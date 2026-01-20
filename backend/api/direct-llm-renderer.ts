/**
 * Direct LLM Renderer
 * 
 * This module provides direct LLM-based renderer generation without MCP.
 * It uses a simple single-shot prompt approach:
 * 
 * - Basic prompts with minimal instructions
 * - No MCP server or tools
 * - No code validation
 * - No domain-specific hints
 * - Direct LLM call with simple prompt
 * 
 * This is the simpler alternative to the MCP-based approach.
 */

import Anthropic from "@anthropic-ai/sdk";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Resolve llm_renderers_direct folder path (separate from MCP renderers)
function getDirectRenderersPath(): string {
  if (__dirname.endsWith('/dist') || __dirname.endsWith('\\dist')) {
    return path.join(__dirname, '../llm_renderers_direct');
  }
  return path.join(__dirname, 'llm_renderers_direct');
}

const DIRECT_RENDERERS_DIR = getDirectRenderersPath();

// Ensure llm_renderers_direct directory exists
function ensureDirectRenderersDir(): void {
  if (!fs.existsSync(DIRECT_RENDERERS_DIR)) {
    fs.mkdirSync(DIRECT_RENDERERS_DIR, { recursive: true });
  }
}

// Generate unique filename for renderer
function generateDirectRendererFilename(domainName: string): string {
  const timestamp = new Date().toISOString()
    .replace(/[:.]/g, '-')
    .replace('T', '_')
    .replace('Z', '');
  const sanitizedDomain = domainName.replace(/[^a-zA-Z0-9-_]/g, '_');
  return `${sanitizedDomain}_${timestamp}.ts`;
}

export interface DirectLLMRendererRequest {
  domain_name: string;
  states: unknown[];
  style_hints?: string;
  llm_provider?: 'anthropic' | 'huggingface';
  llm_model?: string;
}

export interface DirectLLMRendererResponse {
  success: boolean;
  typescript_code: string;
  error: string | null;
  saved_file?: string;
}

/**
 * Save generated code to file
 */
function saveDirectRendererToFile(code: string, domainName: string): string | null {
  try {
    ensureDirectRenderersDir();
    
    const filename = generateDirectRendererFilename(domainName);
    const filepath = path.join(DIRECT_RENDERERS_DIR, filename);
    
    const fileContent = `/**
 * Direct LLM-Generated Renderer for ${domainName}
 * Generated at: ${new Date().toISOString()}
 * 
 * This file was generated using direct LLM approach (without MCP):
 * - Simple prompt with minimal instructions
 * - No MCP tools or validation
 * - No domain-specific hints
 */

${code}
`;
    
    fs.writeFileSync(filepath, fileContent, 'utf-8');
    console.log('[Direct LLM Renderer] Saved:', filename);
    
    return filename;
  } catch (error) {
    console.error('[Direct LLM Renderer] Failed to save file:', error);
    return null;
  }
}

/**
 * DIRECT SYSTEM PROMPT
 * 
 * Basic prompt - just the minimum to get some output.
 * No detailed rules, no code patterns, no validation instructions.
 */
const DIRECT_SYSTEM_PROMPT = `You are a JavaScript developer. Generate canvas rendering code.

When given state data, create JavaScript functions to visualize it on HTML5 Canvas.

Output only JavaScript code, no explanations.`;

/**
 * Generate renderer using direct LLM approach (without MCP)
 * 
 * Simple approach:
 * - Single LLM call
 * - Basic prompt
 * - No validation
 * - No retry logic
 */
export async function generateDirectLLMRenderer(
  request: DirectLLMRendererRequest
): Promise<DirectLLMRendererResponse> {
  // Determine which provider to use
  const provider = request.llm_provider || 'anthropic';
  
  // Check for API key only if using Anthropic
  if (provider === 'anthropic' && !process.env.ANTHROPIC_API_KEY) {
    return {
      success: false,
      typescript_code: "",
      error: "ANTHROPIC_API_KEY environment variable not set"
    };
  }

  console.log('[Direct LLM Renderer] Starting generation for domain:', request.domain_name);
  console.log('[Direct LLM Renderer] Using provider:', provider, 'model:', request.llm_model || 'default');

  try {
    // Use HuggingFace if specified
    if (provider === 'huggingface') {
      return await generateWithHuggingFace(request);
    }
    
    // Default to Anthropic
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

    // USER PROMPT - basic, minimal instructions
    const userPrompt = `Generate JavaScript renderer functions for "${request.domain_name}" domain.

Here is example state data:
${JSON.stringify(exampleState, null, 2)}

Create these functions:
- render${domainPascal}(ctx, state) - main render function
- render${domainPascal}Legend(ctx, x, y) - legend function

Use canvas 2D context (ctx). Draw something based on the state data.`;

    console.log('[Direct LLM Renderer] Sending request to LLM...');

    // Single LLM call - no retry, no validation
    const response = await client.messages.create({
      model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: DIRECT_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    });

    // Extract text from response
    let code = "";
    for (const block of response.content) {
      if (block.type === "text") {
        code += block.text;
      }
    }

    console.log('[Direct LLM Renderer] Received response, length:', code.length);

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
    const savedFile = saveDirectRendererToFile(code, request.domain_name);

    return {
      success: true,
      typescript_code: code,
      error: null,
      saved_file: savedFile || undefined
    };

  } catch (error) {
    console.error('[Direct LLM Renderer] Error:', error);
    
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
 * Generate renderer using HuggingFace Inference API (open-source models)
 */
async function generateWithHuggingFace(
  request: DirectLLMRendererRequest
): Promise<DirectLLMRendererResponse> {
  const apiKey = process.env.HF_API_KEY;
  const model = request.llm_model || 'codellama/CodeLlama-13b-Instruct-hf';
  const baseUrl = 'https://api-inference.huggingface.co/models';
  
  if (!apiKey) {
    return {
      success: false,
      typescript_code: '',
      error: 'HuggingFace API key not configured. Set HF_API_KEY environment variable.'
    };
  }
  
  console.log('[Direct LLM Renderer] Using HuggingFace model:', model);
  
  // Get example state
  const exampleState = request.states[0] || {};
  
  // Convert domain name to PascalCase
  const domainPascal = request.domain_name
    .split(/[-_\s]+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');

  // Format prompt based on model type
  const modelLower = model.toLowerCase();
  let prompt: string;
  
  const userContent = `Generate JavaScript renderer functions for "${request.domain_name}" domain.

Here is example state data:
${JSON.stringify(exampleState, null, 2)}

Create these functions:
- render${domainPascal}(ctx, state) - main render function
- render${domainPascal}Legend(ctx, x, y) - legend function

Use canvas 2D context (ctx). Draw something based on the state data.`;

  if (modelLower.includes('codellama') || modelLower.includes('llama')) {
    // Llama/CodeLlama Instruct format
    prompt = `<s>[INST] <<SYS>>\n${DIRECT_SYSTEM_PROMPT}\n<</SYS>>\n\n${userContent} [/INST] `;
  } else if (modelLower.includes('mistral') || modelLower.includes('mixtral')) {
    // Mistral Instruct format
    prompt = `<s>[INST] ${DIRECT_SYSTEM_PROMPT}\n\n${userContent} [/INST]`;
  } else if (modelLower.includes('starcoder') || modelLower.includes('bigcode')) {
    // StarCoder format
    prompt = `### System:\n${DIRECT_SYSTEM_PROMPT}\n\n### User:\n${userContent}\n\n### Assistant:\n`;
  } else {
    // Generic format
    prompt = `System: ${DIRECT_SYSTEM_PROMPT}\n\nUser: ${userContent}\n\nAssistant: `;
  }

  try {
    // Extended timeout for large models (5 minutes)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5 * 60 * 1000);
    
    const response = await fetch(`${baseUrl}/${model}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: prompt,
        parameters: {
          max_new_tokens: 4096,
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
      console.error('[Direct LLM Renderer] HuggingFace API error:', response.status, errorText);
      
      if (response.status === 503) {
        throw new Error(`Model is loading. Please try again in a few seconds. (${errorText})`);
      }
      if (response.status === 429) {
        throw new Error(`Rate limit exceeded. Please wait and try again. (${errorText})`);
      }
      throw new Error(`HuggingFace API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    
    // Handle different response formats
    let code = '';
    if (Array.isArray(data)) {
      code = data[0]?.generated_text || '';
    } else if (data.generated_text) {
      code = data.generated_text;
    } else if (typeof data === 'string') {
      code = data;
    }

    console.log('[Direct LLM Renderer] Received HuggingFace response, length:', code.length);

    // Basic cleanup - remove markdown code blocks if present
    code = code.replace(/^```(?:javascript|typescript|js|ts)?\s*\n?/gm, '');
    code = code.replace(/\n?```\s*$/gm, '');
    code = code.trim();

    // Check if we got something that looks like code
    if (!code.includes('function')) {
      return {
        success: false,
        typescript_code: '',
        error: 'HuggingFace did not generate valid function code'
      };
    }

    // Save to file
    const savedFile = saveDirectRendererToFile(code, request.domain_name);

    return {
      success: true,
      typescript_code: code,
      error: null,
      saved_file: savedFile || undefined
    };
  } catch (error) {
    console.error('[Direct LLM Renderer] HuggingFace error:', error);
    
    let errorMessage = 'Unknown error during HuggingFace generation';
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        errorMessage = 'Request timed out. The model may be loading or overloaded.';
      } else {
        errorMessage = error.message;
      }
    }

    return {
      success: false,
      typescript_code: '',
      error: `HuggingFace error: ${errorMessage}`
    };
  }
}

/**
 * Get cached direct renderer for a domain (most recent one)
 * Returns null if no cached renderer exists
 */
export function getCachedDirectRenderer(domainName: string): { code: string; filename: string } | null {
  try {
    ensureDirectRenderersDir();
    
    // Sanitize domain name to match filename format
    const sanitizedDomain = domainName.replace(/[^a-zA-Z0-9-_]/g, '_');
    
    // List all files for this domain
    const files = fs.readdirSync(DIRECT_RENDERERS_DIR)
      .filter(f => f.endsWith('.ts') && f.startsWith(sanitizedDomain + '_'))
      .sort()
      .reverse(); // Most recent first
    
    if (files.length === 0) {
      console.log('[Direct LLM Renderer Cache] No cached renderer for domain:', domainName);
      return null;
    }
    
    const latestFile = files[0];
    const filepath = path.join(DIRECT_RENDERERS_DIR, latestFile);
    const content = fs.readFileSync(filepath, 'utf-8');
    
    // Extract the actual code (skip the header comment)
    const codeMatch = content.match(/\*\/\s*\n\n([\s\S]+)/);
    const code = codeMatch ? codeMatch[1].trim() : content;
    
    console.log('[Direct LLM Renderer Cache] Found cached renderer:', latestFile);
    
    return {
      code,
      filename: latestFile
    };
  } catch (error) {
    console.error('[Direct LLM Renderer Cache] Error reading cache:', error);
    return null;
  }
}

/**
 * Clear all cached direct renderers for a domain (or all if no domain specified)
 */
export function clearDirectRendererCache(domainName?: string): { success: boolean; deletedCount: number; error: string | null } {
  try {
    ensureDirectRenderersDir();
    
    let files = fs.readdirSync(DIRECT_RENDERERS_DIR)
      .filter(f => f.endsWith('.ts') && f !== '.gitkeep');
    
    // If domain specified, only delete files for that domain
    if (domainName) {
      const sanitizedDomain = domainName.replace(/[^a-zA-Z0-9-_]/g, '_');
      files = files.filter(f => f.startsWith(sanitizedDomain + '_'));
    }
    
    let deletedCount = 0;
    for (const file of files) {
      const filepath = path.join(DIRECT_RENDERERS_DIR, file);
      fs.unlinkSync(filepath);
      deletedCount++;
    }
    
    console.log('[Direct LLM Renderer Cache] Cleared', deletedCount, 'cached renderers');
    
    return {
      success: true,
      deletedCount,
      error: null
    };
  } catch (error) {
    console.error('[Direct LLM Renderer Cache] Error clearing cache:', error);
    return {
      success: false,
      deletedCount: 0,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * List all cached direct renderers for a domain
 * Returns array of filenames sorted by date (most recent first)
 */
export function listDirectCachedRenderers(domainName: string): { files: string[]; error: string | null } {
  try {
    ensureDirectRenderersDir();
    
    // Sanitize domain name to match filename format
    const sanitizedDomain = domainName.replace(/[^a-zA-Z0-9-_]/g, '_');
    
    // List all files for this domain
    const files = fs.readdirSync(DIRECT_RENDERERS_DIR)
      .filter(f => f.endsWith('.ts') && f.startsWith(sanitizedDomain + '_'))
      .sort()
      .reverse(); // Most recent first
    
    return {
      files,
      error: null
    };
  } catch (error) {
    console.error('[Direct LLM Renderer Cache] Error listing cache:', error);
    return {
      files: [],
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Get a specific cached direct renderer by filename
 */
export function getDirectCachedRendererByFilename(filename: string): { code: string; filename: string } | null {
  try {
    ensureDirectRenderersDir();
    
    const filepath = path.join(DIRECT_RENDERERS_DIR, filename);
    
    if (!fs.existsSync(filepath)) {
      console.log('[Direct LLM Renderer Cache] File not found:', filename);
      return null;
    }
    
    const content = fs.readFileSync(filepath, 'utf-8');
    
    // Extract the actual code (skip the header comment)
    const codeMatch = content.match(/\*\/\s*\n\n([\s\S]+)/);
    const code = codeMatch ? codeMatch[1].trim() : content;
    
    console.log('[Direct LLM Renderer Cache] Loaded renderer:', filename);
    
    return {
      code,
      filename
    };
  } catch (error) {
    console.error('[Direct LLM Renderer Cache] Error reading file:', error);
    return null;
  }
}

/**
 * Check if direct LLM renderer is available
 */
export async function checkDirectLLMRendererStatus(): Promise<{
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
