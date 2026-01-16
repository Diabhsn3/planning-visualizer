/**
 * Naive LLM Renderer
 * 
 * This is a NAIVE/FIRST ATTEMPT implementation of LLM-based renderer generation.
 * It demonstrates what happens when you use LLM without proper tooling:
 * 
 * - Very basic prompts with minimal instructions
 * - No MCP server or tools
 * - No code validation
 * - No domain-specific hints
 * - Direct LLM call with simple prompt
 * 
 * This is intentionally simplistic to show the contrast with the MCP-based approach.
 */

import Anthropic from "@anthropic-ai/sdk";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Resolve llm_renderers folder path
function getLlmRenderersPath(): string {
  if (__dirname.endsWith('/dist') || __dirname.endsWith('\\dist')) {
    return path.join(__dirname, '../llm_renderers');
  }
  return path.join(__dirname, 'llm_renderers');
}

const LLM_RENDERERS_DIR = getLlmRenderersPath();

// Ensure llm_renderers directory exists
function ensureRenderersDir(): void {
  if (!fs.existsSync(LLM_RENDERERS_DIR)) {
    fs.mkdirSync(LLM_RENDERERS_DIR, { recursive: true });
  }
}

// Generate unique filename for renderer
function generateRendererFilename(domainName: string): string {
  const timestamp = new Date().toISOString()
    .replace(/[:.]/g, '-')
    .replace('T', '_')
    .replace('Z', '');
  const sanitizedDomain = domainName.replace(/[^a-zA-Z0-9-_]/g, '_');
  return `${sanitizedDomain}_naive_${timestamp}.ts`;
}

export interface NaiveLLMRendererRequest {
  domain_name: string;
  states: unknown[];
  style_hints?: string;
}

export interface NaiveLLMRendererResponse {
  success: boolean;
  typescript_code: string;
  error: string | null;
  saved_file?: string;
}

/**
 * Save generated code to file
 */
function saveRendererToFile(code: string, domainName: string): string | null {
  try {
    ensureRenderersDir();
    
    const filename = generateRendererFilename(domainName);
    const filepath = path.join(LLM_RENDERERS_DIR, filename);
    
    const fileContent = `/**
 * NAIVE LLM-Generated Renderer for ${domainName}
 * Generated at: ${new Date().toISOString()}
 * 
 * This file was generated using a NAIVE/BASIC LLM approach:
 * - Simple prompt with minimal instructions
 * - No MCP tools or validation
 * - No domain-specific hints
 * 
 * This demonstrates the "first attempt" approach before MCP refinement.
 */

${code}
`;
    
    fs.writeFileSync(filepath, fileContent, 'utf-8');
    console.log('[Naive LLM Renderer] Saved to file:', filepath);
    
    return filepath;
  } catch (error) {
    console.error('[Naive LLM Renderer] Failed to save file:', error);
    return null;
  }
}

/**
 * NAIVE SYSTEM PROMPT
 * 
 * This is intentionally basic - just the bare minimum to get some output.
 * No detailed rules, no code patterns, no validation instructions.
 */
const NAIVE_SYSTEM_PROMPT = `You are a JavaScript developer. Generate canvas rendering code.

When given state data, create JavaScript functions to visualize it on HTML5 Canvas.

Output only JavaScript code, no explanations.`;

/**
 * Generate renderer using NAIVE LLM approach
 * 
 * This is intentionally simplistic:
 * - Single LLM call
 * - Basic prompt
 * - No validation
 * - No retry logic
 */
export async function generateNaiveLLMRenderer(
  request: NaiveLLMRendererRequest
): Promise<NaiveLLMRendererResponse> {
  // Check for API key
  if (!process.env.ANTHROPIC_API_KEY) {
    return {
      success: false,
      typescript_code: "",
      error: "ANTHROPIC_API_KEY environment variable not set"
    };
  }

  console.log('[Naive LLM Renderer] Starting generation for domain:', request.domain_name);

  try {
    const client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    // Get example state
    const exampleState = request.states[0] || {};
    
    // Convert domain name to PascalCase
    const domainPascal = request.domain_name
      .split(/[-_\s]+/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join('');

    // NAIVE USER PROMPT - very basic, minimal instructions
    const userPrompt = `Generate JavaScript renderer functions for "${request.domain_name}" domain.

Here is example state data:
${JSON.stringify(exampleState, null, 2)}

Create these functions:
- render${domainPascal}(ctx, state) - main render function
- render${domainPascal}Legend(ctx, x, y) - legend function

Use canvas 2D context (ctx). Draw something based on the state data.`;

    console.log('[Naive LLM Renderer] Sending request to LLM...');

    // Single LLM call - no retry, no validation
    const response = await client.messages.create({
      model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: NAIVE_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    });

    // Extract text from response
    let code = "";
    for (const block of response.content) {
      if (block.type === "text") {
        code += block.text;
      }
    }

    console.log('[Naive LLM Renderer] Received response, length:', code.length);

    // Basic cleanup - just remove markdown code blocks if present
    code = code.replace(/^```(?:javascript|typescript|js|ts)?\s*\n?/gm, '');
    code = code.replace(/\n?```\s*$/gm, '');
    code = code.trim();

    // Check if we got something that looks like code
    if (!code.includes('function')) {
      return {
        success: false,
        typescript_code: "",
        error: "LLM did not generate valid function code"
      };
    }

    // Save to file
    const savedFile = saveRendererToFile(code, request.domain_name);

    return {
      success: true,
      typescript_code: code,
      error: null,
      saved_file: savedFile || undefined
    };

  } catch (error) {
    console.error('[Naive LLM Renderer] Error:', error);
    
    let errorMessage = "Unknown error during LLM generation";
    if (error instanceof Error) {
      errorMessage = error.message;
    }

    return {
      success: false,
      typescript_code: "",
      error: errorMessage
    };
  }
}

/**
 * Check if naive LLM renderer is available
 */
export async function checkNaiveLLMRendererStatus(): Promise<{
  available: boolean;
  error: string | null;
  apiKeySet: boolean;
}> {
  const apiKeySet = !!process.env.ANTHROPIC_API_KEY;
  
  return {
    available: apiKeySet,
    error: apiKeySet ? null : "ANTHROPIC_API_KEY not set",
    apiKeySet
  };
}

// Simple in-memory cache for generated renderers
const rendererCache: Map<string, string> = new Map();

/**
 * Get cached renderer for a domain
 */
export function getCachedRenderer(domainName: string): { found: boolean; code: string | null } {
  const cached = rendererCache.get(domainName);
  return {
    found: !!cached,
    code: cached || null
  };
}

/**
 * Cache a renderer for a domain
 */
export function cacheRenderer(domainName: string, code: string): void {
  rendererCache.set(domainName, code);
}

/**
 * Clear renderer cache
 */
export function clearRendererCache(): void {
  rendererCache.clear();
}
