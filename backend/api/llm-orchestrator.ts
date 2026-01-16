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
      max_tokens: 8096,
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
// LLM Orchestrator
// ============================================================================

export class LLMOrchestrator {
  private provider: LLMProvider;

  constructor(provider?: LLMProvider) {
    this.provider = provider || new AnthropicProvider();
  }

  getProvider(): LLMProvider {
    return this.provider;
  }

  async chat(messages: Message[], systemPrompt: string, tools?: any[]): Promise<any> {
    return this.provider.chat(messages, systemPrompt, tools);
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
const MAX_ITERATIONS = 10;  // Max agentic loop iterations

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
  onDetailedLog?: DetailedLogCallback
): Promise<GenerationResult> {
  const orchestrator = new LLMOrchestrator();

  // Helper for logging
  const log = (source: string, message: string, level: 'info' | 'success' | 'warning' | 'error' = 'info') => {
    console.log(`[${source}] ${message}`);
    if (onDetailedLog) {
      onDetailedLog(source, message, level);
    }
  };

  // Helper to report progress
  let stepCounter = 0;
  const reportProgress = (message: string) => {
    stepCounter++;
    log('LLMOrchestrator', `Step ${stepCounter}: ${message}`);
    if (onProgress) {
      onProgress(stepCounter, message);
    }
  };

  log('LLMOrchestrator', `Starting INVESTIGATE-FIRST renderer generation for domain: ${domainName}`);
  log('LLMOrchestrator', `Using provider: ${orchestrator.getProvider().getProviderName()}`);
  log('LLMOrchestrator', `Using model: ${orchestrator.getProvider().getModelName()}`);

  try {
    // =========================================================================
    // STEP 1: Fetch system prompt from MCP Resource
    // =========================================================================
    
    reportProgress("Fetching system prompt...");
    
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
    
    reportProgress("Discovering available tools...");
    
    const mcpTools = await mcpClient.listTools();
    const anthropicTools = mcpToolsToAnthropicFormat(mcpTools);
    
    log('LLMOrchestrator', `Available tools: ${mcpTools.map((t: any) => t.name).join(', ')}`);
    
    // =========================================================================
    // STEP 3: Build initial user prompt (encourages investigation)
    // =========================================================================
    
    reportProgress("Preparing investigation request...");
    
    const userPrompt = `Generate a JavaScript renderer for the "${domainName}" domain.

REQUIRED FUNCTIONS:
- render${domainPascal}(ctx, state) - Main render function
- render${domainPascal}Legend(ctx, x, y) - Legend box function  
- render${domainPascal}Background(ctx, width, height) - Background function [optional]

EXAMPLE STATE DATA:
${JSON.stringify(exampleState, null, 2)}

${styleHints ? `STYLE HINTS: ${styleHints}\n` : ''}

IMPORTANT WORKFLOW:
1. FIRST, call analyze_state_structure with the state data to understand the objects and relations
2. Based on the analysis, call any helpful tools (get_state_handling_guidelines, get_legend_guidelines, etc.)
3. THEN generate the complete JavaScript renderer code

Start by analyzing the state structure to understand what you need to render.`;

    // =========================================================================
    // STEP 4: Agentic Loop - Let LLM investigate and generate
    // =========================================================================
    
    reportProgress("Starting investigation phase...");
    
    const messages: Message[] = [
      { role: "user", content: userPrompt }
    ];
    
    let finalCode = "";
    let iteration = 0;
    
    while (iteration < MAX_ITERATIONS) {
      iteration++;
      log('LLMOrchestrator', `--- Iteration ${iteration} ---`);
      
      // Make LLM call with tools available
      const llmResponse = await orchestrator.chat(messages, systemPrompt, anthropicTools);
      
      log('LLMOrchestrator', `LLM stop reason: ${llmResponse.stop_reason}`);
      
      // Check if LLM wants to use tools
      const toolCalls = orchestrator.extractToolCalls(llmResponse);
      
      if (toolCalls.length > 0) {
        // LLM is investigating - execute tool calls
        log('LLMOrchestrator', `LLM called ${toolCalls.length} tool(s): ${toolCalls.map(t => t.name).join(', ')}`);
        reportProgress(`Executing tool: ${toolCalls[0].name}...`);
        
        // Add assistant message with tool calls
        messages.push({
          role: "assistant",
          content: llmResponse.content
        });
        
        // Execute each tool and collect results
        const toolResults: any[] = [];
        for (const toolCall of toolCalls) {
          log('MCPClient', `Calling tool: ${toolCall.name}`);
          
          try {
            const result = await mcpClient.callTool(toolCall.name, toolCall.input as Record<string, unknown>);
            const truncatedResult = result.content.length > 200 
              ? result.content.substring(0, 200) + "..." 
              : result.content;
            log('MCPClient', `Tool result: ${truncatedResult}`);
            
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
        const textOutput = orchestrator.extractText(llmResponse);
        log('LLMOrchestrator', `LLM returned text (${textOutput.length} chars)`);
        
        if (textOutput.includes('function render')) {
          // This looks like code - clean and validate it
          reportProgress("Processing generated code...");
          
          const cleanedCode = cleanCodeLocally(textOutput);
          const validation = validateCodeLocally(cleanedCode, domainPascal);
          
          if (validation.valid) {
            finalCode = cleanedCode;
            log('LLMOrchestrator', 'Code validation passed!', 'success');
            break;
          } else {
            // Ask LLM to fix the issues
            log('LLMOrchestrator', `Validation failed: ${validation.errors.join('; ')}`, 'warning');
            reportProgress("Requesting code fixes...");
            
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
          // LLM returned something else - prompt it to generate code
          log('LLMOrchestrator', 'LLM did not return code, prompting for generation...', 'warning');
          
          messages.push({
            role: "assistant",
            content: textOutput
          });
          messages.push({
            role: "user",
            content: "Now that you've analyzed the state structure, please generate the complete JavaScript renderer code. Start with 'function render" + domainPascal + "(ctx, state) {'"
          });
        }
      }
    }
    
    // =========================================================================
    // STEP 5: Final MCP validation (syntax check)
    // =========================================================================
    
    if (finalCode) {
      reportProgress("Final syntax validation...");
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
    
    if (!finalCode || !finalCode.includes('function render')) {
      reportProgress("Generation failed");
      log('LLMOrchestrator', `Failed after ${iteration} iterations`, 'error');
      return { success: false, code: "", error: `Failed to generate valid renderer after ${iteration} iterations` };
    }
    
    reportProgress("Generation complete!");
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
