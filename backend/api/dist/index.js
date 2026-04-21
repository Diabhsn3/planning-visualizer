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
import { readFile as readFile2, writeFile as writeFile2, mkdir as mkdir2, unlink as unlink2 } from "fs/promises";

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
var SKILLS_DIR = path.join(__dirname, "skills", "canvas-renderer");
var SKILL_MD_PATH = path.join(SKILLS_DIR, "SKILL.md");
var SKILL_INTERFACES_PATH = path.join(SKILLS_DIR, "interfaces.ts");
var SKILL_EXAMPLE_PATH = path.join(SKILLS_DIR, "example-hanoi.ts");
var SKILL_RULES_PATH = path.join(SKILLS_DIR, "rules.md");
var GEMINI_PROMPT_PATH = path.join(__dirname, "prompts", "renderer-skill.txt");
var CACHE_DIR = path.join(__dirname, "llm_renderers");
var SKILL_ID_CACHE_PATH = path.join(__dirname, ".claude-skill-id");
var MODELS = {
  claude: {
    id: "claude-sonnet-4-20250514",
    name: "Claude Sonnet 4",
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
  console.log("[LLM Renderer] Creating new Claude skill...");
  const skillDir = "canvas-renderer";
  const skill = await client.beta.skills.create({
    display_title: "Canvas Renderer Generator",
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
  let fullText = "";
  for (const block of finalResponse.content) {
    if (block.type === "text") {
      fullText += block.text;
    }
  }
  if (!fullText) {
    throw new Error("Claude returned no text content.");
  }
  console.log(`[LLM Renderer] Claude response received, length: ${fullText.length}`);
  return fullText;
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

// visualizer.ts
import path2 from "path";
import { fileURLToPath as fileURLToPath2 } from "url";
import { exec } from "child_process";
import { promisify } from "util";
var execAsync = promisify(exec);
var __filename2 = fileURLToPath2(import.meta.url);
var __dirname2 = path2.dirname(__filename2);
var DATA_DIR = path2.join(__dirname2, "data");
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
  if (__dirname2.endsWith("/dist") || __dirname2.endsWith("\\dist")) {
    return path2.join(__dirname2, "../../planner");
  } else {
    return path2.join(__dirname2, "../planner");
  }
}
function resolvePlanningToolsDir() {
  if (__dirname2.endsWith("/dist") || __dirname2.endsWith("\\dist")) {
    return path2.join(__dirname2, "../../../planning-tools");
  } else {
    return path2.join(__dirname2, "../../planning-tools");
  }
}
var PLANNER_DIR = resolvePlannerDir();
var PLANNING_TOOLS_DIR = resolvePlanningToolsDir();
console.log("[Path Resolution] __dirname:", __dirname2);
console.log("[Path Resolution] PLANNER_DIR:", PLANNER_DIR);
console.log("[Path Resolution] PLANNING_TOOLS_DIR:", PLANNING_TOOLS_DIR);
var DOMAIN_CONFIGS = {
  "blocks-world": {
    name: "Blocks World",
    description: "Classic block stacking problem",
    domainFile: path2.join(PLANNER_DIR, "domains/blocks_world/domain.pddl")
  },
  "gripper": {
    name: "Gripper",
    description: "Robot with grippers moving balls between rooms",
    domainFile: path2.join(PLANNER_DIR, "domains/gripper/domain.pddl")
  },
  "depot": {
    name: "Depot",
    description: "Trucks deliver packages between depots and distributors",
    domainFile: path2.join(PLANNER_DIR, "domains/depot/domain.pddl")
  },
  "hanoi": {
    name: "Hanoi",
    description: "Moving disks between pegs (Tower of Hanoi)",
    domainFile: path2.join(PLANNER_DIR, "domains/hanoi/domain.pddl")
  },
  "rovers": {
    name: "Rovers",
    description: "Planetary rovers navigating between waypoints and collecting images",
    domainFile: path2.join(PLANNER_DIR, "domains/rovers/domain.pddl")
  },
  "satellite": {
    name: "Satellite",
    description: "Satellites calibrate instruments, take images, and transmit them",
    domainFile: path2.join(PLANNER_DIR, "domains/satellite/domain.pddl")
  }
};
var VALID_STRATEGY_IDS = [
  "astar-lmcut",
  "astar-blind",
  "astar-hmax",
  "greedy-ff",
  "lazy-greedy-ff",
  "greedy-add",
  "lama-first",
  "greedy-cea",
  "wastar-ff-3",
  "wastar-lmcut-2"
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
      const dataFile = path2.join(
        DATA_DIR,
        `${input.domain.replace("-", "_")}_rendered.json`
      );
      const data = JSON.parse(await readFile2(dataFile, "utf-8"));
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
      const uploadsDir = path2.join(__dirname2, "uploads");
      await mkdir2(uploadsDir, { recursive: true });
      const timestamp = Date.now();
      if (!input.domainContent || input.domainContent.trim() === "") {
        const domainConfig = DOMAIN_CONFIGS[input.domainName];
        if (!domainConfig) {
          throw new Error(`Unknown domain: ${input.domainName}`);
        }
        domainPath = domainConfig.domainFile;
      } else {
        domainPath = path2.join(uploadsDir, `domain_${timestamp}.pddl`);
        await writeFile2(domainPath, input.domainContent, "utf-8");
      }
      problemPath = path2.join(uploadsDir, `problem_${timestamp}.pddl`);
      await writeFile2(problemPath, input.problemContent, "utf-8");
      const pythonScript = path2.join(PLANNER_DIR, "visualizer_api.py");
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
        await unlink2(problemPath);
        console.log("[uploadAndGenerate] Deleted problem file:", problemPath);
        if (input.domainContent && input.domainContent.trim() !== "") {
          await unlink2(domainPath);
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
          await unlink2(problemPath).catch(() => {
          });
        }
        if (domainPath && input.domainContent && input.domainContent.trim() !== "") {
          await unlink2(domainPath).catch(() => {
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
      const pythonScript = path2.join(PLANNER_DIR, "visualizer_api.py");
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
      const fdPath = path2.join(PLANNING_TOOLS_DIR, "downward/fast-downward.py");
      const { stdout } = await execAsync(`"${PYTHON_CMD}" "${fdPath}" --help`, { timeout: 5e3 });
      if (stdout.includes("Fast Downward")) {
        status.fastDownward.available = true;
        status.fastDownward.path = fdPath;
      }
    } catch (error) {
      try {
        const altFdPath = path2.join(__dirname2, "../../planning-tools/downward/fast-downward.py");
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
      const domainContent = await readFile2(domainConfig.domainFile, "utf-8");
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
    console.log("[llmGenerateRenderer] Starting for domain:", input.domainName);
    console.log("[llmGenerateRenderer] Provider:", input.provider);
    console.log("[llmGenerateRenderer] States count:", input.states.length);
    const result = await generateRenderer({
      domainName: input.domainName,
      states: input.states,
      provider: input.provider
    });
    if (!result.success) {
      throw new Error(result.error || "LLM generation failed");
    }
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
      createContext
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
