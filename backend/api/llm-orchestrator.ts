/**
 * LLM Orchestrator for Renderer Generation
 * 
 * This module provides a provider-agnostic interface for generating
 * JavaScript renderers using LLM via MCP.
 * 
 * Architecture:
 * - LLMOrchestrator: Handles LLM API calls (Anthropic, OpenAI, etc.)
 * - MCPClient: Provides tools and resources from Python MCP server
 * - Investigate-First Approach: LLM analyzes state, uses tools, then generates
 */

import Anthropic from "@anthropic-ai/sdk";
import { MCPClient } from "./mcp-client.js";

// ============================================================================
// Types
// ============================================================================

export type ProgressCallback = (step: number, message: string) => void;
export type DetailedLogCallback = (source: string, message: string, level?: 'info' | 'success' | 'warning' | 'error') => void;

// Sampling types for MCP server-initiated LLM requests
export interface SamplingRequest {
  messages: Array<{ role: string; content: string }>;
  systemPrompt?: string;
  maxTokens?: number;
}

export interface SamplingResponse {
  content: string;
  stopReason?: string;
}

interface GenerationResult {
  success: boolean;
  code: string;
  error?: string;
}

interface Message {
  role: "user" | "assistant";
  content: any;
}

// ============================================================================
// LLM Provider Interface
// ============================================================================

interface LLMProvider {
  getProviderName(): string;
  getModelName(): string;
  chat(
    messages: Message[],
    systemPrompt: string,
    tools?: any[]
  ): Promise<any>;
}

// ============================================================================
// Anthropic Provider
// ============================================================================

class AnthropicProvider implements LLMProvider {
  private client: Anthropic;
  private model: string;

  constructor(model: string = "claude-sonnet-4-20250514") {
    this.client = new Anthropic();
    this.model = model;
  }

  getProviderName(): string {
    return "anthropic";
  }

  getModelName(): string {
    return this.model;
  }

  async chat(
    messages: Message[],
    systemPrompt: string,
    tools?: any[]
  ): Promise<Anthropic.Message> {
    const anthropicMessages = messages.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    const params: Anthropic.MessageCreateParams = {
      model: this.model,
      max_tokens: 16000,
      system: systemPrompt,
      messages: anthropicMessages,
    };

    if (tools && tools.length > 0) {
      params.tools = tools;
    }

    return await this.client.messages.create(params);
  }
}

// ============================================================================
// HuggingFace Inference API Provider (for open-source models)
// ============================================================================

class HuggingFaceProvider implements LLMProvider {
  private apiKey: string;
  private model: string;
  private baseUrl: string;

  constructor(model: string = "codellama/CodeLlama-13b-Instruct-hf") {
    this.apiKey = process.env.HF_API_KEY || "";
    this.model = model;
    this.baseUrl = "https://api-inference.huggingface.co/models";
  }

  getProviderName(): string {
    return "huggingface";
  }

  getModelName(): string {
    return this.model;
  }

  async chat(
    messages: Message[],
    systemPrompt: string,
    _tools?: any[]  // HF Inference API doesn't support tools
  ): Promise<any> {
    if (!this.apiKey) {
      throw new Error("HuggingFace API key not configured. Set HF_API_KEY environment variable.");
    }

    // Format prompt based on model type
    const prompt = this.formatPrompt(messages, systemPrompt);

    try {
      // Extended timeout for large models (5 minutes)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5 * 60 * 1000);

      console.log(`[HuggingFaceProvider] Calling model: ${this.model}`);

      const response = await fetch(`${this.baseUrl}/${this.model}`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          inputs: prompt,
          parameters: {
            max_new_tokens: 8000,
            temperature: 0.7,
            return_full_text: false,
            do_sample: true,
          },
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[HuggingFaceProvider] API error: ${response.status}`, errorText);
        
        // Handle specific HF errors
        if (response.status === 503) {
          throw new Error(`Model is loading. Please try again in a few seconds. (${errorText})`);
        }
        if (response.status === 429) {
          throw new Error(`Rate limit exceeded. Please wait and try again. (${errorText})`);
        }
        throw new Error(`HuggingFace API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log(`[HuggingFaceProvider] Response received`);

      // Handle different response formats
      let generatedText = "";
      if (Array.isArray(data)) {
        generatedText = data[0]?.generated_text || "";
      } else if (data.generated_text) {
        generatedText = data.generated_text;
      } else if (typeof data === "string") {
        generatedText = data;
      }

      // Convert to Anthropic-like format for compatibility
      return {
        content: [{ type: "text", text: generatedText }],
        stop_reason: "end_turn",
      };
    } catch (error) {
      console.error("[HuggingFaceProvider] Error:", error);
      throw error;
    }
  }

  private formatPrompt(messages: Message[], systemPrompt: string): string {
    // Different models need different prompt formats
    const modelLower = this.model.toLowerCase();

    if (modelLower.includes("codellama") || modelLower.includes("llama")) {
      // Llama/CodeLlama Instruct format
      let prompt = `<s>[INST] <<SYS>>\n${systemPrompt}\n<</SYS>>\n\n`;
      
      for (let i = 0; i < messages.length; i++) {
        const msg = messages[i];
        const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
        
        if (msg.role === "user") {
          prompt += `${content} [/INST] `;
        } else if (msg.role === "assistant") {
          prompt += `${content} </s><s>[INST] `;
        }
      }
      
      return prompt;
    } else if (modelLower.includes("mistral") || modelLower.includes("mixtral")) {
      // Mistral Instruct format
      let prompt = `<s>[INST] ${systemPrompt}\n\n`;
      
      for (const msg of messages) {
        const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
        if (msg.role === "user") {
          prompt += `${content} [/INST]`;
        } else {
          prompt += ` ${content}</s> [INST] `;
        }
      }
      
      return prompt;
    } else if (modelLower.includes("starcoder") || modelLower.includes("bigcode")) {
      // StarCoder format (simpler)
      let prompt = `### System:\n${systemPrompt}\n\n`;
      
      for (const msg of messages) {
        const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
        if (msg.role === "user") {
          prompt += `### User:\n${content}\n\n### Assistant:\n`;
        } else {
          prompt += `${content}\n\n`;
        }
      }
      
      return prompt;
    } else {
      // Generic chat format
      let prompt = `System: ${systemPrompt}\n\n`;
      
      for (const msg of messages) {
        const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
        const role = msg.role === "user" ? "User" : "Assistant";
        prompt += `${role}: ${content}\n\n`;
      }
      
      prompt += "Assistant: ";
      return prompt;
    }
  }
}

// ============================================================================
// Provider Factory
// ============================================================================

export type LLMProviderType = "anthropic" | "huggingface";

export interface LLMConfig {
  provider: LLMProviderType;
  model?: string;
}

export function createLLMProvider(config: LLMConfig): LLMProvider {
  switch (config.provider) {
    case "huggingface":
      return new HuggingFaceProvider(
        config.model || "codellama/CodeLlama-13b-Instruct-hf"
      );
    case "anthropic":
    default:
      return new AnthropicProvider(config.model || "claude-sonnet-4-20250514");
  }
}

// Available models for each provider
export const AVAILABLE_MODELS = {
  anthropic: [
    { id: "claude-sonnet-4-20250514", name: "Claude Sonnet 4", description: "Latest and most capable" },
    { id: "claude-3-5-sonnet-20241022", name: "Claude 3.5 Sonnet", description: "Fast and efficient" },
    { id: "claude-3-haiku-20240307", name: "Claude 3 Haiku", description: "Fastest, good for simple tasks" },
  ],
  huggingface: [
    { id: "codellama/CodeLlama-13b-Instruct-hf", name: "CodeLlama 13B", description: "Good for code generation" },
    { id: "codellama/CodeLlama-34b-Instruct-hf", name: "CodeLlama 34B", description: "Best code quality" },
    { id: "bigcode/starcoder2-15b", name: "StarCoder2 15B", description: "Excellent for code" },
    { id: "mistralai/Mistral-7B-Instruct-v0.2", name: "Mistral 7B", description: "Fast and efficient" },
    { id: "mistralai/Mixtral-8x7B-Instruct-v0.1", name: "Mixtral 8x7B", description: "Great quality" },
    { id: "Qwen/Qwen2.5-Coder-7B-Instruct", name: "Qwen 2.5 Coder 7B", description: "Specialized for coding" },
    { id: "deepseek-coder:6.7b", name: "DeepSeek Coder 6.7B", description: "Excellent code model" },
  ],
};

// ============================================================================
// LLM Orchestrator
// ============================================================================

export class LLMOrchestrator {
  private provider: LLMProvider;

  constructor(providerOrConfig?: LLMProvider | LLMConfig) {
    if (!providerOrConfig) {
      // Default to Anthropic
      this.provider = new AnthropicProvider();
    } else if ('chat' in providerOrConfig) {
      // It's already a provider
      this.provider = providerOrConfig as LLMProvider;
    } else {
      // It's a config object
      this.provider = createLLMProvider(providerOrConfig as LLMConfig);
    }
  }

  static fromConfig(config: LLMConfig): LLMOrchestrator {
    return new LLMOrchestrator(config);
  }

  getProvider(): LLMProvider {
    return this.provider;
  }

  async chat(messages: Message[], systemPrompt: string, tools?: any[]): Promise<any> {
    return this.provider.chat(messages, systemPrompt, tools);
  }

  /**
   * Handle a sampling request from the MCP server
   * This is called when the server requests LLM generation
   */
  async handleSamplingRequest(request: SamplingRequest): Promise<SamplingResponse> {
    console.log('[LLMOrchestrator] Handling sampling request');
    
    const messages: Message[] = request.messages.map(m => ({
      role: m.role as "user" | "assistant",
      content: m.content
    }));
    
    const response = await this.provider.chat(
      messages,
      request.systemPrompt || "",
      undefined
    );
    
    // Extract text from Anthropic response
    const textContent = this.extractText(response);
    
    return {
      content: textContent,
      stopReason: response.stop_reason || "end_turn"
    };
  }

  extractText(response: Anthropic.Message): string {
    const textBlocks = response.content.filter(
      (block): block is Anthropic.TextBlock => block.type === "text"
    );
    return textBlocks.map((b) => b.text).join("\n");
  }

  extractToolCalls(response: Anthropic.Message): Anthropic.ToolUseBlock[] {
    return response.content.filter(
      (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
    );
  }
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_PROMPT_VERSION = "v1";
const MAX_ITERATIONS = 20;  // Max agentic loop iterations

// ============================================================================
// Helper Functions
// ============================================================================

function validateCodeLocally(code: string, domainPascal: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Check for required main function
  const mainFnPattern = new RegExp(`function\\s+render${domainPascal}\\s*\\(`);
  if (!mainFnPattern.test(code)) {
    errors.push(`Missing required function: render${domainPascal}(ctx, state)`);
  }
  
  // Check for legend function
  const legendFnPattern = new RegExp(`function\\s+render${domainPascal}Legend\\s*\\(`);
  if (!legendFnPattern.test(code)) {
    errors.push(`Missing required function: render${domainPascal}Legend(ctx, x, y)`);
  }
  
  // Check for common syntax issues
  if (code.includes(": string") || code.includes(": number") || code.includes(": any")) {
    errors.push("Code contains TypeScript type annotations - must be pure JavaScript");
  }
  
  return { valid: errors.length === 0, errors };
}

function cleanCodeLocally(code: string): string {
  let cleaned = code;
  
  // Remove markdown code blocks
  cleaned = cleaned.replace(/```(?:javascript|js|typescript|ts)?\n?/gi, "");
  cleaned = cleaned.replace(/```\n?/g, "");
  
  // Strip any text before 'function render'
  const functionMatch = cleaned.match(/function\s+render\w*\s*\(/);
  if (functionMatch && functionMatch.index !== undefined && functionMatch.index > 0) {
    cleaned = cleaned.substring(functionMatch.index);
  }
  
  // Remove TypeScript type annotations
  cleaned = cleaned.replace(/:\s*(string|number|boolean|any|void|object|Array<[^>]+>|\w+\[\])\s*([,\)\{=])/g, "$2");
  cleaned = cleaned.replace(/as\s+\w+(\[\])?/g, "");
  
  // Remove trailing text after the last closing brace of a function
  // Find all top-level function definitions and their closing braces
  let braceCount = 0;
  let lastValidIndex = 0;
  let inFunction = false;
  
  for (let i = 0; i < cleaned.length; i++) {
    const char = cleaned[i];
    
    // Detect start of a function
    if (!inFunction && cleaned.substring(i).match(/^function\s+render\w*\s*\(/)) {
      inFunction = true;
    }
    
    if (char === '{') {
      braceCount++;
    } else if (char === '}') {
      braceCount--;
      if (braceCount === 0 && inFunction) {
        // End of a top-level function
        lastValidIndex = i + 1;
        inFunction = false;
      }
    }
  }
  
  // If we found valid function endings, truncate after the last one
  if (lastValidIndex > 0) {
    cleaned = cleaned.substring(0, lastValidIndex);
  }
  
  return cleaned.trim();
}

// Convert MCP tools to Anthropic tool format
function mcpToolsToAnthropicFormat(mcpTools: any[]): any[] {
  return mcpTools.map(tool => ({
    name: tool.name,
    description: tool.description || "",
    input_schema: tool.inputSchema || { type: "object", properties: {} }
  }));
}

// ============================================================================
// Main Generation Function - Investigate-First Agentic Approach
// ============================================================================

export async function generateRendererWithLLM(
  mcpClient: MCPClient,
  domainName: string,
  exampleState: any,
  styleHints?: string,
  onProgress?: ProgressCallback,
  onDetailedLog?: DetailedLogCallback,
  orchestrator?: LLMOrchestrator
): Promise<GenerationResult> {
  // Use provided orchestrator or create default
  const llmOrchestrator = orchestrator || new LLMOrchestrator();

  // Helper for logging with timestamps
  const startTime = Date.now();
  const TOTAL_STEPS = 6; // Setup, Tools, Prompt, Iterations (1-3), Validation, Complete
  
  const log = (source: string, message: string, level: 'info' | 'success' | 'warning' | 'error' = 'info') => {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const formattedMessage = `[${elapsed}s] ${message}`;
    console.log(`[${source}] ${formattedMessage}`);
    if (onDetailedLog) {
      onDetailedLog(source, formattedMessage, level);
    }
  };

  // Helper to report progress with step number
  const reportProgress = (step: number, message: string) => {
    const percent = Math.round((step / TOTAL_STEPS) * 100);
    log('LLMOrchestrator', `Step ${step}/${TOTAL_STEPS} (${percent}%): ${message}`);
    if (onProgress) {
      onProgress(step, message);
    }
  };

  log('LLMOrchestrator', `Starting INVESTIGATE-FIRST renderer generation for domain: ${domainName}`);
  log('LLMOrchestrator', `Using provider: ${llmOrchestrator.getProvider().getProviderName()}`);
  log('LLMOrchestrator', `Using model: ${llmOrchestrator.getProvider().getModelName()}`);

  try {
    // =========================================================================
    // STEP 1: Fetch system prompt from MCP Resource
    // =========================================================================
    
    reportProgress(1, "Fetching system prompt...");
    
    const promptResourceUri = `prompt://renderer/system/${DEFAULT_PROMPT_VERSION}`;
    log('MCPClient', `Reading resource: ${promptResourceUri}`);
    const systemPromptResult = await mcpClient.readResource(promptResourceUri);
    
    if (systemPromptResult.isError) {
      log('LLMOrchestrator', `Failed to fetch system prompt: ${systemPromptResult.content}`, 'error');
      return { success: false, code: "", error: `Failed to fetch system prompt: ${systemPromptResult.content}` };
    }
    
    // Convert domain name to PascalCase
    const domainPascal = domainName
      .split(/[-_\s]+/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join('');
    
    // Replace placeholder in system prompt
    const systemPrompt = systemPromptResult.content.replace(/{domain_pascal}/g, domainPascal);
    
    log('LLMOrchestrator', `System prompt loaded (${systemPrompt.length} chars)`);
    log('LLMOrchestrator', `Domain PascalCase: ${domainPascal}`);
    
    // =========================================================================
    // STEP 2: Get available MCP tools
    // =========================================================================
    
    reportProgress(2, "Discovering available tools...");
    
    const mcpTools = mcpClient.getToolsForLLM();
    const anthropicTools = mcpToolsToAnthropicFormat(mcpTools);
    
    log('LLMOrchestrator', `Available tools: ${mcpTools.map((t: any) => t.name).join(', ')}`);
    
    // =========================================================================
    // STEP 3: Build initial user prompt (encourages investigation)
    // =========================================================================
    
    reportProgress(2, "Preparing investigation request...");
    
    const stateJsonStr = JSON.stringify(exampleState);
    
    const userPrompt = `Generate a JavaScript renderer for the "${domainName}" domain.

REQUIRED FUNCTIONS:
- render${domainPascal}(ctx, state) - Main render function
- render${domainPascal}Legend(ctx, x, y) - Legend box function  
- render${domainPascal}Background(ctx, width, height) - Background function [optional]

${styleHints ? `STYLE HINTS: ${styleHints}\n` : ''}

YOUR FIRST ACTION: Call get_generation_context with these parameters:
{
  "state_json": ${stateJsonStr},
  "domain_name": "${domainName}"
}

DO NOT skip parameters. Both state_json and domain_name are REQUIRED.

After getting the context, generate complete JavaScript code.
Generate complete, working JavaScript code. Do not truncate or abbreviate.`;

    // =========================================================================
    // STEP 4: Agentic Loop - Let LLM investigate and generate
    // =========================================================================
    
    reportProgress(3, "Starting LLM generation...");
    
    const messages: Message[] = [
      { role: "user", content: userPrompt }
    ];
    
    let finalCode = "";
    let iteration = 0;
    
    while (iteration < MAX_ITERATIONS) {
      iteration++;
      log('LLMOrchestrator', `━━━ Iteration ${iteration} ━━━`);
      
      // Make LLM call with tools available
      const llmResponse = await llmOrchestrator.chat(messages, systemPrompt, anthropicTools);
      
      // Check if LLM wants to use tools
      const toolCalls = llmOrchestrator.extractToolCalls(llmResponse);
      
      if (toolCalls.length > 0) {
        // LLM is investigating - execute tool calls
        const toolNames = toolCalls.map(t => t.name).join(', ');
        log('LLMOrchestrator', `LLM calling: ${toolNames}`);
        reportProgress(3, `Tool: ${toolCalls[0].name}`);
        
        // Add assistant message with tool calls
        messages.push({
          role: "assistant",
          content: llmResponse.content
        });
        
        // Execute each tool and collect results
        const toolResults: any[] = [];
        for (const toolCall of toolCalls) {
          const toolInput = (toolCall.input || {}) as Record<string, unknown>;
          const inputSummary = Object.keys(toolInput).length > 0 
            ? ` with ${Object.keys(toolInput).join(', ')}` 
            : '';
          log('MCPClient', `→ ${toolCall.name}${inputSummary}`);
          
          try {
            const result = await mcpClient.callTool(toolCall.name, toolCall.input as Record<string, unknown>);
            
            // Log full tool output
            log('MCPClient', `✓ ${toolCall.name} output:\n${result.content}`);
            
            toolResults.push({
              type: "tool_result",
              tool_use_id: toolCall.id,
              content: result.content
            });
          } catch (e) {
            log('MCPClient', `Tool error: ${e}`, 'error');
            toolResults.push({
              type: "tool_result",
              tool_use_id: toolCall.id,
              content: `Error: ${e}`
            });
          }
        }
        
        // Add tool results to messages
        messages.push({
          role: "user",
          content: toolResults
        });
        
      } else {
        // LLM returned text - check if it's the final code
        const textOutput = llmOrchestrator.extractText(llmResponse);
        const stopReason = llmResponse.stop_reason;
        
        // Check if this looks like code (contains function render)
        const looksLikeCode = textOutput.includes('function render');
        
        if (stopReason === 'max_tokens') {
          log('LLMOrchestrator', `⚠️ Output truncated (max_tokens) - ${textOutput.length} chars`, 'warning');
        } else if (looksLikeCode) {
          // Log code response concisely
          log('LLMOrchestrator', `LLM generated code: ${textOutput.length} chars`);
          const preview = textOutput.substring(0, 100).replace(/\n/g, ' ');
          log('LLMOrchestrator', `Code preview: ${preview}...`);
        } else {
          // Log text response (summary/analysis from LLM)
          // Show a brief summary instead of full text
          const firstLine = textOutput.split('\n')[0].substring(0, 100);
          log('LLMOrchestrator', `LLM response: ${firstLine}${textOutput.length > 100 ? '...' : ''}`);
        }
        
        if (looksLikeCode) {
          // This looks like code - clean and validate it
          reportProgress(4, "Validating generated code...");
          
          const cleanedCode = cleanCodeLocally(textOutput);
          const validation = validateCodeLocally(cleanedCode, domainPascal);
          
          if (validation.valid) {
            finalCode = cleanedCode;
            log('LLMOrchestrator', '✅ Code validation passed!', 'success');
            break;
          } else {
            // Ask LLM to fix the issues
            log('LLMOrchestrator', `❌ Validation failed: ${validation.errors.join('; ')}`, 'warning');
            reportProgress(4, "Fixing validation errors...");
            
            messages.push({
              role: "assistant",
              content: textOutput
            });
            messages.push({
              role: "user",
              content: `Your code has validation errors:\n${validation.errors.join('\n')}\n\nPlease fix these issues and provide the corrected code.`
            });
          }
        } else {
          // LLM returned analysis/summary - this is expected after tool calls
          // Check if we already got context from tools (iteration > 1 means we've done tool calls)
          if (iteration > 2) {
            // We've already done investigation, now prompt for code generation
            log('LLMOrchestrator', 'Analysis complete, requesting code generation...');
            
            messages.push({
              role: "assistant",
              content: textOutput
            });
            messages.push({
              role: "user",
              content: "Now generate the complete JavaScript renderer code. Start with 'function render" + domainPascal + "(ctx, state) {' and include all three functions."
            });
          } else {
            // Still in early iterations, let LLM continue investigating
            log('LLMOrchestrator', 'LLM analyzing, continuing investigation...');
            
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
    
    // =========================================================================
    // STEP 5: Final MCP validation (syntax check)
    // =========================================================================
    
    if (finalCode) {
      reportProgress(5, "Final syntax validation...");
      log('MCPClient', 'Running MCP validate_renderer for syntax check');
      
      try {
        const validateResult = await mcpClient.callTool("validate_renderer", {
          code: finalCode,
          domain_name: domainName,
        });
        
        const validation = JSON.parse(validateResult.content) as { valid: boolean; errors?: string[]; warnings?: string[] };
        
        if (!validation.valid) {
          log('LLMOrchestrator', `Syntax warnings: ${validation.errors?.join(', ') || 'none'}`, 'warning');
        }
        if (validation.warnings && validation.warnings.length > 0) {
          log('LLMOrchestrator', `Warnings: ${validation.warnings.join(', ')}`, 'info');
        }
      } catch (e) {
        log('LLMOrchestrator', 'MCP validation skipped (non-critical)', 'info');
      }
    }
    
    // =========================================================================
    // RESULT
    // =========================================================================
    
    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
    
    if (!finalCode || !finalCode.includes('function render')) {
      reportProgress(6, "Generation failed");
      log('LLMOrchestrator', `❌ Failed after ${iteration} iterations (${totalTime}s)`, 'error');
      return { success: false, code: "", error: `Failed to generate valid renderer after ${iteration} iterations` };
    }
    
    reportProgress(6, "Generation complete!");
    log('LLMOrchestrator', `✅ Complete! ${finalCode.length} chars in ${iteration} iterations (${totalTime}s)`, 'success');
    
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
