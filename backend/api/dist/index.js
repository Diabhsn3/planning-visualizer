var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});

// _core/index.ts
import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";

// shared/const.ts
var COOKIE_NAME = "app_session_id";
var ONE_YEAR_MS = 1e3 * 60 * 60 * 24 * 365;
var UNAUTHED_ERR_MSG = "Please login (10001)";
var NOT_ADMIN_ERR_MSG = "You do not have required permission (10002)";

// _core/cookies.ts
function isSecureRequest(req) {
  if (req.protocol === "https") return true;
  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;
  const protoList = Array.isArray(forwardedProto) ? forwardedProto : forwardedProto.split(",");
  return protoList.some((proto) => proto.trim().toLowerCase() === "https");
}
function getSessionCookieOptions(req) {
  return {
    httpOnly: true,
    path: "/",
    sameSite: "none",
    secure: isSecureRequest(req)
  };
}

// _core/systemRouter.ts
import { z } from "zod";

// _core/trpc.ts
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
var t = initTRPC.context().create({
  transformer: superjson
});
var router = t.router;
var publicProcedure = t.procedure;
var requireUser = t.middleware(async (opts) => {
  const { ctx, next } = opts;
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user
    }
  });
});
var protectedProcedure = t.procedure.use(requireUser);
var adminProcedure = t.procedure.use(
  t.middleware(async (opts) => {
    const { ctx, next } = opts;
    if (!ctx.user) {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }
    return next({
      ctx: {
        ...ctx,
        user: ctx.user
      }
    });
  })
);

// _core/systemRouter.ts
var systemRouter = router({
  health: publicProcedure.input(
    z.object({
      timestamp: z.number().min(0, "timestamp cannot be negative")
    })
  ).query(() => ({
    ok: true
  }))
});

// visualizer.ts
import { z as z2 } from "zod";
import { readFile as readFile4, writeFile as writeFile4, mkdir as mkdir4, unlink as unlink3 } from "fs/promises";

// llm-renderer.ts
import Anthropic from "@anthropic-ai/sdk";
import { toFile } from "@anthropic-ai/sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";
import ts from "typescript";
import { readFile, writeFile, mkdir, readdir, unlink } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { createReadStream } from "fs";
var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);
var SKILLS_DIR = __dirname.endsWith("dist") ? path.join(__dirname, "..", "skills", "canvas-renderer-generator") : path.join(__dirname, "skills", "canvas-renderer-generator");
var SKILL_MD_PATH = path.join(SKILLS_DIR, "SKILL.md");
var SKILL_INTERFACES_PATH = path.join(SKILLS_DIR, "interfaces.ts");
var SKILL_EXAMPLE_PATH = path.join(SKILLS_DIR, "example-hanoi.ts");
var SKILL_RULES_PATH = path.join(SKILLS_DIR, "rules.md");
var GEMINI_PROMPT_PATH = __dirname.endsWith("dist") ? path.join(__dirname, "..", "prompts", "renderer-skill.txt") : path.join(__dirname, "prompts", "renderer-skill.txt");
var CACHE_DIR = __dirname.endsWith("dist") ? path.join(__dirname, "..", "llm_renderers") : path.join(__dirname, "llm_renderers");
var SKILL_ID_CACHE_PATH = __dirname.endsWith("dist") ? path.join(__dirname, "..", ".claude-skill-id") : path.join(__dirname, ".claude-skill-id");
var MODELS = {
  claude: {
    id: "claude-sonnet-4-6",
    name: "Claude Sonnet 4.6",
    maxTokens: 16384
  },
  gemini: {
    id: "gemini-2.5-pro",
    name: "Gemini 2.5 Pro",
    maxTokens: 8192
  }
};
var cachedSkillId = null;
async function getOrCreateClaudeSkill(client) {
  if (cachedSkillId) {
    console.log(`[LLM Renderer] Using cached Claude skill: ${cachedSkillId}`);
    return cachedSkillId;
  }
  try {
    const savedId = await readFile(SKILL_ID_CACHE_PATH, "utf-8");
    if (savedId.trim()) {
      try {
        await client.beta.skills.retrieve(savedId.trim(), {
          betas: ["skills-2025-10-02"]
        });
        cachedSkillId = savedId.trim();
        console.log(`[LLM Renderer] Loaded Claude skill from disk: ${cachedSkillId}`);
        return cachedSkillId;
      } catch (err) {
        console.log("[LLM Renderer] Saved skill_id is invalid, will re-create");
      }
    }
  } catch {
  }
  const SKILL_DISPLAY_TITLE = "Canvas Renderer Generator";
  console.log(`[LLM Renderer] Looking for existing skill: "${SKILL_DISPLAY_TITLE}"...`);
  try {
    const skillsList = await client.beta.skills.list({
      betas: ["skills-2025-10-02"]
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
      )
    ],
    betas: ["skills-2025-10-02"]
  });
  cachedSkillId = skill.id;
  console.log(`[LLM Renderer] Created Claude skill: ${cachedSkillId}`);
  console.log(`[LLM Renderer] Skill version: ${skill.latest_version}`);
  await writeFile(SKILL_ID_CACHE_PATH, cachedSkillId, "utf-8");
  return cachedSkillId;
}
var cachedGeminiPrompt = null;
async function loadGeminiPrompt() {
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
function extractCode(response) {
  const codeBlockMatch = response.match(/```(?:typescript|ts|javascript|js)?\s*\n([\s\S]*?)```/);
  if (codeBlockMatch) {
    return codeBlockMatch[1].trim();
  }
  const trimmed = response.trim();
  if (trimmed.startsWith("export ") || trimmed.startsWith("interface ") || trimmed.startsWith("function ") || trimmed.startsWith("//") || trimmed.startsWith("const ")) {
    return trimmed;
  }
  console.warn("[LLM Renderer] Could not identify code block, using full response");
  return trimmed;
}
function validateCode(code, domainName) {
  const issues = [];
  if (!/function\s+render\w*\s*\(/.test(code)) {
    issues.push("Missing main render function (expected a function named render<Something>)");
  }
  if (!/(?:function\s+\w*[Bb]ackground|\w*[Bb]ackground\s*=\s*(?:function|\())/i.test(code)) {
    console.log(`[LLM Renderer] Note: No background function found for ${domainName} (optional)`);
  }
  if (!/(?:function\s+\w*[Ll]egend|\w*[Ll]egend\s*=\s*(?:function|\())/i.test(code)) {
    console.log(`[LLM Renderer] Note: No legend function found for ${domainName} (optional)`);
  }
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
function transpileCachedCode(code) {
  return transpileToJS(code);
}
function transpileToJS(tsCode) {
  let cleaned = tsCode.replace(/^(\s*)export\s+/gm, "$1");
  const result = ts.transpileModule(cleaned, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.None,
      removeComments: false,
      strict: false
    }
  });
  if (result.diagnostics && result.diagnostics.length > 0) {
    const errors = result.diagnostics.map((d) => ts.flattenDiagnosticMessageText(d.messageText, "\n"));
    console.warn("[LLM Renderer] Transpilation warnings:", errors);
  }
  let output = result.outputText;
  output = output.replace(/"use strict";\s*\n?/g, "");
  output = output.replace(/Object\.defineProperty\(exports,\s*"__esModule",\s*\{[^}]*\}\);\s*\n?/g, "");
  output = output.replace(/^exports\.\w+\s*=\s*\w+;\s*\n?/gm, "");
  return output;
}
async function generateWithClaude(userMessage) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY environment variable is not set.");
  }
  const client = new Anthropic({ apiKey });
  const model = MODELS.claude;
  const skillId = await getOrCreateClaudeSkill(client);
  console.log(`[LLM Renderer] Using Claude skill: ${skillId}`);
  console.log(`[LLM Renderer] Calling Claude (${model.id}) with Skills API...`);
  const response = await client.beta.messages.create({
    model: model.id,
    max_tokens: model.maxTokens,
    betas: ["code-execution-2025-08-25", "skills-2025-10-02"],
    container: {
      skills: [
        {
          type: "custom",
          skill_id: skillId,
          version: "latest"
        }
      ]
    },
    messages: [{ role: "user", content: userMessage }],
    tools: [
      {
        type: "code_execution_20250825",
        name: "code_execution"
      }
    ]
  });
  let finalResponse = response;
  let retries = 0;
  const maxRetries = 5;
  while (finalResponse.stop_reason === "pause_turn" && retries < maxRetries) {
    console.log(`[LLM Renderer] Claude paused (turn ${retries + 1}), continuing...`);
    retries++;
    const continueMessages = [
      { role: "user", content: userMessage },
      { role: "assistant", content: finalResponse.content },
      { role: "user", content: "Please continue." }
    ];
    finalResponse = await client.beta.messages.create({
      model: model.id,
      max_tokens: model.maxTokens,
      betas: ["code-execution-2025-08-25", "skills-2025-10-02"],
      container: {
        id: finalResponse.container?.id,
        skills: [
          {
            type: "custom",
            skill_id: skillId,
            version: "latest"
          }
        ]
      },
      messages: continueMessages,
      tools: [
        {
          type: "code_execution_20250825",
          name: "code_execution"
        }
      ]
    });
  }
  const textBlocks = [];
  for (const block of finalResponse.content) {
    if (block.type === "text") {
      textBlocks.push(block.text);
    }
  }
  console.log(`[LLM Renderer] Claude response has ${finalResponse.content.length} content blocks, ${textBlocks.length} text blocks`);
  if (textBlocks.length === 0) {
    throw new Error("Claude returned no text content.");
  }
  let bestCodeBlock = null;
  for (let i = textBlocks.length - 1; i >= 0; i--) {
    const block = textBlocks[i];
    if (/function\s+render\w*\s*\(/.test(block)) {
      bestCodeBlock = block;
      break;
    }
  }
  if (!bestCodeBlock) {
    console.warn("[LLM Renderer] No text block contains a render function, using full response");
    bestCodeBlock = textBlocks.join("\n");
  }
  console.log(`[LLM Renderer] Claude response received, code length: ${bestCodeBlock.length}`);
  return bestCodeBlock;
}
async function generateWithGemini(userMessage) {
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
    systemInstruction: geminiPrompt
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
async function saveToCache(code, domainName, provider) {
  await mkdir(CACHE_DIR, { recursive: true });
  const timestamp = (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-");
  const filename = `${domainName}_${provider}_${timestamp}.ts`;
  const filepath = path.join(CACHE_DIR, filename);
  await writeFile(filepath, code, "utf-8");
  console.log(`[LLM Renderer] Cached renderer saved: ${filename}`);
  return filename;
}
async function listCachedRenderers(domain) {
  try {
    await mkdir(CACHE_DIR, { recursive: true });
    const files = await readdir(CACHE_DIR);
    const renderers = [];
    for (const file of files) {
      if (!file.endsWith(".ts") || file === ".gitkeep") continue;
      const match = file.match(/^(.+?)_(claude|gemini)_(.+)\.ts$/);
      if (!match) continue;
      const [, fileDomain, fileProvider, fileTimestamp] = match;
      if (domain && fileDomain !== domain) continue;
      const filepath = path.join(CACHE_DIR, file);
      const content = await readFile(filepath, "utf-8");
      const tIdx = fileTimestamp.indexOf("T");
      let parsedTimestamp = fileTimestamp;
      if (tIdx !== -1) {
        const datePart = fileTimestamp.substring(0, tIdx);
        const timePart = fileTimestamp.substring(tIdx);
        const timeFixed = timePart.replace(/-(\d{3}Z)$/, ".$1").replace(/-/g, ":");
        parsedTimestamp = datePart + timeFixed;
      }
      renderers.push({
        filename: file,
        domain: fileDomain,
        provider: fileProvider,
        timestamp: parsedTimestamp,
        size: content.length
      });
    }
    renderers.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    return renderers;
  } catch (error) {
    console.error("[LLM Renderer] Error listing cache:", error);
    return [];
  }
}
async function loadCachedRenderer(filename) {
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
async function deleteCachedRenderer(filename) {
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
async function generateRenderer(request) {
  const { domainName, states, provider } = request;
  const model = MODELS[provider];
  console.log(`[LLM Renderer] Starting generation for domain: ${domainName}`);
  console.log(`[LLM Renderer] Provider: ${provider} (${model.name})`);
  console.log(`[LLM Renderer] Sample states: ${states.length}`);
  try {
    const sampleStates = states.slice(0, 3);
    const userMessage = `Generate a complete Canvas renderer for the "${domainName}" domain.

Here are ${sampleStates.length} sample states showing the data structure you need to visualize:

${JSON.stringify(sampleStates, null, 2)}

Analyze the objects, their types, positions, properties, and the relations between them.
Then generate the three TypeScript functions as specified in the instructions.
Output ONLY the raw TypeScript code. Do not wrap it in markdown code blocks. Do not include any explanations. Just the code.`;
    let rawResponse;
    if (provider === "claude") {
      rawResponse = await generateWithClaude(userMessage);
    } else if (provider === "gemini") {
      rawResponse = await generateWithGemini(userMessage);
    } else {
      throw new Error(`Unknown provider: ${provider}`);
    }
    const tsCode = extractCode(rawResponse);
    const validation = validateCode(tsCode, domainName);
    if (!validation.valid) {
      console.warn("[LLM Renderer] Validation issues:", validation.issues);
    }
    const transpiled = transpileToJS(tsCode);
    console.log(`[LLM Renderer] Transpiled TS (${tsCode.length} chars) -> JS (${transpiled.length} chars)`);
    const savedFile = await saveToCache(transpiled, domainName, provider);
    return {
      success: true,
      code: transpiled,
      savedFile,
      provider: model.name,
      model: model.id
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
      error: errorMessage
    };
  }
}

// llm-domain-interpreter.ts
import Anthropic2 from "@anthropic-ai/sdk";
import { toFile as toFile2 } from "@anthropic-ai/sdk";
import { GoogleGenerativeAI as GoogleGenerativeAI2 } from "@google/generative-ai";
import ts2 from "typescript";
import { readFile as readFile2, writeFile as writeFile2, mkdir as mkdir2, readdir as readdir2, unlink as unlink2 } from "fs/promises";
import path2 from "path";
import { fileURLToPath as fileURLToPath2 } from "url";
import { createReadStream as createReadStream2 } from "fs";
var __filename2 = fileURLToPath2(import.meta.url);
var __dirname2 = path2.dirname(__filename2);
var SKILLS_DIR2 = __dirname2.endsWith("dist") ? path2.join(__dirname2, "..", "skills", "pddl-domain-interpreter") : path2.join(__dirname2, "skills", "pddl-domain-interpreter");
var SKILL_MD_PATH2 = path2.join(SKILLS_DIR2, "SKILL.md");
var SKILL_INTERFACES_PATH2 = path2.join(SKILLS_DIR2, "interfaces.ts");
var SKILL_EXAMPLE_PATH2 = path2.join(SKILLS_DIR2, "example-blocks-world.ts");
var SKILL_RULES_PATH2 = path2.join(SKILLS_DIR2, "rules.md");
var GEMINI_PROMPT_PATH2 = __dirname2.endsWith("dist") ? path2.join(__dirname2, "..", "prompts", "domain-interpreter-skill.txt") : path2.join(__dirname2, "prompts", "domain-interpreter-skill.txt");
var CACHE_DIR2 = __dirname2.endsWith("dist") ? path2.join(__dirname2, "..", "llm_transformers") : path2.join(__dirname2, "llm_transformers");
var SKILL_ID_CACHE_PATH2 = __dirname2.endsWith("dist") ? path2.join(__dirname2, "..", ".claude-transformer-skill-id") : path2.join(__dirname2, ".claude-transformer-skill-id");
var MODELS2 = {
  claude: {
    id: "claude-sonnet-4-6",
    name: "Claude Sonnet 4.6",
    maxTokens: 16384
  },
  gemini: {
    id: "gemini-2.5-pro",
    name: "Gemini 2.5 Pro",
    maxTokens: 8192
  }
};
var cachedSkillId2 = null;
async function getOrCreateClaudeSkill2(client) {
  if (cachedSkillId2) {
    console.log(`[LLM Interpreter] Using cached Claude skill: ${cachedSkillId2}`);
    return cachedSkillId2;
  }
  try {
    const savedId = await readFile2(SKILL_ID_CACHE_PATH2, "utf-8");
    if (savedId.trim()) {
      try {
        await client.beta.skills.retrieve(savedId.trim(), {
          betas: ["skills-2025-10-02"]
        });
        cachedSkillId2 = savedId.trim();
        console.log(`[LLM Interpreter] Loaded Claude skill from disk: ${cachedSkillId2}`);
        return cachedSkillId2;
      } catch (err) {
        console.log("[LLM Interpreter] Saved skill_id is invalid, will re-create");
      }
    }
  } catch {
  }
  const SKILL_DISPLAY_TITLE = "PDDL Domain Interpreter";
  console.log(`[LLM Interpreter] Looking for existing skill: "${SKILL_DISPLAY_TITLE}"...`);
  try {
    const skillsList = await client.beta.skills.list({
      betas: ["skills-2025-10-02"]
    });
    for await (const existingSkill of skillsList) {
      if (existingSkill.display_title === SKILL_DISPLAY_TITLE) {
        cachedSkillId2 = existingSkill.id;
        console.log(`[LLM Interpreter] Found existing Claude skill: ${cachedSkillId2}`);
        await writeFile2(SKILL_ID_CACHE_PATH2, cachedSkillId2, "utf-8");
        return cachedSkillId2;
      }
    }
  } catch (listErr) {
    console.warn("[LLM Interpreter] Could not list skills:", listErr);
  }
  console.log("[LLM Interpreter] Creating new Claude skill...");
  const skillDir = "pddl-domain-interpreter";
  const skill = await client.beta.skills.create({
    display_title: SKILL_DISPLAY_TITLE,
    files: [
      await toFile2(
        createReadStream2(SKILL_MD_PATH2),
        `${skillDir}/SKILL.md`,
        { type: "text/markdown" }
      ),
      await toFile2(
        createReadStream2(SKILL_INTERFACES_PATH2),
        `${skillDir}/interfaces.ts`,
        { type: "text/plain" }
      ),
      await toFile2(
        createReadStream2(SKILL_EXAMPLE_PATH2),
        `${skillDir}/example-blocks-world.ts`,
        { type: "text/plain" }
      ),
      await toFile2(
        createReadStream2(SKILL_RULES_PATH2),
        `${skillDir}/rules.md`,
        { type: "text/markdown" }
      )
    ],
    betas: ["skills-2025-10-02"]
  });
  cachedSkillId2 = skill.id;
  console.log(`[LLM Interpreter] Created Claude skill: ${cachedSkillId2}`);
  console.log(`[LLM Interpreter] Skill version: ${skill.latest_version}`);
  await writeFile2(SKILL_ID_CACHE_PATH2, cachedSkillId2, "utf-8");
  return cachedSkillId2;
}
var cachedGeminiPrompt2 = null;
async function loadGeminiPrompt2() {
  if (cachedGeminiPrompt2) return cachedGeminiPrompt2;
  try {
    cachedGeminiPrompt2 = await readFile2(GEMINI_PROMPT_PATH2, "utf-8");
    console.log("[LLM Interpreter] Gemini prompt loaded, length:", cachedGeminiPrompt2.length);
    return cachedGeminiPrompt2;
  } catch (error) {
    console.error("[LLM Interpreter] Failed to load Gemini prompt:", error);
    throw new Error(
      "Gemini prompt file not found. Ensure backend/api/prompts/domain-interpreter-skill.txt exists."
    );
  }
}
function extractCode2(response) {
  const codeBlockMatch = response.match(/```(?:typescript|ts|javascript|js)?\s*\n([\s\S]*?)```/);
  if (codeBlockMatch) {
    return codeBlockMatch[1].trim();
  }
  const trimmed = response.trim();
  if (trimmed.startsWith("export ") || trimmed.startsWith("interface ") || trimmed.startsWith("function ") || trimmed.startsWith("//") || trimmed.startsWith("const ")) {
    return trimmed;
  }
  console.warn("[LLM Interpreter] Could not identify code block, using full response");
  return trimmed;
}
function validateCode2(code, _domainName) {
  const issues = [];
  if (!/function\s+transform\w*\s*\(/.test(code)) {
    issues.push(
      "Missing transformer function (expected a function named transform<Something>)"
    );
  }
  if (/import\s+/.test(code) && !/import\s+type/.test(code)) {
    issues.push("Code contains import statements (not allowed in runtime-evaluated code)");
  }
  if (/require\s*\(/.test(code)) {
    issues.push("Code uses require() (not allowed)");
  }
  if (/Math\.random\s*\(/.test(code)) {
    issues.push("Code uses Math.random() \u2014 positions/colors must be deterministic");
  }
  return { valid: issues.length === 0, issues };
}
function transpileCachedTransformer(code) {
  return transpileToJS2(code);
}
function transpileToJS2(tsCode) {
  let cleaned = tsCode.replace(/^(\s*)export\s+/gm, "$1");
  const result = ts2.transpileModule(cleaned, {
    compilerOptions: {
      target: ts2.ScriptTarget.ES2020,
      module: ts2.ModuleKind.None,
      removeComments: false,
      strict: false
    }
  });
  if (result.diagnostics && result.diagnostics.length > 0) {
    const errors = result.diagnostics.map(
      (d) => ts2.flattenDiagnosticMessageText(d.messageText, "\n")
    );
    console.warn("[LLM Interpreter] Transpilation warnings:", errors);
  }
  let output = result.outputText;
  output = output.replace(/"use strict";\s*\n?/g, "");
  output = output.replace(
    /Object\.defineProperty\(exports,\s*"__esModule",\s*\{[^}]*\}\);\s*\n?/g,
    ""
  );
  output = output.replace(/^exports\.\w+\s*=\s*\w+;\s*\n?/gm, "");
  return output;
}
async function generateWithClaude2(userMessage) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY environment variable is not set.");
  }
  const client = new Anthropic2({ apiKey });
  const model = MODELS2.claude;
  const skillId = await getOrCreateClaudeSkill2(client);
  console.log(`[LLM Interpreter] Using Claude skill: ${skillId}`);
  console.log(`[LLM Interpreter] Calling Claude (${model.id}) with Skills API...`);
  const response = await client.beta.messages.create({
    model: model.id,
    max_tokens: model.maxTokens,
    betas: ["code-execution-2025-08-25", "skills-2025-10-02"],
    container: {
      skills: [
        {
          type: "custom",
          skill_id: skillId,
          version: "latest"
        }
      ]
    },
    messages: [{ role: "user", content: userMessage }],
    tools: [
      {
        type: "code_execution_20250825",
        name: "code_execution"
      }
    ]
  });
  let finalResponse = response;
  let retries = 0;
  const maxRetries = 5;
  while (finalResponse.stop_reason === "pause_turn" && retries < maxRetries) {
    console.log(`[LLM Interpreter] Claude paused (turn ${retries + 1}), continuing...`);
    retries++;
    const continueMessages = [
      { role: "user", content: userMessage },
      { role: "assistant", content: finalResponse.content },
      { role: "user", content: "Please continue." }
    ];
    finalResponse = await client.beta.messages.create({
      model: model.id,
      max_tokens: model.maxTokens,
      betas: ["code-execution-2025-08-25", "skills-2025-10-02"],
      container: {
        id: finalResponse.container?.id,
        skills: [
          {
            type: "custom",
            skill_id: skillId,
            version: "latest"
          }
        ]
      },
      messages: continueMessages,
      tools: [
        {
          type: "code_execution_20250825",
          name: "code_execution"
        }
      ]
    });
  }
  const textBlocks = [];
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
  let bestCodeBlock = null;
  for (let i = textBlocks.length - 1; i >= 0; i--) {
    const block = textBlocks[i];
    if (/function\s+transform\w*\s*\(/.test(block)) {
      bestCodeBlock = block;
      break;
    }
  }
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
async function generateWithGemini2(userMessage) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is not set.");
  }
  const geminiPrompt = await loadGeminiPrompt2();
  const genAI = new GoogleGenerativeAI2(apiKey);
  const modelConfig = MODELS2.gemini;
  console.log(`[LLM Interpreter] Calling Gemini (${modelConfig.id})...`);
  const model = genAI.getGenerativeModel({
    model: modelConfig.id,
    systemInstruction: geminiPrompt
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
async function saveToCache2(code, domainName, provider) {
  await mkdir2(CACHE_DIR2, { recursive: true });
  const timestamp = (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-");
  const filename = `${domainName}_${provider}_${timestamp}.ts`;
  const filepath = path2.join(CACHE_DIR2, filename);
  await writeFile2(filepath, code, "utf-8");
  console.log(`[LLM Interpreter] Cached transformer saved: ${filename}`);
  return filename;
}
async function listCachedTransformers(domain) {
  try {
    await mkdir2(CACHE_DIR2, { recursive: true });
    const files = await readdir2(CACHE_DIR2);
    const transformers = [];
    for (const file of files) {
      if (!file.endsWith(".ts") || file === ".gitkeep") continue;
      const match = file.match(/^(.+?)_(claude|gemini)_(.+)\.ts$/);
      if (!match) continue;
      const [, fileDomain, fileProvider, fileTimestamp] = match;
      if (domain && fileDomain !== domain) continue;
      const filepath = path2.join(CACHE_DIR2, file);
      const content = await readFile2(filepath, "utf-8");
      const tIdx = fileTimestamp.indexOf("T");
      let parsedTimestamp = fileTimestamp;
      if (tIdx !== -1) {
        const datePart = fileTimestamp.substring(0, tIdx);
        const timePart = fileTimestamp.substring(tIdx);
        const timeFixed = timePart.replace(/-(\d{3}Z)$/, ".$1").replace(/-/g, ":");
        parsedTimestamp = datePart + timeFixed;
      }
      transformers.push({
        filename: file,
        domain: fileDomain,
        provider: fileProvider,
        timestamp: parsedTimestamp,
        size: content.length
      });
    }
    transformers.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    return transformers;
  } catch (error) {
    console.error("[LLM Interpreter] Error listing cache:", error);
    return [];
  }
}
async function loadCachedTransformer(filename) {
  try {
    const filepath = path2.join(CACHE_DIR2, filename);
    const code = await readFile2(filepath, "utf-8");
    console.log(`[LLM Interpreter] Loaded cached transformer: ${filename}`);
    return code;
  } catch (error) {
    console.error(`[LLM Interpreter] Cache file not found: ${filename}`);
    return null;
  }
}
async function deleteCachedTransformer(filename) {
  try {
    const filepath = path2.join(CACHE_DIR2, filename);
    await unlink2(filepath);
    console.log(`[LLM Interpreter] Deleted cached transformer: ${filename}`);
    return true;
  } catch (error) {
    console.error(`[LLM Interpreter] Failed to delete: ${filename}`);
    return false;
  }
}
async function generateTransformer(request) {
  const { domainName, domainPddl, sampleStates, provider } = request;
  const model = MODELS2[provider];
  console.log(`[LLM Interpreter] Starting generation for domain: ${domainName}`);
  console.log(`[LLM Interpreter] Provider: ${provider} (${model.name})`);
  console.log(`[LLM Interpreter] Sample states: ${sampleStates.length}`);
  console.log(`[LLM Interpreter] PDDL domain length: ${domainPddl.length} chars`);
  try {
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

Output ONLY the raw TypeScript code. Do not wrap it in markdown code blocks. Do not include any explanations. Just the code, starting with the interface declarations.`;
    let rawResponse;
    if (provider === "claude") {
      rawResponse = await generateWithClaude2(userMessage);
    } else if (provider === "gemini") {
      rawResponse = await generateWithGemini2(userMessage);
    } else {
      throw new Error(`Unknown provider: ${provider}`);
    }
    const tsCode = extractCode2(rawResponse);
    const validation = validateCode2(tsCode, domainName);
    if (!validation.valid) {
      console.warn("[LLM Interpreter] Validation issues:", validation.issues);
    }
    const transpiled = transpileToJS2(tsCode);
    console.log(
      `[LLM Interpreter] Transpiled TS (${tsCode.length} chars) -> JS (${transpiled.length} chars)`
    );
    const savedFile = await saveToCache2(transpiled, domainName, provider);
    return {
      success: true,
      code: transpiled,
      savedFile,
      provider: model.name,
      model: model.id
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
      error: errorMessage
    };
  }
}

// saved-domains.ts
import { readFile as readFile3, writeFile as writeFile3, mkdir as mkdir3 } from "fs/promises";
import path3 from "path";
import { fileURLToPath as fileURLToPath3 } from "url";
import crypto from "crypto";
var __filename3 = fileURLToPath3(import.meta.url);
var __dirname3 = path3.dirname(__filename3);
var DATA_DIR = __dirname3.endsWith("dist") ? path3.join(__dirname3, "..", "data") : path3.join(__dirname3, "data");
var SAVED_DOMAINS_FILE = path3.join(DATA_DIR, "saved_domains.json");
function hashPddl(pddlText) {
  return crypto.createHash("sha256").update(pddlText.trim()).digest("hex").slice(0, 12);
}
async function loadStore() {
  try {
    const raw = await readFile3(SAVED_DOMAINS_FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return { nextId: 1, domains: [] };
  }
}
async function saveStore(store) {
  await mkdir3(DATA_DIR, { recursive: true });
  await writeFile3(SAVED_DOMAINS_FILE, JSON.stringify(store, null, 2), "utf-8");
}
function generateDisplayName(baseName, existingNames) {
  const capitalized = baseName.charAt(0).toUpperCase() + baseName.slice(1);
  if (!existingNames.includes(capitalized)) {
    return capitalized;
  }
  let counter = 2;
  while (existingNames.includes(`${capitalized} (${counter})`)) {
    counter++;
  }
  return `${capitalized} (${counter})`;
}
async function listSavedDomains() {
  const store = await loadStore();
  return store.domains.map((d) => ({
    id: d.id,
    displayName: d.displayName,
    domainName: d.domainName,
    pddlHash: d.pddlHash,
    domainPddlPreview: d.domainPddl.slice(0, 200) + (d.domainPddl.length > 200 ? "..." : ""),
    provider: d.provider,
    createdAt: d.createdAt
  }));
}
async function getSavedDomain(id) {
  const store = await loadStore();
  return store.domains.find((d) => d.id === id) || null;
}
async function saveDomain(params) {
  const store = await loadStore();
  const pddlHash = hashPddl(params.domainPddl);
  const existing = store.domains.find((d) => d.pddlHash === pddlHash);
  if (existing) {
    existing.transformerCode = params.transformerCode;
    existing.rendererCode = params.rendererCode;
    existing.provider = params.provider;
    existing.createdAt = (/* @__PURE__ */ new Date()).toISOString();
    await saveStore(store);
    console.log(`[SavedDomains] Updated existing domain: ${existing.displayName} (id=${existing.id})`);
    return existing;
  }
  const existingNames = store.domains.map((d) => d.displayName);
  const displayName = generateDisplayName(params.domainName, existingNames);
  const newDomain = {
    id: store.nextId,
    displayName,
    domainName: params.domainName,
    pddlHash,
    domainPddl: params.domainPddl,
    transformerCode: params.transformerCode,
    rendererCode: params.rendererCode,
    provider: params.provider,
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  store.domains.push(newDomain);
  store.nextId++;
  await saveStore(store);
  console.log(`[SavedDomains] Saved new domain: ${displayName} (id=${newDomain.id}, hash=${pddlHash})`);
  return newDomain;
}

// visualizer.ts
import path4 from "path";
import { fileURLToPath as fileURLToPath4 } from "url";
import { exec } from "child_process";
import { promisify } from "util";
var execAsync = promisify(exec);
var __filename4 = fileURLToPath4(import.meta.url);
var __dirname4 = path4.dirname(__filename4);
var DATA_DIR2 = path4.join(__dirname4, "data");
function getPythonCommand() {
  if (process.env.PYTHON_CMD) {
    console.log("[Python Detection] Using PYTHON_CMD from environment:", process.env.PYTHON_CMD);
    return process.env.PYTHON_CMD;
  }
  const pythonCandidates = [
    "python3",
    "python",
    "python3.11",
    "python3.12",
    "/usr/bin/python3",
    "/usr/local/bin/python3",
    "/usr/bin/python3.11",
    "/usr/local/bin/python3.11"
  ];
  console.log("[Python Detection] Searching for Python executable...");
  for (const cmd of pythonCandidates) {
    try {
      const { execSync } = __require("child_process");
      const version = execSync(`${cmd} --version 2>&1`, {
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"]
      }).trim();
      console.log(`[Python Detection] Found: ${cmd} (${version})`);
      return cmd;
    } catch (error) {
    }
  }
  console.warn('[Python Detection] No Python found, defaulting to "python3"');
  return "python3";
}
var PYTHON_CMD = getPythonCommand();
console.log("[Python Detection] Using Python command:", PYTHON_CMD);
function resolvePlannerDir() {
  if (__dirname4.endsWith("/dist") || __dirname4.endsWith("\\dist")) {
    return path4.join(__dirname4, "../../planner");
  } else {
    return path4.join(__dirname4, "../planner");
  }
}
function resolvePlanningToolsDir() {
  if (__dirname4.endsWith("/dist") || __dirname4.endsWith("\\dist")) {
    return path4.join(__dirname4, "../../../planning-tools");
  } else {
    return path4.join(__dirname4, "../../planning-tools");
  }
}
var PLANNER_DIR = resolvePlannerDir();
var PLANNING_TOOLS_DIR = resolvePlanningToolsDir();
console.log("[Path Resolution] __dirname:", __dirname4);
console.log("[Path Resolution] PLANNER_DIR:", PLANNER_DIR);
console.log("[Path Resolution] PLANNING_TOOLS_DIR:", PLANNING_TOOLS_DIR);
var DOMAIN_CONFIGS = {
  "blocks-world": {
    name: "Blocks World",
    description: "Classic block stacking problem",
    domainFile: path4.join(PLANNER_DIR, "domains/blocks_world/domain.pddl")
  },
  "gripper": {
    name: "Gripper",
    description: "Robot with grippers moving balls between rooms",
    domainFile: path4.join(PLANNER_DIR, "domains/gripper/domain.pddl")
  },
  "depot": {
    name: "Depot",
    description: "Trucks deliver packages between depots and distributors",
    domainFile: path4.join(PLANNER_DIR, "domains/depot/domain.pddl")
  },
  "hanoi": {
    name: "Hanoi",
    description: "Moving disks between pegs (Tower of Hanoi)",
    domainFile: path4.join(PLANNER_DIR, "domains/hanoi/domain.pddl")
  },
  "rovers": {
    name: "Rovers",
    description: "Planetary rovers navigating between waypoints and collecting images",
    domainFile: path4.join(PLANNER_DIR, "domains/rovers/domain.pddl")
  },
  "satellite": {
    name: "Satellite",
    description: "Satellites calibrate instruments, take images, and transmit them",
    domainFile: path4.join(PLANNER_DIR, "domains/satellite/domain.pddl")
  }
};
var VALID_STRATEGY_IDS = [
  "astar-lmcut",
  "astar-blind",
  "greedy-ff",
  "lazy-greedy-ff",
  "greedy-add",
  "lama-first",
  "greedy-cea"
];
var visualizerRouter = router({
  /**
   * Generate states for pre-built examples
   */
  generateStates: publicProcedure.input(
    z2.object({
      domain: z2.enum(["blocks-world", "gripper", "depot", "hanoi", "rovers", "satellite"])
    })
  ).mutation(async ({ input }) => {
    try {
      const dataFile = path4.join(
        DATA_DIR2,
        `${input.domain.replace("-", "_")}_rendered.json`
      );
      const data = JSON.parse(await readFile4(dataFile, "utf-8"));
      const plan = [];
      for (let i = 1; i < data.states.length; i++) {
        const action = data.states[i].metadata?.action;
        if (action) {
          plan.push(action);
        }
      }
      return {
        success: true,
        domain: input.domain,
        problem: "example",
        plan,
        num_states: data.states.length,
        states: data.states
      };
    } catch (error) {
      console.error("Error generating states:", error);
      throw new Error(
        error instanceof Error ? error.message : "Failed to generate states"
      );
    }
  }),
  /**
   * Upload custom problem file and solve with planner
   */
  uploadAndGenerate: publicProcedure.input(
    z2.object({
      domainContent: z2.string(),
      problemContent: z2.string(),
      domainName: z2.enum(["blocks-world", "gripper", "depot", "hanoi", "rovers", "satellite"]),
      searchStrategy: z2.enum(VALID_STRATEGY_IDS).optional().default("lazy-greedy-ff")
    })
  ).mutation(async ({ input }) => {
    console.log("[uploadAndGenerate] Starting with domain:", input.domainName);
    console.log("[uploadAndGenerate] Search strategy:", input.searchStrategy);
    console.log("[uploadAndGenerate] Problem content length:", input.problemContent.length);
    let domainPath = "";
    let problemPath = "";
    try {
      const uploadsDir = path4.join(__dirname4, "uploads");
      await mkdir4(uploadsDir, { recursive: true });
      const timestamp = Date.now();
      if (!input.domainContent || input.domainContent.trim() === "") {
        const domainConfig = DOMAIN_CONFIGS[input.domainName];
        if (!domainConfig) {
          throw new Error(`Unknown domain: ${input.domainName}`);
        }
        domainPath = domainConfig.domainFile;
      } else {
        domainPath = path4.join(uploadsDir, `domain_${timestamp}.pddl`);
        await writeFile4(domainPath, input.domainContent, "utf-8");
      }
      problemPath = path4.join(uploadsDir, `problem_${timestamp}.pddl`);
      await writeFile4(problemPath, input.problemContent, "utf-8");
      const pythonScript = path4.join(PLANNER_DIR, "visualizer_api.py");
      console.log("[uploadAndGenerate] Running Python script...");
      console.log("[uploadAndGenerate] Using Python command:", PYTHON_CMD);
      const { stdout, stderr } = await execAsync(
        `"${PYTHON_CMD}" "${pythonScript}" "${domainPath}" "${problemPath}" "${input.domainName}" "${input.searchStrategy}"`,
        {
          maxBuffer: 50 * 1024 * 1024,
          // 50 MB to handle large plans (1000+ actions)
          timeout: 24e5,
          // 40 minute timeout for planner (Python default is 1800s/30min + buffer)
          env: {
            ...process.env,
            PYTHONPATH: "",
            // Clear PYTHONPATH to prevent Python 3.13 imports
            PYTHONHOME: ""
            // Clear PYTHONHOME as well
          }
        }
      );
      console.log("[uploadAndGenerate] Python script completed");
      console.log("[uploadAndGenerate] stdout length:", stdout.length);
      console.log("[uploadAndGenerate] stderr:", stderr || "none");
      if (stderr && !stdout) {
        throw new Error(`Python error: ${stderr}`);
      }
      console.log("[uploadAndGenerate] Parsing JSON output...");
      const data = JSON.parse(stdout);
      console.log("[uploadAndGenerate] JSON parsed successfully, success:", data.success);
      if (!data.success) {
        throw new Error(data.error || "Failed to solve problem");
      }
      try {
        console.log("[uploadAndGenerate] Cleaning up uploaded files...");
        await unlink3(problemPath);
        console.log("[uploadAndGenerate] Deleted problem file:", problemPath);
        if (input.domainContent && input.domainContent.trim() !== "") {
          await unlink3(domainPath);
          console.log("[uploadAndGenerate] Deleted domain file:", domainPath);
        }
      } catch (cleanupError) {
        console.warn("[uploadAndGenerate] Failed to clean up files:", cleanupError);
      }
      return {
        success: true,
        domain: data.domain,
        problem: data.problem,
        plan: data.plan,
        num_states: data.num_states,
        states: data.states,
        used_planner: data.used_planner,
        planner_info: data.planner_info,
        search_strategy: data.search_strategy
      };
    } catch (error) {
      try {
        if (problemPath) {
          await unlink3(problemPath).catch(() => {
          });
        }
        if (domainPath && input.domainContent && input.domainContent.trim() !== "") {
          await unlink3(domainPath).catch(() => {
          });
        }
      } catch {
      }
      console.error("[uploadAndGenerate] Error:", error);
      console.error("[uploadAndGenerate] Error stack:", error instanceof Error ? error.stack : "No stack");
      throw new Error(
        error instanceof Error ? error.message : "Failed to process uploaded files"
      );
    }
  }),
  /**
   * Upload a fully custom domain + problem file and solve with planner.
   * Unlike uploadAndGenerate, this accepts any domain name and requires
   * the domain PDDL content to be provided. The DefaultRenderer handles
   * state generation for unknown domains.
   */
  uploadAndGenerateCustom: publicProcedure.input(
    z2.object({
      domainContent: z2.string().min(1, "Domain PDDL content is required"),
      problemContent: z2.string().min(1, "Problem PDDL content is required"),
      domainName: z2.string().min(1, "Domain name is required"),
      searchStrategy: z2.enum(VALID_STRATEGY_IDS).optional().default("lazy-greedy-ff")
    })
  ).mutation(async ({ input }) => {
    console.log("[uploadAndGenerateCustom] Starting with custom domain:", input.domainName);
    console.log("[uploadAndGenerateCustom] Search strategy:", input.searchStrategy);
    let domainPath = "";
    let problemPath = "";
    try {
      const uploadsDir = path4.join(__dirname4, "uploads");
      await mkdir4(uploadsDir, { recursive: true });
      const timestamp = Date.now();
      domainPath = path4.join(uploadsDir, `custom_domain_${timestamp}.pddl`);
      problemPath = path4.join(uploadsDir, `custom_problem_${timestamp}.pddl`);
      await writeFile4(domainPath, input.domainContent, "utf-8");
      await writeFile4(problemPath, input.problemContent, "utf-8");
      const pythonScript = path4.join(PLANNER_DIR, "visualizer_api.py");
      console.log("[uploadAndGenerateCustom] Running Python script...");
      const { stdout, stderr } = await execAsync(
        `"${PYTHON_CMD}" "${pythonScript}" "${domainPath}" "${problemPath}" "custom" "${input.searchStrategy}"`,
        {
          maxBuffer: 50 * 1024 * 1024,
          timeout: 24e5,
          env: {
            ...process.env,
            PYTHONPATH: "",
            PYTHONHOME: ""
          }
        }
      );
      console.log("[uploadAndGenerateCustom] Python script completed");
      if (stderr && !stdout) {
        throw new Error(`Python error: ${stderr}`);
      }
      const data = JSON.parse(stdout);
      if (!data.success) {
        throw new Error(data.error || "Failed to solve custom problem");
      }
      try {
        await unlink3(domainPath);
        await unlink3(problemPath);
      } catch {
      }
      return {
        success: true,
        domain: data.domain,
        problem: data.problem,
        plan: data.plan,
        num_states: data.num_states,
        states: data.states,
        used_planner: data.used_planner,
        planner_info: data.planner_info,
        search_strategy: data.search_strategy
      };
    } catch (error) {
      try {
        if (domainPath) await unlink3(domainPath).catch(() => {
        });
        if (problemPath) await unlink3(problemPath).catch(() => {
        });
      } catch {
      }
      console.error("[uploadAndGenerateCustom] Error:", error);
      throw new Error(
        error instanceof Error ? error.message : "Failed to process custom domain files"
      );
    }
  }),
  /**
   * Get list of available domains
   */
  listDomains: publicProcedure.query(() => {
    return Object.entries(DOMAIN_CONFIGS).map(([id, config]) => ({
      id,
      name: config.name,
      description: config.description
    }));
  }),
  /**
   * Get list of available search strategies
   */
  listStrategies: publicProcedure.query(async () => {
    try {
      const pythonScript = path4.join(PLANNER_DIR, "visualizer_api.py");
      const { stdout } = await execAsync(
        `"${PYTHON_CMD}" "${pythonScript}" list-strategies`,
        {
          timeout: 1e4,
          env: {
            ...process.env,
            PYTHONPATH: "",
            PYTHONHOME: ""
          }
        }
      );
      const data = JSON.parse(stdout);
      if (data.success) {
        return data.strategies;
      }
      throw new Error("Failed to get strategies");
    } catch (error) {
      console.error("[listStrategies] Error:", error);
      return [
        {
          id: "lazy-greedy-ff",
          name: "Lazy Greedy + FF (Very Fast)",
          description: "Lazy evaluation greedy search - fastest option",
          isOptimal: false,
          speed: "fast",
          whenToUse: "When speed is the priority and plan quality is secondary",
          warning: null
        },
        {
          id: "greedy-ff",
          name: "Greedy Best-First + FF (Fast)",
          description: "Fast satisficing search using FF heuristic",
          isOptimal: false,
          speed: "fast",
          whenToUse: "Best for quick results on medium to large problems",
          warning: null
        },
        {
          id: "astar-lmcut",
          name: "A* + LM-cut (Optimal)",
          description: "Optimal search using A* with landmark-cut heuristic",
          isOptimal: true,
          speed: "slow",
          whenToUse: "When you need the shortest possible plan and can wait",
          warning: "\u26A0\uFE0F Optimal search can be very slow for large problems (10+ objects). Consider using a satisficing strategy for faster results."
        }
      ];
    }
  }),
  /**
   * Check system status (Python, Fast Downward availability)
   */
  checkStatus: publicProcedure.query(async () => {
    const status = {
      python: { available: false, version: "", command: PYTHON_CMD },
      fastDownward: { available: false, path: "" }
    };
    try {
      const { stdout: pythonVersion } = await execAsync(`"${PYTHON_CMD}" --version`);
      status.python.available = true;
      status.python.version = pythonVersion.trim();
    } catch (error) {
      status.python.available = false;
    }
    try {
      const fdPath = path4.join(PLANNING_TOOLS_DIR, "downward/fast-downward.py");
      const { stdout } = await execAsync(`"${PYTHON_CMD}" "${fdPath}" --help`, { timeout: 5e3 });
      if (stdout.includes("Fast Downward")) {
        status.fastDownward.available = true;
        status.fastDownward.path = fdPath;
      }
    } catch (error) {
      try {
        const altFdPath = path4.join(__dirname4, "../../planning-tools/downward/fast-downward.py");
        const { stdout } = await execAsync(`"${PYTHON_CMD}" "${altFdPath}" --help`, { timeout: 5e3 });
        if (stdout.includes("Fast Downward")) {
          status.fastDownward.available = true;
          status.fastDownward.path = altFdPath;
        }
      } catch {
        status.fastDownward.available = false;
      }
    }
    return status;
  }),
  /**
   * Get domain definition text for a specific domain
   */
  getDomainDefinition: publicProcedure.input(z2.object({
    domainName: z2.enum(["blocks-world", "gripper", "depot", "hanoi", "rovers", "satellite"])
  })).query(async ({ input }) => {
    const domainConfig = DOMAIN_CONFIGS[input.domainName];
    if (!domainConfig) {
      throw new Error(`Domain ${input.domainName} not found`);
    }
    try {
      const domainContent = await readFile4(domainConfig.domainFile, "utf-8");
      return {
        domainName: input.domainName,
        content: domainContent
      };
    } catch (error) {
      console.error(`[getDomainDefinition] Error reading domain file:`, error);
      throw new Error(`Failed to read domain file for ${input.domainName}`);
    }
  }),
  // ==================== LLM RENDERER ENDPOINTS ====================
  /**
   * Generate a Canvas renderer using an LLM (Claude or Gemini).
   * Accepts domain name, sample states, and the LLM provider to use.
   * Returns the generated TypeScript code.
   */
  llmGenerateRenderer: publicProcedure.input(
    z2.object({
      domainName: z2.string(),
      states: z2.array(z2.any()),
      provider: z2.enum(["claude", "gemini"])
    })
  ).mutation(async ({ input }) => {
    console.log("[Stage 2 - Renderer] ========================================");
    console.log("[Stage 2 - Renderer] Starting canvas renderer generation");
    console.log("[Stage 2 - Renderer] Domain:", input.domainName);
    console.log("[Stage 2 - Renderer] Provider:", input.provider);
    console.log("[Stage 2 - Renderer] States count:", input.states.length);
    if (input.states.length > 0) {
      const firstState = input.states[0];
      const hasObjects = firstState?.objects && Array.isArray(firstState.objects);
      const firstObj = hasObjects ? firstState.objects[0] : null;
      const isEnriched = firstObj && (firstObj.position || firstObj.properties);
      console.log("[Stage 2 - Renderer] States enriched:", !!isEnriched);
      if (firstObj) {
        console.log("[Stage 2 - Renderer] Sample object keys:", Object.keys(firstObj).join(", "));
      }
    }
    const result = await generateRenderer({
      domainName: input.domainName,
      states: input.states,
      provider: input.provider
    });
    if (!result.success) {
      console.error("[Stage 2 - Renderer] FAILED:", result.error);
      throw new Error(result.error || "LLM generation failed");
    }
    console.log("[Stage 2 - Renderer] SUCCESS - Code length:", result.code?.length || 0);
    console.log("[Stage 2 - Renderer] ========================================");
    return result;
  }),
  /**
   * List cached LLM-generated renderers, optionally filtered by domain.
   */
  llmListCachedRenderers: publicProcedure.input(
    z2.object({
      domain: z2.string().optional()
    }).optional()
  ).query(async ({ input }) => {
    const renderers = await listCachedRenderers(input?.domain);
    return renderers;
  }),
  /**
   * Load a specific cached renderer by filename.
   */
  llmLoadCachedRenderer: publicProcedure.input(
    z2.object({
      filename: z2.string()
    })
  ).query(async ({ input }) => {
    const code = await loadCachedRenderer(input.filename);
    if (!code) {
      throw new Error(`Cached renderer not found: ${input.filename}`);
    }
    const cleanCode = transpileCachedCode(code);
    return { filename: input.filename, code: cleanCode };
  }),
  /**
   * Delete a specific cached renderer by filename.
   */
  llmDeleteCachedRenderer: publicProcedure.input(
    z2.object({
      filename: z2.string()
    })
  ).mutation(async ({ input }) => {
    const success = await deleteCachedRenderer(input.filename);
    return { success, filename: input.filename };
  }),
  // ==================== PDDL DOMAIN INTERPRETER ====================
  /**
   * Generate a TypeScript state transformer for a custom PDDL domain.
   * Accepts the domain name, full PDDL domain text, sample raw states,
   * and the LLM provider to use.
   * Returns the generated and transpiled JavaScript transformer code.
   */
  llmGenerateTransformer: publicProcedure.input(
    z2.object({
      domainName: z2.string(),
      domainPddl: z2.string(),
      sampleStates: z2.array(z2.any()),
      provider: z2.enum(["claude", "gemini"])
    })
  ).mutation(async ({ input }) => {
    console.log("[llmGenerateTransformer] Starting for domain:", input.domainName);
    console.log("[llmGenerateTransformer] Provider:", input.provider);
    console.log("[llmGenerateTransformer] Sample states:", input.sampleStates.length);
    console.log("[llmGenerateTransformer] PDDL length:", input.domainPddl.length);
    const result = await generateTransformer({
      domainName: input.domainName,
      domainPddl: input.domainPddl,
      sampleStates: input.sampleStates,
      provider: input.provider
    });
    if (!result.success) {
      throw new Error(result.error || "LLM transformer generation failed");
    }
    return result;
  }),
  /**
   * List cached LLM-generated state transformers, optionally filtered by domain.
   */
  llmListCachedTransformers: publicProcedure.input(
    z2.object({
      domain: z2.string().optional()
    }).optional()
  ).query(async ({ input }) => {
    const transformers = await listCachedTransformers(input?.domain);
    return transformers;
  }),
  /**
   * Load a specific cached transformer by filename.
   */
  llmLoadCachedTransformer: publicProcedure.input(
    z2.object({
      filename: z2.string()
    })
  ).query(async ({ input }) => {
    const code = await loadCachedTransformer(input.filename);
    if (!code) {
      throw new Error(`Cached transformer not found: ${input.filename}`);
    }
    const cleanCode = transpileCachedTransformer(code);
    return { filename: input.filename, code: cleanCode };
  }),
  /**
   * Delete a specific cached transformer by filename.
   */
  llmDeleteCachedTransformer: publicProcedure.input(
    z2.object({
      filename: z2.string()
    })
  ).mutation(async ({ input }) => {
    const success = await deleteCachedTransformer(input.filename);
    return { success, filename: input.filename };
  }),
  // ==================== SAVED DOMAINS LIBRARY ====================
  /**
   * List all saved custom domains (metadata only).
   */
  listSavedDomains: publicProcedure.query(async () => {
    console.log("[listSavedDomains] Fetching saved domains library");
    const domains = await listSavedDomains();
    console.log(`[listSavedDomains] Found ${domains.length} saved domains`);
    return domains;
  }),
  /**
   * Load a saved domain by ID (full data including transformer + renderer code).
   */
  loadSavedDomain: publicProcedure.input(
    z2.object({
      id: z2.number()
    })
  ).query(async ({ input }) => {
    console.log(`[loadSavedDomain] Loading domain id=${input.id}`);
    const domain = await getSavedDomain(input.id);
    if (!domain) {
      throw new Error(`Saved domain not found: id=${input.id}`);
    }
    console.log(`[loadSavedDomain] Loaded: ${domain.displayName}`);
    return domain;
  }),
  /**
   * Save a custom domain to the library after successful LLM generation.
   * Called automatically after both transformer and renderer are generated.
   */
  saveDomainToLibrary: publicProcedure.input(
    z2.object({
      domainName: z2.string(),
      domainPddl: z2.string(),
      transformerCode: z2.string(),
      rendererCode: z2.string(),
      provider: z2.string()
    })
  ).mutation(async ({ input }) => {
    console.log(`[saveDomainToLibrary] Saving domain: ${input.domainName}`);
    const saved = await saveDomain({
      domainName: input.domainName,
      domainPddl: input.domainPddl,
      transformerCode: input.transformerCode,
      rendererCode: input.rendererCode,
      provider: input.provider
    });
    console.log(`[saveDomainToLibrary] Saved as: ${saved.displayName} (id=${saved.id})`);
    return saved;
  })
});

// routers.ts
var appRouter = router({
  system: systemRouter,
  visualizer: visualizerRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true
      };
    })
  })
  // TODO: add feature routers here, e.g.
  // todo: router({
  //   list: protectedProcedure.query(({ ctx }) =>
  //     db.getUserTodos(ctx.user.id)
  //   ),
  // }),
});

// _core/context.ts
async function createContext(opts) {
  return {
    req: opts.req,
    res: opts.res,
    user: null
  };
}

// _core/index.ts
function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}
async function findAvailablePort(startPort = 3e3) {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}
async function startServer() {
  const app = express();
  const server = createServer(app);
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
      allowMethodOverride: true
    })
  );
  const preferredPort = parseInt(process.env.PORT || "4000");
  const port = await findAvailablePort(preferredPort);
  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }
  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}
startServer().catch(console.error);
