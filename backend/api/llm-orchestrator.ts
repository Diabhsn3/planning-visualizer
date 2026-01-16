/**
 * LLM Orchestrator for Renderer Generation
 * 
 * This module provides a provider-agnostic interface for generating
 * JavaScript renderers using LLM via MCP.
 * 
 * Architecture:
 * - LLMOrchestrator: Handles LLM API calls (Anthropic, OpenAI, etc.)
 * - MCPClient: Provides tools and resources from Python MCP server
 * - Single-shot generation: One LLM call with optional retry on validation failure
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

  async chat(
    messages: Message[],
    systemPrompt: string,
    tools?: any[]
  ): Promise<any> {
    return await this.provider.chat(messages, systemPrompt, tools);
  }

  hasToolUse(response: any): boolean {
    if (response.content && Array.isArray(response.content)) {
      return response.content.some((block: any) => block.type === "tool_use");
    }
    return false;
  }

  getToolUseBlocks(response: any): any[] {
    if (response.content && Array.isArray(response.content)) {
      return response.content.filter((block: any) => block.type === "tool_use");
    }
    return [];
  }

  extractText(response: any): string {
    if (response.content && Array.isArray(response.content)) {
      const textBlocks = response.content.filter(
        (block: any) => block.type === "text"
      );
      return textBlocks.map((block: any) => block.text).join("\n");
    }
    return "";
  }

  async executeToolRequests(
    mcpClient: MCPClient,
    response: any
  ): Promise<any[]> {
    const toolBlocks = this.getToolUseBlocks(response);
    const results: any[] = [];

    for (const block of toolBlocks) {
      const toolName = block.name;
      const toolInput = block.input;

      const result = await mcpClient.callTool(toolName, toolInput);

      results.push({
        type: "tool_result",
        tool_use_id: block.id,
        content: result.content,
        is_error: result.isError,
      });
    }

    return results;
  }
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_PROMPT_VERSION = "v1";
const MAX_RETRY_ATTEMPTS = 2; // Maximum retries on validation failure

// ============================================================================
// Local Validation (fast, no LLM call needed)
// ============================================================================

function validateCodeLocally(code: string, domainPascal: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Check for empty code
  if (!code || code.trim().length === 0) {
    errors.push("Code is empty");
    return { valid: false, errors };
  }
  
  // Check for required functions
  const mainFunc = `function render${domainPascal}`;
  const legendFunc = `function render${domainPascal}Legend`;
  
  if (!code.includes(mainFunc)) {
    errors.push(`Missing main render function: ${mainFunc}`);
  }
  
  if (!code.includes(legendFunc)) {
    errors.push(`Missing legend function: ${legendFunc}`);
  }
  
  if (!code.includes("ctx")) {
    errors.push("Missing 'ctx' parameter - renderer needs canvas context");
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

// ============================================================================
// Main Generation Function - Single-Shot with Retry
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
  const reportProgress = (step: number, message: string) => {
    log('LLMOrchestrator', `Step ${step}: ${message}`);
    if (onProgress) {
      onProgress(step, message);
    }
  };

  log('LLMOrchestrator', `Starting SINGLE-SHOT renderer generation for domain: ${domainName}`);
  log('LLMOrchestrator', `Using provider: ${orchestrator.getProvider().getProviderName()}`);
  log('LLMOrchestrator', `Using model: ${orchestrator.getProvider().getModelName()}`);

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
    // STEP 2: Build user prompt with all context
    // =========================================================================
    
    reportProgress(2, "Preparing generation request...");
    
    // Build comprehensive user prompt - give LLM everything it needs in one shot
    let userPrompt = `Generate JavaScript renderer functions for the "${domainName}" domain.

REQUIRED FUNCTION NAMES (use exactly):
- render${domainPascal}(ctx, state) - Main render function
- render${domainPascal}Legend(ctx, x, y) - Legend box function
- render${domainPascal}Background(ctx, width, height) - Background function [optional]

STATE DATA STRUCTURE (your renderer will receive this format):
${JSON.stringify(exampleState, null, 2)}

`;

    if (styleHints) {
      userPrompt += `STYLE HINTS: ${styleHints}\n\n`;
    }

    userPrompt += `IMPORTANT:
- Output ONLY the JavaScript code, no explanations
- Start directly with 'function render${domainPascal}...'
- Use pure JavaScript, NO TypeScript
- Follow the system prompt rules exactly

Generate the complete renderer code now:`;

    // =========================================================================
    // STEP 3: Single LLM call (with retry on failure)
    // =========================================================================
    
    reportProgress(3, "Generating renderer code...");
    log('LLMOrchestrator', 'Making single-shot LLM call...');
    
    let finalCode = "";
    let lastError = "";
    
    for (let attempt = 1; attempt <= MAX_RETRY_ATTEMPTS; attempt++) {
      log('LLMOrchestrator', `Generation attempt ${attempt}/${MAX_RETRY_ATTEMPTS}`);
      
      const messages: Message[] = [
        { role: "user", content: userPrompt }
      ];
      
      // Add error context if this is a retry
      if (attempt > 1 && lastError) {
        messages[0].content += `\n\nPREVIOUS ATTEMPT FAILED WITH ERRORS:\n${lastError}\n\nPlease fix these issues and generate valid code.`;
      }
      
      // Make LLM call WITHOUT tools for faster response
      // Tools are still available via MCP but we don't force the LLM to use them
      const llmResponse = await orchestrator.chat(messages, systemPrompt, []);
      
      // Extract text response
      let rawOutput = orchestrator.extractText(llmResponse);
      log('LLMOrchestrator', `LLM returned ${rawOutput.length} chars`);
      
      if (!rawOutput || rawOutput.length === 0) {
        lastError = "LLM returned empty response";
        log('LLMOrchestrator', lastError, 'warning');
        continue;
      }
      
      // Clean the code locally (fast)
      reportProgress(4, "Cleaning generated code...");
      const cleanedCode = cleanCodeLocally(rawOutput);
      log('LLMOrchestrator', `Cleaned code: ${cleanedCode.length} chars`);
      
      // Validate locally (fast)
      reportProgress(5, "Validating code...");
      const validation = validateCodeLocally(cleanedCode, domainPascal);
      
      if (validation.valid) {
        finalCode = cleanedCode;
        log('LLMOrchestrator', 'Code validation passed!', 'success');
        break;
      } else {
        lastError = validation.errors.join("; ");
        log('LLMOrchestrator', `Validation failed: ${lastError}`, 'warning');
        
        if (attempt < MAX_RETRY_ATTEMPTS) {
          reportProgress(3, `Retrying generation (attempt ${attempt + 1})...`);
        }
      }
    }
    
    // =========================================================================
    // STEP 4: Final MCP validation (optional, for syntax check with Node.js)
    // =========================================================================
    
    if (finalCode) {
      reportProgress(6, "Final syntax validation...");
      log('MCPClient', 'Running MCP validate_renderer for syntax check');
      
      try {
        const validateResult = await mcpClient.callTool("validate_renderer", {
          code: finalCode,
          domain_name: domainName,
        });
        
        const validation = JSON.parse(validateResult.content) as { valid: boolean; errors?: string[]; warnings?: string[] };
        
        if (!validation.valid) {
          log('LLMOrchestrator', `Syntax errors: ${validation.errors?.join(', ') || 'none'}`, 'warning');
          // Don't fail - local validation passed, syntax check is extra
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
      reportProgress(7, "Generation failed");
      log('LLMOrchestrator', `Failed after ${MAX_RETRY_ATTEMPTS} attempts: ${lastError}`, 'error');
      return { success: false, code: "", error: `Failed to generate valid renderer: ${lastError}` };
    }
    
    reportProgress(7, "Generation complete!");
    log('LLMOrchestrator', `Generation complete, code length: ${finalCode.length}`, 'success');
    
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
