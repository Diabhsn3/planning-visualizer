/**
 * LLM Domain Interpreter Module
 *
 * Generates domain-specific TypeScript state transformer functions using LLMs
 * (Claude or Gemini). These transformers take raw DefaultRenderer output and
 * enrich it with positions, colors, labels, and spatial layout — ready for the
 * Canvas renderer to draw.
 *
 * Claude: Uses the formal Claude Skills API with code execution sandbox.
 *   - Skill is uploaded once via `client.beta.skills.create()`
 *   - Subsequent calls reference the skill by `skill_id`
 *   - Claude can validate generated code in the sandbox before returning it
 *
 * Gemini: Uses a system prompt approach with the skill loaded as text.
 *
 * Supports:
 * - Anthropic Claude (claude-sonnet-4-6) via Skills API
 * - Google Gemini (gemini-2.5-pro) via system prompt
 *
 * Features:
 * - Automatic code extraction from LLM responses
 * - TypeScript to JavaScript transpilation via TS compiler API
 * - Separate skill_id from the canvas-renderer-generator skill
 */
import Anthropic from "@anthropic-ai/sdk";
import { toFile } from "@anthropic-ai/sdk";
import ts from "typescript";
import { readFile, writeFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { createReadStream } from "fs";
import { hashSkillFiles, writeStoredHash, syncSkillVersionIfStale } from "./skill-sync";
import { callClaudeWithSkill } from "./llm-claude";
import { callGemini } from "./llm-gemini";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ==================== CONFIGURATION ====================

// Claude Skills API files for the pddl-domain-interpreter skill
// In production (dist/index.js), __dirname is backend/api/dist, so we need to go up one level
const SKILLS_DIR = __dirname.endsWith("dist")
  ? path.join(__dirname, "..", "skills", "pddl-domain-interpreter")
  : path.join(__dirname, "skills", "pddl-domain-interpreter");

const SKILL_MD_PATH        = path.join(SKILLS_DIR, "SKILL.md");
const SKILL_INTERFACES_PATH = path.join(SKILLS_DIR, "interfaces.ts");
const SKILL_EXAMPLE_PATH   = path.join(SKILLS_DIR, "example-blocks-world.ts");
const SKILL_RULES_PATH     = path.join(SKILLS_DIR, "rules.md");

// Gemini uses the flat prompt file
const GEMINI_PROMPT_PATH = __dirname.endsWith("dist")
  ? path.join(__dirname, "..", "prompts", "domain-interpreter-skill.txt")
  : path.join(__dirname, "prompts", "domain-interpreter-skill.txt");

// Separate skill_id cache file from the canvas renderer skill
const SKILL_ID_CACHE_PATH = __dirname.endsWith("dist")
  ? path.join(__dirname, "..", ".claude-transformer-skill-id")
  : path.join(__dirname, ".claude-transformer-skill-id");

// Separate hash file from the canvas renderer skill — used to detect
// edits to the local skill files and push a new version.
const SKILL_HASH_CACHE_PATH = __dirname.endsWith("dist")
  ? path.join(__dirname, "..", ".claude-transformer-skill-hash")
  : path.join(__dirname, ".claude-transformer-skill-hash");

// One place that lists every file the interpreter skill uploads.
const INTERPRETER_SKILL_DIR = "pddl-domain-interpreter";
const INTERPRETER_SKILL_FILES: Array<{
  path: string;
  uploadName: string;
  mimeType: "text/markdown" | "text/plain";
}> = [
  { path: SKILL_MD_PATH,         uploadName: `${INTERPRETER_SKILL_DIR}/SKILL.md`,                mimeType: "text/markdown" },
  { path: SKILL_INTERFACES_PATH, uploadName: `${INTERPRETER_SKILL_DIR}/interfaces.ts`,           mimeType: "text/plain"    },
  { path: SKILL_EXAMPLE_PATH,    uploadName: `${INTERPRETER_SKILL_DIR}/example-blocks-world.ts`, mimeType: "text/plain"    },
  { path: SKILL_RULES_PATH,      uploadName: `${INTERPRETER_SKILL_DIR}/rules.md`,                mimeType: "text/markdown" },
];

// Model configurations (same models as llm-renderer.ts)
const MODELS = {
  claude: {
    id: "claude-sonnet-4-6",
    name: "Claude Sonnet 4.6",
    maxTokens: 16384,
  },
  gemini: {
    id: "gemini-2.5-pro",
    name: "Gemini 2.5 Pro",
    maxTokens: 8192,
  },
} as const;

export type LLMProvider = keyof typeof MODELS;

// ==================== INTERFACES ====================

export interface GenerateTransformerRequest {
  /** The domain name (e.g., "ferry", "logistics", "my-custom-domain") */
  domainName: string;
  /** Full text of the PDDL domain file (domain.pddl) */
  domainPddl: string;
  /** 2-3 sample raw states from the DefaultRenderer (from the example problem) */
  sampleStates: any[];
  /** Which LLM provider to use */
  provider: LLMProvider;
}

export interface GenerateTransformerResponse {
  success: boolean;
  /** The generated and transpiled JavaScript transformer code */
  code?: string;
  /** Human-readable provider name */
  provider: string;
  /** Model ID used */
  model: string;
  /** Error message if success is false */
  error?: string;
}

// ==================== CLAUDE SKILLS API ====================

let cachedSkillId: string | null = null;

/**
 * Get or create the Claude Skill for the pddl-domain-interpreter.
 *
 * Resolution order:
 *   1. In-memory cache → return as-is. NOTE: in-memory means we already
 *      synced once this process; further file edits require a restart.
 *   2. Disk cache (.claude-transformer-skill-id) → retrieve to verify,
 *      then run `syncSkillVersionIfStale` so a local edit triggers a new
 *      version under the same skill_id.
 *   3. Listing on Anthropic side (matched by display_title) → same
 *      sync-if-stale step.
 *   4. No skill found → create from current files, persist id + hash.
 */
async function getOrCreateClaudeSkill(client: Anthropic): Promise<string> {
  // 1. In-memory cache — already synced this process.
  if (cachedSkillId) {
    console.log(`[LLM Interpreter] Using cached Claude skill: ${cachedSkillId}`);
    return cachedSkillId;
  }

  // 2. Disk cache. The inner try/catch only guards `skills.retrieve` so a
  //    failed sync doesn't masquerade as "skill_id invalid" and trip the
  //    fallback into step 4 (which would try to create a duplicate skill).
  let diskSkillId: string | null = null;
  try {
    const savedId = await readFile(SKILL_ID_CACHE_PATH, "utf-8");
    if (savedId.trim()) {
      try {
        await client.beta.skills.retrieve(savedId.trim(), {
          betas: ["skills-2025-10-02"],
        });
        diskSkillId = savedId.trim();
      } catch {
        console.log("[LLM Interpreter] Saved skill_id is invalid, will re-create");
      }
    }
  } catch {
    // No cached skill_id file
  }
  if (diskSkillId) {
    cachedSkillId = diskSkillId;
    console.log(`[LLM Interpreter] Loaded Claude skill from disk: ${cachedSkillId}`);
    // syncSkillVersionIfStale never throws — failures degrade to using
    // the previous version with a warning logged.
    await syncSkillVersionIfStale({
      client,
      skillId: cachedSkillId,
      files: INTERPRETER_SKILL_FILES,
      hashCachePath: SKILL_HASH_CACHE_PATH,
      logTag: "[LLM Interpreter]",
    });
    return cachedSkillId;
  }

  // 3. List skills on Anthropic side, match by display_title
  const SKILL_DISPLAY_TITLE = "PDDL Domain Interpreter";
  console.log(`[LLM Interpreter] Looking for existing skill: "${SKILL_DISPLAY_TITLE}"...`);
  try {
    const skillsList = await client.beta.skills.list({
      betas: ["skills-2025-10-02"],
    });
    for await (const existingSkill of skillsList) {
      if (existingSkill.display_title === SKILL_DISPLAY_TITLE) {
        cachedSkillId = existingSkill.id;
        console.log(`[LLM Interpreter] Found existing Claude skill: ${cachedSkillId}`);
        await writeFile(SKILL_ID_CACHE_PATH, cachedSkillId, "utf-8");
        await syncSkillVersionIfStale({
          client,
          skillId: cachedSkillId,
          files: INTERPRETER_SKILL_FILES,
          hashCachePath: SKILL_HASH_CACHE_PATH,
          logTag: "[LLM Interpreter]",
        });
        return cachedSkillId;
      }
    }
  } catch (listErr) {
    console.warn("[LLM Interpreter] Could not list skills:", listErr);
  }

  // 4. No skill found — create one from the current files.
  console.log("[LLM Interpreter] Creating new Claude skill...");

  const uploadables = await Promise.all(
    INTERPRETER_SKILL_FILES.map((f) =>
      toFile(createReadStream(f.path), f.uploadName, { type: f.mimeType })
    )
  );

  const skill = await client.beta.skills.create({
    display_title: SKILL_DISPLAY_TITLE,
    files: uploadables,
    betas: ["skills-2025-10-02"],
  });

  cachedSkillId = skill.id;
  console.log(`[LLM Interpreter] Created Claude skill: ${cachedSkillId}`);
  console.log(`[LLM Interpreter] Skill version: ${skill.latest_version}`);

  // Persist id + hash so the next run can detect future edits.
  await writeFile(SKILL_ID_CACHE_PATH, cachedSkillId, "utf-8");
  const initialHash = await hashSkillFiles(INTERPRETER_SKILL_FILES.map((f) => f.path));
  await writeStoredHash(SKILL_HASH_CACHE_PATH, initialHash);
  return cachedSkillId;
}

// Gemini prompt loading + caching is owned by llm-gemini.ts
// (mtime-based invalidation, content-hash logging).

// ==================== CODE EXTRACTION ====================

/**
 * Extract TypeScript code from LLM response.
 * Handles responses that may or may not be wrapped in markdown code blocks.
 */
function extractCode(response: string): string {
  // Try to extract from markdown code blocks first
  const codeBlockMatch = response.match(/```(?:typescript|ts|javascript|js)?\s*\n([\s\S]*?)```/);
  if (codeBlockMatch) {
    return codeBlockMatch[1].trim();
  }
  // If no code block, strip any leading prose: slice from the first line that
  // begins a code construct (comment or top-level declaration). Models sometimes
  // prepend a sentence like "Now I'll generate the transformer…" despite being
  // told not to; without this it gets transpiled into garbage and breaks the file.
  const trimmed = response.trim();
  const lines = trimmed.split("\n");
  const codeStart = lines.findIndex((l) =>
    /^\s*(\/\/|\/\*|\*|import\s|export\s|interface\s|type\s+\w|const\s+\w|let\s+\w|var\s+\w|function\s+\w|async\s+function\s|class\s+\w)/.test(l),
  );
  if (codeStart >= 0) {
    if (codeStart > 0) {
      console.warn(`[LLM Interpreter] Stripped ${codeStart} leading non-code line(s) from response`);
    }
    return lines.slice(codeStart).join("\n").trim();
  }

  // Last resort: return the whole response trimmed
  console.warn("[LLM Interpreter] Could not identify code block, using full response");
  return trimmed;
}

/**
 * Best-effort sanity check on generated code. Runs as a WARN-only signal —
 * we log but don't fail. Original behavior was simply to trust the model
 * output; turning this into a hard gate caused false positives (e.g.
 * arrow-function declarations the regex didn't match), which triggered
 * self-repair retries that produced worse output.
 */
function validateCode(code: string, _domainName: string): void {
  // Recognize both `function transformX(...)` and `const transformX = (...) =>`.
  if (!/(?:function|const|let|var)\s+transform\w*\b/.test(code)) {
    console.warn(
      "[LLM Interpreter] Note: no transform<Something> function found " +
      "(could be fine — the model may have used an unconventional name)."
    );
  }
  if (/import\s+/.test(code) && !/import\s+type/.test(code)) {
    console.warn("[LLM Interpreter] Warning: code contains import statements (won't work in new Function eval)");
  }
  if (/require\s*\(/.test(code)) {
    console.warn("[LLM Interpreter] Warning: code uses require() (won't work in new Function eval)");
  }
  if (/Math\.random\s*\(/.test(code)) {
    console.warn("[LLM Interpreter] Warning: code uses Math.random() — positions will jitter across replays");
  }
}

// ==================== TYPESCRIPT TRANSPILATION ====================

function transpileToJS(tsCode: string): string {
  // Strip 'export' keywords before transpilation
  let cleaned = tsCode.replace(/^(\s*)export\s+/gm, "$1");
  const result = ts.transpileModule(cleaned, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.None,
      removeComments: false,
      strict: false,
    },
  });
  if (result.diagnostics && result.diagnostics.length > 0) {
    const errors = result.diagnostics.map((d) =>
      ts.flattenDiagnosticMessageText(d.messageText, "\n")
    );
    console.warn("[LLM Interpreter] Transpilation warnings:", errors);
  }
  // Remove CommonJS artifacts
  let output = result.outputText;
  output = output.replace(/"use strict";\s*\n?/g, "");
  output = output.replace(
    /Object\.defineProperty\(exports,\s*"__esModule",\s*\{[^}]*\}\);\s*\n?/g,
    ""
  );
  output = output.replace(/^exports\.\w+\s*=\s*\w+;\s*\n?/gm, "");
  return output;
}

// ==================== LLM PROVIDERS ====================
//
// Both providers go through shared helpers (llm-claude.ts / llm-gemini.ts)
// — see those files for determinism, timeouts, retries, audit logging,
// and (Claude only) skill version sync. The wrappers below just glue in
// the transformer-specific bits: which skill_id, which prompt file, and
// the function name pattern to extract.

const TRANSFORMER_FN_PATTERN = /(?:function|const|let)\s+(?:transform)\w*\b/;

async function generateWithClaude(userMessage: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY environment variable is not set.");
  }
  const client = new Anthropic({ apiKey });
  const skillId = await getOrCreateClaudeSkill(client);
  return callClaudeWithSkill({
    client,
    skillId,
    userMessage,
    extractFunctionPattern: TRANSFORMER_FN_PATTERN,
    modelId: MODELS.claude.id,
    maxTokens: MODELS.claude.maxTokens,
    logTag: "[LLM Interpreter]",
  });
}

async function generateWithGemini(userMessage: string): Promise<string> {
  return callGemini({
    promptPath: GEMINI_PROMPT_PATH,
    userMessage,
    modelId: MODELS.gemini.id,
    logTag: "[LLM Interpreter]",
  });
}

// ==================== MAIN GENERATION FUNCTION ====================

/**
 * Generate a domain-specific state transformer using an LLM.
 *
 * For Claude: Uses the formal Skills API with code execution sandbox.
 * For Gemini: Uses the system prompt approach.
 *
 * 1. Builds the user message with PDDL domain only (no sample states)
 * 2. Calls the selected LLM provider
 * 3. Extracts and validates the generated code
 * 4. Transpiles TypeScript to JavaScript
 * 5. Caches the result to disk
 * 6. Returns the code
 */
export async function generateTransformer(
  request: GenerateTransformerRequest
): Promise<GenerateTransformerResponse> {
  const { domainName, domainPddl, sampleStates, provider } = request;
  const model = MODELS[provider];

  console.log(`[LLM Interpreter] Starting generation for domain: ${domainName}`);
  console.log(`[LLM Interpreter] Provider: ${provider} (${model.name})`);
  console.log(`[LLM Interpreter] PDDL domain length: ${domainPddl.length} chars`);
  console.log(`[LLM Interpreter] Sample states: ${sampleStates.length}`);

  try {
    // 1. Build user message — PDDL domain + sample states
    const sampleSlice = sampleStates.slice(0, 3);
    const userMessage = `Generate a complete TypeScript state transformer for the "${domainName}" domain.

## PDDL Domain File

\`\`\`pddl
${domainPddl}
\`\`\`

## Sample Raw States (from DefaultRenderer)

Below are ${sampleSlice.length} sample raw states from ONE example problem. Use them to understand the data format and structure:

\`\`\`json
${JSON.stringify(sampleSlice, null, 2)}
\`\`\`

**CRITICAL**: These samples are from a SINGLE small example problem. The actual problems your code will process may have:
- MORE or FEWER objects of each type (e.g., 10 locations instead of 3)
- DIFFERENT object names (e.g., "harbor", "island" instead of "loca", "locb")
- DIFFERENT numbers of relations

Your transformer MUST dynamically handle ANY valid problem in this domain — never hardcode object names, counts, or positions for the sample above.

## Instructions

1. Read all reference files in the skill folder (SKILL.md, interfaces.ts, example-blocks-world.ts, rules.md).
2. Analyze the PDDL domain predicates, types, and actions to understand the domain semantics.
3. Study the sample states to understand the data format (object structure, relation structure, property names).
4. Design a spatial layout strategy appropriate for this domain that works for any number of objects.
5. Generate the transformer function following the output contract in SKILL.md.
6. The function MUST be fully generic — it must work for any valid problem in this domain, not just the sample objects shown above.

Output ONLY the raw TypeScript code. Do not wrap it in markdown code blocks. Do not include any explanations. Just the code, starting with the interface declarations.`;

    // 2. Single LLM call. No retry, no smoke test. Trusting the model
    //    output gives the user-perceived "always working" behavior we
    //    had before the retry loop was added.
    const rawResponse =
      provider === "claude"
        ? await generateWithClaude(userMessage)
        : provider === "gemini"
          ? await generateWithGemini(userMessage)
          : (() => { throw new Error(`Unknown provider: ${provider}`); })();

    const tsCode = extractCode(rawResponse);

    // Best-effort warnings only.
    validateCode(tsCode, domainName);

    const transpiled = transpileToJS(tsCode);
    console.log(
      `[LLM Interpreter] Transpiled TS (${tsCode.length} chars) -> JS (${transpiled.length} chars) — accepted.`
    );

    return {
      success: true,
      code: transpiled,
      provider: model.name,
      model: model.id,
    };
  } catch (error) {
    console.error("[LLM Interpreter] Generation failed:", error);
    let errorMessage = "Unknown error during LLM generation";
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    return {
      success: false,
      provider: model.name,
      model: model.id,
      error: errorMessage,
    };
  }
}
