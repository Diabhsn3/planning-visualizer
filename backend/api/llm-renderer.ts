/**
 * LLM Renderer Generation Pipeline
 * Orchestrates the generation of visualization renderers using LLM.
 */

import path from "path";
import { fileURLToPath } from "url";
import { generateRendererCode, isLlmAvailable } from "./llm-orchestrator.js";
import { createProgress, updateProgress, getProgress } from "./generation-progress.js";
import { v4 as uuidv4 } from "uuid";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface LLMRendererResult {
  success: boolean;
  code?: string;
  error?: string;
  cached?: boolean;
  sessionId?: string;
}

// Simple UUID generator if uuid package not available
function generateSessionId(): string {
  return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Generate an LLM-based renderer for a domain
 */
export async function generateLLMRenderer(
  domainName: string,
  states: any[],
  sessionId?: string
): Promise<LLMRendererResult> {
  // Create or use session ID
  const sid = sessionId || generateSessionId();
  
  console.log(`[LLM Renderer] Generate request for domain: ${domainName}`);
  console.log(`[LLM Renderer] Session ID: ${sid}`);
  console.log(`[LLM Renderer] States count: ${states.length}`);
  
  // Initialize progress tracking
  createProgress(sid, domainName);
  
  // Check if LLM is available
  if (!isLlmAvailable()) {
    updateProgress(sid, "connect", "failed", "ANTHROPIC_API_KEY not configured");
    return {
      success: false,
      error: "ANTHROPIC_API_KEY not configured. LLM mode is not available.",
      sessionId: sid,
    };
  }
  
  try {
    // Step 1: Connect to MCP
    updateProgress(sid, "connect", "running");
    // Connection happens lazily in callTool
    updateProgress(sid, "connect", "completed");
    
    // Step 2: Get prompts
    updateProgress(sid, "prompts", "running");
    
    // Use the first state as an example for generation
    const exampleState = states[0] || {};
    
    // Step 3-5: Call the LLM orchestrator (handles prompts, LLM call, clean, validate)
    updateProgress(sid, "prompts", "completed");
    updateProgress(sid, "llm", "running");
    
    const result = await generateRendererCode(domainName, exampleState);
    
    if (result.success && result.code) {
      updateProgress(sid, "llm", "completed");
      updateProgress(sid, "clean", "completed");
      updateProgress(sid, "validate", "completed");
      
      console.log(`[LLM Renderer] Generation successful after ${result.attempts} attempt(s)`);
      
      // Step 6: Save (no-op for now, caching coming next)
      updateProgress(sid, "save", "running");
      updateProgress(sid, "save", "completed");
      
      return {
        success: true,
        code: result.code,
        cached: false,
        sessionId: sid,
      };
    } else {
      updateProgress(sid, "llm", "failed", result.error);
      console.error(`[LLM Renderer] Generation failed: ${result.error}`);
      return {
        success: false,
        error: result.error || "Unknown error during generation",
        sessionId: sid,
      };
    }
    
  } catch (error: any) {
    console.error("[LLM Renderer] Error:", error);
    updateProgress(sid, "llm", "failed", error.message);
    return {
      success: false,
      error: error.message || "Failed to generate renderer",
      sessionId: sid,
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

/**
 * Get generation progress for a session
 */
export { getProgress } from "./generation-progress.js";