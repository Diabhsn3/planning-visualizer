"""
MCP Server for Planning Visualizer
Exposes tools for generating JavaScript renderers.

This is a PURE TOOL SERVER - it does NOT call Claude.
Claude orchestration happens in the Node.js backend.
"""

import os
import json
import re
import subprocess
import tempfile
from pydantic import Field
from typing import Union
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

OBJECT ARRANGEMENT RULES (CRITICAL - NEVER VIOLATE):
11. When multiple objects are at the SAME location, arrange them SIDE BY SIDE or STACKED.
12. NEVER overlay objects on top of each other - they must ALL be visible.
13. Example: If 3 cars are at station A, show them in a row or column, not overlapping.
14. Use offsets based on index: x + (index * objectWidth + spacing)

CONTAINER SIZING RULES (CRITICAL):
15. Containers (stations, depots, rooms, locations, etc.) should RESIZE based on their contents.
16. Draw contained objects INSIDE the container, not around or outside it.
17. If a station contains 3 cars, make the station wider/taller to fit all cars inside.
18. When objects leave, the container should visually shrink.
19. Calculate container size: baseSize + (numContainedObjects * objectSize + padding)
20. Draw the container FIRST (as background), then draw objects INSIDE it.

Output the required functions (main render and legend). Optionally include background if appropriate for the domain. Start with 'function render...'."""


@mcp.tool(
    name="get_generation_prompt",
    description="Get the system and user prompts for generating a renderer. Returns prompts that should be sent to Claude.",
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
        domain_pascal = ''.join(word.capitalize() for word in domain_name.replace('-', ' ').replace('_', ' ').split())
        
        system_prompt = get_system_prompt(domain_pascal)
        
        user_prompt = f'Generate renderer functions for "{domain_name}" domain.\n'
        user_prompt += f"Use PascalCase name: {domain_pascal}\n\n"
        user_prompt += f"EXAMPLE STATE:\n{json.dumps(state_data, indent=2)}\n\n"
        if style_hints:
            user_prompt += f"STYLE HINTS: {style_hints}\n\n"
        user_prompt += "Generate ALL THREE JavaScript functions (render, background, legend)."
        
        return json.dumps({
            "success": True,
            "system_prompt": system_prompt,
            "user_prompt": user_prompt,
            "domain_pascal": domain_pascal
        })
        
    except Exception as e:
        return json.dumps({
            "success": False,
            "error": str(e)
        })


@mcp.tool(
    name="validate_renderer",
    description="Validate JavaScript renderer code for syntax errors.",
)
def validate_renderer(
    code: str = Field(description="The JavaScript renderer code to validate"),
    domain_name: str = Field(description="Expected domain name"),
) -> str:
    """Validate renderer code for syntax errors."""
    errors = []
    warnings = []
    
    # Convert domain name to PascalCase
    domain_pascal = ''.join(word.capitalize() for word in domain_name.replace('-', ' ').replace('_', ' ').split())
    
    # Check for required functions
    main_func = f"function render{domain_pascal}"
    legend_func = f"function render{domain_pascal}Legend"
    bg_func = f"function render{domain_pascal}Background"
    
    if main_func not in code:
        errors.append(f"Missing main render function: {main_func}")
    
    if legend_func not in code:
        errors.append(f"Missing legend function: {legend_func}")
    
    # Background is optional - just note if missing
    if bg_func not in code:
        warnings.append(f"No background function (optional): {bg_func}")
    
    if "ctx" not in code:
        errors.append("Missing 'ctx' parameter")
    
    try:
        with tempfile.NamedTemporaryFile(mode='w', suffix='.js', delete=False) as f:
            f.write(code)
            temp_path = f.name
        
        result = subprocess.run(
            ['node', '--check', temp_path],
            capture_output=True,
            text=True,
            timeout=10
        )
        
        if result.returncode != 0:
            errors.append(f"JavaScript syntax error: {result.stderr.strip()[:200]}")
        
        os.unlink(temp_path)
        
    except Exception as e:
        errors.append(f"Validation error: {str(e)}")
    
    if errors:
        return json.dumps({"valid": False, "errors": errors, "warnings": warnings})
    else:
        return json.dumps({"valid": True, "errors": [], "warnings": warnings, "message": "All required functions are valid"})


@mcp.tool(
    name="clean_code",
    description="Clean generated code by removing markdown code blocks, TypeScript annotations, and extra whitespace.",
)
def clean_code(
    code: str = Field(description="The raw code to clean"),
) -> str:
    """Clean code by removing markdown formatting and TypeScript annotations."""
    try:
        # Remove markdown code blocks
        cleaned = re.sub(r'^```(?:javascript|typescript|js|ts)?\s*\n?', '', code, flags=re.MULTILINE)
        cleaned = re.sub(r'\n?```\s*$', '', cleaned)
        
        # Remove TypeScript interface and type declarations
        cleaned = re.sub(r'^\s*(interface|type)\s+\w+[^{]*\{[^}]*\}\s*;?\s*$', '', cleaned, flags=re.MULTILINE)
        
        # Remove TypeScript type annotations from function parameters
        # e.g., (ctx: CanvasRenderingContext2D, state: any) -> (ctx, state)
        cleaned = re.sub(r':\s*[A-Za-z_][A-Za-z0-9_<>\[\]|&\s,]*(?=[,)])', '', cleaned)
        
        # Remove TypeScript return type annotations
        # e.g., function foo(): void { -> function foo() {
        cleaned = re.sub(r'\)\s*:\s*[A-Za-z_][A-Za-z0-9_<>\[\]|&\s]*\s*\{', ') {', cleaned)
        
        # Remove TypeScript type annotations from variable declarations
        # e.g., const x: number = 5 -> const x = 5
        cleaned = re.sub(r'(const|let|var)\s+(\w+)\s*:\s*[A-Za-z_][A-Za-z0-9_<>\[\]|&\s]*\s*=', r'\1 \2 =', cleaned)
        
        # Remove 'as Type' casts (including generic types like Record<string, any>)
        # This needs to handle nested angle brackets
        def remove_as_casts(text):
            result = []
            i = 0
            while i < len(text):
                # Look for ' as '
                if text[i:i+4] == ' as ':
                    # Find the end of the type annotation
                    j = i + 4
                    # Skip whitespace
                    while j < len(text) and text[j] in ' \t':
                        j += 1
                    # Skip the type name and any generic parameters
                    depth = 0
                    while j < len(text):
                        if text[j] == '<':
                            depth += 1
                        elif text[j] == '>':
                            depth -= 1
                            if depth == 0:
                                j += 1
                                break
                        elif depth == 0 and text[j] in ';,)\n ':
                            break
                        j += 1
                    i = j
                else:
                    result.append(text[i])
                    i += 1
            return ''.join(result)
        
        cleaned = remove_as_casts(cleaned)
        
        # Remove generic type parameters from function calls
        # e.g., Array<string> -> Array
        cleaned = re.sub(r'<[A-Za-z_][A-Za-z0-9_<>\[\]|&\s,]*>', '', cleaned)
        
        cleaned = cleaned.strip()
        
        return json.dumps({
            "success": True,
            "code": cleaned
        })
    except Exception as e:
        return json.dumps({
            "success": False,
            "error": str(e)
        })


@mcp.tool(
    name="get_domain_hints",
    description="Get visualization hints for a specific planning domain.",
)
def get_domain_hints(
    domain_name: str = Field(description="Name of the planning domain"),
) -> str:
    """Get visualization hints for a domain."""
    
    hints = {
        "hanoi": {
            "description": "Tower of Hanoi puzzle with disks on pegs",
            "layout": "3 pegs arranged horizontally, disks stacked vertically",
            "background": "Wooden texture or gradient",
            "legend": "Show disk sizes and colors",
        },
        "blocks-world": {
            "description": "Blocks stacking puzzle",
            "layout": "blocks on table or stacked",
            "background": "Table surface with wood grain",
            "legend": "Show block colors and arm state",
        },
        "gripper": {
            "description": "Robot gripper moving balls between rooms",
            "layout": "rooms side by side, robot moves between them",
            "background": "Room floor pattern",
            "legend": "Show ball colors and gripper states",
        },
        "logistics": {
            "description": "Package delivery with trucks and planes",
            "layout": "cities with locations, vehicles move between them",
            "background": "Map-like terrain",
            "legend": "Show vehicle types and package states",
        },
        "satellite": {
            "description": "Satellites taking images of targets",
            "layout": "satellites in orbit, targets on ground",
            "background": "Space/Earth view",
            "legend": "Show satellite modes and target types",
        },
    }
    
    domain_key = domain_name.lower().replace(" ", "-").replace("_", "-")
    
    if domain_key in hints:
        return json.dumps({"found": True, "domain": domain_key, "hints": hints[domain_key]})
    else:
        return json.dumps({
            "found": False,
            "domain": domain_key,
            "hints": {
                "description": "Unknown domain - analyze the state structure",
                "layout": "Arrange objects based on relations",
                "background": "Use a subtle gradient or pattern",
                "legend": "Show all object types and their colors"
            },
            "available_domains": list(hints.keys())
        })


if __name__ == "__main__":
    mcp.run(transport="stdio")
