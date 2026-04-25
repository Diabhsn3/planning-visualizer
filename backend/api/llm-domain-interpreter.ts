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
 * - Disk-based caching of generated transformers per domain
 * - Automatic code extraction from LLM responses
 * - TypeScript to JavaScript transpilation via TS compiler API
 * - Separate cache and skill_id from the canvas-renderer-generator skill
 */
import Anthropic from "@anthropic-ai/sdk";
import { toFile } from "@anthropic-ai/sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";
import ts from "typescript";
import { readFile, writeFile, mkdir, readdir, unlink } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { createReadStream } from "fs";
import crypto from "crypto";

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

// Separate cache directory from the canvas renderer cache
const CACHE_DIR = __dirname.endsWith("dist")
  ? path.join(__dirname, "..", "llm_transformers")
  : path.join(__dirname, "llm_transformers");

// Separate skill_id cache file from the canvas renderer skill
const SKILL_ID_CACHE_PATH = __dirname.endsWith("dist")
  ? path.join(__dirname, "..", ".claude-transformer-skill-id")
  : path.join(__dirname, ".claude-transformer-skill-id");
const SKILL_HASH_CACHE_PATH = __dirname.endsWith("dist")
  ? path.join(__dirname, "..", ".claude-transformer-skill-hash")
  : path.join(__dirname, ".claude-transformer-skill-hash");

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
  /** 2–3 sample raw states from the DefaultRenderer */
  sampleStates: any[];
  /** Which LLM provider to use */
  provider: LLMProvider;
}

export interface GenerateTransformerResponse {
  success: boolean;
  /** The generated and transpiled JavaScript transformer code */
  code?: string;
  /** Filename of the cached transformer on disk */
  savedFile?: string;
  /** Human-readable provider name */
  provider: string;
  /** Model ID used */
  model: string;
  /** Error message if success is false */
  error?: string;
}

export interface CachedTransformer {
  filename: string;
  domain: string;
  provider: string;
  timestamp: string;
  size: number;
}

// ==================== CLAUDE SKILLS API ====================

const SKILL_DISPLAY_TITLE_INTERPRETER = "PDDL Domain Interpreter";

/** In-memory cache for the skill ID (cleared on process restart) */
let cachedSkillId: string | null = null;

/** In-flight promise to prevent concurrent skill creation races */
let skillCreationPromise: Promise<string> | null = null;

/**
 * Compute a combined MD5 hash of all skill files.
 * Used to detect when skill files have changed and the skill needs re-uploading.
 */
async function computeSkillHash(): Promise<string> {
  const files = [SKILL_MD_PATH, SKILL_INTERFACES_PATH, SKILL_EXAMPLE_PATH, SKILL_RULES_PATH];
  const hash = crypto.createHash("md5");
  for (const f of files) {
    try {
      const fileContent = await readFile(f, "utf-8");
      hash.update(fileContent);
    } catch {
      hash.update(`MISSING:${f}`);
    }
  }
  return hash.digest("hex");
}

/**
 * Get or create the Claude Skill for the PDDL Domain Interpreter.
 *
 * Caching strategy (fastest to slowest):
 *   1. In-memory module-level variable (zero cost, cleared on restart)
 *   2. Disk cache file (.claude-transformer-skill-id) trusted directly, no API round-trip
 *      BUT only if the skill file hash matches (.claude-transformer-skill-hash)
 *   3. Create a new skill via the API (uploads 4 files once)
 *
 * A combined hash of all skill files is stored alongside the skill ID.
 * If the files change (e.g. SKILL.md is updated), the hash mismatches,
 * the old skill is deleted, and a fresh one is uploaded automatically.
 *
 * An in-flight promise lock prevents concurrent requests from racing
 * to create the skill simultaneously.
 */
async function getOrCreateClaudeSkill(client: Anthropic): Promise<string> {
  // 1. In-memory cache - fastest path, zero API calls
  if (cachedSkillId) {
    console.log(`[LLM Interpreter] Using in-memory cached skill: ${cachedSkillId}`);
    return cachedSkillId;
  }

  // 2. In-flight lock - if another request is already resolving the skill, wait for it
  if (skillCreationPromise) {
    console.log("[LLM Interpreter] Waiting for in-flight skill resolution...");
    return skillCreationPromise;
  }

  // 3. Kick off resolution (with lock held)
  skillCreationPromise = (async () => {
    try {
      // 3a. Check disk cache + hash validation (no API round-trip needed)
      const currentHash = await computeSkillHash();
      try {
        const savedId = (await readFile(SKILL_ID_CACHE_PATH, "utf-8")).trim();
        const savedHash = (await readFile(SKILL_HASH_CACHE_PATH, "utf-8")).trim();
        if (savedId && savedHash === currentHash) {
          // Files unchanged - trust the disk cache without an API round-trip
          cachedSkillId = savedId;
          console.log(`[LLM Interpreter] Loaded skill from disk cache (hash match): ${cachedSkillId}`);
          return cachedSkillId;
        } else if (savedId && savedHash !== currentHash) {
          console.log(`[LLM Interpreter] Skill files changed (hash mismatch) - will re-upload skill`);
          // Attempt to delete the stale skill from Anthropic (best-effort)
          try {
            await (client.beta.skills as any).delete(savedId, { betas: ["skills-2025-10-02"] });
            console.log(`[LLM Interpreter] Deleted stale skill: ${savedId}`);
          } catch {
            // Deletion is best-effort; not fatal if it fails
          }
        }
      } catch {
        // No disk cache yet - proceed to create
      }

      // 3b. Upload a fresh skill (with fallback for duplicate-title errors)
      console.log(`[LLM Interpreter] Uploading new Claude skill "${SKILL_DISPLAY_TITLE_INTERPRETER}"...`);
      const skillDir = "pddl-domain-interpreter";
      let newSkillId: string;
      try {
        const skill = await client.beta.skills.create({
          display_title: SKILL_DISPLAY_TITLE_INTERPRETER,
          files: [
            await toFile(createReadStream(SKILL_MD_PATH), `${skillDir}/SKILL.md`, { type: "text/markdown" }),
            await toFile(createReadStream(SKILL_INTERFACES_PATH), `${skillDir}/interfaces.ts`, { type: "text/plain" }),
            await toFile(createReadStream(SKILL_EXAMPLE_PATH), `${skillDir}/example-blocks-world.ts`, { type: "text/plain" }),
            await toFile(createReadStream(SKILL_RULES_PATH), `${skillDir}/rules.md`, { type: "text/markdown" }),
          ],
          betas: ["skills-2025-10-02"],
        });
        newSkillId = skill.id;
        console.log(`[LLM Interpreter] Created Claude skill: ${newSkillId} (version: ${skill.latest_version})`);
      } catch (createErr: any) {
        // Anthropic returns 400 if a skill with this display_title already exists.
        // This happens when the server has no local cache but the skill was previously uploaded.
        // Recover by listing all skills and finding the existing one by title.
        if (createErr?.status === 400 && createErr?.message?.includes("reuse an existing display_title")) {
          console.log(`[LLM Interpreter] Skill already exists on Anthropic — fetching existing skill ID...`);
          const skillsList = await client.beta.skills.list({ betas: ["skills-2025-10-02"] });
          let foundId: string | null = null;
          for await (const s of skillsList) {
            if (s.display_title === SKILL_DISPLAY_TITLE_INTERPRETER) {
              foundId = s.id;
              break;
            }
          }
          if (!foundId) {
            throw new Error(`[LLM Interpreter] Could not find existing skill after duplicate-title error`);
          }
          newSkillId = foundId;
          console.log(`[LLM Interpreter] Recovered existing skill: ${newSkillId}`);
        } else {
          throw createErr;
        }
      }
      cachedSkillId = newSkillId;
      // Persist skill ID and hash to disk for future restarts
      await writeFile(SKILL_ID_CACHE_PATH, cachedSkillId, "utf-8");
      await writeFile(SKILL_HASH_CACHE_PATH, currentHash, "utf-8");
      return cachedSkillId;
    } finally {
      // Release the in-flight lock so future calls go through the fast path
      skillCreationPromise = null;
    }
  })();

  return skillCreationPromise;
}

// ==================== GEMINI PROMPT LOADER ====================

let cachedGeminiPrompt: string | null = null;

async function loadGeminiPrompt(): Promise<string> {
  if (cachedGeminiPrompt) return cachedGeminiPrompt;
  try {
    cachedGeminiPrompt = await readFile(GEMINI_PROMPT_PATH, "utf-8");
    console.log("[LLM Interpreter] Gemini prompt loaded, length:", cachedGeminiPrompt.length);
    return cachedGeminiPrompt;
  } catch (error) {
    console.error("[LLM Interpreter] Failed to load Gemini prompt:", error);
    throw new Error(
      "Gemini prompt file not found. Ensure backend/api/prompts/domain-interpreter-skill.txt exists."
    );
  }
}

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
  // If no code block, check if the response starts with typical code patterns
  const trimmed = response.trim();
  if (
    trimmed.startsWith("export ") ||
    trimmed.startsWith("interface ") ||
    trimmed.startsWith("function ") ||
    trimmed.startsWith("//") ||
    trimmed.startsWith("const ")
  ) {
    return trimmed;
  }
  // Last resort: return the whole response trimmed
  console.warn("[LLM Interpreter] Could not identify code block, using full response");
  return trimmed;
}

/**
 * Basic validation that the generated code contains the expected transformer function.
 */
function validateCode(
  code: string,
  _domainName: string
): { valid: boolean; issues: string[] } {
  const issues: string[] = [];

  // Check for a transform function (any name starting with 'transform')
  if (!/function\s+transform\w*\s*\(/.test(code)) {
    issues.push(
      "Missing transformer function (expected a function named transform<Something>)"
    );
  }

  // Check for forbidden patterns
  if (/import\s+/.test(code) && !/import\s+type/.test(code)) {
    issues.push("Code contains import statements (not allowed in runtime-evaluated code)");
  }
  if (/require\s*\(/.test(code)) {
    issues.push("Code uses require() (not allowed)");
  }
  if (/Math\.random\s*\(/.test(code)) {
    issues.push("Code uses Math.random() — positions/colors must be deterministic");
  }

  return { valid: issues.length === 0, issues };
}

// ==================== TYPESCRIPT TRANSPILATION ====================

/**
 * Transpile TypeScript code to JavaScript using the TypeScript compiler API.
 */
export function transpileCachedTransformer(code: string): string {
  return transpileToJS(code);
}

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

/**
 * Generate transformer code using Anthropic Claude via the formal Skills API.
 */
async function generateWithClaude(userMessage: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY environment variable is not set.");
  }
  const client = new Anthropic({ apiKey });
  const model = MODELS.claude;

  // Get or create the skill
  const skillId = await getOrCreateClaudeSkill(client);
  console.log(`[LLM Interpreter] Using Claude skill: ${skillId}`);
  console.log(`[LLM Interpreter] Calling Claude (${model.id}) with Skills API...`);

  // Call Claude with the skill and code execution
  const response = await client.beta.messages.create({
    model: model.id,
    max_tokens: model.maxTokens,
    betas: ["skills-2025-10-02"],
    container: {
      skills: [
        {
          type: "custom" as const,
          skill_id: skillId,
          version: "latest",
        },
      ],
    },
    tools: [{ type: "code_execution_20250522" as const, name: "code_execution" }],
    tool_choice: { type: "none" as const },
    messages: [{ role: "user", content: userMessage }],
    
  });

  // Extract code from response content blocks.
  const finalResponse = response;
  // Find the last text block that contains a transform function.
  const textBlocks: string[] = [];
  for (const block of finalResponse.content) {
    if (block.type === "text") {
      textBlocks.push(block.text);
    }
  }

  console.log(
    `[LLM Interpreter] Claude response has ${finalResponse.content.length} content blocks, ${textBlocks.length} text blocks`
  );

  if (textBlocks.length === 0) {
    throw new Error("Claude returned no text content.");
  }

  // Find the best text block: the last one that looks like actual transformer code
  let bestCodeBlock: string | null = null;
  for (let i = textBlocks.length - 1; i >= 0; i--) {
    const block = textBlocks[i];
    if (/function\s+transform\w*\s*\(/.test(block)) {
      bestCodeBlock = block;
      break;
    }
  }

  // Fallback: concatenate all text blocks and extract
  if (!bestCodeBlock) {
    console.warn(
      "[LLM Interpreter] No text block contains a transform function, using full response"
    );
    bestCodeBlock = textBlocks.join("\n");
  }

  console.log(
    `[LLM Interpreter] Claude response received, code length: ${bestCodeBlock.length}`
  );
  return bestCodeBlock;
}

/**
 * Generate transformer code using Google Gemini (system prompt approach).
 */
async function generateWithGemini(userMessage: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is not set.");
  }
  const geminiPrompt = await loadGeminiPrompt();
  const genAI = new GoogleGenerativeAI(apiKey);
  const modelConfig = MODELS.gemini;

  console.log(`[LLM Interpreter] Calling Gemini (${modelConfig.id})...`);

  const model = genAI.getGenerativeModel({
    model: modelConfig.id,
    systemInstruction: geminiPrompt,
  });

  const result = await model.generateContent(userMessage);
  const response = result.response;
  const text = response.text();

  if (!text) {
    throw new Error("Gemini returned no text content.");
  }

  console.log(`[LLM Interpreter] Gemini response received, length: ${text.length}`);
  return text;
}

// ==================== CACHING ====================

/**
 * Save generated transformer code to disk cache.
 */
async function saveToCache(
  code: string,
  domainName: string,
  provider: LLMProvider
): Promise<string> {
  await mkdir(CACHE_DIR, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `${domainName}_${provider}_${timestamp}.ts`;
  const filepath = path.join(CACHE_DIR, filename);
  await writeFile(filepath, code, "utf-8");
  console.log(`[LLM Interpreter] Cached transformer saved: ${filename}`);
  return filename;
}

/**
 * List all cached transformers, optionally filtered by domain.
 */
export async function listCachedTransformers(
  domain?: string
): Promise<CachedTransformer[]> {
  try {
    await mkdir(CACHE_DIR, { recursive: true });
    const files = await readdir(CACHE_DIR);
    const transformers: CachedTransformer[] = [];

    for (const file of files) {
      if (!file.endsWith(".ts") || file === ".gitkeep") continue;
      // Parse filename: {domain}_{provider}_{timestamp}.ts
      const match = file.match(/^(.+?)_(claude|gemini)_(.+)\.ts$/);
      if (!match) continue;
      const [, fileDomain, fileProvider, fileTimestamp] = match;
      if (domain && fileDomain !== domain) continue;

      const filepath = path.join(CACHE_DIR, file);
      const content = await readFile(filepath, "utf-8");

      // Restore ISO timestamp from filename format
      const tIdx = fileTimestamp.indexOf("T");
      let parsedTimestamp = fileTimestamp;
      if (tIdx !== -1) {
        const datePart = fileTimestamp.substring(0, tIdx);
        const timePart = fileTimestamp.substring(tIdx);
        const timeFixed = timePart
          .replace(/-(\d{3}Z)$/, ".$1")
          .replace(/-/g, ":");
        parsedTimestamp = datePart + timeFixed;
      }

      transformers.push({
        filename: file,
        domain: fileDomain,
        provider: fileProvider,
        timestamp: parsedTimestamp,
        size: content.length,
      });
    }

    // Sort by timestamp descending (newest first)
    transformers.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    return transformers;
  } catch (error) {
    console.error("[LLM Interpreter] Error listing cache:", error);
    return [];
  }
}

/**
 * Load a cached transformer by filename.
 */
export async function loadCachedTransformer(
  filename: string
): Promise<string | null> {
  try {
    const filepath = path.join(CACHE_DIR, filename);
    const code = await readFile(filepath, "utf-8");
    console.log(`[LLM Interpreter] Loaded cached transformer: ${filename}`);
    return code;
  } catch (error) {
    console.error(`[LLM Interpreter] Cache file not found: ${filename}`);
    return null;
  }
}

/**
 * Delete a cached transformer by filename.
 */
export async function deleteCachedTransformer(
  filename: string
): Promise<boolean> {
  try {
    const filepath = path.join(CACHE_DIR, filename);
    await unlink(filepath);
    console.log(`[LLM Interpreter] Deleted cached transformer: ${filename}`);
    return true;
  } catch (error) {
    console.error(`[LLM Interpreter] Failed to delete: ${filename}`);
    return false;
  }
}

/**
 * Clear all cached transformers for a domain (or all domains).
 */
export async function clearTransformerCache(domain?: string): Promise<number> {
  try {
    await mkdir(CACHE_DIR, { recursive: true });
    const files = await readdir(CACHE_DIR);
    let deleted = 0;
    for (const file of files) {
      if (!file.endsWith(".ts") || file === ".gitkeep") continue;
      if (domain && !file.startsWith(`${domain}_`)) continue;
      await unlink(path.join(CACHE_DIR, file));
      deleted++;
    }
    console.log(`[LLM Interpreter] Cleared ${deleted} cached transformers`);
    return deleted;
  } catch (error) {
    console.error("[LLM Interpreter] Error clearing cache:", error);
    return 0;
  }
}

// ==================== MAIN GENERATION FUNCTION ====================

/**
 * Generate a domain-specific state transformer using an LLM.
 *
 * For Claude: Uses the formal Skills API with code execution sandbox.
 * For Gemini: Uses the system prompt approach.
 *
 * 1. Builds the user message with PDDL domain + sample states
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
  console.log(`[LLM Interpreter] Sample states: ${sampleStates.length}`);
  console.log(`[LLM Interpreter] PDDL domain length: ${domainPddl.length} chars`);

  try {
    // 1. Build user message
    const samples = sampleStates.slice(0, 3);
    const userMessage = `Generate a complete TypeScript state transformer for the "${domainName}" domain.

## PDDL Domain File

\`\`\`pddl
${domainPddl}
\`\`\`

## Sample Raw States (from DefaultRenderer)

Here are ${samples.length} sample state(s) showing the data structure you need to transform:

\`\`\`json
${JSON.stringify(samples, null, 2)}
\`\`\`

## Instructions

1. Read all reference files in the skill folder (SKILL.md, interfaces.ts, example-blocks-world.ts, rules.md).
2. Analyze the PDDL domain to understand the object types, predicates, and actions.
3. Analyze the sample states to understand what data is available.
4. Design a spatial layout strategy appropriate for this domain.
5. Generate the transformer function following the output contract in SKILL.md.
6. Validate your code by running it with the sample states.

Output ONLY the raw TypeScript code. 
DO NOT use the code execution tool. 
DO NOT include any explanations, comments, or markdown formatting. 
DO NOT wrap the code in markdown blocks. 
Start directly with the interface declarations. 
Generate the code in a single turn without any testing loops.`;

    // 2. Call LLM
    let rawResponse: string;
    if (provider === "claude") {
      rawResponse = await generateWithClaude(userMessage);
    } else if (provider === "gemini") {
      rawResponse = await generateWithGemini(userMessage);
    } else {
      throw new Error(`Unknown provider: ${provider}`);
    }

    // 3. Extract code
    const tsCode = extractCode(rawResponse);

    // 4. Validate
    const validation = validateCode(tsCode, domainName);
    if (!validation.valid) {
      console.warn("[LLM Interpreter] Validation issues:", validation.issues);
    }

    // 5. Transpile TypeScript to JavaScript
    const transpiled = transpileToJS(tsCode);
    console.log(
      `[LLM Interpreter] Transpiled TS (${tsCode.length} chars) -> JS (${transpiled.length} chars)`
    );

    // 6. Cache
    const savedFile = await saveToCache(transpiled, domainName, provider);

    return {
      success: true,
      code: transpiled,
      savedFile,
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
