/**
 * Strict validator for LLM-generated Canvas renderer code.
 *
 * Enforces the three required exports defined in prompts/renderer-skill.txt:
 *
 *   1. render<DomainName>(ctx, state, width, height)            — main renderer
 *   2. render<DomainName>Background(ctx, width, height)         — background renderer
 *   3. render<DomainName>Legend(ctx, x, y) OR = undefined       — legend renderer
 *
 * Used by:
 *   - Unit tests (__tests__/unit/renderer-validator.test.ts)
 *   - The renderer pipeline (when REQUIRE_STRICT_RENDERER=1)
 *   - The error-surfacing audit (proves a bad LLM output produces a clear error)
 *
 * Returns a structured result so callers can surface a *specific* message
 * to the user — never a silent failure.
 */

export interface RendererValidationIssue {
  export: "main" | "background" | "legend";
  reason: string;
}

export interface RendererValidationResult {
  ok: boolean;
  domainCamel: string;
  mainExportName: string;
  backgroundExportName: string;
  legendExportName: string;
  issues: RendererValidationIssue[];
}

/**
 * Convert a domain id like "blocks-world" or "blocks_world" into the
 * CamelCase form used in renderer function names: "BlocksWorld".
 */
export function toCamelCase(domainName: string): string {
  return domainName
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1).toLowerCase())
    .join("");
}

/**
 * Looks for an exported declaration with the given name. Matches:
 *   export function foo(...)
 *   export const foo = (...) => ...
 *   export const foo = function (...) ...
 *   export const foo = undefined            (legend-only escape hatch)
 *   export { foo, bar }
 */
function findExport(code: string, name: string): { found: boolean; isUndefined: boolean } {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  const undefinedPattern = new RegExp(
    `export\\s+const\\s+${escaped}\\s*=\\s*undefined\\b`
  );
  if (undefinedPattern.test(code)) {
    return { found: true, isUndefined: true };
  }

  const declPattern = new RegExp(
    `export\\s+(?:async\\s+)?(?:function|const|let|var)\\s+${escaped}\\b`
  );
  if (declPattern.test(code)) {
    return { found: true, isUndefined: false };
  }

  const reExportPattern = new RegExp(
    `export\\s*\\{[^}]*\\b${escaped}\\b[^}]*\\}`
  );
  if (reExportPattern.test(code)) {
    return { found: true, isUndefined: false };
  }

  return { found: false, isUndefined: false };
}

export function validateRendererExports(
  code: string,
  domainName: string
): RendererValidationResult {
  const domainCamel = toCamelCase(domainName);
  const mainExportName = `render${domainCamel}`;
  const backgroundExportName = `render${domainCamel}Background`;
  const legendExportName = `render${domainCamel}Legend`;

  const issues: RendererValidationIssue[] = [];

  const main = findExport(code, mainExportName);
  if (!main.found) {
    issues.push({
      export: "main",
      reason: `Missing required export \`${mainExportName}\`. The renderer must export a function with this exact name.`,
    });
  } else if (main.isUndefined) {
    issues.push({
      export: "main",
      reason: `Main renderer \`${mainExportName}\` is exported as \`undefined\`. It must be a function.`,
    });
  }

  const background = findExport(code, backgroundExportName);
  if (!background.found) {
    issues.push({
      export: "background",
      reason: `Missing required export \`${backgroundExportName}\`. The renderer must export a background drawing function with this exact name.`,
    });
  } else if (background.isUndefined) {
    issues.push({
      export: "background",
      reason: `Background renderer \`${backgroundExportName}\` is exported as \`undefined\`. It must be a function.`,
    });
  }

  const legend = findExport(code, legendExportName);
  if (!legend.found) {
    issues.push({
      export: "legend",
      reason: `Missing required export \`${legendExportName}\`. Export it as a function or as \`undefined\`.`,
    });
  }

  return {
    ok: issues.length === 0,
    domainCamel,
    mainExportName,
    backgroundExportName,
    legendExportName,
    issues,
  };
}

/**
 * Convenience that throws with a user-visible, structured error message
 * listing every missing export. Use when you want hard-gating behavior
 * (e.g., the visualizer API after generation).
 */
export class RendererValidationError extends Error {
  readonly result: RendererValidationResult;
  constructor(result: RendererValidationResult) {
    const detail = result.issues.map((i) => `  - [${i.export}] ${i.reason}`).join("\n");
    super(
      `Generated renderer for "${result.domainCamel}" failed validation. ` +
        `Required exports: ${result.mainExportName}, ${result.backgroundExportName}, ${result.legendExportName}.\n${detail}`
    );
    this.name = "RendererValidationError";
    this.result = result;
  }
}

export function assertRendererExports(code: string, domainName: string): RendererValidationResult {
  const result = validateRendererExports(code, domainName);
  if (!result.ok) {
    throw new RendererValidationError(result);
  }
  return result;
}
