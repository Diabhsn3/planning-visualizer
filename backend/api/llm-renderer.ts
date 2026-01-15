/**
 * LLM Renderer Generation Pipeline
 * Orchestrates the generation of visualization renderers using LLM.
 */

import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { generateRendererCode, isLlmAvailable } from "./llm-orchestrator.js";
import { createProgress, updateProgress, getProgress } from "./generation-progress.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Directory for cached renderers
const CACHE_DIR = path.resolve(__dirname, "llm_renderers");

export interface LLMRendererResult {
  success: boolean;
  code?: string;
  error?: string;
  cached?: boolean;
  sessionId?: string;
}

// Simple session ID generator
function generateSessionId(): string {
  return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Get the cache file path for a domain
 */
function getCachePath(domainName: string): string {
  const safeName = domainName.replace(/[^a-zA-Z0-9-_]/g, "_");
  return path.join(CACHE_DIR, `${safeName}.ts`);
}

/**
 * Ensure cache directory exists
 */
async function ensureCacheDir(): Promise<void> {
  try {
    await fs.mkdir(CACHE_DIR, { recursive: true });
  } catch (error) {
    // Directory may already exist
  }
}

/**
 * Check if a cached renderer exists for a domain
 */
export async function checkCachedRenderer(domainName: string): Promise<{ found: boolean; code: string | null }> {
  try {
    const cachePath = getCachePath(domainName);
    const code = await fs.readFile(cachePath, "utf-8");
    console.log(`[LLM Renderer] Found cached renderer for ${domainName}`);
    return { found: true, code };
  } catch (error) {
    return { found: false, code: null };
  }
}

/**
 * Save renderer to cache
 */
async function saveToCache(domainName: string, code: string): Promise<void> {
  await ensureCacheDir();
  const cachePath = getCachePath(domainName);
  
  // Add header comment
  const header = `// LLM-generated renderer for ${domainName}\n// Generated at: ${new Date().toISOString()}\n\n`;
  await fs.writeFile(cachePath, header + code, "utf-8");
  
  console.log(`[LLM Renderer] Saved renderer to cache: ${cachePath}`);
}

/**
 * Clear cached renderers
 */
export async function clearRendererCache(): Promise<{ cleared: number }> {
  try {
    await ensureCacheDir();
    const files = await fs.readdir(CACHE_DIR);
    const tsFiles = files.filter(f => f.endsWith(".ts") && f !== ".gitkeep");
    
    for (const file of tsFiles) {
      await fs.unlink(path.join(CACHE_DIR, file));
    }
    
    console.log(`[LLM Renderer] Cleared ${tsFiles.length} cached renderers`);
    return { cleared: tsFiles.length };
  } catch (error) {
    console.error("[LLM Renderer] Error clearing cache:", error);
    return { cleared: 0 };
  }
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
      
      // Step 6: Save to cache
      updateProgress(sid, "save", "running");
      await saveToCache(domainName, result.code);
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
 * Get generation progress for a session
 */
export { getProgress } from "./generation-progress.js";