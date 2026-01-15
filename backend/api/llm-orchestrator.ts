/**
 * LLM Orchestrator for Node.js Backend
 * 
 * This module provides a generic LLM orchestration layer that:
 * 1. Abstracts away specific LLM provider details (currently Anthropic)
 * 2. Supports MCP sampling - allowing the MCP server to request LLM generations
 * 3. Implements a FULLY AUTONOMOUS agentic loop where the LLM discovers and
 *    uses MCP tools based on their descriptions - NO hardcoded workflow
 * 
 * Architecture:
 * - LLMOrchestrator: Generic interface for LLM operations
 * - AnthropicProvider: Concrete implementation using Anthropic SDK
 * - generateRendererWithLLM: Autonomous loop where LLM decides everything
 * 
 * MCP Integration:
 * - Resources: Versioned prompts fetched from prompt://renderer/system/{version}
 * - Tools: Self-descriptive functions that LLM discovers and uses autonomously
 * - The LLM reads tool descriptions and decides which to call and when
 */

import Anthropic from "@anthropic-ai/sdk";
import type { MCPClient } from "./mcp-client.js";

// ============================================================================
// Types for LLM Messages (Provider-agnostic)
// ============================================================================

export interface TextBlock {
  type: "text";
  text: string;
}

export interface ToolUseBlock {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ToolResultBlock {
  type: "tool_result";
  tool_use_id: string;
  content: string;
  is_error?: boolean;
}

export type ContentBlock = TextBlock | ToolUseBlock;
export type MessageContent = string | (ContentBlock | ToolResultBlock)[];

export interface Message {
  role: "user" | "assistant";
  content: MessageContent;
}

export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export interface LLMResponse {
  content: ContentBlock[];
  stopReason: string;
  model: string;
}

// ============================================================================
// MCP Sampling Types (per MCP Specification 2025-11-25)
// ============================================================================

export interface SamplingRequest {
  messages: Array<{
    role: "user" | "assistant";
    content: {
      type: "text";
      text: string;
    } | Array<{
      type: string;
      [key: string]: unknown;
    }>;
  }>;
  modelPreferences?: {
    hints?: Array<{ name: string }>;
    intelligencePriority?: number;
    speedPriority?: number;
  };
  systemPrompt?: string;
  maxTokens?: number;
  tools?: ToolDefinition[];
  toolChoice?: {
    mode: "auto" | "none" | "required";
  };
}

export interface SamplingResponse {
  role: "assistant";
  content: {
    type: "text";
    text: string;
  } | Array<{
    type: string;
    [key: string]: unknown;
  }>;
  model: string;
  stopReason: string;
}

// ============================================================================
// LLM Provider Interface (Generic)
// ============================================================================

export interface LLMProvider {
  /**
   * Send a message to the LLM with optional tools
   */
  chat(
    messages: Message[],
    system: string,
    tools?: ToolDefinition[]
  ): Promise<LLMResponse>;

  /**
   * Simple message to LLM without tools
   */
  simpleChat(system: string, userMessage: string): Promise<string>;

  /**
   * Handle an MCP sampling request
   */
  handleSamplingRequest(request: SamplingRequest): Promise<SamplingResponse>;

  /**
   * Get the provider name
   */
  getProviderName(): string;

  /**
   * Get the model being used
   */
  getModelName(): string;
}

// ============================================================================
// Anthropic Provider Implementation
// ============================================================================

export class AnthropicProvider implements LLMProvider {
  private client: Anthropic;
  private model: string;

  constructor(apiKey?: string) {
    this.client = new Anthropic({
      apiKey: apiKey || process.env.ANTHROPIC_API_KEY,
    });
    this.model = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-20250514";
  }

  getProviderName(): string {
    return "anthropic";
  }

  getModelName(): string {
    return this.model;
  }

  async chat(
    messages: Message[],
    system: string,
    tools?: ToolDefinition[]
  ): Promise<LLMResponse> {
    const params: Anthropic.MessageCreateParams = {
      model: this.model,
      max_tokens: 8192,
      system,
      messages: messages as Anthropic.MessageParam[],
    };

    if (tools && tools.length > 0) {
      params.tools = tools.map(t => ({
        name: t.name,
        description: t.description,
        input_schema: t.input_schema as Anthropic.Tool.InputSchema,
      }));
    }

    const response = await this.client.messages.create(params);

    return {
      content: response.content as ContentBlock[],
      stopReason: response.stop_reason || "end_turn",
      model: response.model,
    };
  }

  async simpleChat(system: string, userMessage: string): Promise<string> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 8192,
      system,
      messages: [{ role: "user", content: userMessage }],
    });

    return response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map(block => block.text)
      .join("\n");
  }

  async handleSamplingRequest(request: SamplingRequest): Promise<SamplingResponse> {
    console.log("[AnthropicProvider] Handling MCP sampling request");

    const messages = request.messages.map(msg => {
      let content: string | Anthropic.ContentBlockParam[];
      
      if (typeof msg.content === "string") {
        content = msg.content;
      } else if (Array.isArray(msg.content)) {
        content = msg.content.map(c => {
          if (c.type === "text") {
            return { type: "text" as const, text: (c as { type: "text"; text: string }).text };
          }
          return { type: "text" as const, text: JSON.stringify(c) };
        });
      } else if (msg.content && typeof msg.content === "object" && "type" in msg.content) {
        const textContent = msg.content as { type: "text"; text: string };
        content = [{ type: "text" as const, text: textContent.text }];
      } else {
        content = "";
      }
      
      return { role: msg.role, content };
    }) as Anthropic.MessageParam[];

    const params: Anthropic.MessageCreateParams = {
      model: this.model,
      max_tokens: request.maxTokens || 4096,
      messages,
    };

    if (request.systemPrompt) {
      params.system = request.systemPrompt;
    }

    if (request.tools && request.tools.length > 0) {
      params.tools = request.tools.map(t => ({
        name: t.name,
        description: t.description,
        input_schema: t.input_schema as Anthropic.Tool.InputSchema,
      }));
    }

    const response = await this.client.messages.create(params);

    let responseContent: SamplingResponse["content"];
    
    if (response.content.length === 1 && response.content[0].type === "text") {
      responseContent = { type: "text", text: response.content[0].text };
    } else {
      responseContent = response.content
        .filter(block => block.type === "text" || block.type === "tool_use")
        .map(block => {
          if (block.type === "text") {
            return { type: "text" as const, text: block.text };
          } else if (block.type === "tool_use") {
            return {
              type: "tool_use" as const,
              id: block.id,
              name: block.name,
              input: block.input as Record<string, unknown>,
            };
          }
          return { type: "text" as const, text: "" };
        });
    }

    return {
      role: "assistant",
      content: responseContent,
      model: response.model,
      stopReason: response.stop_reason === "tool_use" ? "toolUse" : "endTurn",
    };
  }
}

// ============================================================================
// LLM Orchestrator (Main Class)
// ============================================================================

export class LLMOrchestrator {
  private provider: LLMProvider;

  constructor(provider?: LLMProvider) {
    this.provider = provider || new AnthropicProvider();
  }

  getProvider(): LLMProvider {
    return this.provider;
  }

  hasToolUse(response: LLMResponse): boolean {
    return response.content.some(block => block.type === "tool_use");
  }

  getToolUseBlocks(response: LLMResponse): ToolUseBlock[] {
    return response.content.filter(
      (block): block is ToolUseBlock => block.type === "tool_use"
    );
  }

  extractText(response: LLMResponse): string {
    return response.content
      .filter((block): block is TextBlock => block.type === "text")
      .map(block => block.text)
      .join("\n");
  }

  async executeToolRequests(
    mcpClient: MCPClient,
    response: LLMResponse
  ): Promise<ToolResultBlock[]> {
    const toolUseBlocks = this.getToolUseBlocks(response);
    const results: ToolResultBlock[] = [];

    for (const block of toolUseBlocks) {
      console.log(`[LLMOrchestrator] Executing tool: ${block.name}`);
      
      const result = await mcpClient.callTool(block.name, block.input as Record<string, unknown>);
      
      results.push({
        type: "tool_result",
        tool_use_id: block.id,
        content: result.content,
        is_error: result.isError,
      });
    }

    return results;
  }

  async handleSamplingRequest(request: SamplingRequest): Promise<SamplingResponse> {
    console.log("[LLMOrchestrator] Received MCP sampling request");
    return this.provider.handleSamplingRequest(request);
  }

  async simpleChat(system: string, userMessage: string): Promise<string> {
    return this.provider.simpleChat(system, userMessage);
  }

  async chat(
    messages: Message[],
    system: string,
    tools?: ToolDefinition[]
  ): Promise<LLMResponse> {
    return this.provider.chat(messages, system, tools);
  }
}

// ============================================================================
// Renderer Generation - FULLY AUTONOMOUS Agentic Loop
// ============================================================================

/**
 * Generate a renderer using a FULLY AUTONOMOUS agentic loop.
 * 
 * The LLM:
 * 1. Receives a simple task: "Generate a visualization renderer for this domain"
 * 2. Discovers available MCP tools via their descriptions
 * 3. Autonomously decides which tools to call and when
 * 4. Uses tools to understand the domain, get hints, validate code, etc.
 * 5. Returns the final code when ready
 * 
 * NO HARDCODED WORKFLOW - the LLM figures out the best approach based on
 * the tool descriptions. This is the true MCP pattern.
 */
export type ProgressCallback = (step: number, message: string) => void;
export type DetailedLogCallback = (source: string, message: string, level?: 'info' | 'success' | 'warning' | 'error') => void;

// Default prompt version to use
const DEFAULT_PROMPT_VERSION = "v1";

// Maximum iterations for the agentic loop
const MAX_AGENT_ITERATIONS = 15;

export async function generateRendererWithLLM(
  mcpClient: MCPClient,
  domainName: string,
  exampleState: unknown,
  styleHints?: string,
  onProgress?: ProgressCallback,
  onDetailedLog?: DetailedLogCallback
): Promise<{ success: boolean; code: string; error?: string }> {
  const orchestrator = new LLMOrchestrator();

  // Helper to log detailed messages
  const log = (source: string, message: string, level: 'info' | 'success' | 'warning' | 'error' = 'info') => {
    console.log(`[${source}] ${message}`);
    if (onDetailedLog) {
      onDetailedLog(source, message, level);
    }
  };

  // Helper to report progress
  const reportProgress = (step: number, message: string) => {
    log('LLMOrchestrator', `Step ${step}: ${message}`);
    if (onProgress) {
      onProgress(step, message);
    }
  };

  log('LLMOrchestrator', `Starting AUTONOMOUS renderer generation for domain: ${domainName}`);
  log('LLMOrchestrator', `Using provider: ${orchestrator.getProvider().getProviderName()}`);
  log('LLMOrchestrator', `Using model: ${orchestrator.getProvider().getModelName()}`);

  try {
    // =========================================================================
    // SETUP: Fetch system prompt and prepare minimal context
    // =========================================================================
    
    reportProgress(1, "Fetching system prompt from MCP Resource...");
    
    const promptResourceUri = `prompt://renderer/system/${DEFAULT_PROMPT_VERSION}`;
    log('MCPClient', `Reading resource: ${promptResourceUri}`);
    const systemPromptResult = await mcpClient.readResource(promptResourceUri);
    
    if (systemPromptResult.isError) {
      log('LLMOrchestrator', `Failed to fetch system prompt: ${systemPromptResult.content}`, 'error');
      return { success: false, code: "", error: `Failed to fetch system prompt: ${systemPromptResult.content}` };
    }
    
    // Convert domain name to PascalCase for the prompt
    const domainPascal = domainName
      .split(/[-_\s]+/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join('');
    
    // Replace placeholder in system prompt
    const systemPrompt = systemPromptResult.content.replace(/{domain_pascal}/g, domainPascal);
    
    log('LLMOrchestrator', `System prompt loaded (${systemPrompt.length} chars)`);
    log('LLMOrchestrator', `Domain PascalCase: ${domainPascal}`);
    
    // =========================================================================
    // AUTONOMOUS AGENTIC LOOP - LLM discovers and uses tools on its own
    // =========================================================================
    
    reportProgress(2, "Starting autonomous agentic loop...");
    
    // Get ALL available tools from MCP server - LLM will discover what they do
    const availableTools = mcpClient.getToolsForLLM();
    log('LLMOrchestrator', `Available MCP tools: ${availableTools.map(t => t.name).join(', ')}`);
    
    // Build a simple, minimal user prompt - just the task and data
    // NO workflow instructions - let LLM figure it out from tool descriptions
    let userPrompt = `Generate JavaScript renderer functions for the "${domainName}" domain.

The renderer must use PascalCase name: ${domainPascal}
(e.g., function render${domainPascal}(ctx, state) { ... })

EXAMPLE STATE DATA:
${JSON.stringify(exampleState, null, 2)}
`;

    if (styleHints) {
      userPrompt += `\nSTYLE HINTS: ${styleHints}\n`;
    }

    userPrompt += `
Use the available tools to:
- Understand the domain better (check for existing rendered data, get hints)
- Validate your generated code before returning it
- Clean any formatting issues from your code

When you have valid, working code, output ONLY the JavaScript functions (no explanations).`;

    // Initialize message history
    const messages: Message[] = [
      { role: "user", content: userPrompt }
    ];
    
    let finalCode = "";
    let iteration = 0;
    
    // Autonomous loop: LLM decides everything
    while (iteration < MAX_AGENT_ITERATIONS) {
      iteration++;
      reportProgress(2 + iteration, `Autonomous iteration ${iteration}...`);
      log('LLMOrchestrator', `--- Iteration ${iteration} ---`);
      
      // Call LLM with current history and ALL available tools
      const llmResponse = await orchestrator.chat(messages, systemPrompt, availableTools);
      
      log('LLMOrchestrator', `LLM stop reason: ${llmResponse.stopReason}`);
      
      // Check if LLM wants to use tools
      if (orchestrator.hasToolUse(llmResponse)) {
        const toolBlocks = orchestrator.getToolUseBlocks(llmResponse);
        log('LLMOrchestrator', `LLM autonomously chose ${toolBlocks.length} tool(s): ${toolBlocks.map(t => t.name).join(', ')}`);
        
        // Add assistant's response to history
        messages.push({
          role: "assistant",
          content: llmResponse.content
        });
        
        // Execute tools and collect results
        const toolResults = await orchestrator.executeToolRequests(mcpClient, llmResponse);
        
        // Log tool results
        for (const result of toolResults) {
          const preview = result.content.substring(0, 150);
          log('MCPClient', `Tool result: ${preview}${result.content.length > 150 ? '...' : ''}`, result.is_error ? 'error' : 'info');
        }
        
        // Add tool results to history
        messages.push({
          role: "user",
          content: toolResults
        });
        
      } else {
        // LLM returned text - check if it's the final code
        let rawOutput = orchestrator.extractText(llmResponse);
        log('LLMOrchestrator', `LLM returned text output (${rawOutput.length} chars)`);
        
        if (rawOutput.includes('function render')) {
          // Extract just the code portion - strip any preamble
          const functionMatch = rawOutput.match(/function\s+render\w*\s*\(/);
          if (functionMatch && functionMatch.index !== undefined && functionMatch.index > 0) {
            log('LLMOrchestrator', `Stripping ${functionMatch.index} chars of preamble`);
            rawOutput = rawOutput.substring(functionMatch.index);
          }
          finalCode = rawOutput;
          log('LLMOrchestrator', 'Final code received from LLM', 'success');
          break;
        } else {
          // LLM returned text but no code - prompt to continue
          log('LLMOrchestrator', 'Output does not contain render function - prompting to continue', 'warning');
          messages.push({
            role: "assistant",
            content: llmResponse.content
          });
          messages.push({
            role: "user",
            content: "Please generate the JavaScript renderer code now. Output ONLY the functions, starting with 'function render...'."
          });
        }
      }
    }
    
    if (!finalCode || !finalCode.includes('function render')) {
      log('LLMOrchestrator', 'Loop completed but no valid code produced', 'error');
      return { success: false, code: "", error: "Failed to generate valid renderer code after maximum iterations" };
    }
    
    // =========================================================================
    // FINAL CLEANUP - ensure code is clean
    // =========================================================================
    
    reportProgress(MAX_AGENT_ITERATIONS + 3, "Final cleanup...");
    
    // Clean the code one more time
    log('MCPClient', 'Final clean_code call');
    const cleanResult = await mcpClient.callTool("clean_code", { code: finalCode });
    
    try {
      const cleanData = JSON.parse(cleanResult.content) as { success: boolean; code?: string };
      if (cleanData.success && cleanData.code) {
        finalCode = cleanData.code;
      }
    } catch {
      log('LLMOrchestrator', 'Could not parse clean_code result, using raw code', 'warning');
    }
    
    // Final validation
    log('MCPClient', 'Final validate_renderer call');
    const validateResult = await mcpClient.callTool("validate_renderer", {
      code: finalCode,
      domain_name: domainName,
    });
    
    try {
      const validation = JSON.parse(validateResult.content) as { valid: boolean; errors?: string[]; warnings?: string[] };
      
      if (!validation.valid) {
        log('LLMOrchestrator', `Final validation errors: ${validation.errors?.join(', ') || 'none'}`, 'warning');
      }
      if (validation.warnings && validation.warnings.length > 0) {
        log('LLMOrchestrator', `Validation warnings: ${validation.warnings.join(', ')}`, 'info');
      }
    } catch {
      log('LLMOrchestrator', 'Could not parse validation result', 'warning');
    }
    
    reportProgress(MAX_AGENT_ITERATIONS + 4, "Generation complete!");
    log('LLMOrchestrator', `Generation complete, code length: ${finalCode.length}`, 'success');
    log('LLMOrchestrator', `Total iterations: ${iteration}`);
    
    return { success: true, code: finalCode };

  } catch (error) {
    log('LLMOrchestrator', `Error: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    return {
      success: false,
      code: "",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// ============================================================================
// Export default orchestrator instance
// ============================================================================

export const defaultOrchestrator = new LLMOrchestrator();
