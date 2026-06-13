/**
 * LLM Renderer Module
 * 
 * Generates domain-specific Canvas rendering code using LLMs (Claude or Gemini).
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
 * - Disk-based caching of generated renderers per domain
 * - Automatic code extraction from LLM responses
 * - TypeScript to JavaScript transpilation via TS compiler API
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

// Claude Skills API files
// In production (dist/index.js), __dirname is backend/api/dist, so we need to go up one level
const SKILLS_DIR = __dirname.endsWith("dist")
  ? path.join(__dirname, "..", "skills", "canvas-renderer-generator")
  : path.join(__dirname, "skills", "canvas-renderer-generator");
const SKILL_MD_PATH = path.join(SKILLS_DIR, "SKILL.md");
const SKILL_INTERFACES_PATH = path.join(SKILLS_DIR, "interfaces.ts");
const SKILL_EXAMPLE_PATH = path.join(SKILLS_DIR, "example-hanoi.ts");
const SKILL_RULES_PATH = path.join(SKILLS_DIR, "rules.md");

// Gemini still uses the flat prompt file
// In production (dist/index.js), __dirname is backend/api/dist, so we need to go up one level
const GEMINI_PROMPT_PATH = __dirname.endsWith("dist") 
  ? path.join(__dirname, "..", "prompts", "renderer-skill.txt")
  : path.join(__dirname, "prompts", "renderer-skill.txt");

// File to persist the skill_id after first upload
const SKILL_ID_CACHE_PATH = __dirname.endsWith("dist")
  ? path.join(__dirname, "..", ".claude-skill-id")
  : path.join(__dirname, ".claude-skill-id");

// File to persist the sha256 of the local skill files. Used to detect
// edits and push a new skill version when they change.
const SKILL_HASH_CACHE_PATH = __dirname.endsWith("dist")
  ? path.join(__dirname, "..", ".claude-skill-hash")
  : path.join(__dirname, ".claude-skill-hash");

// One place that lists every file the renderer skill uploads. Used both
// for the initial create and for syncing new versions.
const RENDERER_SKILL_DIR = "canvas-renderer-generator";
const RENDERER_SKILL_FILES: Array<{
  path: string;
  uploadName: string;
  mimeType: "text/markdown" | "text/plain";
}> = [
  { path: SKILL_MD_PATH,        uploadName: `${RENDERER_SKILL_DIR}/SKILL.md`,         mimeType: "text/markdown" },
  { path: SKILL_INTERFACES_PATH, uploadName: `${RENDERER_SKILL_DIR}/interfaces.ts`,    mimeType: "text/plain"    },
  { path: SKILL_EXAMPLE_PATH,   uploadName: `${RENDERER_SKILL_DIR}/example-hanoi.ts`, mimeType: "text/plain"    },
  { path: SKILL_RULES_PATH,     uploadName: `${RENDERER_SKILL_DIR}/rules.md`,         mimeType: "text/markdown" },
];

// Model configurations
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

export interface GenerateRendererRequest {
  domainName: string;
  /** 2-3 sample enriched states (output of the transformer applied to sample raw states) */
  states: any[];
  /** Full text of the PDDL domain file (domain.pddl) */
  domainPddl: string;
  /** The generated transformer code from Stage 1 — so the renderer knows the enriched state structure */
  transformerCode: string;
  provider: LLMProvider;
}

export interface GenerateRendererResponse {
  success: boolean;
  code?: string;
  provider: string;
  model: string;
  error?: string;
}

// ==================== CLAUDE SKILLS API ====================

let cachedSkillId: string | null = null;

/**
 * Get or create the Claude Skill.
 *
 * Resolution order:
 *   1. In-memory cache → return as-is. NOTE: in-memory means we already
 *      synced once this process; further file edits require a restart.
 *   2. Disk cache (.claude-skill-id) → retrieve to verify, then run
 *      `syncSkillVersionIfStale` so a local edit triggers a new version
 *      under the same skill_id.
 *   3. Listing on Anthropic side (matched by display_title) → same
 *      sync-if-stale step.
 *   4. No skill found → create from current files, persist id + hash.
 */
async function getOrCreateClaudeSkill(client: Anthropic): Promise<string> {
  // 1. In-memory cache — already synced this process.
  if (cachedSkillId) {
    console.log(`[LLM Renderer] Using cached Claude skill: ${cachedSkillId}`);
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
        console.log("[LLM Renderer] Saved skill_id is invalid, will re-create");
      }
    }
  } catch {
    // No cached skill_id file
  }
  if (diskSkillId) {
    cachedSkillId = diskSkillId;
    console.log(`[LLM Renderer] Loaded Claude skill from disk: ${cachedSkillId}`);
    // syncSkillVersionIfStale never throws — failures degrade to using
    // the previous version with a warning logged.
    await syncSkillVersionIfStale({
      client,
      skillId: cachedSkillId,
      files: RENDERER_SKILL_FILES,
      hashCachePath: SKILL_HASH_CACHE_PATH,
      logTag: "[LLM Renderer]",
    });
    return cachedSkillId;
  }

  // 3. List skills on Anthropic side, match by display_title
  const SKILL_DISPLAY_TITLE = "Canvas Renderer Generator";
  console.log(`[LLM Renderer] Looking for existing skill: "${SKILL_DISPLAY_TITLE}"...`);

  try {
    const skillsList = await client.beta.skills.list({
      betas: ["skills-2025-10-02"],
    });

    for await (const existingSkill of skillsList) {
      if (existingSkill.display_title === SKILL_DISPLAY_TITLE) {
        cachedSkillId = existingSkill.id;
        console.log(`[LLM Renderer] Found existing Claude skill: ${cachedSkillId}`);
        await writeFile(SKILL_ID_CACHE_PATH, cachedSkillId, "utf-8");
        await syncSkillVersionIfStale({
          client,
          skillId: cachedSkillId,
          files: RENDERER_SKILL_FILES,
          hashCachePath: SKILL_HASH_CACHE_PATH,
          logTag: "[LLM Renderer]",
        });
        return cachedSkillId;
      }
    }
  } catch (listErr) {
    console.warn("[LLM Renderer] Could not list skills:", listErr);
  }

  // 4. No skill found — create one from the current files.
  console.log("[LLM Renderer] Creating new Claude skill...");

  const uploadables = await Promise.all(
    RENDERER_SKILL_FILES.map((f) =>
      toFile(createReadStream(f.path), f.uploadName, { type: f.mimeType })
    )
  );

  const skill = await client.beta.skills.create({
    display_title: SKILL_DISPLAY_TITLE,
    files: uploadables,
    betas: ["skills-2025-10-02"],
  });

  cachedSkillId = skill.id;
  console.log(`[LLM Renderer] Created Claude skill: ${cachedSkillId}`);
  console.log(`[LLM Renderer] Skill version: ${skill.latest_version}`);

  // Persist id + hash so the next run can detect future edits.
  await writeFile(SKILL_ID_CACHE_PATH, cachedSkillId, "utf-8");
  const initialHash = await hashSkillFiles(RENDERER_SKILL_FILES.map((f) => f.path));
  await writeStoredHash(SKILL_HASH_CACHE_PATH, initialHash);

  return cachedSkillId;
}

// Gemini prompt loading + caching is owned by llm-gemini.ts (mtime-based
// invalidation, content-hash logging) — nothing extra needed here.

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
  // prepend a sentence like "Now I'll generate the renderer…" despite being told
  // not to; without this it gets transpiled into garbage and breaks the file.
  const trimmed = response.trim();
  const lines = trimmed.split("\n");
  const codeStart = lines.findIndex((l) =>
    /^\s*(\/\/|\/\*|\*|import\s|export\s|interface\s|type\s+\w|const\s+\w|let\s+\w|var\s+\w|function\s+\w|async\s+function\s|class\s+\w)/.test(l),
  );
  if (codeStart >= 0) {
    if (codeStart > 0) {
      console.warn(`[LLM Renderer] Stripped ${codeStart} leading non-code line(s) from response`);
    }
    return lines.slice(codeStart).join("\n").trim();
  }

  // Last resort: return the whole response trimmed
  console.warn("[LLM Renderer] Could not identify code block, using full response");
  return trimmed;
}

/**
 * Best-effort sanity check on generated code. Runs as a WARN-only signal —
 * we log but don't fail. The original behavior was simply to trust the
 * model output; turning this into a hard gate caused false positives
 * (e.g. arrow-function declarations that the regex didn't match), which
 * triggered self-repair retries that produced worse output.
 */
function validateCode(code: string, domainName: string): void {
  // Recognize both `function renderX(...)` and `const renderX = (...) =>`.
  if (!/(?:function|const|let|var)\s+render\w*\b/.test(code)) {
    console.warn(
      `[LLM Renderer] Note: no render<Something> function found for ${domainName} ` +
      `(could be fine — the model may have used an unconventional name).`
    );
  }
  if (!/(?:function|const|let|var)\s+\w*[Bb]ackground\b/.test(code)) {
    console.log(`[LLM Renderer] Note: no background function found for ${domainName} (optional)`);
  }
  if (!/(?:function|const|let|var)\s+\w*[Ll]egend\b/.test(code)) {
    console.log(`[LLM Renderer] Note: no legend function found for ${domainName} (optional)`);
  }
  if (/import\s+/.test(code) && !/import\s+type/.test(code)) {
    console.warn(`[LLM Renderer] Warning: code contains import statements (won't work in new Function eval)`);
  }
  if (/new\s+Image\s*\(/.test(code)) {
    console.warn(`[LLM Renderer] Warning: code uses new Image() (external assets not allowed)`);
  }
  if (/require\s*\(/.test(code)) {
    console.warn(`[LLM Renderer] Warning: code uses require() (won't work in new Function eval)`);
  }
}

// ==================== TYPESCRIPT TRANSPILATION ====================

function transpileToJS(tsCode: string): string {
  // Step 1: Strip 'export' keywords before transpilation.
  let cleaned = tsCode.replace(/^(\s*)export\s+/gm, '$1');

  const result = ts.transpileModule(cleaned, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.None,
      removeComments: false,
      strict: false,
    },
  });

  if (result.diagnostics && result.diagnostics.length > 0) {
    const errors = result.diagnostics.map((d) => ts.flattenDiagnosticMessageText(d.messageText, "\n"));
    console.warn("[LLM Renderer] Transpilation warnings:", errors);
  }

  // Step 2: Remove any remaining CommonJS artifacts
  let output = result.outputText;
  output = output.replace(/"use strict";\s*\n?/g, '');
  output = output.replace(/Object\.defineProperty\(exports,\s*"__esModule",\s*\{[^}]*\}\);\s*\n?/g, '');
  output = output.replace(/^exports\.\w+\s*=\s*\w+;\s*\n?/gm, '');

  return output;
}

// ==================== LLM PROVIDERS ====================
//
// Both providers go through shared helpers (llm-claude.ts / llm-gemini.ts)
// that handle determinism, timeouts, retries, audit logging, and (Claude
// only) skill version sync. The two thin wrappers below just glue the
// renderer-specific bits together: which skill_id to use, which prompt
// file Gemini reads, and what function name to extract from the response.

const RENDERER_FN_PATTERN = /(?:function|const|let)\s+(?:render)\w*\b/;

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
    extractFunctionPattern: RENDERER_FN_PATTERN,
    modelId: MODELS.claude.id,
    maxTokens: MODELS.claude.maxTokens,
    logTag: "[LLM Renderer]",
  });
}

async function generateWithGemini(userMessage: string): Promise<string> {
  return callGemini({
    promptPath: GEMINI_PROMPT_PATH,
    userMessage,
    modelId: MODELS.gemini.id,
    logTag: "[LLM Renderer]",
  });
}

// ==================== MAIN GENERATION FUNCTION ====================

/**
 * Generate a domain-specific Canvas renderer using an LLM.
 * 
 * For Claude: Uses the formal Skills API with code execution sandbox.
 * For Gemini: Uses the system prompt approach.
 * 
 * 1. Builds the user message with PDDL domain + transformer code (no sample states)
 * 2. Calls the selected LLM provider
 * 3. Extracts and validates the generated code
 * 4. Transpiles TypeScript to JavaScript
 * 5. Returns the code (persistence is handled by saved-domains.ts → artifacts/)
 */
export async function generateRenderer(
  request: GenerateRendererRequest
): Promise<GenerateRendererResponse> {
  const { domainName, states, domainPddl, transformerCode, provider } = request;
  const model = MODELS[provider];

  console.log(`[LLM Renderer] Starting generation for domain: ${domainName}`);
  console.log(`[LLM Renderer] Provider: ${provider} (${model.name})`);
  console.log(`[LLM Renderer] Sample enriched states: ${states.length}`);
  console.log(`[LLM Renderer] PDDL domain length: ${domainPddl.length} chars`);
  console.log(`[LLM Renderer] Transformer code length: ${transformerCode.length} chars`);

  try {
    // 1. Build user message — sample enriched states + transformer code for context
    const sampleStates = states.slice(0, 3);
    const userMessage = `Generate a complete Canvas renderer for the "${domainName}" domain.

## Sample Enriched States (output of the Stage 1 transformer)

Below are ${sampleStates.length} sample enriched states from ONE example problem. Use them to understand the exact data structure your renderer will receive:

\`\`\`json
${JSON.stringify(sampleStates, null, 2)}
\`\`\`

**CRITICAL**: These samples are from a SINGLE small example problem. The actual problems may have:
- MORE or FEWER objects of each type (e.g., 10 locations instead of 3)
- DIFFERENT object names and labels
- DIFFERENT numbers of relations

Your renderer MUST dynamically handle ANY number of objects — never hardcode positions, colors, or layout for the specific objects shown above.

## Stage 1 Transformer Code (for reference)

The following transformer function produces the enriched states above. Read it to understand the full range of object types, properties, and layout logic:

\`\`\`typescript
${transformerCode}
\`\`\`

Analyze the objects, their types, positions, properties, and the relations between them.
Then generate the three TypeScript functions as specified in the instructions.
The renderer MUST be generic — it must work for any number of objects, not just the specific problem shown above.
Output ONLY the raw TypeScript code. Do not wrap it in markdown code blocks. Do not include any explanations. Just the code.`;

    // 2. Single LLM call. No retry, no smoke test. The prior retry loop
    //    fired on regex pedantry and re-prompted the model into producing
    //    worse output. Trusting the LLM gives the user-perceived "always
    //    working" behavior we had before.
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
      `[LLM Renderer] Transpiled TS (${tsCode.length} chars) -> JS (${transpiled.length} chars) — accepted.`
    );

    return {
      success: true,
      code: transpiled,
      provider: model.name,
      model: model.id,
    };
  } catch (error) {
    console.error("[LLM Renderer] Generation failed:", error);

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
