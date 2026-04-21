/**
 * LLM Renderer Module
 * 
 * Generates domain-specific Canvas rendering code using LLMs (Claude or Gemini).
 * Uses a skill/prompt template to guide the LLM in producing correct TypeScript
 * renderer functions that follow the project's RenderedState interface.
 * 
 * Supports:
 * - Anthropic Claude (claude-sonnet-4-20250514)
 * - Google Gemini (gemini-2.5-pro)
 * 
 * Features:
 * - Disk-based caching of generated renderers per domain
 * - Automatic code extraction from LLM responses
 */

import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";
import ts from "typescript";
import { readFile, writeFile, mkdir, readdir, unlink } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ==================== CONFIGURATION ====================

const SKILL_PROMPT_PATH = path.join(__dirname, "prompts", "renderer-skill.txt");
const CACHE_DIR = path.join(__dirname, "llm_renderers");

// Model configurations
const MODELS = {
  claude: {
    id: "claude-sonnet-4-20250514",
    name: "Claude Sonnet 4",
    maxTokens: 8192,
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
  states: any[]; // RenderedState[] - sample states
  provider: LLMProvider;
}

export interface GenerateRendererResponse {
  success: boolean;
  code?: string;
  savedFile?: string;
  provider: string;
  model: string;
  error?: string;
}

export interface CachedRenderer {
  filename: string;
  domain: string;
  provider: string;
  timestamp: string;
  size: number;
}

// ==================== SKILL LOADER ====================

let cachedSkillPrompt: string | null = null;

async function loadSkillPrompt(): Promise<string> {
  if (cachedSkillPrompt) return cachedSkillPrompt;

  try {
    cachedSkillPrompt = await readFile(SKILL_PROMPT_PATH, "utf-8");
    console.log("[LLM Renderer] Skill prompt loaded, length:", cachedSkillPrompt.length);
    return cachedSkillPrompt;
  } catch (error) {
    console.error("[LLM Renderer] Failed to load skill prompt:", error);
    throw new Error("Skill prompt file not found. Ensure backend/api/prompts/renderer-skill.txt exists.");
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
  console.warn("[LLM Renderer] Could not identify code block, using full response");
  return trimmed;
}

/**
 * Basic validation that the generated code contains the expected function signatures.
 */
function validateCode(code: string, domainName: string): { valid: boolean; issues: string[] } {
  const issues: string[] = [];

  // Check for at least one render function (any name starting with 'render')
  // The frontend discovers functions by name pattern, so exact domain-name matching
  // is not required. The LLM may use any naming convention.
  if (!/function\s+render\w*\s*\(/.test(code)) {
    issues.push("Missing main render function (expected a function named render<Something>)");
  }

  // Check for a background function (any function with 'background' in the name)
  if (!/(?:function\s+\w*[Bb]ackground|\w*[Bb]ackground\s*=\s*(?:function|\())/i.test(code)) {
    // Not a hard failure - the frontend handles missing background gracefully
    console.log(`[LLM Renderer] Note: No background function found for ${domainName} (optional)`);
  }

  // Check for a legend function (any function with 'legend' in the name)
  if (!/(?:function\s+\w*[Ll]egend|\w*[Ll]egend\s*=\s*(?:function|\())/i.test(code)) {
    // Not a hard failure - the frontend handles missing legend gracefully
    console.log(`[LLM Renderer] Note: No legend function found for ${domainName} (optional)`);
  }

  // Check for forbidden patterns
  if (/import\s+/.test(code) && !/import\s+type/.test(code)) {
    issues.push("Code contains import statements (not allowed in runtime-evaluated code)");
  }
  if (/new\s+Image\s*\(/.test(code)) {
    issues.push("Code uses new Image() (external assets not allowed)");
  }
  if (/require\s*\(/.test(code)) {
    issues.push("Code uses require() (not allowed)");
  }

  return { valid: issues.length === 0, issues };
}

// ==================== TYPESCRIPT TRANSPILATION ====================

/**
 * Transpile TypeScript code to JavaScript using the TypeScript compiler API.
 * This handles all TS syntax correctly: interfaces, type annotations, generics,
 * callback types, union types, etc. — unlike fragile regex-based stripping.
 */
function transpileToJS(tsCode: string): string {
  // Step 1: Strip 'export' keywords before transpilation.
  // If the LLM generates `export function renderX(...)`, the TS compiler
  // converts it to CommonJS `exports.renderX = renderX;` which breaks
  // when executed via `new Function()` (no `exports` object in that scope).
  // Removing `export` first makes the compiler emit plain function declarations.
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

  // Step 2: Remove any remaining CommonJS artifacts that the compiler may add.
  // Even with ModuleKind.None, some TS versions add "use strict" and Object.defineProperty.
  let output = result.outputText;
  output = output.replace(/"use strict";\s*\n?/g, '');
  output = output.replace(/Object\.defineProperty\(exports,\s*"__esModule",\s*\{[^}]*\}\);\s*\n?/g, '');
  output = output.replace(/^exports\.\w+\s*=\s*\w+;\s*\n?/gm, '');

  return output;
}

// ==================== LLM PROVIDERS ====================

/**
 * Generate renderer code using Anthropic Claude.
 */
async function generateWithClaude(
  skillPrompt: string,
  userMessage: string
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY environment variable is not set.");
  }

  const client = new Anthropic({ apiKey });
  const model = MODELS.claude;

  console.log(`[LLM Renderer] Calling Claude (${model.id})...`);

  const response = await client.messages.create({
    model: model.id,
    max_tokens: model.maxTokens,
    system: skillPrompt,
    messages: [{ role: "user", content: userMessage }],
  });

  // Extract text from response
  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Claude returned no text content.");
  }

  console.log(`[LLM Renderer] Claude response received, length: ${textBlock.text.length}`);
  return textBlock.text;
}

/**
 * Generate renderer code using Google Gemini.
 */
async function generateWithGemini(
  skillPrompt: string,
  userMessage: string
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is not set.");
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const modelConfig = MODELS.gemini;

  console.log(`[LLM Renderer] Calling Gemini (${modelConfig.id})...`);

  const model = genAI.getGenerativeModel({
    model: modelConfig.id,
    systemInstruction: skillPrompt,
  });

  const result = await model.generateContent(userMessage);
  const response = result.response;
  const text = response.text();

  if (!text) {
    throw new Error("Gemini returned no text content.");
  }

  console.log(`[LLM Renderer] Gemini response received, length: ${text.length}`);
  return text;
}

// ==================== CACHING ====================

/**
 * Save generated renderer code to disk cache.
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
  console.log(`[LLM Renderer] Cached renderer saved: ${filename}`);

  return filename;
}

/**
 * List all cached renderers, optionally filtered by domain.
 */
export async function listCachedRenderers(domain?: string): Promise<CachedRenderer[]> {
  try {
    await mkdir(CACHE_DIR, { recursive: true });
    const files = await readdir(CACHE_DIR);

    const renderers: CachedRenderer[] = [];

    for (const file of files) {
      if (!file.endsWith(".ts") || file === ".gitkeep") continue;

      // Parse filename: {domain}_{provider}_{timestamp}.ts
      const match = file.match(/^(.+?)_(claude|gemini)_(.+)\.ts$/);
      if (!match) continue;

      const [, fileDomain, fileProvider, fileTimestamp] = match;

      if (domain && fileDomain !== domain) continue;

      const filepath = path.join(CACHE_DIR, file);
      const content = await readFile(filepath, "utf-8");

      renderers.push({
        filename: file,
        domain: fileDomain,
        provider: fileProvider,
        timestamp: fileTimestamp.replace(/-/g, ":").replace("T", " "),
        size: content.length,
      });
    }

    // Sort by timestamp descending (newest first)
    renderers.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

    return renderers;
  } catch (error) {
    console.error("[LLM Renderer] Error listing cache:", error);
    return [];
  }
}

/**
 * Load a cached renderer by filename.
 */
export async function loadCachedRenderer(filename: string): Promise<string | null> {
  try {
    const filepath = path.join(CACHE_DIR, filename);
    const code = await readFile(filepath, "utf-8");
    console.log(`[LLM Renderer] Loaded cached renderer: ${filename}`);
    return code;
  } catch (error) {
    console.error(`[LLM Renderer] Cache file not found: ${filename}`);
    return null;
  }
}

/**
 * Delete a cached renderer by filename.
 */
export async function deleteCachedRenderer(filename: string): Promise<boolean> {
  try {
    const filepath = path.join(CACHE_DIR, filename);
    await unlink(filepath);
    console.log(`[LLM Renderer] Deleted cached renderer: ${filename}`);
    return true;
  } catch (error) {
    console.error(`[LLM Renderer] Failed to delete: ${filename}`);
    return false;
  }
}

/**
 * Clear all cached renderers for a domain (or all domains).
 */
export async function clearCache(domain?: string): Promise<number> {
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

    console.log(`[LLM Renderer] Cleared ${deleted} cached renderers`);
    return deleted;
  } catch (error) {
    console.error("[LLM Renderer] Error clearing cache:", error);
    return 0;
  }
}

// ==================== MAIN GENERATION FUNCTION ====================

/**
 * Generate a domain-specific Canvas renderer using an LLM.
 * 
 * 1. Loads the skill prompt
 * 2. Builds the user message with domain name + sample states
 * 3. Calls the selected LLM provider
 * 4. Extracts and validates the generated code
 * 5. Caches the result to disk
 * 6. Returns the code
 */
export async function generateRenderer(
  request: GenerateRendererRequest
): Promise<GenerateRendererResponse> {
  const { domainName, states, provider } = request;
  const model = MODELS[provider];

  console.log(`[LLM Renderer] Starting generation for domain: ${domainName}`);
  console.log(`[LLM Renderer] Provider: ${provider} (${model.name})`);
  console.log(`[LLM Renderer] Sample states: ${states.length}`);

  try {
    // 1. Load skill prompt
    const skillPrompt = await loadSkillPrompt();

    // 2. Build user message
    // Send only first 2-3 states to keep token count reasonable
    const sampleStates = states.slice(0, 3);
    const userMessage = `Generate a complete Canvas renderer for the "${domainName}" domain.

Here are ${sampleStates.length} sample states showing the data structure you need to visualize:

${JSON.stringify(sampleStates, null, 2)}

Analyze the objects, their types, positions, properties, and the relations between them.
Then generate the three TypeScript functions as specified in the instructions.`;

    // 3. Call LLM
    let rawResponse: string;
    if (provider === "claude") {
      rawResponse = await generateWithClaude(skillPrompt, userMessage);
    } else if (provider === "gemini") {
      rawResponse = await generateWithGemini(skillPrompt, userMessage);
    } else {
      throw new Error(`Unknown provider: ${provider}`);
    }

    // 4. Extract code
    const tsCode = extractCode(rawResponse);

    // 5. Validate (on the TypeScript source)
    const validation = validateCode(tsCode, domainName);
    if (!validation.valid) {
      console.warn("[LLM Renderer] Validation issues:", validation.issues);
      // Still return the code but log warnings - the frontend will handle execution errors
    }

    // 6. Transpile TypeScript to JavaScript
    // Using the TypeScript compiler API ensures all type annotations, interfaces,
    // generics, callback types, etc. are correctly removed — no fragile regex needed.
    const transpiled = transpileToJS(tsCode);
    console.log(`[LLM Renderer] Transpiled TS (${tsCode.length} chars) -> JS (${transpiled.length} chars)`);

    // 7. Cache (save the transpiled JS so cached renderers are ready to use)
    const savedFile = await saveToCache(transpiled, domainName, provider);

    return {
      success: true,
      code: transpiled,
      savedFile,
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
