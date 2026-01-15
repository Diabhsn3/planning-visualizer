/**
 * LLM Orchestrator for Planning Visualizer
 * Handles all LLM (Claude) API calls for code generation.
 * 
 * Architecture:
 * - MCP Server (Python): Provides tools (prompts, validation, cleaning)
 * - MCP Client (Node.js): Connects to Python server
 * - LLM Orchestrator (Node.js): Calls Claude API directly
 * 
 * This separation follows MCP best practices:
 * - Tools are provider-agnostic (in Python)
 * - LLM calls are centralized here (in Node.js)
 */

import Anthropic from "@anthropic-ai/sdk";
import { callTool } from "./mcp-client.js";

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Model to use for code generation
const MODEL = "claude-sonnet-4-20250514";

export interface GenerationResult {
  success: boolean;
  code?: string;
  error?: string;
  attempts?: number;
}

/**
 * Generate renderer code using Claude
 * Uses MCP tools for prompts and validation
 */
export async function generateRendererCode(
  domainName: string,
  exampleState: any,
  styleHints: string = "",
  maxAttempts: number = 3
): Promise<GenerationResult> {
  console.log(`[LLM Orchestrator] Generating renderer for domain: ${domainName}`);
  
  try {
    // Step 1: Get prompts from MCP server
    const promptResult = await callTool("get_generation_prompt", {
      domain_name: domainName,
      example_state: JSON.stringify(exampleState),
      style_hints: styleHints,
    });
    
    const promptData = JSON.parse(promptResult);
    if (!promptData.success) {
      return { success: false, error: `Failed to get prompts: ${promptData.error}` };
    }
    
    const { system_prompt, user_prompt, domain_pascal } = promptData;
    
    // Step 2: Call Claude API
    console.log(`[LLM Orchestrator] Calling Claude API with model: ${MODEL}`);
    
    let lastError = "";
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      console.log(`[LLM Orchestrator] Attempt ${attempt}/${maxAttempts}`);
      
      try {
        const response = await anthropic.messages.create({
          model: MODEL,
          max_tokens: 8192,
          system: system_prompt,
          messages: [
            { role: "user", content: user_prompt }
          ],
        });
        
        // Extract text from response
        let rawCode = "";
        for (const block of response.content) {
          if (block.type === "text") {
            rawCode += block.text;
          }
        }
        
        // Step 3: Clean the code using MCP tool
        const cleanResult = await callTool("clean_code", { code: rawCode });
        const cleanData = JSON.parse(cleanResult);
        
        if (!cleanData.success) {
          lastError = `Failed to clean code: ${cleanData.error}`;
          continue;
        }
        
        const cleanedCode = cleanData.code;
        
        // Step 4: Validate the code using MCP tool
        const validateResult = await callTool("validate_renderer", {
          code: cleanedCode,
          domain_name: domainName,
        });
        const validateData = JSON.parse(validateResult);
        
        if (validateData.valid) {
          console.log(`[LLM Orchestrator] Code validated successfully on attempt ${attempt}`);
          return {
            success: true,
            code: cleanedCode,
            attempts: attempt,
          };
        } else {
          lastError = validateData.errors.join("; ");
          console.log(`[LLM Orchestrator] Validation failed: ${lastError}`);
        }
        
      } catch (apiError: any) {
        lastError = apiError.message || "API call failed";
        console.error(`[LLM Orchestrator] API error on attempt ${attempt}:`, lastError);
      }
    }
    
    return {
      success: false,
      error: `Failed after ${maxAttempts} attempts. Last error: ${lastError}`,
      attempts: maxAttempts,
    };
    
  } catch (error: any) {
    console.error("[LLM Orchestrator] Error:", error);
    return {
      success: false,
      error: error.message || "Unknown error",
    };
  }
}

/**
 * Check if LLM orchestrator is available
 */
export function isLlmAvailable(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}