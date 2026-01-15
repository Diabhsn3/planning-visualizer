"""
MCP Server for Planning Visualizer
Exposes tools for generating JavaScript renderers.
"""
from mcp.server.fastmcp import FastMCP
# Create the MCP server
mcp = FastMCP("PlanningVisualizerMCP", log_level="ERROR")
# --- Tools will be added here in subsequent commits ---
if __name__ == "__main__":
 mcp.run(transport="stdio")