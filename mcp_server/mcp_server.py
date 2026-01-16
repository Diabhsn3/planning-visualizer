"""
MCP Server for Planning Visualizer
Exposes tools and resources for generating JavaScript renderers.

Architecture:
- Resources: Versioned prompts and domain rendered data
- Tools: Self-descriptive utility functions that LLM discovers autonomously

The LLM autonomously discovers and uses tools based on their descriptions.
No hardcoded workflow - the LLM decides which tools to call and when.
"""

import os
import json
import re
import subprocess
import tempfile
from pathlib import Path
from pydantic import Field
from typing import Union, Optional
from mcp.server.fastmcp import FastMCP

# Create the MCP server
mcp = FastMCP("PlanningVisualizerMCP", log_level="ERROR")

# Directory containing versioned prompts
PROMPTS_DIR = Path(__file__).parent / "prompts"

# Directories containing rendered domain data (searched in order)
RENDERED_DATA_DIRS = [
    Path(__file__).parent.parent / "backend" / "api" / "data",
    Path(__file__).parent.parent / "backend" / "planner" / "output",
]


# =============================================================================
# MCP RESOURCES - Data that LLM can read to understand context
# =============================================================================

@mcp.resource("prompt://renderer/system/{version}")
def get_system_prompt_resource(version: str) -> str:
    """
    Fetch a versioned system prompt for renderer generation.
    
    URI: prompt://renderer/system/v1
    
    Contains instructions for generating JavaScript renderer functions.
    The prompt has a {domain_pascal} placeholder to be replaced with the domain name.
    """
    prompt_path = PROMPTS_DIR / version / "system_prompt.txt"
    if not prompt_path.exists():
        available = [d.name for d in PROMPTS_DIR.iterdir() if d.is_dir()]
        raise ValueError(f"Prompt version '{version}' not found. Available: {available}")
    with open(prompt_path, "r") as f:
        return f.read()


@mcp.resource("prompt://renderer/versions")
def list_prompt_versions() -> dict:
    """
    List all available prompt versions.
    
    URI: prompt://renderer/versions
    """
    versions = [d.name for d in PROMPTS_DIR.iterdir() if d.is_dir()]
    return {
        "available_versions": sorted(versions),
        "default": "v1",
        "description": "Use prompt://renderer/system/{version} to fetch a specific version"
    }


@mcp.resource("data://rendered/{domain}")
def get_rendered_domain_data(domain: str) -> dict:
    """
    Fetch pre-computed rendered data for a domain.
    
    URI: data://rendered/blocks_world
    
    This contains the actual state structure (objects, positions, relations)
    that the renderer needs to visualize. Use this to understand what data
    your renderer code will receive.
    """
    # Normalize domain name
    domain_normalized = domain.lower().replace("-", "_").replace(" ", "_")
    filename = f"{domain_normalized}_rendered.json"
    
    for data_dir in RENDERED_DATA_DIRS:
        file_path = data_dir / filename
        if file_path.exists():
            with open(file_path, "r") as f:
                return json.load(f)
    
    raise ValueError(f"No rendered data found for domain '{domain}'. File '{filename}' not found.")


# =============================================================================
# MCP TOOLS - Self-descriptive functions for autonomous LLM discovery
# =============================================================================

@mcp.tool(
    name="get_domain_rendered_data",
    description="""Search for and retrieve pre-computed rendered state data for a planning domain.

USE THIS TOOL WHEN: You need to understand what data structure your renderer will receive.
The returned JSON shows the exact format of objects, positions, colors, and relations.

RETURNS: JSON with domain name, number of states, and array of state objects.
Each state contains 'objects' (with id, type, label, position, properties) and 'relations'.

EXAMPLE: For 'blocks_world', returns data showing blocks with positions, colors, and stacking relations.""",
)
def get_domain_rendered_data(
    domain_name: str = Field(description="Name of the planning domain (e.g., 'blocks_world', 'gripper', 'satellite')"),
) -> str:
    """Search for rendered domain data to understand the state structure."""
    # Normalize domain name for file search
    domain_normalized = domain_name.lower().replace("-", "_").replace(" ", "_")
    filename = f"{domain_normalized}_rendered.json"
    
    # Search in all data directories
    for data_dir in RENDERED_DATA_DIRS:
        file_path = data_dir / filename
        if file_path.exists():
            with open(file_path, "r") as f:
                data = json.load(f)
            
            # Return a summary plus first state as example
            first_state = data.get("states", [{}])[0] if data.get("states") else {}
            
            return json.dumps({
                "found": True,
                "domain": domain_name,
                "file_path": str(file_path),
                "num_states": data.get("num_states", len(data.get("states", []))),
                "example_state": first_state,
                "object_types": list(set(obj.get("type", "unknown") for obj in first_state.get("objects", []))),
                "relation_types": list(set(rel.get("type", "unknown") for rel in first_state.get("relations", []))),
                "hint": "Use this state structure to understand what your renderer needs to draw"
            })
    
    # Not found - list available domains
    available = []
    for data_dir in RENDERED_DATA_DIRS:
        if data_dir.exists():
            for f in data_dir.glob("*_rendered.json"):
                domain = f.stem.replace("_rendered", "")
                if domain not in available:
                    available.append(domain)
    
    return json.dumps({
        "found": False,
        "domain": domain_name,
        "searched_filename": filename,
        "available_domains": sorted(available),
        "hint": "No pre-computed data for this domain. You'll need to analyze the example_state provided in the user prompt."
    })


@mcp.tool(
    name="list_available_domains",
    description="""List all planning domains that have pre-computed rendered data available.

USE THIS TOOL WHEN: You want to see which domains have example data you can reference.

RETURNS: List of domain names with rendered data files.""",
)
def list_available_domains() -> str:
    """List all domains with available rendered data."""
    available = []
    for data_dir in RENDERED_DATA_DIRS:
        if data_dir.exists():
            for f in data_dir.glob("*_rendered.json"):
                domain = f.stem.replace("_rendered", "")
                if domain not in available:
                    available.append(domain)
    
    return json.dumps({
        "available_domains": sorted(available),
        "count": len(available),
        "hint": "Use get_domain_rendered_data to fetch the actual state structure for any of these domains"
    })


@mcp.tool(
    name="get_domain_hints",
    description="""Get visualization style hints for known planning domains.

USE THIS TOOL: OPTIONAL - only if you need styling ideas before generating code.
Most domains work fine without calling this tool.

RETURNS: Hints about visual style, layout approach, background, and legend content.""",
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
        "blocks_world": {
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
        "depot": {
            "description": "Warehouse logistics with hoists and crates",
            "layout": "depots with storage areas, trucks for transport",
            "background": "Industrial warehouse floor",
            "legend": "Show crate locations and hoist states",
        },
        "rovers": {
            "description": "Mars rovers collecting samples and images",
            "layout": "terrain map with waypoints, rovers moving between them",
            "background": "Mars terrain (red/brown)",
            "legend": "Show rover equipment and sample states",
        },
    }
    
    domain_key = domain_name.lower().replace(" ", "-").replace("_", "-")
    domain_key_underscore = domain_name.lower().replace(" ", "_").replace("-", "_")
    
    if domain_key in hints:
        return json.dumps({"found": True, "domain": domain_key, "hints": hints[domain_key]})
    elif domain_key_underscore in hints:
        return json.dumps({"found": True, "domain": domain_key_underscore, "hints": hints[domain_key_underscore]})
    else:
        return json.dumps({
            "found": False,
            "domain": domain_key,
            "hints": {
                "description": "Unknown domain - analyze the state structure to determine visualization",
                "layout": "Arrange objects based on their relations and positions",
                "background": "Use a subtle gradient or pattern appropriate to the domain theme",
                "legend": "Show all object types with their colors and any important states"
            },
            "available_domains": list(hints.keys())
        })


@mcp.tool(
    name="prepare_generation_artifacts",
    description="""Prepare the user prompt and domain name in PascalCase for renderer generation.

USE THIS TOOL WHEN: You're ready to start generating renderer code and need the formatted prompt.

RETURNS: JSON with user_prompt (the generation request) and domain_pascal (for function naming).
The user_prompt includes the example state and any style hints.""",
)
def prepare_generation_artifacts(
    domain_name: str = Field(description="Name of the planning domain"),
    example_state: Union[str, dict] = Field(description="JSON string or dict containing an example state"),
    style_hints: str = Field(default="", description="Optional style hints"),
) -> str:
    """Prepare the user prompt for renderer generation."""
    try:
        state_data = json.loads(example_state) if isinstance(example_state, str) else example_state
        
        # Convert domain name to PascalCase for function names
        domain_pascal = ''.join(word.capitalize() for word in domain_name.replace('-', ' ').replace('_', ' ').split())
        
        user_prompt = f'Generate renderer functions for "{domain_name}" domain.\n'
        user_prompt += f"Use PascalCase name: {domain_pascal}\n\n"
        user_prompt += f"EXAMPLE STATE:\n{json.dumps(state_data, indent=2)}\n\n"
        if style_hints:
            user_prompt += f"STYLE HINTS: {style_hints}\n\n"
        user_prompt += "Generate the required JavaScript functions (main render and legend). Include background function only if appropriate for this domain."
        
        return json.dumps({
            "success": True,
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
    description="""Validate JavaScript renderer code for syntax errors and required functions.

IMPORTANT: Only call this AFTER you have written complete JavaScript code.
DO NOT call this tool before generating code - you need code to validate first!

WORKFLOW:
1. First, generate the JavaScript renderer functions
2. Then, call this tool with your generated code
3. If validation fails, fix the errors and validate again

CHECKS:
- JavaScript syntax (using Node.js --check)
- Required functions: renderDomainName(ctx, state), renderDomainNameLegend(ctx, x, y)
- Presence of 'ctx' parameter

RETURNS: JSON with valid (boolean), errors (array), and warnings (array).""",
)
def validate_renderer(
    code: str = Field(description="The JavaScript renderer code to validate"),
    domain_name: str = Field(description="Expected domain name (for function name checking)"),
) -> str:
    """Validate renderer code for syntax errors and required functions."""
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
        errors.append("Missing 'ctx' parameter - renderer needs canvas context")
    
    # Check JavaScript syntax
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
    description="""Clean generated code by removing markdown formatting and TypeScript annotations.

IMPORTANT: Only call this AFTER you have written code that needs cleaning.
If your code is already clean JavaScript, you don't need this tool.

REMOVES:
- Markdown code block markers (```)
- TypeScript type annotations (: string, : number, etc.)
- Any text before 'function render...'

RETURNS: JSON with success (boolean) and code (cleaned JavaScript).""",
)
def clean_code(
    code: str = Field(description="The raw code to clean"),
) -> str:
    """Clean code by removing markdown formatting, conversational text, and TypeScript annotations."""
    try:
        # Remove markdown code blocks
        cleaned = re.sub(r'^```(?:javascript|typescript|js|ts)?\s*\n?', '', code, flags=re.MULTILINE)
        cleaned = re.sub(r'\n?```\s*$', '', cleaned)
        
        # CRITICAL: Strip any conversational preamble before the first 'function' keyword
        function_match = re.search(r'(function\s+render\w*\s*\()', cleaned)
        if function_match:
            cleaned = cleaned[function_match.start():]
        
        # Remove TypeScript interface and type declarations
        cleaned = re.sub(r'^\s*(interface|type)\s+\w+[^{]*\{[^}]*\}\s*;?\s*$', '', cleaned, flags=re.MULTILINE)
        
        # Remove TypeScript type annotations from function parameters
        cleaned = re.sub(r':\s*[A-Za-z_][A-Za-z0-9_<>\[\]|&\s,]*(?=[,)])', '', cleaned)
        
        # Remove TypeScript return type annotations
        cleaned = re.sub(r'\)\s*:\s*[A-Za-z_][A-Za-z0-9_<>\[\]|&\s]*\s*\{', ') {', cleaned)
        
        # Remove TypeScript type annotations from variable declarations
        cleaned = re.sub(r'(const|let|var)\s+(\w+)\s*:\s*[A-Za-z_][A-Za-z0-9_<>\[\]|&\s]*\s*=', r'\1 \2 =', cleaned)
        
        # Remove 'as Type' casts
        def remove_as_casts(text):
            result = []
            i = 0
            while i < len(text):
                if text[i:i+4] == ' as ':
                    j = i + 4
                    while j < len(text) and text[j] in ' \t':
                        j += 1
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
        
        # Remove generic type parameters
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


# =============================================================================
# EXAMPLE RENDERER RESOURCE AND TOOL
# =============================================================================

EXAMPLES_DIR = Path(__file__).parent / "examples"

@mcp.resource("example://renderer/blocks_world")
def get_example_renderer_resource() -> str:
    """
    Get a complete working example of a renderer implementation.
    
    URI: example://renderer/blocks_world
    
    This shows the correct structure, patterns, and Canvas API usage
    for generating renderer functions.
    """
    example_path = EXAMPLES_DIR / "example_renderer.js"
    if not example_path.exists():
        raise ValueError("Example renderer not found")
    with open(example_path, "r") as f:
        return f.read()


@mcp.tool(
    name="get_example_renderer",
    description="""Get a complete working example of a renderer implementation.

USE THIS TOOL WHEN: You want to see a working example of how to structure renderer code.
The example shows correct patterns for:
- Null-checking state data
- Filtering objects by type
- Using positions and properties
- Drawing with Canvas API (fillRect, strokeRect, fillText, etc.)
- Creating a legend box
- Creating a custom background

RETURNS: Complete JavaScript code for a blocks_world renderer with comments.
Study this example to understand the expected code structure before generating your own.""",
)
def get_example_renderer() -> str:
    """Get a complete working example of a renderer implementation."""
    example_path = EXAMPLES_DIR / "example_renderer.js"
    if not example_path.exists():
        return json.dumps({
            "found": False,
            "error": "Example renderer not found"
        })
    
    with open(example_path, "r") as f:
        code = f.read()
    
    return json.dumps({
        "found": True,
        "domain": "blocks_world",
        "description": "Complete working example showing correct renderer structure",
        "patterns_demonstrated": [
            "Null-checking state data",
            "Filtering objects by type",
            "Using object positions and properties",
            "Drawing shapes with Canvas API",
            "Adding shadows and borders",
            "Drawing text labels",
            "Creating a legend box",
            "Creating gradient backgrounds"
        ],
        "code": code
    })


@mcp.tool(
    name="get_legend_guidelines",
    description="""Get guidelines for creating a properly sized legend box.

USE THIS TOOL WHEN: You are creating the renderDomainLegend function.
The legend should have SMALL icons (15-20px), not full-sized objects.

RETURNS: Code example and sizing rules for legend items.""",
)
def get_legend_guidelines() -> str:
    """Get guidelines for creating a properly sized legend box."""
    return json.dumps({
        "description": "Guidelines for creating a properly sized legend",
        "critical_rules": [
            "Legend icons must be SMALL (15-20px), NOT full-sized objects",
            "Legend box should be compact (120-160px wide, 80-150px tall)",
            "Use simple shapes for icons, not detailed drawings",
            "Each legend item: small icon (15x15) + text label",
            "Spacing between items: 20-25px vertical"
        ],
        "example_code": '''function renderDomainLegend(ctx, x, y) {
  const boxWidth = 140;
  const boxHeight = 120;
  const iconSize = 15;  // SMALL icons!
  const padding = 10;
  const itemSpacing = 22;
  
  // Background box
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.fillRect(x, y, boxWidth, boxHeight);
  ctx.strokeStyle = '#ccc';
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, boxWidth, boxHeight);
  
  // Title
  ctx.fillStyle = '#333';
  ctx.font = 'bold 11px Arial';
  ctx.textAlign = 'left';
  ctx.fillText('Legend', x + padding, y + 16);
  
  let itemY = y + 32;
  
  // Item 1: Depot (small rectangle)
  ctx.fillStyle = '#A9A9A9';
  ctx.fillRect(x + padding, itemY, iconSize, iconSize);
  ctx.fillStyle = '#333';
  ctx.font = '10px Arial';
  ctx.fillText('Depot', x + padding + iconSize + 8, itemY + 11);
  itemY += itemSpacing;
  
  // Item 2: Truck (small rectangle)
  ctx.fillStyle = '#00BFFF';
  ctx.fillRect(x + padding, itemY, iconSize, iconSize);
  ctx.fillStyle = '#333';
  ctx.fillText('Truck', x + padding + iconSize + 8, itemY + 11);
  itemY += itemSpacing;
  
  // Item 3: Package (small square)
  ctx.fillStyle = '#FFD700';
  ctx.fillRect(x + padding, itemY, iconSize, iconSize);
  ctx.fillStyle = '#333';
  ctx.fillText('Package', x + padding + iconSize + 8, itemY + 11);
}''',
        "common_mistakes": [
            "Drawing full-sized objects in legend (e.g., 60x60 blocks)",
            "Making legend box too large",
            "Using complex drawings instead of simple colored squares"
        ]
    })


@mcp.tool(
    name="get_state_handling_guidelines",
    description="""Get guidelines for handling state transitions properly.

USE THIS TOOL WHEN: Objects are not moving correctly between states, disappearing unexpectedly, or appearing in wrong positions.

RETURNS: Critical rules for reading state data and positioning objects dynamically.""",
)
def get_state_handling_guidelines() -> str:
    """Get guidelines for handling state transitions properly."""
    return json.dumps({
        "description": "Guidelines for handling state transitions in renderers",
        "critical_rules": [
            "NEVER hardcode object positions - always read from state.objects[].position",
            "ALWAYS iterate over state.objects to find what exists in current state",
            "ALWAYS check state.relations to determine object relationships (e.g., 'in-truck', 'on-pile')",
            "Objects may appear/disappear between states - only draw what's in current state",
            "Position objects based on their relations, not just their position property"
        ],
        "state_structure": {
            "objects": "Array of {id, type, label, position: [x,y], properties: {}}",
            "relations": "Array of {type, source, target} describing relationships"
        },
        "example_patterns": {
            "find_objects_by_type": "const trucks = state.objects.filter(o => o.type === 'truck');",
            "get_position": "const [x, y] = obj.position || [0, 0];",
            "find_relation": "const inTruck = state.relations.find(r => r.type === 'in-truck' && r.source === pkg.id);",
            "position_by_relation": "if (inTruck) { drawAt(truckPosition); } else if (onPile) { drawAt(pilePosition); }"
        },
        "example_code": '''// CORRECT: Dynamic positioning based on state
function renderDepot(ctx, state) {
  // Get all objects from current state
  const packages = state.objects.filter(o => o.type === 'package');
  const trucks = state.objects.filter(o => o.type === 'truck');
  
  // Build relation maps from current state
  const packageInTruck = new Map();
  const packageOnPile = new Map();
  
  for (const rel of state.relations) {
    if (rel.type === 'in-truck') packageInTruck.set(rel.source, rel.target);
    if (rel.type === 'on-pile') packageOnPile.set(rel.source, rel.target);
  }
  
  // Draw each package at its CURRENT location
  for (const pkg of packages) {
    const truckId = packageInTruck.get(pkg.id);
    const pileId = packageOnPile.get(pkg.id);
    
    if (truckId) {
      // Package is in a truck - find truck position and draw inside
      const truck = trucks.find(t => t.id === truckId);
      if (truck && truck.position) {
        const [tx, ty] = truck.position;
        drawPackage(ctx, tx + 10, ty + 10); // Inside truck
      }
    } else if (pileId) {
      // Package is on a pile - use pile position
      // ... similar logic
    } else {
      // Package has its own position
      const [x, y] = pkg.position || [0, 0];
      drawPackage(ctx, x, y);
    }
  }
}''',
        "common_mistakes": [
            "Hardcoding positions like 'drawTruck(100, 200)' instead of reading from state",
            "Not checking relations - drawing package at its own position even when it's in a truck",
            "Assuming objects always exist - not filtering by current state",
            "Drawing objects that don't exist in current state"
        ]
    })


if __name__ == "__main__":
    mcp.run(transport="stdio")
