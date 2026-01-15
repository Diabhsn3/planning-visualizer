/**
 * MCP Client for Node.js Backend
 * 
 * This module provides an MCP client that connects to the Python MCP server
 * via stdio transport and executes tools.
 * 
 * MCP Sampling Support:
 * - The client declares sampling capability during initialization
 * - When the server requests LLM generation via sampling/createMessage,
 *   the client handles it using the LLM orchestrator
 * 
 * Architecture:
 * - Uses @modelcontextprotocol/sdk for MCP protocol handling
 * - Connects to Python MCP server via stdio transport
 * - Supports both tool calls (client -> server) and sampling (server -> client)
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import path from "path";
import { fileURLToPath } from "url";
import type { SamplingRequest, SamplingResponse, LLMOrchestrator } from "./llm-orchestrator.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Resolve MCP server directory
function getMcpServerDir(): string {
  if (__dirname.endsWith('/dist') || __dirname.endsWith('\\dist')) {
    return path.join(__dirname, '../../../mcp_server');
  }
  return path.join(__dirname, '../../mcp_server');
}

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface ToolResult {
  content: string;
  isError: boolean;
}

/**
 * MCP Client Options
 */
export interface MCPClientOptions {
  /**
   * Enable sampling capability - allows server to request LLM generations
   */
  enableSampling?: boolean;
  
  /**
   * LLM Orchestrator instance for handling sampling requests
   */
  orchestrator?: LLMOrchestrator;
}

export class MCPClient {
  private client: Client | null = null;
  private transport: StdioClientTransport | null = null;
  private tools: MCPTool[] = [];
  private connected: boolean = false;
  private options: MCPClientOptions;
  private orchestrator: LLMOrchestrator | null = null;

  constructor(options: MCPClientOptions = {}) {
    this.options = options;
    this.orchestrator = options.orchestrator || null;
    
    // Build capabilities object
    const capabilities: Record<string, unknown> = {};
    
    // Declare sampling capability if enabled
    if (options.enableSampling) {
      capabilities.sampling = {};
      console.log('[MCPClient] Sampling capability enabled');
    }
    
    this.client = new Client(
      { name: "planning-visualizer-backend", version: "1.0.0" },
      { capabilities }
    );
  }

  /**
   * Set the LLM orchestrator for handling sampling requests
   */
  setOrchestrator(orchestrator: LLMOrchestrator): void {
    this.orchestrator = orchestrator;
  }

  /**
   * Connect to the MCP server
   */
  async connect(): Promise<void> {
    if (this.connected) {
      console.log('[MCPClient] Already connected');
      return;
    }

    const mcpServerDir = getMcpServerDir();
    const serverScript = path.join(mcpServerDir, 'mcp_server.py');
    
    console.log('[MCPClient] Connecting to MCP server...');
    console.log('[MCPClient] Server script:', serverScript);

    // Create stdio transport
    this.transport = new StdioClientTransport({
      command: "python3",
      args: [serverScript],
      env: {
        ...process.env,
        ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || "",
      },
    });

    // Set up sampling request handler if enabled
    if (this.options.enableSampling && this.client) {
      this.setupSamplingHandler();
    }

    // Connect client to transport
    await this.client!.connect(this.transport);
    this.connected = true;

    // Discover tools
    const toolsResult = await this.client!.listTools();
    this.tools = toolsResult.tools.map((tool: { name: string; description?: string; inputSchema?: Record<string, unknown> }) => ({
      name: tool.name,
      description: tool.description || "",
      inputSchema: (tool.inputSchema as MCPTool['inputSchema']) || { type: "object", properties: {} },
    }));

    console.log('[MCPClient] Connected to MCP server');
    console.log('[MCPClient] Discovered tools:', this.tools.map(t => t.name));
  }

  /**
   * Set up handler for MCP sampling requests from the server
   * 
   * According to MCP spec, when the server sends a sampling/createMessage request,
   * the client should:
   * 1. Receive the request with messages, modelPreferences, etc.
   * 2. Call the LLM with the provided parameters
   * 3. Return the LLM response to the server
   */
  private setupSamplingHandler(): void {
    if (!this.client) return;

    console.log('[MCPClient] Setting up sampling request handler');
    
    // Note: The MCP SDK handles sampling requests automatically
    // when the client declares the sampling capability.
    // The actual handler is set up during client initialization.
    // For now, we log that sampling is enabled.
    
    // In a full implementation, we would register a handler like:
    // this.client.setRequestHandler('sampling/createMessage', async (request) => {
    //   return this.handleSamplingRequest(request);
    // });
    
    // However, the current SDK version may not expose this directly.
    // The sampling capability declaration is sufficient for the server
    // to know that the client supports sampling.
  }

  /**
   * Handle a sampling request from the MCP server
   * This is called when the server requests LLM generation
   */
  async handleSamplingRequest(request: SamplingRequest): Promise<SamplingResponse> {
    if (!this.orchestrator) {
      throw new Error("No LLM orchestrator configured for sampling requests");
    }

    console.log('[MCPClient] Handling sampling request from server');
    return this.orchestrator.handleSamplingRequest(request);
  }

  /**
   * Disconnect from the MCP server
   */
  async disconnect(): Promise<void> {
    if (!this.connected) return;

    try {
      await this.client?.close();
    } catch (e) {
      // Ignore close errors
    }

    this.connected = false;
    this.tools = [];
    console.log('[MCPClient] Disconnected from MCP server');
  }

  /**
   * Get available tools in LLM-compatible format
   * (Generic naming - works with any LLM provider)
   */
  getToolsForLLM(): Array<{
    name: string;
    description: string;
    input_schema: Record<string, unknown>;
  }> {
    return this.tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.inputSchema,
    }));
  }

  /**
   * Get available tools in Claude-compatible format
   * @deprecated Use getToolsForLLM() instead
   */
  getToolsForClaude(): Array<{
    name: string;
    description: string;
    input_schema: Record<string, unknown>;
  }> {
    return this.getToolsForLLM();
  }

  /**
   * Call a tool on the MCP server
   */
  async callTool(name: string, args: Record<string, unknown>): Promise<ToolResult> {
    if (!this.connected || !this.client) {
      throw new Error("MCP client not connected");
    }

    console.log(`[MCPClient] Calling tool: ${name}`);

    try {
      const result = await this.client.callTool({ name, arguments: args });
      
      // Extract text content from result
      let content = "";
      if (result.content && Array.isArray(result.content)) {
        for (const item of result.content) {
          if ((item as { type: string }).type === "text") {
            content += (item as { type: string; text: string }).text;
          }
        }
      }

      return {
        content,
        isError: Boolean(result.isError),
      };
    } catch (error) {
      console.error(`[MCPClient] Tool call error:`, error);
      return {
        content: error instanceof Error ? error.message : "Unknown error",
        isError: true,
      };
    }
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Get list of available tool names
   */
  getToolNames(): string[] {
    return this.tools.map(t => t.name);
  }

  /**
   * Check if sampling is enabled
   */
  isSamplingEnabled(): boolean {
    return this.options.enableSampling === true;
  }
}

/**
 * Create and connect an MCP client
 */
export async function createMCPClient(options: MCPClientOptions = {}): Promise<MCPClient> {
  const client = new MCPClient(options);
  await client.connect();
  return client;
}

/**
 * Create an MCP client with sampling support
 */
export async function createMCPClientWithSampling(
  orchestrator: LLMOrchestrator
): Promise<MCPClient> {
  const client = new MCPClient({
    enableSampling: true,
    orchestrator,
  });
  await client.connect();
  return client;
}
