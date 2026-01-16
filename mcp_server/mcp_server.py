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
            "description": "A dual-warehouse logistics scenario where labeled crates are moved via an overhead hoist onto a single transport truck, shuttled between depots, and deposited on designated piles. The hoists can pick up crates from piles or trucks, stack them, and release them at the target depot.",
            "layout": "Two depots (D1 and D2) sit side-by-side on an industrial grid. Each depot has a pile (pile1, pile2) and a gantry-style hoist. A small truck parks beside the active depot; crates (p1, p2, etc.) are hoisted from piles onto the truck bed, transported to the other depot, and hoisted down. Piles are labelled, hoists are centred in each depot, and the truck travels along the space between depots.",
            "background": "A light grey, tiled warehouse floor provides a neutral, industrial backdrop and helps to separate the depots spatially. The grid subtly conveys movement and positions without distracting from the assets.",
            "legend": "Use distinct colors (e.g., yellow and orange boxes) and labels (p1, p2) to denote each crate, icons to represent the hoists, and a small vehicle icon for the truck. Show the piles as brown platforms with labels (pile1, pile2). Hoist states (idle vs. holding a crate) can be indicated by highlighting the hoist arm; truck states (loaded vs. empty) can be reflected by the presence of crates on its bed.",
            "critical_relations": {
                "at-pile": "pile1 at-pile d1 means pile1 belongs to depot d1 ONLY - do NOT draw pile1 at other depots!",
                "at-crane": "c1 at-crane d1 means hoist/crane c1 belongs to depot d1 ONLY - centred in that depot",
                "at-truck": "t1 at-truck d1 means truck t1 is currently parked at depot d1",
                "on": "p1 on p2 means crate p1 is stacked ON TOP of crate p2 (draw p1 above p2)",
                "on-pile": "p1 on-pile pile1 means crate p1 is on the pile (bottom of stack on that pile)",
                "in-truck": "p1 in-truck t1 means crate p1 is ON the truck bed - draw it visible on the truck!",
                "holding": "c1 holding p1 means hoist c1 is holding crate p1 - draw p1 attached to hoist gripper!"
            },
            "positioning_rules": [
                "EACH pile belongs to ONE depot via at-pile - check the relation!",
                "EACH hoist/crane belongs to ONE depot via at-crane - centred in that depot!",
                "Crates can be: on a pile (on-pile), stacked on another crate (on), on truck bed (in-truck), or held by hoist (holding)",
                "When crate is in-truck, draw it ON the truck bed, visible to user!",
                "When hoist is holding a crate, draw the crate near the hoist gripper/arm!",
                "Build location maps FIRST: which piles/hoists are at which depot",
                "Truck travels between depots - check at-truck to see current location"
            ],
            "visual_style": {
                "depot": "Large gray rectangle (warehouse building) with label inside, side-by-side layout",
                "hoist": "Gantry-style crane with vertical arm, centred in depot, pink/magenta color",
                "pile": "Brown platform at bottom of depot with label, crates stack on top",
                "truck": "Small blue vehicle with wheels, parks beside active depot",
                "crate": "Yellow/orange small rectangle with label (p1, p2, etc.)"
            }
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
The legend MUST be CONSISTENT across all states - it does NOT depend on state data.

RETURNS: Code example and sizing rules for legend items.""",
)
def get_legend_guidelines() -> str:
    """Get guidelines for creating a properly sized legend box."""
    return json.dumps({
        "description": "Guidelines for creating a properly sized, CONSISTENT legend",
        "critical_rules": [
            "CONSISTENCY: Legend must be IDENTICAL for ALL states in the domain - do NOT read state data!",
            "MATCHING VISUALS: Legend icons must use the SAME colors and shapes as the main visualization",
            "Legend icons must be SMALL (15-20px), NOT full-sized objects",
            "Legend box should be compact (120-160px wide, 80-150px tall)",
            "Use simplified versions of the actual object drawings, not different shapes",
            "Each legend item: small icon (15x15) + text label",
            "Spacing between items: 20-25px vertical",
            "Include ALL object types that appear in the domain (depot, truck, crane, pile, package, etc.)"
        ],
        "consistency_explanation": {
            "why": "The legend explains what each visual element means. It should NOT change between states.",
            "how": "The renderDomainLegend function takes NO state parameter - it draws the same legend every time.",
            "what_to_include": "All object TYPES in the domain, not specific instances. E.g., 'Depot' not 'd1, d2'."
        },
        "matching_visuals_explanation": {
            "why": "Users need to match legend icons to objects in the visualization.",
            "how": "If you draw depots as gray rectangles in the main render, draw a small gray rectangle in the legend.",
            "example": "If trucks are blue with wheels, the legend should show a small blue rectangle (simplified truck)."
        },
        "example_code": '''function renderDomainLegend(ctx, x, y) {
  // NOTE: No state parameter! Legend is CONSISTENT across all states.
  const boxWidth = 140;
  const boxHeight = 140;  // Adjust based on number of object types
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
  
  // IMPORTANT: Use the SAME colors as in the main render function!
  
  // Item 1: Depot (gray - matches main visualization)
  ctx.fillStyle = '#A9A9A9';  // Same gray as depot in main render
  ctx.fillRect(x + padding, itemY, iconSize, iconSize);
  ctx.fillStyle = '#333';
  ctx.font = '10px Arial';
  ctx.fillText('Depot', x + padding + iconSize + 8, itemY + 11);
  itemY += itemSpacing;
  
  // Item 2: Truck (blue - matches main visualization)
  ctx.fillStyle = '#00BFFF';  // Same blue as truck in main render
  ctx.fillRect(x + padding, itemY, iconSize, iconSize);
  ctx.fillStyle = '#333';
  ctx.fillText('Truck', x + padding + iconSize + 8, itemY + 11);
  itemY += itemSpacing;
  
  // Item 3: Crane/Hoist (pink - matches main visualization)
  ctx.fillStyle = '#FF69B4';  // Same pink as crane in main render
  ctx.fillRect(x + padding, itemY, iconSize, iconSize);
  ctx.fillStyle = '#333';
  ctx.fillText('Crane', x + padding + iconSize + 8, itemY + 11);
  itemY += itemSpacing;
  
  // Item 4: Package/Crate (yellow - matches main visualization)
  ctx.fillStyle = '#FFD700';  // Same yellow as package in main render
  ctx.fillRect(x + padding, itemY, iconSize, iconSize);
  ctx.fillStyle = '#333';
  ctx.fillText('Package', x + padding + iconSize + 8, itemY + 11);
  itemY += itemSpacing;
  
  // Item 5: Pile (brown - matches main visualization)
  ctx.fillStyle = '#8B4513';  // Same brown as pile in main render
  ctx.fillRect(x + padding, itemY, iconSize, iconSize);
  ctx.fillStyle = '#333';
  ctx.fillText('Pile', x + padding + iconSize + 8, itemY + 11);
}''',
        "common_mistakes": [
            "Reading state data in legend function - legend should be STATIC!",
            "Using different colors in legend than in main visualization",
            "Drawing full-sized objects in legend (e.g., 60x60 blocks)",
            "Making legend box too large",
            "Only showing some object types, not all",
            "Changing legend between states"
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


@mcp.tool(
    name="analyze_state_structure",
    description="""Analyze the state data structure to understand what objects and relations exist.

USE THIS TOOL FIRST before generating any code!
This tool examines the state data and tells you:
- What object types exist (e.g., truck, package, depot)
- What relation types exist (e.g., in-truck, on-pile, at-depot)
- How objects relate to each other
- What properties objects have

RETURNS: Detailed analysis of the state structure to guide your renderer design.""",
)
def analyze_state_structure(state_json: str) -> str:
    """Analyze the state data structure.
    
    Args:
        state_json: JSON string of the state data to analyze
    """
    try:
        state = json.loads(state_json)
    except json.JSONDecodeError:
        return json.dumps({"error": "Invalid JSON provided"})
    
    objects = state.get("objects", [])
    relations = state.get("relations", [])
    
    # Analyze object types
    object_types = {}
    for obj in objects:
        obj_type = obj.get("type", "unknown")
        if obj_type not in object_types:
            object_types[obj_type] = {
                "count": 0,
                "has_position": False,
                "properties": set(),
                "example_ids": []
            }
        object_types[obj_type]["count"] += 1
        if obj.get("position"):
            object_types[obj_type]["has_position"] = True
        if obj.get("properties"):
            object_types[obj_type]["properties"].update(obj["properties"].keys())
        if len(object_types[obj_type]["example_ids"]) < 3:
            object_types[obj_type]["example_ids"].append(obj.get("id", "?"))
    
    # Convert sets to lists for JSON
    for obj_type in object_types:
        object_types[obj_type]["properties"] = list(object_types[obj_type]["properties"])
    
    # Analyze relation types
    relation_types = {}
    for rel in relations:
        rel_type = rel.get("type", "unknown")
        if rel_type not in relation_types:
            relation_types[rel_type] = {
                "count": 0,
                "has_target": False,
                "source_types": set(),
                "target_types": set(),
                "examples": []
            }
        relation_types[rel_type]["count"] += 1
        if rel.get("target"):
            relation_types[rel_type]["has_target"] = True
        # Try to find source/target object types
        source_id = rel.get("source")
        target_id = rel.get("target")
        for obj in objects:
            if obj.get("id") == source_id:
                relation_types[rel_type]["source_types"].add(obj.get("type", "unknown"))
            if obj.get("id") == target_id:
                relation_types[rel_type]["target_types"].add(obj.get("type", "unknown"))
        if len(relation_types[rel_type]["examples"]) < 2:
            relation_types[rel_type]["examples"].append(f"{source_id} -> {target_id}")
    
    # Convert sets to lists for JSON
    for rel_type in relation_types:
        relation_types[rel_type]["source_types"] = list(relation_types[rel_type]["source_types"])
        relation_types[rel_type]["target_types"] = list(relation_types[rel_type]["target_types"])
    
    # Generate insights
    insights = []
    recommendations = []
    
    # Detect 'in' relations (containment)
    in_relations = [r for r in relation_types if "in" in r.lower() or "inside" in r.lower() or "contains" in r.lower()]
    if in_relations:
        insights.append(f"CONTAINMENT DETECTED: Found 'in' relations: {in_relations}")
        insights.append("Objects with 'in' relations should be drawn INSIDE their container.")
        insights.append("Containers should RESIZE dynamically based on number of contents.")
        recommendations.append("MUST USE get_spatial_relationship_guidelines for containment patterns")
    
    # Detect 'on' relations (stacking)
    on_relations = [r for r in relation_types if "on" in r.lower() or "stacked" in r.lower() or "above" in r.lower()]
    if on_relations:
        insights.append(f"STACKING DETECTED: Found 'on' relations: {on_relations}")
        insights.append("Objects with 'on' relations should be drawn ABOVE (vertically stacked on) their target.")
        insights.append("Multiple objects at same position with 'on' relations form a VERTICAL STACK, not overlap!")
        recommendations.append("MUST USE get_spatial_relationship_guidelines for stacking patterns")
    
    # Detect 'holding' relations
    holding_relations = [r for r in relation_types if "holding" in r.lower() or "held" in r.lower() or "carrying" in r.lower()]
    if holding_relations:
        insights.append(f"HOLDING DETECTED: Found holding relations: {holding_relations}")
        insights.append("Held objects should be drawn near/attached to their holder (e.g., crane gripper).")
        insights.append("IMPORTANT: When a crane is holding a package, draw the package VISIBLE near the crane!")
        recommendations.append("MUST USE get_spatial_relationship_guidelines for held object positioning")
    
    # Detect 'in-truck' relations (packages inside trucks)
    in_truck_relations = [r for r in relation_types if "in-truck" in r.lower() or "in_truck" in r.lower()]
    if in_truck_relations:
        insights.append(f"IN-TRUCK DETECTED: Found in-truck relations: {in_truck_relations}")
        insights.append("IMPORTANT: Packages in trucks should be drawn ON/INSIDE the truck, NOT invisible!")
        insights.append("Draw the package on the truck bed so it's visible to the user.")
    
    # Detect 'at' location relations (at-pile, at-crane, at-truck, at-depot, etc.)
    at_relations = [r for r in relation_types if r.lower().startswith("at") or r.lower().startswith("at-")]
    if at_relations:
        insights.append(f"LOCATION RELATIONS DETECTED: Found 'at' relations: {at_relations}")
        insights.append("CRITICAL: Objects with 'at-X' relations should be drawn AT the location of their target!")
        insights.append("CRITICAL: Each pile/crane belongs to ONE specific depot - do NOT draw them at all depots!")
        
        # Build and show actual location mappings from the state
        location_map = {}
        for rel in relations:
            rel_type = rel.get("type", "").lower()
            if rel_type.startswith("at-") or rel_type == "at":
                source = rel.get("source")
                target = rel.get("target")
                if source and target:
                    location_map[source] = target
        
        if location_map:
            insights.append(f"ACTUAL LOCATION MAPPINGS: {location_map}")
            # Group by location
            by_location = {}
            for obj, loc in location_map.items():
                if loc not in by_location:
                    by_location[loc] = []
                by_location[loc].append(obj)
            for loc, objs in by_location.items():
                insights.append(f"  At {loc}: {objs}")
        
        insights.append("WORKFLOW: 1) Build location map from at-X relations, 2) Draw each depot, 3) Draw objects ONLY at their assigned depot")
        recommendations.append("MUST USE get_spatial_relationship_guidelines for location-based positioning")
    
    # Check for position data
    positioned_types = [t for t, info in object_types.items() if info["has_position"]]
    if positioned_types:
        insights.append(f"Objects with positions: {positioned_types}. Use state.objects[].position for base locations.")
    
    non_positioned = [t for t, info in object_types.items() if not info["has_position"]]
    if non_positioned:
        insights.append(f"Objects WITHOUT positions: {non_positioned}. Position these based on their relations!")
    
    # Warn about same-position objects
    if in_relations or on_relations:
        insights.append("WARNING: Objects at the same logical position are NOT overlapping!")
        insights.append("Use relations to determine spatial arrangement (inside, stacked above, etc.)")
    
    # Add standard recommendations
    recommendations.extend([
        "Use get_state_handling_guidelines for dynamic state handling",
        "Use get_legend_guidelines when creating the legend function",
        "Always iterate over state.objects - never hardcode positions"
    ])
    
    return json.dumps({
        "analysis": "State structure analysis complete",
        "object_types": object_types,
        "relation_types": relation_types,
        "insights": insights,
        "recommendations": recommendations
    }, indent=2)


@mcp.tool(
    name="get_spatial_relationship_guidelines",
    description="""Get guidelines for handling spatial relationships: 'in' (containment), 'on' (stacking), and 'at' (location).

USE THIS TOOL WHEN: You see relations like 'in', 'on', 'at-pile', 'at-crane', 'at-truck', 'holding', 'contains', or similar.
This tool teaches you how to:
- Draw containers that RESIZE based on number of contents
- Draw contained objects INSIDE their container
- Stack objects VERTICALLY when one is 'on' another
- Position objects AT their location based on 'at-X' relations
- Handle multiple objects at the same logical position

RETURNS: Code patterns for containment, stacking, and location-based positioning.""",
)
def get_spatial_relationship_guidelines() -> str:
    """Get guidelines for handling spatial relationships."""
    return json.dumps({
        "description": "Guidelines for handling 'in' (containment), 'on' (stacking), and 'at' (location) relationships",
        "overview": {
            "in_relations": "When A is 'in' B, A should be drawn INSIDE B. B is the container and should resize based on contents.",
            "on_relations": "When A is 'on' B, A should be drawn ABOVE B (vertically stacked). Build stacks from bottom to top.",
            "at_relations": "When A 'at-X' B, A should be drawn AT B's location. Example: 'pile1 at-pile d1' means pile1 is at depot d1.",
            "key_insight": "Objects at the same logical position are NOT overlapping - they have spatial relationships that determine their visual arrangement!"
        },
        "critical_rules": [
            "NEVER draw objects on top of each other - use relations to determine arrangement",
            "'in' relation = draw INSIDE container, container RESIZES to fit contents",
            "'on' relation = draw ABOVE the target, stack VERTICALLY with Y offset",
            "Build containment/stacking maps FIRST, then draw in correct order",
            "Draw containers/bases FIRST, then their contents/stacked objects"
        ],
        "containment_pattern": {
            "description": "For 'in' relations: container with dynamic sizing, contents drawn inside",
            "code": '''// CONTAINMENT: Objects 'in' a container
function renderContainment(ctx, state) {
  // Step 1: Build containment map
  const containedIn = new Map(); // objectId -> containerId
  const containerContents = new Map(); // containerId -> [objectIds]
  
  for (const rel of state.relations) {
    if (rel.type.includes('in') || rel.type === 'inside' || rel.type === 'contains') {
      // rel.source is IN rel.target (or target CONTAINS source)
      const containedId = rel.source;
      const containerId = rel.target;
      
      containedIn.set(containedId, containerId);
      if (!containerContents.has(containerId)) {
        containerContents.set(containerId, []);
      }
      containerContents.get(containerId).push(containedId);
    }
  }
  
  // Step 2: Draw containers with dynamic sizing
  const containers = state.objects.filter(o => containerContents.has(o.id));
  
  for (const container of containers) {
    const contents = containerContents.get(container.id) || [];
    const contentObjects = contents.map(id => state.objects.find(o => o.id === id)).filter(Boolean);
    
    // Dynamic sizing based on contents
    const baseWidth = 80;
    const baseHeight = 60;
    const itemWidth = 30;
    const itemHeight = 25;
    const padding = 10;
    
    const width = Math.max(baseWidth, contentObjects.length * (itemWidth + 5) + padding * 2);
    const height = baseHeight;
    
    const [x, y] = container.position || [0, 0];
    const pixelX = x * gridSize;
    const pixelY = y * gridSize;
    
    // Draw container
    ctx.fillStyle = '#666';
    ctx.fillRect(pixelX, pixelY, width, height);
    ctx.strokeStyle = '#333';
    ctx.strokeRect(pixelX, pixelY, width, height);
    
    // Draw contents INSIDE container
    contentObjects.forEach((item, index) => {
      const itemX = pixelX + padding + index * (itemWidth + 5);
      const itemY = pixelY + padding + (height - itemHeight - padding * 2) / 2;
      drawSmallObject(ctx, item, itemX, itemY, itemWidth, itemHeight);
    });
  }
  
  // Step 3: Draw non-contained objects at their own positions
  const freeObjects = state.objects.filter(o => !containedIn.has(o.id) && !containerContents.has(o.id));
  for (const obj of freeObjects) {
    const [x, y] = obj.position || [0, 0];
    drawObject(ctx, obj, x * gridSize, y * gridSize);
  }
}'''
        },
        "stacking_pattern": {
            "description": "For 'on' relations: vertical stacking with Y offset",
            "code": '''// STACKING: Objects 'on' other objects (like blocks, packages on piles)
function renderStacking(ctx, state) {
  // Step 1: Build stacking relationships
  const onTop = new Map(); // objectId -> whatItIsOn
  const stackedOn = new Map(); // baseId -> [objectsOnTop]
  
  for (const rel of state.relations) {
    if (rel.type.includes('on') || rel.type === 'stacked' || rel.type === 'above') {
      // rel.source is ON rel.target
      const topId = rel.source;
      const bottomId = rel.target;
      
      onTop.set(topId, bottomId);
      if (!stackedOn.has(bottomId)) {
        stackedOn.set(bottomId, []);
      }
      stackedOn.get(bottomId).push(topId);
    }
  }
  
  // Step 2: Find base objects (things that aren't on anything, or are on fixed surfaces)
  const bases = state.objects.filter(o => !onTop.has(o.id));
  
  // Step 3: Build complete stacks from bottom to top
  function getStackHeight(objId, visited = new Set()) {
    if (visited.has(objId)) return 0; // Prevent cycles
    visited.add(objId);
    
    const objectsOnThis = stackedOn.get(objId) || [];
    if (objectsOnThis.length === 0) return 1;
    
    return 1 + Math.max(...objectsOnThis.map(id => getStackHeight(id, visited)));
  }
  
  // Step 4: Draw stacks - bottom to top
  const objectHeight = 30;
  const objectWidth = 40;
  const stackSpacing = 5;
  
  function drawStack(baseObj, baseX, baseY) {
    // Draw the base object
    drawObject(ctx, baseObj, baseX, baseY, objectWidth, objectHeight);
    
    // Draw objects stacked on this one
    const objectsOnBase = stackedOn.get(baseObj.id) || [];
    objectsOnBase.forEach((objId, index) => {
      const obj = state.objects.find(o => o.id === objId);
      if (obj) {
        // Stack ABOVE (lower Y value since Y increases downward)
        const stackY = baseY - (objectHeight + stackSpacing);
        // If multiple objects on same base, offset horizontally
        const offsetX = index * (objectWidth + 5);
        drawStack(obj, baseX + offsetX, stackY);
      }
    });
  }
  
  // Draw each base and its stack
  bases.forEach((base, index) => {
    const [x, y] = base.position || [index, 0];
    const pixelX = x * gridSize;
    const pixelY = y * gridSize;
    drawStack(base, pixelX, pixelY);
  });
}'''
        },
        "combined_pattern": {
            "description": "Handling both 'in' and 'on' relations together",
            "code": '''// COMBINED: Handle both containment and stacking
function renderWithRelationships(ctx, state) {
  // Build relationship maps
  const containedIn = new Map();
  const onTopOf = new Map();
  const heldBy = new Map();
  
  for (const rel of state.relations) {
    const relType = rel.type.toLowerCase();
    
    if (relType.includes('in') || relType.includes('inside')) {
      containedIn.set(rel.source, rel.target);
    } else if (relType.includes('on') || relType.includes('stacked')) {
      onTopOf.set(rel.source, rel.target);
    } else if (relType.includes('holding') || relType.includes('held')) {
      heldBy.set(rel.source, rel.target);
    }
  }
  
  // Determine draw order: containers first, then bases, then stacked/contained
  const drawn = new Set();
  
  // Draw containers and their contents
  // Draw bases and their stacks
  // Draw held objects near their holders
  // Draw free objects at their positions
}'''
        },
        "location_pattern": {
            "description": "For 'at-X' relations: position objects at their location's coordinates",
            "code": '''// LOCATION: Objects 'at' a location (at-pile, at-crane, at-truck)
function renderWithLocations(ctx, state) {
  // Step 1: Build location maps from 'at-X' relations
  const objectLocation = new Map(); // objectId -> locationId
  const locationObjects = new Map(); // locationId -> {piles: [], cranes: [], trucks: [], packages: []}
  
  for (const rel of state.relations) {
    const relType = rel.type.toLowerCase();
    
    // Handle 'at-pile', 'at-crane', 'at-truck', 'at' relations
    if (relType.startsWith('at-') || relType === 'at') {
      const objectId = rel.source;  // The object that is AT somewhere
      const locationId = rel.target; // The location (usually a depot)
      
      objectLocation.set(objectId, locationId);
      
      if (!locationObjects.has(locationId)) {
        locationObjects.set(locationId, { piles: [], cranes: [], trucks: [], packages: [] });
      }
      
      // Categorize by relation type
      const obj = state.objects.find(o => o.id === objectId);
      if (obj) {
        if (relType === 'at-pile') locationObjects.get(locationId).piles.push(obj);
        else if (relType === 'at-crane') locationObjects.get(locationId).cranes.push(obj);
        else if (relType === 'at-truck') locationObjects.get(locationId).trucks.push(obj);
        else if (relType === 'at') locationObjects.get(locationId).packages.push(obj);
      }
    }
  }
  
  // Step 2: Draw locations (depots) first, then objects AT each location
  const locations = state.objects.filter(o => o.type === 'depot' || o.type === 'location');
  
  for (const location of locations) {
    const [x, y] = location.position || [0, 0];
    const pixelX = x * gridSize;
    const pixelY = y * gridSize;
    
    // Draw the depot/location
    drawDepot(ctx, location, pixelX, pixelY);
    
    // Get objects at this location
    const atThisLocation = locationObjects.get(location.id) || { piles: [], cranes: [], trucks: [], packages: [] };
    
    // Draw cranes at this location (e.g., top of depot)
    atThisLocation.cranes.forEach((crane, index) => {
      const craneX = pixelX + 20 + index * 40;
      const craneY = pixelY - 30; // Above depot
      drawCrane(ctx, crane, craneX, craneY);
    });
    
    // Draw piles at this location (e.g., inside depot)
    atThisLocation.piles.forEach((pile, index) => {
      const pileX = pixelX + 30 + index * 60;
      const pileY = pixelY + 80; // Inside depot
      drawPile(ctx, pile, pileX, pileY);
    });
    
    // Draw trucks at this location (e.g., outside depot)
    atThisLocation.trucks.forEach((truck, index) => {
      const truckX = pixelX + 100 + index * 80;
      const truckY = pixelY + 120; // Below depot
      drawTruck(ctx, truck, truckX, truckY);
    });
  }
}

// IMPORTANT: Combine with 'on' relations for stacking!
// Example: If 'p1 on p2' and 'p2 on-pile pile1' and 'pile1 at-pile d1'
// Then: Draw d1 depot, draw pile1 at d1, draw p2 on pile1, draw p1 on p2
function getObjectDrawPosition(objId, state, objectLocation, drawnPositions) {
  // Check if object is ON something
  const onRel = state.relations.find(r => 
    (r.type === 'on' || r.type === 'on-pile') && r.source === objId
  );
  
  if (onRel) {
    // Object is on something - get that thing's position first
    const basePos = getObjectDrawPosition(onRel.target, state, objectLocation, drawnPositions);
    return { x: basePos.x, y: basePos.y - objectHeight }; // Stack above
  }
  
  // Check if object is AT a location
  const locationId = objectLocation.get(objId);
  if (locationId) {
    const location = state.objects.find(o => o.id === locationId);
    if (location && location.position) {
      const [lx, ly] = location.position;
      return { x: lx * gridSize + offset, y: ly * gridSize + offset };
    }
  }
  
  // Fallback to object's own position
  const obj = state.objects.find(o => o.id === objId);
  if (obj && obj.position) {
    const [x, y] = obj.position;
    return { x: x * gridSize, y: y * gridSize };
  }
  
  return { x: 0, y: 0 };
}'''
        },
        "common_mistakes": [
            "Drawing objects at their raw position without checking 'at-X' relations",
            "Drawing objects at their raw position without checking 'on'/'in' relations",
            "Not building relationship maps before drawing",
            "Fixed container sizes that don't adapt to contents",
            "Drawing stacked objects at same Y position instead of offset",
            "Drawing contained objects outside their container bounds",
            "Not handling the draw order (base before stack, container before contents)",
            "Ignoring 'at-pile', 'at-crane', 'at-truck' relations and drawing objects at wrong depot",
            "Drawing pile1 at d2 when 'pile1 at-pile d1' says it should be at d1"
        ],
        "key_insight": "The position property gives the LOGICAL location. Relations tell you the SPATIAL arrangement at that location! 'at-X' relations tell you WHICH location an object belongs to!"
    })


if __name__ == "__main__":
    mcp.run(transport="stdio")
