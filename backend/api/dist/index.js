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
import { readFile, writeFile, mkdir, unlink } from "fs/promises";
import path4 from "path";
import { fileURLToPath as fileURLToPath4 } from "url";
import { exec } from "child_process";
import { promisify } from "util";

// llm-renderer.ts
import path2 from "path";
import fs from "fs";
import { fileURLToPath as fileURLToPath2 } from "url";

// mcp-client.ts
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import path from "path";
import { fileURLToPath } from "url";
var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);
function getMcpServerDir() {
  if (__dirname.endsWith("/dist") || __dirname.endsWith("\\dist")) {
    return path.join(__dirname, "../../../mcp_server");
  }
  return path.join(__dirname, "../../mcp_server");
}
var MCPClient = class {
  client = null;
  transport = null;
  tools = [];
  resources = [];
  connected = false;
  options;
  orchestrator = null;
  constructor(options = {}) {
    this.options = options;
    this.orchestrator = options.orchestrator || null;
    const capabilities = {};
    if (options.enableSampling) {
      capabilities.sampling = {};
      console.log("[MCPClient] Sampling capability enabled");
    }
    this.client = new Client(
      { name: "planning-visualizer-backend", version: "1.0.0" },
      { capabilities }
    );
  }
  /**
   * Set the LLM orchestrator for handling sampling requests
   */
  setOrchestrator(orchestrator) {
    this.orchestrator = orchestrator;
  }
  /**
   * Connect to the MCP server
   */
  async connect() {
    if (this.connected) {
      console.log("[MCPClient] Already connected");
      return;
    }
    const mcpServerDir = getMcpServerDir();
    const serverScript = path.join(mcpServerDir, "mcp_server.py");
    console.log("[MCPClient] Connecting to MCP server...");
    console.log("[MCPClient] Server script:", serverScript);
    this.transport = new StdioClientTransport({
      command: "python3",
      args: [serverScript],
      env: {
        ...process.env,
        ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || ""
      }
    });
    if (this.options.enableSampling && this.client) {
      this.setupSamplingHandler();
    }
    await this.client.connect(this.transport);
    this.connected = true;
    const toolsResult = await this.client.listTools();
    this.tools = toolsResult.tools.map((tool) => ({
      name: tool.name,
      description: tool.description || "",
      inputSchema: tool.inputSchema || { type: "object", properties: {} }
    }));
    try {
      const resourcesResult = await this.client.listResources();
      this.resources = resourcesResult.resources.map((resource) => ({
        uri: resource.uri,
        name: resource.name,
        description: resource.description,
        mimeType: resource.mimeType
      }));
      console.log("[MCPClient] Discovered resources:", this.resources.map((r) => r.uri));
    } catch (e) {
      console.log("[MCPClient] No resources discovered (server may not expose any)");
      this.resources = [];
    }
    console.log("[MCPClient] Connected to MCP server");
    console.log("[MCPClient] Discovered tools:", this.tools.map((t2) => t2.name));
  }
  /**
   * Set up handler for MCP sampling requests from the server
   * 
   * According to MCP spec, when the server sends a sampling/createMessage request,
   * the client should:
   * 1. Receive the request with messages, modelPreferences, etc.
   * 2. Call the LLM with the provided parameters
   * 3. Return the LLM response to the server
   */
  setupSamplingHandler() {
    if (!this.client) return;
    console.log("[MCPClient] Setting up sampling request handler");
  }
  /**
   * Handle a sampling request from the MCP server
   * This is called when the server requests LLM generation
   */
  async handleSamplingRequest(request) {
    if (!this.orchestrator) {
      throw new Error("No LLM orchestrator configured for sampling requests");
    }
    console.log("[MCPClient] Handling sampling request from server");
    return this.orchestrator.handleSamplingRequest(request);
  }
  /**
   * Disconnect from the MCP server
   */
  async disconnect() {
    if (!this.connected) return;
    try {
      await this.client?.close();
    } catch (e) {
    }
    this.connected = false;
    this.tools = [];
    this.resources = [];
    console.log("[MCPClient] Disconnected from MCP server");
  }
  /**
   * Get available tools in LLM-compatible format
   * (Generic naming - works with any LLM provider)
   */
  getToolsForLLM() {
    return this.tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.inputSchema
    }));
  }
  /**
   * Get available tools in Claude-compatible format
   * @deprecated Use getToolsForLLM() instead
   */
  getToolsForClaude() {
    return this.getToolsForLLM();
  }
  /**
   * Call a tool on the MCP server
   */
  async callTool(name, args) {
    if (!this.connected || !this.client) {
      throw new Error("MCP client not connected");
    }
    console.log(`[MCPClient] Calling tool: ${name}`);
    try {
      const result = await this.client.callTool({ name, arguments: args });
      let content = "";
      if (result.content && Array.isArray(result.content)) {
        for (const item of result.content) {
          if (item.type === "text") {
            content += item.text;
          }
        }
      }
      return {
        content,
        isError: Boolean(result.isError)
      };
    } catch (error) {
      console.error(`[MCPClient] Tool call error:`, error);
      return {
        content: error instanceof Error ? error.message : "Unknown error",
        isError: true
      };
    }
  }
  /**
   * Read a resource from the MCP server
   * 
   * Resources are read-only data sources exposed by the server.
   * Use this to fetch versioned prompts, configuration, etc.
   * 
   * @param uri The resource URI (e.g., "prompt://renderer/system/v1")
   */
  async readResource(uri) {
    if (!this.connected || !this.client) {
      throw new Error("MCP client not connected");
    }
    console.log(`[MCPClient] Reading resource: ${uri}`);
    try {
      const result = await this.client.readResource({ uri });
      let content = "";
      let mimeType = "text/plain";
      if (result.contents && Array.isArray(result.contents)) {
        for (const item of result.contents) {
          if (item.text) {
            content += item.text;
          }
          if (item.mimeType) {
            mimeType = item.mimeType;
          }
        }
      }
      return {
        content,
        mimeType,
        isError: false
      };
    } catch (error) {
      console.error(`[MCPClient] Resource read error:`, error);
      return {
        content: error instanceof Error ? error.message : "Unknown error",
        mimeType: "text/plain",
        isError: true
      };
    }
  }
  /**
   * List available resources from the MCP server
   */
  getResources() {
    return this.resources;
  }
  /**
   * Check if connected
   */
  isConnected() {
    return this.connected;
  }
  /**
   * Get list of available tool names
   */
  getToolNames() {
    return this.tools.map((t2) => t2.name);
  }
  /**
   * Check if sampling is enabled
   */
  isSamplingEnabled() {
    return this.options.enableSampling === true;
  }
};
async function createMCPClient(options = {}) {
  const client = new MCPClient(options);
  await client.connect();
  return client;
}

// llm-orchestrator.ts
import Anthropic from "@anthropic-ai/sdk";
var AnthropicProvider = class {
  client;
  model;
  constructor(model = "claude-sonnet-4-20250514") {
    this.client = new Anthropic();
    this.model = model;
  }
  getProviderName() {
    return "anthropic";
  }
  getModelName() {
    return this.model;
  }
  async chat(messages, systemPrompt, tools) {
    const anthropicMessages = messages.map((m) => ({
      role: m.role,
      content: m.content
    }));
    const params = {
      model: this.model,
      max_tokens: 16e3,
      system: systemPrompt,
      messages: anthropicMessages
    };
    if (tools && tools.length > 0) {
      params.tools = tools;
    }
    return await this.client.messages.create(params);
  }
};
var OllamaProvider = class {
  baseUrl;
  model;
  constructor(model = "codellama:13b", baseUrl = "http://localhost:11434") {
    this.baseUrl = process.env.OLLAMA_BASE_URL || baseUrl;
    this.model = model;
  }
  getProviderName() {
    return "ollama";
  }
  getModelName() {
    return this.model;
  }
  async chat(messages, systemPrompt, _tools) {
    const ollamaMessages = [
      { role: "system", content: systemPrompt },
      ...messages.map((m) => ({
        role: m.role,
        content: typeof m.content === "string" ? m.content : JSON.stringify(m.content)
      }))
    ];
    try {
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: this.model,
          messages: ollamaMessages,
          stream: false,
          options: {
            num_predict: 16e3,
            temperature: 0.7
          }
        })
      });
      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
      }
      const data = await response.json();
      return {
        content: [{ type: "text", text: data.message?.content || "" }],
        stop_reason: data.done ? "end_turn" : "max_tokens"
      };
    } catch (error) {
      console.error("[OllamaProvider] Error:", error);
      throw error;
    }
  }
};
function createLLMProvider(config) {
  switch (config.provider) {
    case "ollama":
      return new OllamaProvider(
        config.model || "codellama:13b",
        config.ollamaBaseUrl || "http://localhost:11434"
      );
    case "anthropic":
    default:
      return new AnthropicProvider(config.model || "claude-sonnet-4-20250514");
  }
}
var LLMOrchestrator = class _LLMOrchestrator {
  provider;
  constructor(providerOrConfig) {
    if (!providerOrConfig) {
      this.provider = new AnthropicProvider();
    } else if ("chat" in providerOrConfig) {
      this.provider = providerOrConfig;
    } else {
      this.provider = createLLMProvider(providerOrConfig);
    }
  }
  static fromConfig(config) {
    return new _LLMOrchestrator(config);
  }
  getProvider() {
    return this.provider;
  }
  async chat(messages, systemPrompt, tools) {
    return this.provider.chat(messages, systemPrompt, tools);
  }
  /**
   * Handle a sampling request from the MCP server
   * This is called when the server requests LLM generation
   */
  async handleSamplingRequest(request) {
    console.log("[LLMOrchestrator] Handling sampling request");
    const messages = request.messages.map((m) => ({
      role: m.role,
      content: m.content
    }));
    const response = await this.provider.chat(
      messages,
      request.systemPrompt || "",
      void 0
    );
    const textContent = this.extractText(response);
    return {
      content: textContent,
      stopReason: response.stop_reason || "end_turn"
    };
  }
  extractText(response) {
    const textBlocks = response.content.filter(
      (block) => block.type === "text"
    );
    return textBlocks.map((b) => b.text).join("\n");
  }
  extractToolCalls(response) {
    return response.content.filter(
      (block) => block.type === "tool_use"
    );
  }
};
var DEFAULT_PROMPT_VERSION = "v1";
var MAX_ITERATIONS = 20;
function validateCodeLocally(code, domainPascal) {
  const errors = [];
  const mainFnPattern = new RegExp(`function\\s+render${domainPascal}\\s*\\(`);
  if (!mainFnPattern.test(code)) {
    errors.push(`Missing required function: render${domainPascal}(ctx, state)`);
  }
  const legendFnPattern = new RegExp(`function\\s+render${domainPascal}Legend\\s*\\(`);
  if (!legendFnPattern.test(code)) {
    errors.push(`Missing required function: render${domainPascal}Legend(ctx, x, y)`);
  }
  if (code.includes(": string") || code.includes(": number") || code.includes(": any")) {
    errors.push("Code contains TypeScript type annotations - must be pure JavaScript");
  }
  return { valid: errors.length === 0, errors };
}
function cleanCodeLocally(code) {
  let cleaned = code;
  cleaned = cleaned.replace(/```(?:javascript|js|typescript|ts)?\n?/gi, "");
  cleaned = cleaned.replace(/```\n?/g, "");
  const functionMatch = cleaned.match(/function\s+render\w*\s*\(/);
  if (functionMatch && functionMatch.index !== void 0 && functionMatch.index > 0) {
    cleaned = cleaned.substring(functionMatch.index);
  }
  cleaned = cleaned.replace(/:\s*(string|number|boolean|any|void|object|Array<[^>]+>|\w+\[\])\s*([,\)\{=])/g, "$2");
  cleaned = cleaned.replace(/as\s+\w+(\[\])?/g, "");
  let braceCount = 0;
  let lastValidIndex = 0;
  let inFunction = false;
  for (let i = 0; i < cleaned.length; i++) {
    const char = cleaned[i];
    if (!inFunction && cleaned.substring(i).match(/^function\s+render\w*\s*\(/)) {
      inFunction = true;
    }
    if (char === "{") {
      braceCount++;
    } else if (char === "}") {
      braceCount--;
      if (braceCount === 0 && inFunction) {
        lastValidIndex = i + 1;
        inFunction = false;
      }
    }
  }
  if (lastValidIndex > 0) {
    cleaned = cleaned.substring(0, lastValidIndex);
  }
  return cleaned.trim();
}
function mcpToolsToAnthropicFormat(mcpTools) {
  return mcpTools.map((tool) => ({
    name: tool.name,
    description: tool.description || "",
    input_schema: tool.inputSchema || { type: "object", properties: {} }
  }));
}
async function generateRendererWithLLM(mcpClient, domainName, exampleState, styleHints, onProgress, onDetailedLog, orchestrator) {
  const llmOrchestrator = orchestrator || new LLMOrchestrator();
  const startTime = Date.now();
  const TOTAL_STEPS = 6;
  const log = (source, message, level = "info") => {
    const elapsed = ((Date.now() - startTime) / 1e3).toFixed(1);
    const formattedMessage = `[${elapsed}s] ${message}`;
    console.log(`[${source}] ${formattedMessage}`);
    if (onDetailedLog) {
      onDetailedLog(source, formattedMessage, level);
    }
  };
  const reportProgress = (step, message) => {
    const percent = Math.round(step / TOTAL_STEPS * 100);
    log("LLMOrchestrator", `Step ${step}/${TOTAL_STEPS} (${percent}%): ${message}`);
    if (onProgress) {
      onProgress(step, message);
    }
  };
  log("LLMOrchestrator", `Starting INVESTIGATE-FIRST renderer generation for domain: ${domainName}`);
  log("LLMOrchestrator", `Using provider: ${llmOrchestrator.getProvider().getProviderName()}`);
  log("LLMOrchestrator", `Using model: ${llmOrchestrator.getProvider().getModelName()}`);
  try {
    reportProgress(1, "Fetching system prompt...");
    const promptResourceUri = `prompt://renderer/system/${DEFAULT_PROMPT_VERSION}`;
    log("MCPClient", `Reading resource: ${promptResourceUri}`);
    const systemPromptResult = await mcpClient.readResource(promptResourceUri);
    if (systemPromptResult.isError) {
      log("LLMOrchestrator", `Failed to fetch system prompt: ${systemPromptResult.content}`, "error");
      return { success: false, code: "", error: `Failed to fetch system prompt: ${systemPromptResult.content}` };
    }
    const domainPascal = domainName.split(/[-_\s]+/).map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join("");
    const systemPrompt = systemPromptResult.content.replace(/{domain_pascal}/g, domainPascal);
    log("LLMOrchestrator", `System prompt loaded (${systemPrompt.length} chars)`);
    log("LLMOrchestrator", `Domain PascalCase: ${domainPascal}`);
    reportProgress(2, "Discovering available tools...");
    const mcpTools = mcpClient.getToolsForLLM();
    const anthropicTools = mcpToolsToAnthropicFormat(mcpTools);
    log("LLMOrchestrator", `Available tools: ${mcpTools.map((t2) => t2.name).join(", ")}`);
    reportProgress(2, "Preparing investigation request...");
    const stateJsonStr = JSON.stringify(exampleState);
    const userPrompt = `Generate a JavaScript renderer for the "${domainName}" domain.

REQUIRED FUNCTIONS:
- render${domainPascal}(ctx, state) - Main render function
- render${domainPascal}Legend(ctx, x, y) - Legend box function  
- render${domainPascal}Background(ctx, width, height) - Background function [optional]

${styleHints ? `STYLE HINTS: ${styleHints}
` : ""}

YOUR FIRST ACTION: Call get_generation_context with these parameters:
{
  "state_json": ${stateJsonStr},
  "domain_name": "${domainName}"
}

DO NOT skip parameters. Both state_json and domain_name are REQUIRED.

After getting the context, generate complete JavaScript code.
Generate complete, working JavaScript code. Do not truncate or abbreviate.`;
    reportProgress(3, "Starting LLM generation...");
    const messages = [
      { role: "user", content: userPrompt }
    ];
    let finalCode = "";
    let iteration = 0;
    while (iteration < MAX_ITERATIONS) {
      iteration++;
      log("LLMOrchestrator", `\u2501\u2501\u2501 Iteration ${iteration} \u2501\u2501\u2501`);
      const llmResponse = await llmOrchestrator.chat(messages, systemPrompt, anthropicTools);
      const toolCalls = llmOrchestrator.extractToolCalls(llmResponse);
      if (toolCalls.length > 0) {
        const toolNames = toolCalls.map((t2) => t2.name).join(", ");
        log("LLMOrchestrator", `LLM calling: ${toolNames}`);
        reportProgress(3, `Tool: ${toolCalls[0].name}`);
        messages.push({
          role: "assistant",
          content: llmResponse.content
        });
        const toolResults = [];
        for (const toolCall of toolCalls) {
          const toolInput = toolCall.input || {};
          const inputSummary = Object.keys(toolInput).length > 0 ? ` with ${Object.keys(toolInput).join(", ")}` : "";
          log("MCPClient", `\u2192 ${toolCall.name}${inputSummary}`);
          try {
            const result = await mcpClient.callTool(toolCall.name, toolCall.input);
            log("MCPClient", `\u2713 ${toolCall.name} output:
${result.content}`);
            toolResults.push({
              type: "tool_result",
              tool_use_id: toolCall.id,
              content: result.content
            });
          } catch (e) {
            log("MCPClient", `Tool error: ${e}`, "error");
            toolResults.push({
              type: "tool_result",
              tool_use_id: toolCall.id,
              content: `Error: ${e}`
            });
          }
        }
        messages.push({
          role: "user",
          content: toolResults
        });
      } else {
        const textOutput = llmOrchestrator.extractText(llmResponse);
        const stopReason = llmResponse.stop_reason;
        const looksLikeCode = textOutput.includes("function render");
        if (stopReason === "max_tokens") {
          log("LLMOrchestrator", `\u26A0\uFE0F Output truncated (max_tokens) - ${textOutput.length} chars`, "warning");
        } else if (looksLikeCode) {
          log("LLMOrchestrator", `LLM generated code: ${textOutput.length} chars`);
          const preview = textOutput.substring(0, 100).replace(/\n/g, " ");
          log("LLMOrchestrator", `Code preview: ${preview}...`);
        } else {
          const firstLine = textOutput.split("\n")[0].substring(0, 100);
          log("LLMOrchestrator", `LLM response: ${firstLine}${textOutput.length > 100 ? "..." : ""}`);
        }
        if (looksLikeCode) {
          reportProgress(4, "Validating generated code...");
          const cleanedCode = cleanCodeLocally(textOutput);
          const validation = validateCodeLocally(cleanedCode, domainPascal);
          if (validation.valid) {
            finalCode = cleanedCode;
            log("LLMOrchestrator", "\u2705 Code validation passed!", "success");
            break;
          } else {
            log("LLMOrchestrator", `\u274C Validation failed: ${validation.errors.join("; ")}`, "warning");
            reportProgress(4, "Fixing validation errors...");
            messages.push({
              role: "assistant",
              content: textOutput
            });
            messages.push({
              role: "user",
              content: `Your code has validation errors:
${validation.errors.join("\n")}

Please fix these issues and provide the corrected code.`
            });
          }
        } else {
          if (iteration > 2) {
            log("LLMOrchestrator", "Analysis complete, requesting code generation...");
            messages.push({
              role: "assistant",
              content: textOutput
            });
            messages.push({
              role: "user",
              content: "Now generate the complete JavaScript renderer code. Start with 'function render" + domainPascal + "(ctx, state) {' and include all three functions."
            });
          } else {
            log("LLMOrchestrator", "LLM analyzing, continuing investigation...");
            messages.push({
              role: "assistant",
              content: textOutput
            });
            messages.push({
              role: "user",
              content: "Please continue with your analysis and then generate the renderer code."
            });
          }
        }
      }
    }
    if (finalCode) {
      reportProgress(5, "Final syntax validation...");
      log("MCPClient", "Running MCP validate_renderer for syntax check");
      try {
        const validateResult = await mcpClient.callTool("validate_renderer", {
          code: finalCode,
          domain_name: domainName
        });
        const validation = JSON.parse(validateResult.content);
        if (!validation.valid) {
          log("LLMOrchestrator", `Syntax warnings: ${validation.errors?.join(", ") || "none"}`, "warning");
        }
        if (validation.warnings && validation.warnings.length > 0) {
          log("LLMOrchestrator", `Warnings: ${validation.warnings.join(", ")}`, "info");
        }
      } catch (e) {
        log("LLMOrchestrator", "MCP validation skipped (non-critical)", "info");
      }
    }
    const totalTime = ((Date.now() - startTime) / 1e3).toFixed(1);
    if (!finalCode || !finalCode.includes("function render")) {
      reportProgress(6, "Generation failed");
      log("LLMOrchestrator", `\u274C Failed after ${iteration} iterations (${totalTime}s)`, "error");
      return { success: false, code: "", error: `Failed to generate valid renderer after ${iteration} iterations` };
    }
    reportProgress(6, "Generation complete!");
    log("LLMOrchestrator", `\u2705 Complete! ${finalCode.length} chars in ${iteration} iterations (${totalTime}s)`, "success");
    return { success: true, code: finalCode };
  } catch (error) {
    log("LLMOrchestrator", `Error: ${error instanceof Error ? error.message : "Unknown error"}`, "error");
    return {
      success: false,
      code: "",
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
}
var defaultOrchestrator = new LLMOrchestrator();

// generation-progress.ts
var progressStore = /* @__PURE__ */ new Map();
var INITIAL_STEPS_ESTIMATE = 6;
function createProgress(id, domainName) {
  const progress = {
    id,
    domainName,
    status: "pending",
    currentStep: 0,
    totalSteps: INITIAL_STEPS_ESTIMATE,
    percentage: 0,
    currentMessage: "Initializing...",
    logs: [],
    detailedLogs: [],
    startTime: Date.now()
  };
  progressStore.set(id, progress);
  return progress;
}
function addDetailedLog(id, source, message, level = "info") {
  const progress = progressStore.get(id);
  if (!progress) return;
  progress.detailedLogs.push({
    timestamp: Date.now(),
    source,
    message,
    level
  });
  progressStore.set(id, progress);
}
function updateProgress(id, step, message, status) {
  const progress = progressStore.get(id);
  if (!progress) return;
  progress.currentStep = step;
  progress.currentMessage = message;
  if (step > progress.totalSteps) {
    progress.totalSteps = step + 2;
  }
  progress.percentage = Math.round(step / progress.totalSteps * 100);
  if (status) {
    progress.status = status;
  } else if (progress.status === "pending") {
    progress.status = "running";
  }
  progress.logs.push({
    step,
    totalSteps: progress.totalSteps,
    message,
    timestamp: Date.now()
  });
  if (status === "completed" || status === "error") {
    progress.endTime = Date.now();
  }
  progressStore.set(id, progress);
}
function completeProgress(id, success, error) {
  const progress = progressStore.get(id);
  if (!progress) return;
  progress.status = success ? "completed" : "error";
  progress.currentStep = progress.totalSteps;
  progress.percentage = 100;
  progress.currentMessage = success ? "Generation complete!" : "Generation failed";
  progress.endTime = Date.now();
  if (error) {
    progress.error = error;
  }
  progress.logs.push({
    step: progress.totalSteps,
    totalSteps: progress.totalSteps,
    message: success ? "Generation complete!" : `Error: ${error}`,
    timestamp: Date.now()
  });
  progressStore.set(id, progress);
}
function getProgress(id) {
  return progressStore.get(id) || null;
}
function getLatestProgress() {
  const entries = Array.from(progressStore.entries());
  if (entries.length === 0) return null;
  return entries.sort((a, b) => b[1].startTime - a[1].startTime)[0][1];
}
function cleanupOldProgress() {
  const fiveMinutesAgo = Date.now() - 5 * 60 * 1e3;
  const entries = Array.from(progressStore.entries());
  for (const [id, progress] of entries) {
    if (progress.endTime && progress.endTime < fiveMinutesAgo) {
      progressStore.delete(id);
    }
  }
}
function generateProgressId() {
  return `gen_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// llm-renderer.ts
var __filename2 = fileURLToPath2(import.meta.url);
var __dirname2 = path2.dirname(__filename2);
function getLlmRenderersPath() {
  if (__dirname2.endsWith("/dist") || __dirname2.endsWith("\\dist")) {
    return path2.join(__dirname2, "../llm_renderers");
  }
  return path2.join(__dirname2, "llm_renderers");
}
var LLM_RENDERERS_DIR = getLlmRenderersPath();
function ensureRenderersDir() {
  if (!fs.existsSync(LLM_RENDERERS_DIR)) {
    fs.mkdirSync(LLM_RENDERERS_DIR, { recursive: true });
  }
}
function generateRendererFilename(domainName) {
  const timestamp = (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-").replace("T", "_").replace("Z", "");
  const sanitizedDomain = domainName.replace(/[^a-zA-Z0-9-_]/g, "_");
  return `${sanitizedDomain}_${timestamp}.ts`;
}
function saveRendererToFile(code, domainName) {
  try {
    ensureRenderersDir();
    const filename = generateRendererFilename(domainName);
    const filepath = path2.join(LLM_RENDERERS_DIR, filename);
    const fileContent = `/**
 * LLM-Generated Renderer for ${domainName}
 * Generated at: ${(/* @__PURE__ */ new Date()).toISOString()}
 * 
 * This file was automatically generated by the MCP visualization pipeline.
 * Architecture: Node.js MCP Client + Python MCP Server + LLM Orchestrator
 * 
 * The generation process uses:
 * - MCP tools for domain hints, prompt generation, and code validation
 * - LLM Orchestrator for provider-agnostic LLM operations
 * - MCP sampling capability for server-initiated LLM requests
 * 
 * It can be used for debugging, inspection, or as a reference for manual renderers.
 */

${code}
`;
    fs.writeFileSync(filepath, fileContent, "utf-8");
    console.log("[LLM Renderer] Saved:", filename);
    return filename;
  } catch (error) {
    console.error("[LLM Renderer] Failed to save file:", error);
    return null;
  }
}
async function generateLLMRenderer(request) {
  const provider = request.llm_provider || "anthropic";
  if (provider === "anthropic" && !process.env.ANTHROPIC_API_KEY) {
    return {
      success: false,
      typescript_code: "",
      error: "ANTHROPIC_API_KEY environment variable not set. Please add it to backend/api/.env"
    };
  }
  let mcpClient = null;
  const progressId = generateProgressId();
  createProgress(progressId, request.domain_name);
  cleanupOldProgress();
  const logDetail = (source, message, level = "info") => {
    console.log(`[${source}] ${message}`);
    addDetailedLog(progressId, source, message, level);
  };
  try {
    logDetail("LLM Renderer", `Starting MCP generation for domain: ${request.domain_name}`);
    logDetail("LLM Renderer", `Progress ID: ${progressId}`);
    logDetail("LLM Renderer", `Using LLM provider: ${provider}, model: ${request.llm_model || "default"}`);
    const llmConfig = {
      provider,
      model: request.llm_model,
      ollamaBaseUrl: request.ollama_base_url
    };
    const orchestrator = LLMOrchestrator.fromConfig(llmConfig);
    logDetail("MCPClient", "Setting up sampling request handler");
    mcpClient = await createMCPClient({
      enableSampling: true,
      orchestrator
    });
    logDetail("MCPClient", "Connected to MCP server");
    const tools = mcpClient.getToolNames();
    logDetail("MCPClient", `Discovered tools: ${JSON.stringify(tools)}`);
    logDetail("LLM Renderer", "MCP client connected (sampling enabled)");
    const exampleState = request.states[0] || {};
    const onProgress = (step, message) => {
      updateProgress(progressId, step, message, "running");
    };
    const onDetailedLog = (source, message, level) => {
      addDetailedLog(progressId, source, message, level || "info");
    };
    const result = await generateRendererWithLLM(
      mcpClient,
      request.domain_name,
      exampleState,
      request.style_hints,
      onProgress,
      onDetailedLog,
      orchestrator
      // Pass the configured orchestrator
    );
    logDetail("LLM Renderer", `Generation complete, success: ${result.success}`, result.success ? "success" : "error");
    let savedFile = null;
    if (result.success && result.code) {
      savedFile = saveRendererToFile(result.code, request.domain_name);
      if (savedFile) {
        logDetail("LLM Renderer", `\u{1F4BE} Saved: ${savedFile}`, "success");
      }
    }
    completeProgress(progressId, result.success, result.error);
    return {
      success: result.success,
      typescript_code: result.code || "",
      error: result.error || null,
      saved_file: savedFile || void 0,
      progress_id: progressId
    };
  } catch (error) {
    logDetail("LLM Renderer", `Error: ${error instanceof Error ? error.message : "Unknown error"}`, "error");
    let errorMessage = "Unknown error during MCP generation";
    if (error instanceof Error) {
      if (error.message.includes("ENOENT")) {
        errorMessage = `Python not found. Please ensure Python 3 is installed.`;
      } else if (error.message.includes("timeout")) {
        errorMessage = "MCP generation timed out. Please try again.";
      } else if (error.message.includes("connect")) {
        errorMessage = "Failed to connect to MCP server. Ensure Python dependencies are installed.";
      } else {
        errorMessage = error.message;
      }
    }
    completeProgress(progressId, false, errorMessage);
    return {
      success: false,
      typescript_code: "",
      error: errorMessage,
      progress_id: progressId
    };
  } finally {
    if (mcpClient) {
      try {
        await mcpClient.disconnect();
      } catch (e) {
      }
    }
  }
}
async function checkLLMRendererStatus() {
  const apiKeySet = !!process.env.ANTHROPIC_API_KEY;
  let mcpClient = null;
  try {
    const orchestrator = new LLMOrchestrator();
    mcpClient = await createMCPClient({
      enableSampling: true,
      orchestrator
    });
    const tools = mcpClient.getToolNames();
    if (tools.length === 0) {
      return {
        available: false,
        error: "MCP server has no tools available",
        apiKeySet,
        samplingEnabled: false
      };
    }
    return {
      available: true,
      error: null,
      apiKeySet,
      samplingEnabled: mcpClient.isSamplingEnabled()
    };
  } catch (error) {
    let errorMsg = "Unknown error";
    if (error instanceof Error) {
      if (error.message.includes("ENOENT")) {
        errorMsg = "Python not found. Please ensure Python 3 is installed.";
      } else if (error.message.includes("ModuleNotFoundError") || error.message.includes("No module")) {
        errorMsg = "MCP dependencies not installed. Run: pip install -r mcp_server/requirements.txt";
      } else {
        errorMsg = error.message;
      }
    }
    return {
      available: false,
      error: errorMsg,
      apiKeySet,
      samplingEnabled: false
    };
  } finally {
    if (mcpClient) {
      try {
        await mcpClient.disconnect();
      } catch (e) {
      }
    }
  }
}
function getCachedRenderer(domainName) {
  try {
    ensureRenderersDir();
    const sanitizedDomain = domainName.replace(/[^a-zA-Z0-9-_]/g, "_");
    const files = fs.readdirSync(LLM_RENDERERS_DIR).filter((f) => f.endsWith(".ts") && f.startsWith(sanitizedDomain + "_")).sort().reverse();
    if (files.length === 0) {
      console.log("[LLM Renderer Cache] No cached renderer for domain:", domainName);
      return null;
    }
    const latestFile = files[0];
    const filepath = path2.join(LLM_RENDERERS_DIR, latestFile);
    const content = fs.readFileSync(filepath, "utf-8");
    const codeMatch = content.match(/\*\/\s*\n\n([\s\S]+)/);
    const code = codeMatch ? codeMatch[1].trim() : content;
    console.log("[LLM Renderer Cache] Found cached renderer:", latestFile);
    return {
      code,
      filename: latestFile
    };
  } catch (error) {
    console.error("[LLM Renderer Cache] Error reading cache:", error);
    return null;
  }
}
function clearRendererCache() {
  try {
    ensureRenderersDir();
    const files = fs.readdirSync(LLM_RENDERERS_DIR).filter((f) => f.endsWith(".ts") && f !== ".gitkeep");
    let deletedCount = 0;
    for (const file of files) {
      const filepath = path2.join(LLM_RENDERERS_DIR, file);
      fs.unlinkSync(filepath);
      deletedCount++;
    }
    console.log("[LLM Renderer Cache] Cleared", deletedCount, "cached renderers");
    return {
      success: true,
      deletedCount,
      error: null
    };
  } catch (error) {
    console.error("[LLM Renderer Cache] Error clearing cache:", error);
    return {
      success: false,
      deletedCount: 0,
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
}
function getGenerationProgress(progressId) {
  if (progressId) {
    return getProgress(progressId);
  }
  return getLatestProgress();
}
function listCachedRenderers(domainName) {
  try {
    ensureRenderersDir();
    const sanitizedDomain = domainName.replace(/[^a-zA-Z0-9-_]/g, "_");
    const files = fs.readdirSync(LLM_RENDERERS_DIR).filter((f) => f.endsWith(".ts") && f.startsWith(sanitizedDomain + "_")).sort().reverse();
    return {
      files,
      error: null
    };
  } catch (error) {
    console.error("[LLM Renderer Cache] Error listing cache:", error);
    return {
      files: [],
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
}
function getCachedRendererByFilename(filename) {
  try {
    ensureRenderersDir();
    const filepath = path2.join(LLM_RENDERERS_DIR, filename);
    if (!fs.existsSync(filepath)) {
      console.log("[LLM Renderer Cache] File not found:", filename);
      return null;
    }
    const content = fs.readFileSync(filepath, "utf-8");
    const codeMatch = content.match(/\*\/\s*\n\n([\s\S]+)/);
    const code = codeMatch ? codeMatch[1].trim() : content;
    console.log("[LLM Renderer Cache] Loaded renderer:", filename);
    return {
      code,
      filename
    };
  } catch (error) {
    console.error("[LLM Renderer Cache] Error reading file:", error);
    return null;
  }
}

// direct-llm-renderer.ts
import Anthropic2 from "@anthropic-ai/sdk";
import path3 from "path";
import fs2 from "fs";
import { fileURLToPath as fileURLToPath3 } from "url";
var __filename3 = fileURLToPath3(import.meta.url);
var __dirname3 = path3.dirname(__filename3);
function getDirectRenderersPath() {
  if (__dirname3.endsWith("/dist") || __dirname3.endsWith("\\dist")) {
    return path3.join(__dirname3, "../llm_renderers_direct");
  }
  return path3.join(__dirname3, "llm_renderers_direct");
}
var DIRECT_RENDERERS_DIR = getDirectRenderersPath();
function ensureDirectRenderersDir() {
  if (!fs2.existsSync(DIRECT_RENDERERS_DIR)) {
    fs2.mkdirSync(DIRECT_RENDERERS_DIR, { recursive: true });
  }
}
function generateDirectRendererFilename(domainName) {
  const timestamp = (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-").replace("T", "_").replace("Z", "");
  const sanitizedDomain = domainName.replace(/[^a-zA-Z0-9-_]/g, "_");
  return `${sanitizedDomain}_${timestamp}.ts`;
}
function saveDirectRendererToFile(code, domainName) {
  try {
    ensureDirectRenderersDir();
    const filename = generateDirectRendererFilename(domainName);
    const filepath = path3.join(DIRECT_RENDERERS_DIR, filename);
    const fileContent = `/**
 * Direct LLM-Generated Renderer for ${domainName}
 * Generated at: ${(/* @__PURE__ */ new Date()).toISOString()}
 * 
 * This file was generated using direct LLM approach (without MCP):
 * - Simple prompt with minimal instructions
 * - No MCP tools or validation
 * - No domain-specific hints
 */

${code}
`;
    fs2.writeFileSync(filepath, fileContent, "utf-8");
    console.log("[Direct LLM Renderer] Saved:", filename);
    return filename;
  } catch (error) {
    console.error("[Direct LLM Renderer] Failed to save file:", error);
    return null;
  }
}
var DIRECT_SYSTEM_PROMPT = `You are a JavaScript developer. Generate canvas rendering code.

When given state data, create JavaScript functions to visualize it on HTML5 Canvas.

Output only JavaScript code, no explanations.`;
async function generateDirectLLMRenderer(request) {
  const provider = request.llm_provider || "anthropic";
  if (provider === "anthropic" && !process.env.ANTHROPIC_API_KEY) {
    return {
      success: false,
      typescript_code: "",
      error: "ANTHROPIC_API_KEY environment variable not set"
    };
  }
  console.log("[Direct LLM Renderer] Starting generation for domain:", request.domain_name);
  console.log("[Direct LLM Renderer] Using provider:", provider, "model:", request.llm_model || "default");
  try {
    if (provider === "ollama") {
      return await generateWithOllama(request);
    }
    const client = new Anthropic2({
      apiKey: process.env.ANTHROPIC_API_KEY
    });
    const exampleState = request.states[0] || {};
    const domainPascal = request.domain_name.split(/[-_\s]+/).map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join("");
    const userPrompt = `Generate JavaScript renderer functions for "${request.domain_name}" domain.

Here is example state data:
${JSON.stringify(exampleState, null, 2)}

Create these functions:
- render${domainPascal}(ctx, state) - main render function
- render${domainPascal}Legend(ctx, x, y) - legend function

Use canvas 2D context (ctx). Draw something based on the state data.`;
    console.log("[Direct LLM Renderer] Sending request to LLM...");
    const response = await client.messages.create({
      model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: DIRECT_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }]
    });
    let code = "";
    for (const block of response.content) {
      if (block.type === "text") {
        code += block.text;
      }
    }
    console.log("[Direct LLM Renderer] Received response, length:", code.length);
    code = code.replace(/^```(?:javascript|typescript|js|ts)?\s*\n?/gm, "");
    code = code.replace(/\n?```\s*$/gm, "");
    code = code.trim();
    if (!code.includes("function")) {
      return {
        success: false,
        typescript_code: "",
        error: "LLM did not generate valid function code"
      };
    }
    const savedFile = saveDirectRendererToFile(code, request.domain_name);
    return {
      success: true,
      typescript_code: code,
      error: null,
      saved_file: savedFile || void 0
    };
  } catch (error) {
    console.error("[Direct LLM Renderer] Error:", error);
    let errorMessage = "Unknown error during LLM generation";
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    return {
      success: false,
      typescript_code: "",
      error: errorMessage
    };
  }
}
async function generateWithOllama(request) {
  const baseUrl = request.ollama_base_url || process.env.OLLAMA_BASE_URL || "http://localhost:11434";
  const model = request.llm_model || "codellama:13b";
  console.log("[Direct LLM Renderer] Using Ollama at:", baseUrl, "model:", model);
  const exampleState = request.states[0] || {};
  const domainPascal = request.domain_name.split(/[-_\s]+/).map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join("");
  const userPrompt = `Generate JavaScript renderer functions for "${request.domain_name}" domain.

Here is example state data:
${JSON.stringify(exampleState, null, 2)}

Create these functions:
- render${domainPascal}(ctx, state) - main render function
- render${domainPascal}Legend(ctx, x, y) - legend function

Use canvas 2D context (ctx). Draw something based on the state data.`;
  try {
    const response = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: DIRECT_SYSTEM_PROMPT },
          { role: "user", content: userPrompt }
        ],
        stream: false,
        options: {
          num_predict: 4096,
          temperature: 0.7
        }
      })
    });
    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
    }
    const data = await response.json();
    let code = data.message?.content || "";
    console.log("[Direct LLM Renderer] Received Ollama response, length:", code.length);
    code = code.replace(/^```(?:javascript|typescript|js|ts)?\s*\n?/gm, "");
    code = code.replace(/\n?```\s*$/gm, "");
    code = code.trim();
    if (!code.includes("function")) {
      return {
        success: false,
        typescript_code: "",
        error: "Ollama did not generate valid function code"
      };
    }
    const savedFile = saveDirectRendererToFile(code, request.domain_name);
    return {
      success: true,
      typescript_code: code,
      error: null,
      saved_file: savedFile || void 0
    };
  } catch (error) {
    console.error("[Direct LLM Renderer] Ollama error:", error);
    let errorMessage = "Unknown error during Ollama generation";
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    return {
      success: false,
      typescript_code: "",
      error: `Ollama error: ${errorMessage}. Make sure Ollama is running at ${baseUrl}`
    };
  }
}
function getCachedDirectRenderer(domainName) {
  try {
    ensureDirectRenderersDir();
    const sanitizedDomain = domainName.replace(/[^a-zA-Z0-9-_]/g, "_");
    const files = fs2.readdirSync(DIRECT_RENDERERS_DIR).filter((f) => f.endsWith(".ts") && f.startsWith(sanitizedDomain + "_")).sort().reverse();
    if (files.length === 0) {
      console.log("[Direct LLM Renderer Cache] No cached renderer for domain:", domainName);
      return null;
    }
    const latestFile = files[0];
    const filepath = path3.join(DIRECT_RENDERERS_DIR, latestFile);
    const content = fs2.readFileSync(filepath, "utf-8");
    const codeMatch = content.match(/\*\/\s*\n\n([\s\S]+)/);
    const code = codeMatch ? codeMatch[1].trim() : content;
    console.log("[Direct LLM Renderer Cache] Found cached renderer:", latestFile);
    return {
      code,
      filename: latestFile
    };
  } catch (error) {
    console.error("[Direct LLM Renderer Cache] Error reading cache:", error);
    return null;
  }
}
function clearDirectRendererCache(domainName) {
  try {
    ensureDirectRenderersDir();
    let files = fs2.readdirSync(DIRECT_RENDERERS_DIR).filter((f) => f.endsWith(".ts") && f !== ".gitkeep");
    if (domainName) {
      const sanitizedDomain = domainName.replace(/[^a-zA-Z0-9-_]/g, "_");
      files = files.filter((f) => f.startsWith(sanitizedDomain + "_"));
    }
    let deletedCount = 0;
    for (const file of files) {
      const filepath = path3.join(DIRECT_RENDERERS_DIR, file);
      fs2.unlinkSync(filepath);
      deletedCount++;
    }
    console.log("[Direct LLM Renderer Cache] Cleared", deletedCount, "cached renderers");
    return {
      success: true,
      deletedCount,
      error: null
    };
  } catch (error) {
    console.error("[Direct LLM Renderer Cache] Error clearing cache:", error);
    return {
      success: false,
      deletedCount: 0,
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
}
function listDirectCachedRenderers(domainName) {
  try {
    ensureDirectRenderersDir();
    const sanitizedDomain = domainName.replace(/[^a-zA-Z0-9-_]/g, "_");
    const files = fs2.readdirSync(DIRECT_RENDERERS_DIR).filter((f) => f.endsWith(".ts") && f.startsWith(sanitizedDomain + "_")).sort().reverse();
    return {
      files,
      error: null
    };
  } catch (error) {
    console.error("[Direct LLM Renderer Cache] Error listing cache:", error);
    return {
      files: [],
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
}
function getDirectCachedRendererByFilename(filename) {
  try {
    ensureDirectRenderersDir();
    const filepath = path3.join(DIRECT_RENDERERS_DIR, filename);
    if (!fs2.existsSync(filepath)) {
      console.log("[Direct LLM Renderer Cache] File not found:", filename);
      return null;
    }
    const content = fs2.readFileSync(filepath, "utf-8");
    const codeMatch = content.match(/\*\/\s*\n\n([\s\S]+)/);
    const code = codeMatch ? codeMatch[1].trim() : content;
    console.log("[Direct LLM Renderer Cache] Loaded renderer:", filename);
    return {
      code,
      filename
    };
  } catch (error) {
    console.error("[Direct LLM Renderer Cache] Error reading file:", error);
    return null;
  }
}

// visualizer.ts
var execAsync = promisify(exec);
var __filename4 = fileURLToPath4(import.meta.url);
var __dirname4 = path4.dirname(__filename4);
var DATA_DIR = path4.join(__dirname4, "data");
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
      const dataFile = path4.join(
        DATA_DIR,
        `${input.domain.replace("-", "_")}_rendered.json`
      );
      const data = JSON.parse(await readFile(dataFile, "utf-8"));
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
      await mkdir(uploadsDir, { recursive: true });
      const timestamp = Date.now();
      if (!input.domainContent || input.domainContent.trim() === "") {
        const domainConfig = DOMAIN_CONFIGS[input.domainName];
        if (!domainConfig) {
          throw new Error(`Unknown domain: ${input.domainName}`);
        }
        domainPath = domainConfig.domainFile;
      } else {
        domainPath = path4.join(uploadsDir, `domain_${timestamp}.pddl`);
        await writeFile(domainPath, input.domainContent, "utf-8");
      }
      problemPath = path4.join(uploadsDir, `problem_${timestamp}.pddl`);
      await writeFile(problemPath, input.problemContent, "utf-8");
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
        await unlink(problemPath);
        console.log("[uploadAndGenerate] Deleted problem file:", problemPath);
        if (input.domainContent && input.domainContent.trim() !== "") {
          await unlink(domainPath);
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
          await unlink(problemPath).catch(() => {
          });
        }
        if (domainPath && input.domainContent && input.domainContent.trim() !== "") {
          await unlink(domainPath).catch(() => {
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
      const domainContent = await readFile(domainConfig.domainFile, "utf-8");
      return {
        domainName: input.domainName,
        content: domainContent
      };
    } catch (error) {
      console.error(`[getDomainDefinition] Error reading domain file:`, error);
      throw new Error(`Failed to read domain file for ${input.domainName}`);
    }
  }),
  /**
   * Generate TypeScript renderer using LLM
   * NO CACHING - always generates fresh code
   * 
   * @param useMcp - If true, uses MCP-based generation with tools and validation.
   *                 If false, uses direct LLM generation with simple prompts.
   */
  generateLLMRenderer: publicProcedure.input(
    z2.object({
      domainName: z2.string(),
      states: z2.array(z2.any()),
      styleHints: z2.string().optional(),
      useMcp: z2.boolean().optional().default(true),
      llmProvider: z2.enum(["anthropic", "ollama"]).optional().default("anthropic"),
      llmModel: z2.string().optional(),
      ollamaBaseUrl: z2.string().optional()
    })
  ).mutation(async ({ input }) => {
    console.log("[generateLLMRenderer] Starting for domain:", input.domainName);
    console.log("[generateLLMRenderer] Number of states:", input.states.length);
    console.log("[generateLLMRenderer] Using MCP:", input.useMcp);
    console.log("[generateLLMRenderer] LLM Provider:", input.llmProvider, "Model:", input.llmModel || "default");
    if (input.useMcp) {
      const result = await generateLLMRenderer({
        domain_name: input.domainName,
        states: input.states,
        style_hints: input.styleHints,
        llm_provider: input.llmProvider,
        llm_model: input.llmModel,
        ollama_base_url: input.ollamaBaseUrl
      });
      console.log("[generateLLMRenderer] MCP Result success:", result.success);
      if (!result.success) {
        console.error("[generateLLMRenderer] Error:", result.error);
      }
      if (result.saved_file) {
        console.log("[generateLLMRenderer] Saved:", result.saved_file);
      }
      return {
        success: result.success,
        typescript_code: result.typescript_code,
        error: result.error,
        saved_file: result.saved_file || null,
        progress_id: result.progress_id || null
      };
    } else {
      const result = await generateDirectLLMRenderer({
        domain_name: input.domainName,
        states: input.states,
        style_hints: input.styleHints,
        llm_provider: input.llmProvider,
        llm_model: input.llmModel,
        ollama_base_url: input.ollamaBaseUrl
      });
      console.log("[generateLLMRenderer] Direct Result success:", result.success);
      if (!result.success) {
        console.error("[generateLLMRenderer] Error:", result.error);
      }
      if (result.saved_file) {
        console.log("[generateLLMRenderer] Saved:", result.saved_file);
      }
      return {
        success: result.success,
        typescript_code: result.typescript_code,
        error: result.error,
        saved_file: result.saved_file || null,
        progress_id: null
        // Direct approach doesn't use progress tracking
      };
    }
  }),
  /**
   * Check LLM renderer availability
   */
  checkLLMStatus: publicProcedure.query(async () => {
    return await checkLLMRendererStatus();
  }),
  /**
   * Get cached renderer for a domain
   */
  getCachedRenderer: publicProcedure.input(z2.object({ domainName: z2.string() })).query(({ input }) => {
    console.log("[getCachedRenderer] Looking for cached renderer for:", input.domainName);
    const cached = getCachedRenderer(input.domainName);
    if (cached) {
      console.log("[getCachedRenderer] Found cached renderer:", cached.filename);
      return {
        found: true,
        code: cached.code,
        filename: cached.filename
      };
    }
    console.log("[getCachedRenderer] No cached renderer found");
    return {
      found: false,
      code: null,
      filename: null
    };
  }),
  /**
   * Clear all cached MCP renderers
   */
  clearRendererCache: publicProcedure.mutation(async () => {
    console.log("[clearRendererCache] Clearing all cached MCP renderers");
    const result = clearRendererCache();
    console.log("[clearRendererCache] Result:", result);
    return result;
  }),
  /**
   * Get cached direct (non-MCP) renderer for a domain
   */
  getCachedDirectRenderer: publicProcedure.input(z2.object({ domainName: z2.string() })).query(({ input }) => {
    console.log("[getCachedDirectRenderer] Looking for cached direct renderer for:", input.domainName);
    const cached = getCachedDirectRenderer(input.domainName);
    if (cached) {
      console.log("[getCachedDirectRenderer] Found cached direct renderer:", cached.filename);
      return {
        found: true,
        code: cached.code,
        filename: cached.filename
      };
    }
    console.log("[getCachedDirectRenderer] No cached direct renderer found");
    return {
      found: false,
      code: null,
      filename: null
    };
  }),
  /**
   * Clear all cached direct (non-MCP) renderers
   */
  clearDirectRendererCache: publicProcedure.mutation(async () => {
    console.log("[clearDirectRendererCache] Clearing all cached direct renderers");
    const result = clearDirectRendererCache();
    console.log("[clearDirectRendererCache] Result:", result);
    return result;
  }),
  /**
   * Get generation progress
   * Used for polling during LLM renderer generation
   */
  getGenerationProgress: publicProcedure.input(z2.object({ progressId: z2.string().optional() })).query(({ input }) => {
    const progress = getGenerationProgress(input.progressId);
    if (!progress) {
      return {
        found: false,
        progress: null
      };
    }
    return {
      found: true,
      progress: {
        id: progress.id,
        domainName: progress.domainName,
        status: progress.status,
        currentStep: progress.currentStep,
        totalSteps: progress.totalSteps,
        percentage: progress.percentage,
        currentMessage: progress.currentMessage,
        logs: progress.logs,
        detailedLogs: progress.detailedLogs || [],
        startTime: progress.startTime,
        endTime: progress.endTime,
        error: progress.error
      }
    };
  }),
  /**
   * List all cached MCP renderers for a domain
   */
  listCachedRenderers: publicProcedure.input(z2.object({ domainName: z2.string() })).query(({ input }) => {
    console.log("[listCachedRenderers] Listing cached renderers for:", input.domainName);
    const result = listCachedRenderers(input.domainName);
    return result;
  }),
  /**
   * List all cached direct renderers for a domain
   */
  listDirectCachedRenderers: publicProcedure.input(z2.object({ domainName: z2.string() })).query(({ input }) => {
    console.log("[listDirectCachedRenderers] Listing cached direct renderers for:", input.domainName);
    const result = listDirectCachedRenderers(input.domainName);
    return result;
  }),
  /**
   * Get a specific cached MCP renderer by filename
   */
  getCachedRendererByFilename: publicProcedure.input(z2.object({ filename: z2.string() })).query(({ input }) => {
    console.log("[getCachedRendererByFilename] Getting renderer:", input.filename);
    const result = getCachedRendererByFilename(input.filename);
    if (result) {
      return {
        found: true,
        code: result.code,
        filename: result.filename
      };
    }
    return {
      found: false,
      code: null,
      filename: null
    };
  }),
  /**
   * Get a specific cached direct renderer by filename
   */
  getDirectCachedRendererByFilename: publicProcedure.input(z2.object({ filename: z2.string() })).query(({ input }) => {
    console.log("[getDirectCachedRendererByFilename] Getting direct renderer:", input.filename);
    const result = getDirectCachedRendererByFilename(input.filename);
    if (result) {
      return {
        found: true,
        code: result.code,
        filename: result.filename
      };
    }
    return {
      found: false,
      code: null,
      filename: null
    };
  }),
  /**
   * Get available LLM providers and models
   */
  getAvailableLLMModels: publicProcedure.query(() => {
    return {
      providers: [
        {
          id: "anthropic",
          name: "Anthropic (Claude)",
          description: "Cloud-based, requires API key",
          requiresApiKey: true,
          models: [
            { id: "claude-sonnet-4-20250514", name: "Claude Sonnet 4", description: "Latest and most capable" },
            { id: "claude-3-5-sonnet-20241022", name: "Claude 3.5 Sonnet", description: "Fast and efficient" },
            { id: "claude-3-haiku-20240307", name: "Claude 3 Haiku", description: "Fastest, good for simple tasks" }
          ]
        },
        {
          id: "ollama",
          name: "Ollama (Local)",
          description: "Free, runs locally, requires Ollama installed",
          requiresApiKey: false,
          models: [
            { id: "codellama:13b", name: "CodeLlama 13B", description: "Good balance of speed and quality" },
            { id: "codellama:34b", name: "CodeLlama 34B", description: "Best code quality, slower" },
            { id: "llama3.1:8b", name: "Llama 3.1 8B", description: "Fast general purpose" },
            { id: "llama3.1:70b", name: "Llama 3.1 70B", description: "Most capable open model" },
            { id: "mistral:7b", name: "Mistral 7B", description: "Fast and efficient" },
            { id: "mixtral:8x7b", name: "Mixtral 8x7B", description: "Great for code generation" },
            { id: "qwen2.5-coder:7b", name: "Qwen 2.5 Coder 7B", description: "Specialized for coding" },
            { id: "deepseek-coder:6.7b", name: "DeepSeek Coder 6.7B", description: "Excellent code model" }
          ]
        }
      ]
    };
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
