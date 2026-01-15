/**
 * LLM Orchestrator for Node.js Backend
 * 
 * This module provides a generic LLM orchestration layer that:
 * 1. Abstracts away specific LLM provider details (currently Anthropic)
 * 2. Supports MCP sampling - allowing the MCP server to request LLM generations
 * 3. Handles tool use conversations for generating renderers
 * 
 * Architecture:
 * - LLMOrchestrator: Generic interface for LLM operations
 * - AnthropicProvider: Concrete implementation using Anthropic SDK
 * - SamplingHandler: Handles MCP sampling requests from the server
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

    // Convert MCP sampling request to Anthropic format
    // We need to handle the content conversion carefully for type safety
    const messages = request.messages.map(msg => {
      let content: string | Anthropic.ContentBlockParam[];
      
      if (typeof msg.content === "string") {
        content = msg.content;
      } else if (Array.isArray(msg.content)) {
        content = msg.content.map(c => {
          if (c.type === "text") {
            return { type: "text" as const, text: (c as { type: "text"; text: string }).text };
          }
          // For other types, convert to text representation
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

    // Convert Anthropic response to MCP sampling response format
    // Handle single text response vs array of content blocks
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
          // Fallback for other types
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

  /**
   * Get the underlying provider
   */
  getProvider(): LLMProvider {
    return this.provider;
  }

  /**
   * Check if response contains tool use
   */
  hasToolUse(response: LLMResponse): boolean {
    return response.content.some(block => block.type === "tool_use");
  }

  /**
   * Extract tool use blocks from response
   */
  getToolUseBlocks(response: LLMResponse): ToolUseBlock[] {
    return response.content.filter(
      (block): block is ToolUseBlock => block.type === "tool_use"
    );
  }

  /**
   * Extract text from response
   */
  extractText(response: LLMResponse): string {
    return response.content
      .filter((block): block is TextBlock => block.type === "text")
      .map(block => block.text)
      .join("\n");
  }

  /**
   * Execute tool requests using MCP client
   */
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

  /**
   * Handle an MCP sampling request
   * This is called when the MCP server requests LLM generation
   */
  async handleSamplingRequest(request: SamplingRequest): Promise<SamplingResponse> {
    console.log("[LLMOrchestrator] Received MCP sampling request");
    return this.provider.handleSamplingRequest(request);
  }

  /**
   * Simple chat without tools
   */
  async simpleChat(system: string, userMessage: string): Promise<string> {
    return this.provider.simpleChat(system, userMessage);
  }

  /**
   * Chat with tools
   */
  async chat(
    messages: Message[],
    system: string,
    tools?: ToolDefinition[]
  ): Promise<LLMResponse> {
    return this.provider.chat(messages, system, tools);
  }
}

// ============================================================================
// Renderer Generation with MCP Tools
// ============================================================================

/**
 * Generate a renderer using LLM with MCP tools
 * 
 * This function demonstrates the MCP sampling pattern:
 * 1. Client connects to MCP server
 * 2. Client calls MCP tools to get prompts and hints
 * 3. Client uses LLM to generate code
 * 4. Client validates and cleans code using MCP tools
 * 
 * In a full MCP sampling implementation, the server would request
 * the LLM generation via sampling/createMessage, but for simplicity
 * we keep the LLM calls in the client for now.
 */
export type ProgressCallback = (step: number, message: string) => void;
export type DetailedLogCallback = (source: string, message: string, level?: 'info' | 'success' | 'warning' | 'error') => void;

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

  log('LLMOrchestrator', `Starting renderer generation for domain: ${domainName}`);
  log('LLMOrchestrator', `Using provider: ${orchestrator.getProvider().getProviderName()}`);
  log('LLMOrchestrator', `Using model: ${orchestrator.getProvider().getModelName()}`);

  // Helper function to safely parse JSON from MCP tool results
  const safeParseToolResult = (result: { content: string; isError: boolean }, toolName: string): unknown => {
    if (result.isError) {
      log('LLMOrchestrator', `Tool ${toolName} returned error: ${result.content}`, 'error');
      throw new Error(`MCP tool ${toolName} failed: ${result.content}`);
    }
    try {
      return JSON.parse(result.content);
    } catch (e) {
      log('LLMOrchestrator', `Failed to parse JSON from ${toolName}: ${result.content.substring(0, 200)}`, 'error');
      throw new Error(`Invalid JSON from MCP tool ${toolName}: ${result.content.substring(0, 100)}...`);
    }
  };

  // Helper to report progress
  const reportProgress = (step: number, message: string) => {
    log('LLMOrchestrator', `Step ${step}: ${message}`);
    if (onProgress) {
      onProgress(step, message);
    }
  };

  try {
    // Step 1: Get domain hints
    reportProgress(1, "Getting domain hints...");
    log('MCPClient', 'Calling tool: get_domain_hints');
    const hintsResult = await mcpClient.callTool("get_domain_hints", { domain_name: domainName });
    const hints = safeParseToolResult(hintsResult, "get_domain_hints") as { found: boolean };
    log('LLMOrchestrator', `Domain hints: ${hints.found ? "found" : "not found"}`);

    // Step 2: Get generation prompts
    reportProgress(2, "Preparing generation prompts...");
    log('MCPClient', 'Calling tool: prepare_generation_artifacts');
    const promptResult = await mcpClient.callTool("prepare_generation_artifacts", {
      domain_name: domainName,
      example_state: JSON.stringify(exampleState),
      style_hints: styleHints || "",
    });
    const promptData = safeParseToolResult(promptResult, "prepare_generation_artifacts") as {
      success: boolean;
      system_prompt?: string;
      user_prompt?: string;
      error?: string;
    };
    
    if (!promptData.success) {
      return { success: false, code: "", error: promptData.error };
    }

    // Step 3: Generate code using LLM
    reportProgress(3, "Calling Claude API to generate code...");
    if (!promptData.system_prompt || !promptData.user_prompt) {
      return { success: false, code: "", error: "Missing prompts from MCP server" };
    }
    let code = await orchestrator.simpleChat(promptData.system_prompt, promptData.user_prompt);
    
    // Step 4: Clean the code
    reportProgress(4, "Cleaning generated code...");
    log('MCPClient', 'Calling tool: clean_code');
    const cleanResult = await mcpClient.callTool("clean_code", { code });
    const cleanData = safeParseToolResult(cleanResult, "clean_code") as { success: boolean; code?: string };
    
    if (cleanData.success && cleanData.code) {
      code = cleanData.code;
    }

    // Step 5: Validate the code
    reportProgress(5, "Validating JavaScript syntax...");
    log('MCPClient', 'Calling tool: validate_renderer');
    const validateResult = await mcpClient.callTool("validate_renderer", {
      code,
      domain_name: domainName,
    });
    const validation = safeParseToolResult(validateResult, "validate_renderer") as {
      valid: boolean;
      errors?: string[];
    };

    if (!validation.valid) {
      log('LLMOrchestrator', `Validation failed: ${validation.errors?.join(", ") || "Unknown error"}`, 'warning');
      
      // Try to regenerate with error feedback
      log('LLMOrchestrator', 'Attempting to fix errors...');
      const fixPrompt = `${promptData.user_prompt}

PREVIOUS ATTEMPT HAD ERRORS:
${validation.errors?.join("\n") || "Unknown errors"}

Please fix these issues and generate correct code.`;
      
      code = await orchestrator.simpleChat(promptData.system_prompt, fixPrompt);
      
      // Clean again
      log('MCPClient', 'Calling tool: clean_code (retry)');
      const cleanResult2 = await mcpClient.callTool("clean_code", { code });
      const cleanData2 = safeParseToolResult(cleanResult2, "clean_code") as { success: boolean; code?: string };
      if (cleanData2.success && cleanData2.code) {
        code = cleanData2.code;
      }
      
      // Validate again
      log('MCPClient', 'Calling tool: validate_renderer (retry)');
      const validateResult2 = await mcpClient.callTool("validate_renderer", {
        code,
        domain_name: domainName,
      });
      const validation2 = safeParseToolResult(validateResult2, "validate_renderer") as {
        valid: boolean;
        errors?: string[];
      };
      
      if (!validation2.valid) {
        log('LLMOrchestrator', `Second validation also failed: ${validation2.errors?.join(", ") || "Unknown error"}`, 'warning');
        // Return anyway, frontend can handle partial code
      }
    }

    reportProgress(6, "Generation complete!");
    log('LLMOrchestrator', `Generation complete, code length: ${code.length}`, 'success');
    return { success: true, code };

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
