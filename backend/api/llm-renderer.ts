/**
 * LLM Renderer Generation Pipeline
 * Orchestrates the generation of visualization renderers using LLM.
 */

import path from "path";
import { fileURLToPath } from "url";
import { generateRendererCode, isLlmAvailable } from "./llm-orchestrator.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface LLMRendererResult {
  success: boolean;
  code?: string;
  error?: string;
  cached?: boolean;
  sessionId?: string;
}

/**
 * Generate an LLM-based renderer for a domain
 */
export async function generateLLMRenderer(
  domainName: string,
  states: any[],
  sessionId?: string
): Promise<LLMRendererResult> {
  console.log(`[LLM Renderer] Generate request for domain: ${domainName}`);
  console.log(`[LLM Renderer] Session ID: ${sessionId || "none"}`);
  console.log(`[LLM Renderer] States count: ${states.length}`);
  
  // Check if LLM is available
  if (!isLlmAvailable()) {
    return {
      success: false,
      error: "ANTHROPIC_API_KEY not configured. LLM mode is not available.",
      sessionId,
    };
  }
  
  try {
    // Use the first state as an example for generation
    const exampleState = states[0] || {};
    
    // Call the LLM orchestrator
    const result = await generateRendererCode(domainName, exampleState);
    
    if (result.success && result.code) {
      console.log(`[LLM Renderer] Generation successful after ${result.attempts} attempt(s)`);
      
      return {
        success: true,
        code: result.code,
        cached: false,
        sessionId,
      };
    } else {
      console.error(`[LLM Renderer] Generation failed: ${result.error}`);
      return {
        success: false,
        error: result.error || "Unknown error during generation",
        sessionId,
      };
    }
    
  } catch (error: any) {
    console.error("[LLM Renderer] Error:", error);
    return {
      success: false,
      error: error.message || "Failed to generate renderer",
      sessionId,
    };
  }
}

/**
 * Check if a cached renderer exists for a domain
 */
export async function checkCachedRenderer(domainName: string): Promise<{ found: boolean; code: string | null }> {
  // No caching yet - will be added in next commit
  return { found: false, code: null };
}

/**
 * Clear cached renderers
 */
export async function clearRendererCache(): Promise<{ cleared: number }> {
  // No caching yet - will be added in next commit
  return { cleared: 0 };
}