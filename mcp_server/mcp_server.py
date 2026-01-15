"""
MCP Server for Planning Visualizer
Exposes tools for generating JavaScript renderers.

This is a PURE TOOL SERVER - it does NOT call Claude.
Claude orchestration happens in the Node.js backend.
"""

import json
from typing import Union

from pydantic import Field
from mcp.server.fastmcp import FastMCP

# Create the MCP server
mcp = FastMCP("PlanningVisualizerMCP", log_level="ERROR")


def get_system_prompt(domain_pascal: str) -> str:
    """Get the system prompt for code generation."""
    return f"""You are an expert JavaScript developer for HTML5 Canvas visualization.
Generate JavaScript functions that render PDDL planning states.

YOU MUST GENERATE THE MAIN RENDER AND LEGEND FUNCTIONS. Background function is OPTIONAL.

1. MAIN RENDER FUNCTION (REQUIRED):
   function render{domain_pascal}(ctx, state) {{
     // Main visualization - draws all objects and relations
     // ctx: Canvas 2D context
     // state: {{ objects: {{...}}, predicates: {{...}} }}
     // DO NOT clear canvas or draw background here
   }}

2. BACKGROUND FUNCTION (OPTIONAL - include only if the domain benefits from a custom background):
   function render{domain_pascal}Background(ctx, width, height) {{
     // Custom background - gradient, pattern, terrain, space, etc.
     // Called BEFORE zoom/pan transformations (stays fixed)
     // ctx: Canvas 2D context
     // width, height: Canvas dimensions
     // Only include if the domain would benefit from a thematic background
     // Examples where background IS useful: wooden table for blocks, space for satellites, warehouse for logistics
     // Examples where background is NOT needed: simple grid-based domains, abstract puzzles
   }}

3. LEGEND FUNCTION (REQUIRED):
   function render{domain_pascal}Legend(ctx, x, y) {{
     // Legend box showing what colors/shapes mean
     // Called AFTER zoom/pan (stays fixed at position)
     // ctx: Canvas 2D context
     // x, y: Top-left position for legend
     // Draw a semi-transparent box with icon + label pairs
   }}

CRITICAL RULES:
1. EVERY const/let MUST have an initializer on the SAME LINE.
2. Parse state.predicates to determine object positions and relationships.
3. Use distinct colors, shadows, labels. Make it professional and visually appealing.
4. No imports, no external libs, only Canvas API.
5. PURE JAVASCRIPT ONLY - NO TypeScript! No type annotations like `: string`, `: number`, `: any`.
6. NO type annotations on parameters. Write `function foo(ctx, state)` NOT `function foo(ctx: any, state: any)`.
7. The main render function should NOT clear the canvas.
8. ONLY include background function if the domain would genuinely benefit from a custom thematic background.
9. Legend should explain all colors and shapes used.
10. Use simple ternary operators carefully: `condition ? valueA : valueB`.


Output the required functions (main render and legend). Optionally include background if appropriate for the domain.
Start with 'function render...'.
"""


@mcp.tool(
    name="get_generation_prompt",
    description=(
        "Get the system and user prompts for generating a renderer. "
        "Returns prompts that should be sent to Claude."
    ),
)
def get_generation_prompt(
    domain_name: str = Field(description="Name of the planning domain"),
    example_state: Union[str, dict] = Field(description="JSON string or dict containing an example state"),
    style_hints: str = Field(default="", description="Optional style hints"),
) -> str:
    """Get prompts for renderer generation."""
    try:
        state_data = json.loads(example_state) if isinstance(example_state, str) else example_state

        # Convert domain name to PascalCase for function names
        domain_pascal = "".join(
            word.capitalize() for word in domain_name.replace("-", " ").replace("_", " ").split()
        )

        system_prompt = get_system_prompt(domain_pascal)

        user_prompt = f'Generate renderer functions for "{domain_name}" domain.\n'
        user_prompt += f"Use PascalCase name: {domain_pascal}\n\n"
        user_prompt += f"EXAMPLE STATE:\n{json.dumps(state_data, indent=2)}\n\n"
        if style_hints:
            user_prompt += f"STYLE HINTS: {style_hints}\n\n"
        user_prompt += "Generate ALL THREE JavaScript functions (render, background, legend)."

        return json.dumps(
            {
                "success": True,
                "system_prompt": system_prompt,
                "user_prompt": user_prompt,
                "domain_pascal": domain_pascal,
            }
        )

    except Exception as e:
        return json.dumps({"success": False, "error": str(e)})


if __name__ == "__main__":
    mcp.run(transport="stdio")