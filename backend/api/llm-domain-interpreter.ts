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
import { GoogleGenerativeAI } from "@google/generative-ai";
import ts from "typescript";
import { readFile, writeFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { createReadStream } from "fs";

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
 * On first call, uploads the skill files (SKILL.md, interfaces.ts,
 * example-blocks-world.ts, rules.md) to Claude's Skills API and saves
 * the returned skill_id to disk.
 * On subsequent calls, returns the cached skill_id.
 */
async function getOrCreateClaudeSkill(client: Anthropic): Promise<string> {
  // 1. Check in-memory cache
  if (cachedSkillId) {
    console.log(`[LLM Interpreter] Using cached Claude skill: ${cachedSkillId}`);
    return cachedSkillId;
  }

  // 2. Check disk cache
  try {
    const savedId = await readFile(SKILL_ID_CACHE_PATH, "utf-8");
    if (savedId.trim()) {
      try {
        await client.beta.skills.retrieve(savedId.trim(), {
          betas: ["skills-2025-10-02"],
        });
        cachedSkillId = savedId.trim();
        console.log(`[LLM Interpreter] Loaded Claude skill from disk: ${cachedSkillId}`);
        return cachedSkillId;
      } catch (err) {
        console.log("[LLM Interpreter] Saved skill_id is invalid, will re-create");
      }
    }
  } catch {
    // No cached skill_id file, will create new
  }

  // 3. Try to find an existing skill by listing all skills
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
        return cachedSkillId;
      }
    }
  } catch (listErr) {
    console.warn("[LLM Interpreter] Could not list skills:", listErr);
  }

  // 4. Create new skill (only if not found)
  console.log("[LLM Interpreter] Creating new Claude skill...");
  const skillDir = "pddl-domain-interpreter";
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
        `${skillDir}/example-blocks-world.ts`,
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
  console.log(`[LLM Interpreter] Created Claude skill: ${cachedSkillId}`);
  console.log(`[LLM Interpreter] Skill version: ${skill.latest_version}`);

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
    console.log(`[LLM Interpreter] Claude paused (turn ${retries + 1}), continuing...`);
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
