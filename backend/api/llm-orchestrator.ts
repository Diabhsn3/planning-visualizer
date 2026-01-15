/**
 * LLM Orchestrator for Node.js Backend
 * 
 * This module provides a generic LLM orchestration layer that:
 * 1. Abstracts away specific LLM provider details (currently Anthropic)
 * 2. Supports MCP sampling - allowing the MCP server to request LLM generations
 * 3. Implements an AGENTIC LOOP for renderer generation where the LLM decides
 *    which tools to call and when, rather than following a hardcoded sequence
 * 
 * Architecture:
 * - LLMOrchestrator: Generic interface for LLM operations
 * - AnthropicProvider: Concrete implementation using Anthropic SDK
 * - generateRendererWithLLM: Agentic loop that lets LLM orchestrate tool calls
 * 
 * MCP Integration:
 * - Resources: Versioned prompts fetched from prompt://renderer/system/{version}
 * - Tools: Utility functions (validate_renderer, clean_code, get_domain_hints)
 * - The LLM decides which tools to use based on the task context
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
// Renderer Generation with Agentic Loop
// ============================================================================

/**
 * Generate a renderer using an AGENTIC LOOP where the LLM decides tool usage.
 * 
 * This function implements the MCP-idiomatic pattern:
 * 1. Fetch the versioned system prompt from MCP Resource (prompt://renderer/system/v1)
 * 2. Prepare the initial user prompt using MCP Tool (prepare_generation_artifacts)
 * 3. Enter an agentic loop where the LLM decides which tools to call
 * 4. The LLM can use: get_domain_hints, clean_code, validate_renderer
 * 5. Loop continues until LLM returns final code or max iterations reached
 * 
 * Benefits:
 * - LLM decides the optimal sequence of tool calls
 * - More flexible than hardcoded orchestration
 * - Prompts are versioned and reproducible via MCP Resources
 * - Follows MCP design philosophy: Resources for context, Tools for actions
 */
export type ProgressCallback = (step: number, message: string) => void;
export type DetailedLogCallback = (source: string, message: string, level?: 'info' | 'success' | 'warning' | 'error') => void;

// Default prompt version to use
const DEFAULT_PROMPT_VERSION = "v1";

// Maximum iterations for the agentic loop
const MAX_AGENT_ITERATIONS = 10;

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

  log('LLMOrchestrator', `Starting AGENTIC renderer generation for domain: ${domainName}`);
  log('LLMOrchestrator', `Using provider: ${orchestrator.getProvider().getProviderName()}`);
  log('LLMOrchestrator', `Using model: ${orchestrator.getProvider().getModelName()}`);

  try {
    // =========================================================================
    // SETUP PHASE: Fetch versioned prompt and prepare initial context
    // =========================================================================
    
    reportProgress(1, "Fetching versioned system prompt from MCP Resource...");
    
    // Step 1: Read the versioned system prompt from MCP Resource
    const promptResourceUri = `prompt://renderer/system/${DEFAULT_PROMPT_VERSION}`;
    log('MCPClient', `Reading resource: ${promptResourceUri}`);
    const systemPromptResult = await mcpClient.readResource(promptResourceUri);
    
    if (systemPromptResult.isError) {
      log('LLMOrchestrator', `Failed to fetch system prompt: ${systemPromptResult.content}`, 'error');
      return { success: false, code: "", error: `Failed to fetch system prompt: ${systemPromptResult.content}` };
    }
    
    log('LLMOrchestrator', `Fetched system prompt (${systemPromptResult.content.length} chars) from ${promptResourceUri}`, 'success');
    
    // Step 2: Get the initial user prompt and domain_pascal from prepare_generation_artifacts
    reportProgress(2, "Preparing initial generation context...");
    log('MCPClient', 'Calling tool: prepare_generation_artifacts');
    
    const artifactsResult = await mcpClient.callTool("prepare_generation_artifacts", {
      domain_name: domainName,
      example_state: JSON.stringify(exampleState),
      style_hints: styleHints || "",
    });
    
    const artifacts = safeParseToolResult(artifactsResult, "prepare_generation_artifacts") as {
      success: boolean;
      user_prompt?: string;
      domain_pascal?: string;
      error?: string;
    };
    
    if (!artifacts.success || !artifacts.user_prompt || !artifacts.domain_pascal) {
      return { success: false, code: "", error: artifacts.error || "Failed to prepare generation artifacts" };
    }
    
    // Replace {domain_pascal} placeholder in system prompt
    const systemPrompt = systemPromptResult.content.replace(/{domain_pascal}/g, artifacts.domain_pascal);
    const initialUserPrompt = artifacts.user_prompt;
    
    log('LLMOrchestrator', `Domain PascalCase: ${artifacts.domain_pascal}`);
    
    // =========================================================================
    // AGENTIC LOOP: Let the LLM decide which tools to use
    // =========================================================================
    
    reportProgress(3, "Starting agentic generation loop...");
    
    // Get available tools from MCP server (for LLM to choose from)
    const availableTools = mcpClient.getToolsForLLM();
    log('LLMOrchestrator', `Available tools for LLM: ${availableTools.map(t => t.name).join(', ')}`);
    
    // Build the agentic system prompt that instructs the LLM how to use tools
    const agenticSystemPrompt = `${systemPrompt}

---

You have access to the following tools to help generate and validate the renderer:

AVAILABLE TOOLS:
- get_domain_hints: Get visualization hints for known planning domains
- clean_code: Remove markdown formatting and TypeScript annotations from code
- validate_renderer: Check JavaScript syntax and required functions

WORKFLOW:
1. First, optionally call get_domain_hints to get styling suggestions for this domain
2. Generate the JavaScript renderer code based on the example state
3. Call clean_code on your generated code to remove any formatting issues
4. Call validate_renderer to check for syntax errors
5. If validation fails, fix the errors and repeat steps 3-4
6. When the code is valid, output ONLY the final JavaScript code

IMPORTANT: When you have valid, working code, output it as plain text WITHOUT any tool calls.
The final output should start with 'function render...' and contain only JavaScript code.`;

    // Initialize message history with the user's request
    const messages: Message[] = [
      { role: "user", content: initialUserPrompt }
    ];
    
    let finalCode = "";
    let iteration = 0;
    
    // Agentic loop: LLM decides what to do
    while (iteration < MAX_AGENT_ITERATIONS) {
      iteration++;
      reportProgress(3 + iteration, `Agentic loop iteration ${iteration}...`);
      log('LLMOrchestrator', `--- Iteration ${iteration} ---`);
      
      // Call LLM with current history and available tools
      const llmResponse = await orchestrator.chat(messages, agenticSystemPrompt, availableTools);
      
      log('LLMOrchestrator', `LLM stop reason: ${llmResponse.stopReason}`);
      
      // Check if LLM wants to use tools
      if (orchestrator.hasToolUse(llmResponse)) {
        // LLM requested tool calls - execute them
        const toolBlocks = orchestrator.getToolUseBlocks(llmResponse);
        log('LLMOrchestrator', `LLM requested ${toolBlocks.length} tool(s): ${toolBlocks.map(t => t.name).join(', ')}`);
        
        // Add assistant's response (with tool_use) to history
        messages.push({
          role: "assistant",
          content: llmResponse.content
        });
        
        // Execute each tool and collect results
        const toolResults = await orchestrator.executeToolRequests(mcpClient, llmResponse);
        
        // Log tool results
        for (const result of toolResults) {
          const preview = result.content.substring(0, 100);
          log('MCPClient', `Tool result: ${preview}${result.content.length > 100 ? '...' : ''}`, result.is_error ? 'error' : 'info');
        }
        
        // Add tool results to history (as user message per Anthropic spec)
        messages.push({
          role: "user",
          content: toolResults
        });
        
      } else {
        // LLM returned text (no tool calls) - this should be the final code
        let rawOutput = orchestrator.extractText(llmResponse);
        log('LLMOrchestrator', `LLM returned final output (${rawOutput.length} chars)`);
        
        // Check if it looks like valid code
        if (rawOutput.includes('function render')) {
          // Extract just the code portion - strip any conversational preamble
          // This handles cases like "Here's the code:\n\nfunction render..."
          const functionMatch = rawOutput.match(/function\s+render\w*\s*\(/);
          if (functionMatch && functionMatch.index !== undefined && functionMatch.index > 0) {
            log('LLMOrchestrator', `Stripping ${functionMatch.index} chars of preamble before code`);
            rawOutput = rawOutput.substring(functionMatch.index);
          }
          finalCode = rawOutput;
          log('LLMOrchestrator', 'Final output contains render function - accepting as final code', 'success');
          break;
        } else {
          // LLM returned text but it doesn't look like code - ask it to continue
          log('LLMOrchestrator', 'Output does not contain render function - prompting LLM to continue', 'warning');
          messages.push({
            role: "assistant",
            content: llmResponse.content
          });
          messages.push({
            role: "user",
            content: "Please generate the JavaScript renderer code. The output should start with 'function render...' and contain the complete implementation."
          });
        }
      }
    }
    
    if (!finalCode || !finalCode.includes('function render')) {
      log('LLMOrchestrator', 'Agentic loop completed but no valid code produced', 'error');
      return { success: false, code: "", error: "Failed to generate valid renderer code after maximum iterations" };
    }
    
    // =========================================================================
    // FINAL CLEANUP: Ensure code is clean and valid
    // =========================================================================
    
    reportProgress(10, "Final validation...");
    
    // Final clean pass
    log('MCPClient', 'Final clean_code call');
    const finalCleanResult = await mcpClient.callTool("clean_code", { code: finalCode });
    const finalCleanData = safeParseToolResult(finalCleanResult, "clean_code") as { success: boolean; code?: string };
    
    if (finalCleanData.success && finalCleanData.code) {
      finalCode = finalCleanData.code;
    }
    
    // Final validation
    log('MCPClient', 'Final validate_renderer call');
    const finalValidateResult = await mcpClient.callTool("validate_renderer", {
      code: finalCode,
      domain_name: domainName,
    });
    const finalValidation = safeParseToolResult(finalValidateResult, "validate_renderer") as {
      valid: boolean;
      errors?: string[];
      warnings?: string[];
    };
    
    if (!finalValidation.valid) {
      log('LLMOrchestrator', `Final validation warnings: ${finalValidation.errors?.join(', ') || 'none'}`, 'warning');
      // Still return the code - frontend can handle partial results
    }
    
    if (finalValidation.warnings && finalValidation.warnings.length > 0) {
      log('LLMOrchestrator', `Validation warnings: ${finalValidation.warnings.join(', ')}`, 'info');
    }
    
    reportProgress(11, "Generation complete!");
    log('LLMOrchestrator', `Generation complete, code length: ${finalCode.length}`, 'success');
    log('LLMOrchestrator', `Total agentic iterations: ${iteration}`);
    
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
