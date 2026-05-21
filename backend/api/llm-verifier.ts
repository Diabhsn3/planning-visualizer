/**
 * Verification Agent — the `unvis` function.
 *
 *   image, domain schema, object list  →  set of PDDL ground predicates (s')
 *
 * Everything else (TP/FP/FN, precision, recall, aggregation) is pure set
 * arithmetic in verifier-metrics.ts. This file is the only LLM surface.
 *
 * Output protocol: the model writes a final code_execution cell that
 * prints exactly one line:
 *   PREDICATES_JSON: ["(on b1 b2)", "(ontable b3)", ...]
 *
 * The backend parses that line. If parsing fails, we return
 * `{ predicates: [], parseFailure: true }` so calibration / eval surfaces
 * the issue rather than silently scoring 0.
 */

import Anthropic from "@anthropic-ai/sdk";
import crypto from "crypto";
import { runClaudeAgentLoop } from "./llm-claude-kernel";

const MODEL_ID = "claude-sonnet-4-5"; // Vision-capable Claude.
const MAX_TOKENS = 4096;
const TEMPERATURE = 0.0; // Maximally deterministic — same image → same s'.
const TIMEOUT_MS = 60_000;

/**
 * Bump this when the prompt semantics change so cached extractions get
 * invalidated. Read by verifier-storage when building cache keys.
 */
export const EXTRACTOR_VERSION = "unvis-v1";

export interface PredicateSchemaEntry {
  name: string;
  arg_types: string[];
}

export interface PddlObject {
  name: string;
  type: string;
}

export interface ExtractPredicatesInput {
  /** Raw base64 (no `data:image/png;base64,` prefix). */
  pngBase64: string;
  domainName: string;
  predicateSchema: PredicateSchemaEntry[];
  objects: PddlObject[];
}

export interface ExtractPredicatesResult {
  predicates: string[];
  parseFailure: boolean;
  /** Joined text blocks from the final response — kept for debugging. */
  rawText: string;
  modelId: string;
  extractorVersion: string;
}

function buildSystemPrompt(): string {
  return `You are the "unvisualizer" for a PDDL planning domain.

Your single job: look at the image, identify every ground predicate that
holds in the depicted state, and emit them as a JSON array.

Output protocol — FOLLOW EXACTLY:
- After any analysis you want to do, end your response with ONE line in
  this exact format (no markdown fences, no trailing text):

    PREDICATES_JSON: ["(on b1 b2)", "(ontable b3)", "(clear b1)", "(handempty)"]

- Each predicate is a PDDL S-expression: (name arg1 arg2 ...) for
  multi-argument predicates, or (name) for nullary predicates.
- Lowercase everything. No internal whitespace beyond single spaces.
- Use predicate names from PREDICATE SIGNATURES verbatim.
- Use object identifiers from OBJECTS verbatim, EVEN IF the image shows
  different visual labels (e.g. "Block A" — map positionally to b1).
- If something is genuinely ambiguous from the image, OMIT it. We prefer
  False Negatives over False Positives.
- Do NOT emit predicates whose names are not in PREDICATE SIGNATURES.

Do not call any tools. Emit your final answer as plain text.`;
}

function buildUserText(input: ExtractPredicatesInput): string {
  const sigLines = input.predicateSchema
    .map((s) => `  (${s.name}${s.arg_types.length > 0 ? " " + s.arg_types.map((t) => `?x:${t}`).join(" ") : ""})`)
    .join("\n");
  const objLines = input.objects
    .map((o) => `  ${o.name} : ${o.type}`)
    .join("\n");
  return `DOMAIN: ${input.domainName}

PREDICATE SIGNATURES:
${sigLines || "  (none provided)"}

OBJECTS IN THIS PROBLEM:
${objLines || "  (none provided)"}

Now extract the predicate set from the attached image and print it in the
required PREDICATES_JSON format.`;
}

/**
 * Find the matching `]` for a `[` at position `start`. Returns the
 * inclusive end index, or -1 if no balanced match found. Quote-aware so
 * brackets inside strings don't confuse it.
 */
function findClosingBracket(text: string, start: number): number {
  if (text[start] !== "[") return -1;
  let depth = 0;
  let inString = false;
  let stringChar = "";
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (inString) {
      if (c === "\\") escaped = true;
      else if (c === stringChar) inString = false;
      continue;
    }
    if (c === '"' || c === "'") {
      inString = true;
      stringChar = c;
      continue;
    }
    if (c === "[") depth++;
    else if (c === "]") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function tryParseArrayOfStrings(raw: string): string[] | null {
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed.filter((p): p is string => typeof p === "string");
  } catch {
    return null;
  }
}

/**
 * Extract predicates from the model's free-form output.
 *
 * Tries, in order:
 *   1. `PREDICATES_JSON: [...]` marker, with a quote- and depth-aware
 *      bracket walker so multi-line arrays parse cleanly.
 *   2. Any standalone JSON array of strings — handles cases where the
 *      model emitted just the array without the marker.
 *
 * Last successful match wins (model may print progress arrays before the
 * final one).
 */
function parsePredicatesJsonLine(text: string): string[] | null {
  // 1. Look for PREDICATES_JSON: <array>. Take the LAST occurrence.
  const markerRe = /PREDICATES_JSON\s*:?\s*/gi;
  let m: RegExpExecArray | null;
  let lastFromMarker: string[] | null = null;
  while ((m = markerRe.exec(text)) !== null) {
    // Skip whitespace / code-fences after the marker until we find a [.
    let i = m.index + m[0].length;
    while (i < text.length && text[i] !== "[") i++;
    if (i >= text.length) continue;
    const end = findClosingBracket(text, i);
    if (end === -1) continue;
    const slice = text.slice(i, end + 1);
    const parsed = tryParseArrayOfStrings(slice);
    if (parsed) lastFromMarker = parsed;
  }
  if (lastFromMarker) return lastFromMarker;

  // 2. Fallback: pick the last bracket-balanced JSON array of strings
  // anywhere in the text. This catches cases where the model dropped the
  // marker or wrote the array inside a code fence.
  let lastFallback: string[] | null = null;
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== "[") continue;
    const end = findClosingBracket(text, i);
    if (end === -1) continue;
    const slice = text.slice(i, end + 1);
    const parsed = tryParseArrayOfStrings(slice);
    // Only accept if every entry looks like an S-expression predicate.
    if (parsed && parsed.length > 0 && parsed.every((p) => /^\s*\(/.test(p))) {
      lastFallback = parsed;
    }
    i = end; // Skip past the bracket we just examined.
  }
  return lastFallback;
}

export function hashImage(pngBase64: string): string {
  return crypto.createHash("sha256").update(pngBase64).digest("hex");
}

export async function extractPredicates(
  input: ExtractPredicatesInput
): Promise<ExtractPredicatesResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }
  const client = new Anthropic({ apiKey });

  const systemBlocks = [
    {
      type: "text" as const,
      text: buildSystemPrompt(),
      cache_control: { type: "ephemeral" as const },
    },
  ];
  const initialMessages = [
    {
      role: "user" as const,
      content: [
        {
          type: "image" as const,
          source: {
            type: "base64" as const,
            media_type: "image/png" as const,
            data: input.pngBase64,
          },
        },
        {
          type: "text" as const,
          text: buildUserText(input),
        },
      ],
    },
  ];

  console.log(
    `[Verifier] Calling ${MODEL_ID} for domain="${input.domainName}", ` +
    `${input.predicateSchema.length} predicate types, ` +
    `${input.objects.length} objects, image=${input.pngBase64.length}b64`
  );

  // No tools — the model just emits a text response ending with the
  // PREDICATES_JSON line. Code execution was tried earlier but caused
  // `tool_choice: "none"` on the final-retry to cut the model off
  // before it wrote the answer.
  const response = await runClaudeAgentLoop({
    client,
    modelId: MODEL_ID,
    maxTokens: MAX_TOKENS,
    temperature: TEMPERATURE,
    timeoutMs: TIMEOUT_MS,
    logTag: "[Verifier]",
    systemBlocks,
    initialMessages,
    betas: [],
    tools: [],
    maxPauseTurns: 0,
  });

  // Concatenate all text blocks AND code_execution stdout outputs — the
  // PREDICATES_JSON: line lives in one of them. The Anthropic SDK shapes
  // code_execution_tool_result.content in a couple of ways depending on
  // the request — handle them all defensively.
  const textParts: string[] = [];
  for (const block of response.content as any[]) {
    if (block.type === "text") {
      textParts.push(block.text);
    } else if (block.type === "code_execution_tool_result") {
      const c = block.content;
      if (typeof c === "string") {
        textParts.push(c);
      } else if (c && typeof c === "object") {
        // { type: "code_execution_result", stdout, stderr } shape.
        if (typeof c.stdout === "string") textParts.push(c.stdout);
        if (typeof c.stderr === "string" && c.stderr) textParts.push(c.stderr);
        // Array-of-blocks shape.
        if (Array.isArray(c)) {
          for (const item of c) {
            if (typeof item?.text === "string") textParts.push(item.text);
          }
        }
        if (Array.isArray(c.content)) {
          for (const item of c.content) {
            if (typeof item?.text === "string") textParts.push(item.text);
          }
        }
      }
    }
  }
  const rawText = textParts.join("\n");

  const parsed = parsePredicatesJsonLine(rawText);
  if (parsed === null) {
    console.warn(
      "[Verifier] Failed to parse predicates. Raw model output (first 500 chars):\n" +
      rawText.slice(0, 500) +
      (rawText.length > 500 ? `\n…[+${rawText.length - 500} more chars]` : "")
    );
    return {
      predicates: [],
      parseFailure: true,
      rawText,
      modelId: MODEL_ID,
      extractorVersion: EXTRACTOR_VERSION,
    };
  }

  console.log(`[Verifier] Extracted ${parsed.length} predicates.`);
  return {
    predicates: parsed,
    parseFailure: false,
    rawText,
    modelId: MODEL_ID,
    extractorVersion: EXTRACTOR_VERSION,
  };
}
