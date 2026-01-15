/**
 * MCP Client for Planning Visualizer
 * Connects to the Python MCP server and provides tool access.
 * 
 * Architecture:
 * - This client connects to mcp_server.py via stdio
 * - The Python server provides tools (get_generation_prompt, validate_renderer, etc.)
 * - Claude API calls happen HERE in Node.js, not in Python
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { spawn, ChildProcess } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Singleton client instance
let mcpClient: Client | null = null;
let serverProcess: ChildProcess | null = null;
let isConnecting = false;

/**
 * Get or create the MCP client connection
 */
export async function getMcpClient(): Promise<Client> {
  if (mcpClient) {
    return mcpClient;
  }

  if (isConnecting) {
    // Wait for existing connection attempt
    while (isConnecting) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    if (mcpClient) {
      return mcpClient;
    }
  }

  isConnecting = true;

  try {
    // Path to the MCP server
    const serverPath = path.resolve(__dirname, "../../mcp_server/mcp_server.py");
    
    // Get Python command from environment or use default
    const pythonCmd = process.env.PYTHON_CMD || "python3";
    
    console.log(`[MCP Client] Starting MCP server with ${pythonCmd} ${serverPath}`);
    
    // Create transport using stdio
    const transport = new StdioClientTransport({
      command: pythonCmd,
      args: [serverPath],
    });

    // Create client
    const client = new Client({
      name: "planning-visualizer-client",
      version: "1.0.0",
    }, {
      capabilities: {
        sampling: {},  // Enable sampling capability
      }
    });

    // Connect to server
    await client.connect(transport);
    
    console.log("[MCP Client] Connected to MCP server");
    
    // List available tools
    const tools = await client.listTools();
    console.log("[MCP Client] Available tools:", tools.tools.map(t => t.name));

    mcpClient = client;
    return client;
  } catch (error) {
    console.error("[MCP Client] Failed to connect:", error);
    throw error;
  } finally {
    isConnecting = false;
  }
}

/**
 * Disconnect the MCP client
 */
export async function disconnectMcpClient(): Promise<void> {
  if (mcpClient) {
    try {
      await mcpClient.close();
    } catch (error) {
      console.error("[MCP Client] Error closing client:", error);
    }
    mcpClient = null;
  }

  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
}

/**
 * Check if MCP client is connected
 */
export function isMcpConnected(): boolean {
  return mcpClient !== null;
}

/**
 * Call an MCP tool
 */
export async function callTool(toolName: string, args: Record<string, unknown>): Promise<string> {
  const client = await getMcpClient();
  
  console.log(`[MCP Client] Calling tool: ${toolName}`);
  
  const result = await client.callTool({
    name: toolName,
    arguments: args,
  });

  // Extract text content from result
  if (result.content && Array.isArray(result.content)) {
    const textContent = result.content.find((c: any) => c.type === "text");
    if (textContent && "text" in textContent) {
      return textContent.text;
    }
  }

  return JSON.stringify(result);
}

/**
 * Create a sampling message (for MCP sampling support)
 * This allows the server to request LLM completions through the client
 */
export async function createSamplingMessage(
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number = 4096
): Promise<string> {
  // This is a placeholder for MCP sampling
  // In a full implementation, this would be called by the server
  // For now, we handle LLM calls directly in the orchestrator
  console.log("[MCP Client] Sampling message requested");
  return JSON.stringify({
    role: "assistant",
    content: "Sampling not implemented - use orchestrator directly"
  });
}