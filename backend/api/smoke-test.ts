/**
 * Backend smoke tests for LLM-generated transformer / renderer code.
 *
 * Pattern A: instead of paying for Claude's `code_execution` tool to
 * sandbox-test the generated code, we run it ourselves on the backend
 * against a real sample state from the planner output. This catches:
 *
 *   - Syntax errors (transpile already covers the obvious ones, but
 *     `new Function(...)` will trip on subtler cases like a missing brace
 *     deep in a generator).
 *   - Crashes when called with the actual first state (TypeError on a
 *     missing field, undefined dereferences, infinite loops cut by a
 *     watchdog).
 *   - Wrong output shape from the transformer (e.g. forgot to return
 *     `relations`, returned a string instead of an object).
 *
 * If the smoke test throws, the calling generation pipeline does ONE
 * self-repair retry: re-prompt the model with the broken code + the
 * exact error, then run the smoke test again. Two attempts max — total
 * worst-case cost stays bounded.
 */

/**
 * Build a Proxy that quacks like a Canvas2D context but does nothing.
 * Any property write succeeds (so `ctx.fillStyle = "..."` works); any
 * method call returns undefined. Good enough for the renderer's smoke
 * test — we only care that the function runs without throwing.
 */
export function makeMockCanvasContext(): any {
  const target: Record<string | symbol, unknown> = {};
  const noop = () => undefined;
  const handler: ProxyHandler<typeof target> = {
    get(t, prop) {
      if (prop in t) return t[prop];
      // Numeric/string properties Canvas defines (lineWidth, font, ...)
      // default to undefined; methods become no-ops.
      return noop;
    },
    set(t, prop, value) {
      t[prop] = value;
      return true;
    },
  };
  return new Proxy(target, handler);
}

/**
 * Instantiate a function from a JS code string and return the first
 * top-level function whose name matches `namePattern`. Mirrors what
 * StateCanvas does in the browser, just on the server.
 */
function instantiateNamedFunction(
  jsCode: string,
  namePattern: RegExp
): Function {
  // Find every top-level identifier we should try to expose.
  const declRegex = /(?:function|const|let|var)\s+(\w+)/g;
  const names = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = declRegex.exec(jsCode)) !== null) {
    names.add(m[1]);
  }
  if (names.size === 0) {
    throw new Error("No top-level declarations found in generated code");
  }

  const exportLines = Array.from(names)
    .map((n) => `try { __exports[${JSON.stringify(n)}] = ${n}; } catch (_) {}`)
    .join("\n");

  const wrapped = `
    ${jsCode}
    const __exports = {};
    ${exportLines}
    return __exports;
  `;

  let exports: Record<string, unknown>;
  try {
    // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
    exports = new Function(wrapped)() as Record<string, unknown>;
  } catch (e) {
    throw new Error(
      `Generated code is not parseable: ${e instanceof Error ? e.message : String(e)}`
    );
  }

  for (const name of Object.keys(exports)) {
    if (namePattern.test(name) && typeof exports[name] === "function") {
      return exports[name] as Function;
    }
  }
  throw new Error(
    `No exported function matched ${namePattern} (saw: ${Object.keys(exports).join(", ") || "<none>"})`
  );
}

/**
 * Validate the shape of a transformer's output (an enriched state).
 * Throws with a specific reason if something is missing/wrong.
 */
function assertEnrichedState(value: unknown): void {
  if (value == null || typeof value !== "object") {
    throw new Error(`transform() returned non-object: ${typeof value}`);
  }
  const v = value as Record<string, unknown>;
  if (!Array.isArray(v.objects)) {
    throw new Error(
      "transform() output is missing `objects` array (or it's not an array)"
    );
  }
  if (!Array.isArray(v.relations)) {
    throw new Error(
      "transform() output is missing `relations` array (or it's not an array)"
    );
  }
  // Spot-check the first object — they should all have id, type, position.
  if (v.objects.length > 0) {
    const o = v.objects[0] as any;
    if (typeof o?.id !== "string") {
      throw new Error("transform() output objects[0].id is not a string");
    }
    if (typeof o?.type !== "string") {
      throw new Error("transform() output objects[0].type is not a string");
    }
    if (
      o.position !== undefined &&
      (!Array.isArray(o.position) ||
        o.position.length !== 2 ||
        !Number.isFinite(o.position[0]) ||
        !Number.isFinite(o.position[1]))
    ) {
      throw new Error(
        `transform() output objects[0].position is malformed (expected [number, number]): ${JSON.stringify(o.position)}`
      );
    }
  }
}

/**
 * Smoke-test a transformer:
 *   1. Parse and instantiate the `transform*` function.
 *   2. Call it with the first raw sample state.
 *   3. Validate the output shape.
 * Throws on any failure — caller catches and triggers self-repair.
 */
export function smokeTestTransformer(
  jsCode: string,
  rawSampleState: unknown
): void {
  const fn = instantiateNamedFunction(jsCode, /^transform\w*$/);

  let result: unknown;
  try {
    result = fn(rawSampleState);
  } catch (e) {
    throw new Error(
      `transform() threw on first sample state: ${e instanceof Error ? e.message : String(e)}`
    );
  }

  assertEnrichedState(result);
}

/**
 * Smoke-test a renderer:
 *   1. Parse and instantiate the main `render*` function (skips
 *      render*Background / render*Legend, which are optional).
 *   2. Call it with a mock Canvas2D context and the sample enriched
 *      state.
 *
 * "It didn't throw" is the whole bar — we don't have a real canvas to
 * inspect, but this catches the vast majority of bad generations
 * (undefined dereferences, missing object types, etc.).
 */
export function smokeTestRenderer(
  jsCode: string,
  enrichedSampleState: unknown
): void {
  // Match `render` followed by anything except "Background"/"Legend".
  // The main render function is the one drawing the actual scene.
  const fn = instantiateNamedFunction(
    jsCode,
    /^render(?!.*Background$)(?!.*Legend$)\w*$/
  );

  const ctx = makeMockCanvasContext();
  try {
    fn(ctx, enrichedSampleState);
  } catch (e) {
    throw new Error(
      `render() threw on first sample state: ${e instanceof Error ? e.message : String(e)}`
    );
  }
}

/**
 * Build the second-attempt prompt when the first generation failed a
 * smoke test or static validation. Both the transformer and renderer
 * pipelines use this — the only difference is the `kind` label.
 */
export function buildSelfRepairPrompt(opts: {
  originalUserMessage: string;
  previousCode: string;
  error: Error;
  kind: "transformer" | "renderer";
}): string {
  const { originalUserMessage, previousCode, error, kind } = opts;
  return `${originalUserMessage}

---

## RETRY: previous attempt failed

Your previous response could not be used. Below is the exact code you produced and the exact error encountered when we tried to run it. Fix the problem and return the corrected ${kind} code only — same format as before, no markdown fences, no commentary.

### Previous code
\`\`\`typescript
${previousCode}
\`\`\`

### Error
${error.message}

Return the corrected code now.`;
}
