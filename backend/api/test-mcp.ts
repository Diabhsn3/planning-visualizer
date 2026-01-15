/**
 * Test script for the MCP architecture with LLM Orchestrator
 * Run with: npx tsx test-mcp.ts
 * 
 * This script tests:
 * 1. MCP client connection to Python server
 * 2. Tool discovery and execution
 * 3. LLM Orchestrator integration
 * 4. MCP sampling capability (optional)
 */

import { createMCPClient, createMCPClientWithSampling } from "./mcp-client.js";
import { generateRendererWithLLM, LLMOrchestrator } from "./llm-orchestrator.js";

async function main() {
  console.log("=== Testing MCP Architecture with LLM Orchestrator ===\n");

  // Check API key
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("ERROR: ANTHROPIC_API_KEY not set");
    console.log("Set it with: export ANTHROPIC_API_KEY=your-key");
    process.exit(1);
  }
  console.log("✓ ANTHROPIC_API_KEY is set\n");

  // Test 1: Connect to MCP server (basic)
  console.log("Test 1: Connecting to MCP server (basic)...");
  let mcpClient;
  try {
    mcpClient = await createMCPClient();
    console.log("✓ Connected to MCP server");
    console.log(`✓ Found ${mcpClient.getToolNames().length} tools: ${mcpClient.getToolNames().join(", ")}\n`);
  } catch (error) {
    console.error("✗ Failed to connect:", error);
    process.exit(1);
  }

  // Test 2: Call get_domain_hints tool
  console.log("Test 2: Calling get_domain_hints...");
  try {
    const result = await mcpClient.callTool("get_domain_hints", { domain_name: "hanoi" });
    const data = JSON.parse(result.content);
    console.log(`✓ Domain hints: ${data.found ? "found" : "not found"}`);
    console.log(`  Description: ${data.hints?.description || "N/A"}\n`);
  } catch (error) {
    console.error("✗ Failed:", error);
  }

  // Test 3: Call prepare_generation_artifacts tool
  console.log("Test 3: Calling prepare_generation_artifacts...");
  try {
    const exampleState = {
      objects: { disk: ["d1", "d2"], peg: ["peg1", "peg2", "peg3"] },
      predicates: { on: [["d1", "d2"]], smaller: [["d1", "d2"]] }
    };
    const result = await mcpClient.callTool("prepare_generation_artifacts", {
      domain_name: "hanoi",
      example_state: JSON.stringify(exampleState),
      style_hints: ""
    });
    const data = JSON.parse(result.content);
    console.log(`✓ Got prompts: ${data.success}`);
    console.log(`  Domain PascalCase: ${data.domain_pascal}\n`);
  } catch (error) {
    console.error("✗ Failed:", error);
  }

  // Disconnect basic client
  await mcpClient.disconnect();
  console.log("✓ Disconnected basic MCP client\n");

  // Test 4: Connect with sampling support
  console.log("Test 4: Connecting to MCP server with sampling support...");
  const orchestrator = new LLMOrchestrator();
  console.log(`  Provider: ${orchestrator.getProvider().getProviderName()}`);
  console.log(`  Model: ${orchestrator.getProvider().getModelName()}`);
  
  let samplingClient;
  try {
    samplingClient = await createMCPClientWithSampling(orchestrator);
    console.log("✓ Connected with sampling support");
    console.log(`✓ Sampling enabled: ${samplingClient.isSamplingEnabled()}\n`);
  } catch (error) {
    console.error("✗ Failed to connect with sampling:", error);
    process.exit(1);
  }

  // Test 5: Full generation (optional - takes time)
  const runFullTest = process.argv.includes("--full");
  if (runFullTest) {
    console.log("Test 5: Full renderer generation with LLM Orchestrator...");
    try {
      const exampleState = {
        objects: { disk: ["d1", "d2", "d3"], peg: ["peg1", "peg2", "peg3"] },
        predicates: { 
          on: [["d1", "d2"], ["d2", "d3"]], 
          smaller: [["d1", "d2"], ["d2", "d3"]],
          clear: [["d1"], ["peg2"], ["peg3"]]
        }
      };
      
      const result = await generateRendererWithLLM(samplingClient, "hanoi", exampleState);
      console.log(`✓ Generation success: ${result.success}`);
      console.log(`  Code length: ${result.code?.length || 0} chars`);
      if (result.error) {
        console.log(`  Error: ${result.error}`);
      }
    } catch (error) {
      console.error("✗ Failed:", error);
    }
  } else {
    console.log("Test 5: Skipped (run with --full to test generation)\n");
  }

  // Cleanup
  await samplingClient.disconnect();
  console.log("✓ Disconnected sampling MCP client");
  console.log("\n=== All tests completed ===");
}

main().catch(console.error);
