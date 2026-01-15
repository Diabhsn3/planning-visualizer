/**
 * Test script for MCP architecture
 * Run with: npx tsx test-mcp.ts
 */

import { getMcpClient, callTool, disconnectMcpClient } from "./mcp-client.js";

async function testMcpConnection() {
  console.log("=== MCP Architecture Test ===\n");
  
  try {
    // Test 1: Connect to MCP server
    console.log("1. Testing MCP connection...");
    const client = await getMcpClient();
    console.log("   ✓ Connected to MCP server\n");
    
    // Test 2: List available tools
    console.log("2. Listing available tools...");
    const tools = await client.listTools();
    console.log("   Available tools:");
    for (const tool of tools.tools) {
      console.log(`   - ${tool.name}: ${tool.description?.slice(0, 50)}...`);
    }
    console.log("");
    
    
    // Test 4: Call get_generation_prompt tool
    console.log("4. Testing get_generation_prompt tool...");
    const promptResult = await callTool("get_generation_prompt", {
      domain_name: "test-domain",
      example_state: JSON.stringify({
        objects: { block1: { type: "block" } },
        predicates: { on: [["block1", "table"]] }
      }),
      style_hints: "Use blue colors"
    });
    const prompts = JSON.parse(promptResult);
    console.log("   Success:", prompts.success);
    console.log("   Domain Pascal:", prompts.domain_pascal);
    console.log("   System prompt length:", prompts.system_prompt?.length || 0);
    console.log("   User prompt length:", prompts.user_prompt?.length || 0);
    console.log("");
    
    
    
    // Test 6: Call validate_renderer tool
    console.log("6. Testing validate_renderer tool...");
    const validateResult = await callTool("validate_renderer", {
      code: "function renderTestDomain(ctx, state) { ctx.fillRect(0,0,100,100); }\nfunction renderTestDomainLegend(ctx, x, y) { }",
      domain_name: "test-domain"
    });
    const validation = JSON.parse(validateResult);
    console.log("   Valid:", validation.valid);
    console.log("   Errors:", validation.errors);
    console.log("   Warnings:", validation.warnings);
    console.log("");
    
    console.log("=== All tests passed! ===\n");
    
  } catch (error) {
    console.error("Test failed:", error);
  } finally {
    await disconnectMcpClient();
    console.log("Disconnected from MCP server");
  }
}

// Run tests
testMcpConnection();