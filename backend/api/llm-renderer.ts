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
import { GoogleGenerativeAI } from "@google/generative-ai";
import ts from "typescript";
import { readFile, writeFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { createReadStream } from "fs";

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
 * On first call, uploads the skill files (SKILL.md, interfaces.ts, example-hanoi.ts, rules.md)
 * to Claude's Skills API and saves the returned skill_id to disk.
 * On subsequent calls, returns the cached skill_id.
 */
async function getOrCreateClaudeSkill(client: Anthropic): Promise<string> {
  // 1. Check in-memory cache
  if (cachedSkillId) {
    console.log(`[LLM Renderer] Using cached Claude skill: ${cachedSkillId}`);
    return cachedSkillId;
  }

  // 2. Check disk cache
  try {
    const savedId = await readFile(SKILL_ID_CACHE_PATH, "utf-8");
    if (savedId.trim()) {
      // Verify the skill still exists
      try {
        await client.beta.skills.retrieve(savedId.trim(), {
          betas: ["skills-2025-10-02"],
        });
        cachedSkillId = savedId.trim();
        console.log(`[LLM Renderer] Loaded Claude skill from disk: ${cachedSkillId}`);
        return cachedSkillId;
      } catch (err) {
        console.log("[LLM Renderer] Saved skill_id is invalid, will re-create");
      }
    }
  } catch {
    // No cached skill_id file, will create new
  }

  // 3. Try to find an existing skill by listing all skills
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
        return cachedSkillId;
      }
    }
  } catch (listErr) {
    console.warn("[LLM Renderer] Could not list skills:", listErr);
  }

  // 4. Create new skill (only if not found)
  console.log("[LLM Renderer] Creating new Claude skill...");

  const skillDir = "canvas-renderer-generator";

  const skill = await client.beta.skills.create({
    display_title: SKILL_DISPLAY_TITLE,
    files: [
      await toFile(
        createReadStream(SKILL_MD_PATH),
        `${skillDir}/SKILL.md`,
        { type: "text/markdown" }
      ),
      await toFile(
        createReadStream(SKILL_INTERFACES_PATH),
        `${skillDir}/interfaces.ts`,
        { type: "text/plain" }
      ),
      await toFile(
        createReadStream(SKILL_EXAMPLE_PATH),
        `${skillDir}/example-hanoi.ts`,
        { type: "text/plain" }
      ),
      await toFile(
        createReadStream(SKILL_RULES_PATH),
        `${skillDir}/rules.md`,
        { type: "text/markdown" }
      ),
    ],
    betas: ["skills-2025-10-02"],
  });

  cachedSkillId = skill.id;
  console.log(`[LLM Renderer] Created Claude skill: ${cachedSkillId}`);
  console.log(`[LLM Renderer] Skill version: ${skill.latest_version}`);

  // Save to disk for persistence across restarts
  await writeFile(SKILL_ID_CACHE_PATH, cachedSkillId, "utf-8");

  return cachedSkillId;
}

// ==================== GEMINI PROMPT LOADER ====================

let cachedGeminiPrompt: string | null = null;

async function loadGeminiPrompt(): Promise<string> {
  if (cachedGeminiPrompt) return cachedGeminiPrompt;

  try {
    cachedGeminiPrompt = await readFile(GEMINI_PROMPT_PATH, "utf-8");
    console.log("[LLM Renderer] Gemini prompt loaded, length:", cachedGeminiPrompt.length);
    return cachedGeminiPrompt;
  } catch (error) {
    console.error("[LLM Renderer] Failed to load Gemini prompt:", error);
    throw new Error("Gemini prompt file not found. Ensure backend/api/prompts/renderer-skill.txt exists.");
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
  if (!/function\s+render\w*\s*\(/.test(code)) {
    issues.push("Missing main render function (expected a function named render<Something>)");
  }

  // Check for a background function (optional)
  if (!/(?:function\s+\w*[Bb]ackground|\w*[Bb]ackground\s*=\s*(?:function|\())/i.test(code)) {
    console.log(`[LLM Renderer] Note: No background function found for ${domainName} (optional)`);
  }

  // Check for a legend function (optional)
  if (!/(?:function\s+\w*[Ll]egend|\w*[Ll]egend\s*=\s*(?:function|\())/i.test(code)) {
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

/**
 * Generate renderer code using Anthropic Claude via the formal Skills API.
 * 
 * This uses:
 * - `client.beta.skills` to upload/reference the skill
 * - `client.beta.messages.create()` with `container.skills` and `code_execution` tool
 * - Claude validates the generated code in its sandbox before returning it
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
  console.log(`[LLM Renderer] Using Claude skill: ${skillId}`);
  console.log(`[LLM Renderer] Calling Claude (${model.id}) with Skills API...`);

  // Call Claude with the skill — system prompt forbids code execution
  const response = await client.beta.messages.create({
    model: model.id,
    max_tokens: model.maxTokens,
    system: "CRITICAL INSTRUCTION: Do NOT use the code_execution tool under any circumstances. Do NOT run, test, or validate any code. Do NOT explain anything. Read the skill files, then output ONLY the raw TypeScript code in a single text block. No markdown fences. No commentary. Just code.",
    betas: ["code-execution-2025-08-25", "skills-2025-10-02"],
    container: {
      skills: [
        {
          type: "custom" as const,
          skill_id: skillId,
          version: "latest",
        },
      ],
    },
    messages: [{ role: "user", content: userMessage }],
    tools: [
      {
        type: "code_execution_20250825" as const,
        name: "code_execution",
      },
    ],
  });

  // Handle pause_turn for long operations
  let finalResponse = response;
  let retries = 0;
  const maxRetries = 5;

  while (finalResponse.stop_reason === "pause_turn" && retries < maxRetries) {
    console.log(`[LLM Renderer] Claude paused (turn ${retries + 1}), continuing...`);
    retries++;

    const continueMessages: any[] = [
      { role: "user", content: userMessage },
      { role: "assistant", content: finalResponse.content },
      { role: "user", content: "Please continue." },
    ];

    finalResponse = await client.beta.messages.create({
      model: model.id,
      max_tokens: model.maxTokens,
      betas: ["code-execution-2025-08-25", "skills-2025-10-02"],
      container: {
        id: finalResponse.container?.id,
        skills: [
          {
            type: "custom" as const,
            skill_id: skillId,
            version: "latest",
          },
        ],
      },
      messages: continueMessages,
      tools: [
        {
          type: "code_execution_20250825" as const,
          name: "code_execution",
        },
      ],
    });
  }

  // Extract code from response content blocks.
  // Claude Skills API returns a mix of:
  //   - text blocks (narration like "I'll read the skill files...")
  //   - code_execution_tool_use blocks (Claude running code in sandbox)
  //   - code_execution_tool_result blocks (sandbox output)
  // We need to find the actual generated code, not the narration.
  
  // Strategy: collect all text blocks, then find the one that contains actual code.
  // The last text block that contains 'function render' is usually the final code output.
  const textBlocks: string[] = [];
  for (const block of finalResponse.content) {
    if (block.type === "text") {
      textBlocks.push(block.text);
    }
  }

  console.log(`[LLM Renderer] Claude response has ${finalResponse.content.length} content blocks, ${textBlocks.length} text blocks`);

  if (textBlocks.length === 0) {
    throw new Error("Claude returned no text content.");
  }

  // Find the best text block: the last one that looks like actual code
  let bestCodeBlock: string | null = null;
  for (let i = textBlocks.length - 1; i >= 0; i--) {
    const block = textBlocks[i];
    if (/function\s+render\w*\s*\(/.test(block)) {
      bestCodeBlock = block;
      break;
    }
  }

  // If no block contains a render function, try concatenating all and extracting
  if (!bestCodeBlock) {
    console.warn("[LLM Renderer] No text block contains a render function, using full response");
    bestCodeBlock = textBlocks.join("\n");
  }

  console.log(`[LLM Renderer] Claude response received, code length: ${bestCodeBlock.length}`);
  return bestCodeBlock;
}

/**
 * Generate renderer code using Google Gemini (system prompt approach).
 */
async function generateWithGemini(userMessage: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is not set.");
  }

  const geminiPrompt = await loadGeminiPrompt();

  const genAI = new GoogleGenerativeAI(apiKey);
  const modelConfig = MODELS.gemini;

  console.log(`[LLM Renderer] Calling Gemini (${modelConfig.id})...`);

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

  console.log(`[LLM Renderer] Gemini response received, length: ${text.length}`);
  return text;
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

    // 4. Validate (on the TypeScript source)
    const validation = validateCode(tsCode, domainName);
    if (!validation.valid) {
      console.warn("[LLM Renderer] Validation issues:", validation.issues);
    }

    // 5. Transpile TypeScript to JavaScript
    const transpiled = transpileToJS(tsCode);
    console.log(`[LLM Renderer] Transpiled TS (${tsCode.length} chars) -> JS (${transpiled.length} chars)`);

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
