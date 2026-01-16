"""
MCP Server for Planning Visualizer
Exposes tools and resources for generating JavaScript renderers.

Simplified Architecture:
- Resources: Versioned prompts
- Tools: Only 2 tools for efficient generation
  1. get_generation_context - Combined state analysis + domain hints
  2. validate_renderer - Syntax validation
"""

import os
import json
import re
import subprocess
import tempfile
from pathlib import Path
from pydantic import Field
from typing import Union, Optional, Any
from mcp.server.fastmcp import FastMCP

# Create the MCP server
mcp = FastMCP("PlanningVisualizerMCP", log_level="ERROR")

# Directory containing versioned prompts
PROMPTS_DIR = Path(__file__).parent / "prompts"

# Directory containing example renderer
EXAMPLES_DIR = Path(__file__).parent / "examples"


# =============================================================================
# MCP RESOURCES - Data that LLM can read to understand context
# =============================================================================

@mcp.resource("prompt://renderer/system/{version}")
def get_system_prompt_resource(version: str) -> str:
    """
    Fetch a versioned system prompt for renderer generation.
    
    URI: prompt://renderer/system/v1
    """
    prompt_path = PROMPTS_DIR / version / "system_prompt.txt"
    if not prompt_path.exists():
        available = [d.name for d in PROMPTS_DIR.iterdir() if d.is_dir()]
        raise ValueError(f"Prompt version '{version}' not found. Available: {available}")
    with open(prompt_path, "r") as f:
        return f.read()


# =============================================================================
# DOMAIN HINTS DATABASE
# =============================================================================

DOMAIN_HINTS = {
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
            "at-crane": "c1 at-crane d1 means hoist c1 belongs to depot d1 ONLY",
            "at-truck": "t1 at-truck d1 means truck t1 is currently at depot d1",
            "on-pile": "p1 on-pile pile1 means crate p1 is on pile1 - draw it stacked on the pile",
            "on": "p1 on p2 means crate p1 is stacked on crate p2 - draw vertically stacked",
            "in-truck": "p1 in-truck t1 means crate p1 is INSIDE the truck - draw it ON the truck bed!",
            "holding": "c1 holding p1 means hoist c1 is holding crate p1 - draw p1 attached to hoist gripper!"
        },
        "positioning_rules": [
            "EACH pile belongs to ONE depot via at-pile - check the relation!",
            "EACH hoist belongs to ONE depot via at-crane - check the relation!",
            "When crate is in-truck, draw it INSIDE/ON the truck, not invisible!",
            "When hoist is holding a crate, draw the crate near the hoist gripper!",
            "Build location maps FIRST: pileAtDepot, craneAtDepot, truckAtDepot"
        ],
        "code_pattern": """// DEPOT: Build location maps from at-X relations
const pileAtDepot = new Map();
const craneAtDepot = new Map();
const truckAtDepot = new Map();

for (const rel of state.relations) {
  if (rel.type === 'at-pile') pileAtDepot.set(rel.source, rel.target);
  if (rel.type === 'at-crane') craneAtDepot.set(rel.source, rel.target);
  if (rel.type === 'at-truck') truckAtDepot.set(rel.source, rel.target);
}

// Draw each depot, then draw ONLY objects that belong to THAT depot
for (const depot of depots) {
  const [dx, dy] = depot.position;
  drawDepot(ctx, depot, dx, dy);
  
  // Get objects at THIS depot
  const pilesHere = piles.filter(p => pileAtDepot.get(p.id) === depot.id);
  const cranesHere = cranes.filter(c => craneAtDepot.get(c.id) === depot.id);
  const trucksHere = trucks.filter(t => truckAtDepot.get(t.id) === depot.id);
  
  // Draw them at this depot's location
  pilesHere.forEach((pile, i) => drawPile(ctx, pile, dx + 20 + i*60, dy + 50));
  cranesHere.forEach(crane => drawCrane(ctx, crane, dx + 50, dy - 30));
  trucksHere.forEach(truck => drawTruck(ctx, truck, dx + 100, dy + 80));
}"""
    },
}


# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def _analyze_state(state: dict) -> dict:
    """Analyze state structure and detect relations."""
    objects = state.get("objects", [])
    relations = state.get("relations", [])
    
    # Analyze object types
    object_types = {}
    for obj in objects:
        obj_type = obj.get("type", "unknown")
        if obj_type not in object_types:
            object_types[obj_type] = {"count": 0, "has_position": False, "example_ids": []}
        object_types[obj_type]["count"] += 1
        if obj.get("position"):
            object_types[obj_type]["has_position"] = True
        if len(object_types[obj_type]["example_ids"]) < 3:
            object_types[obj_type]["example_ids"].append(obj.get("id", "?"))
    
    # Analyze relation types
    relation_types = {}
    for rel in relations:
        rel_type = rel.get("type", "unknown")
        if rel_type not in relation_types:
            relation_types[rel_type] = {"count": 0, "examples": []}
        relation_types[rel_type]["count"] += 1
        if len(relation_types[rel_type]["examples"]) < 2:
            relation_types[rel_type]["examples"].append(f"{rel.get('source')} -> {rel.get('target')}")
    
    # Generate insights based on detected relations
    insights = []
    
    # Detect containment ('in' relations)
    in_relations = [r for r in relation_types if "in" in r.lower()]
    if in_relations:
        insights.append(f"CONTAINMENT: Found 'in' relations {in_relations}. Draw contained objects INSIDE their container.")
    
    # Detect stacking ('on' relations)
    on_relations = [r for r in relation_types if "on" in r.lower()]
    if on_relations:
        insights.append(f"STACKING: Found 'on' relations {on_relations}. Draw objects ABOVE (vertically stacked on) their target.")
    
    # Detect location ('at' relations)
    at_relations = [r for r in relation_types if r.lower().startswith("at")]
    if at_relations:
        # Build location map
        location_map = {}
        for rel in relations:
            if rel.get("type", "").lower().startswith("at"):
                location_map[rel.get("source")] = rel.get("target")
        
        insights.append(f"LOCATIONS: Found 'at' relations {at_relations}.")
        insights.append(f"LOCATION MAP: {location_map}")
        insights.append("CRITICAL: Draw each object ONLY at its assigned location!")
    
    # Detect holding
    holding_relations = [r for r in relation_types if "holding" in r.lower()]
    if holding_relations:
        insights.append(f"HOLDING: Found holding relations {holding_relations}. Draw held objects near the holder!")
    
    return {
        "object_types": object_types,
        "relation_types": relation_types,
        "insights": insights
    }


def _get_domain_hints(domain_name: str) -> dict:
    """Get domain-specific hints."""
    domain_key = domain_name.lower().replace(" ", "-").replace("_", "-")
    domain_key_underscore = domain_name.lower().replace(" ", "_").replace("-", "_")
    
    if domain_key in DOMAIN_HINTS:
        return {"found": True, "hints": DOMAIN_HINTS[domain_key]}
    elif domain_key_underscore in DOMAIN_HINTS:
        return {"found": True, "hints": DOMAIN_HINTS[domain_key_underscore]}
    else:
        return {
            "found": False,
            "hints": {
                "description": "Unknown domain - analyze the state structure to determine visualization",
                "layout": "Arrange objects based on their relations and positions",
                "background": "Use a subtle gradient or pattern appropriate to the domain theme",
                "legend": "Show all object types with their colors and any important states"
            }
        }


# =============================================================================
# MCP TOOLS - Only 2 tools for efficient generation
# =============================================================================

@mcp.tool(
    name="get_generation_context",
    description="""Get ALL context needed to generate a renderer in ONE call.

CALL THIS TOOL FIRST before generating any code!

This tool combines:
1. State structure analysis (object types, relation types, insights)
2. Domain-specific hints (styling, layout, critical relations)

RETURNS: Complete context including:
- object_types: What objects exist and their properties
- relation_types: What relations exist (in, on, at-*, holding, etc.)
- insights: How to handle the detected relations
- domain_hints: Styling and layout suggestions for this domain

After calling this tool, you have everything needed to generate the renderer.""",
)
def get_generation_context(
    state_json: Any = Field(description="The example state data (can be JSON string or object)"),
    domain_name: str = Field(description="Name of the planning domain (e.g., 'depot', 'blocks_world')"),
) -> str:
    """Get all context needed for renderer generation."""
    try:
        # Validate required parameters - handle None, empty dict, empty string
        if state_json is None or state_json == "" or state_json == {}:
            return json.dumps({
                "success": False,
                "error": "MISSING PARAMETER: state_json is required. Pass the example state data (as JSON object or string)."
            })
        if not domain_name or domain_name == "":
            return json.dumps({
                "success": False,
                "error": "MISSING PARAMETER: domain_name is required. Pass the domain name (e.g., 'depot', 'rovers')."
            })
        
        # Parse state - accept both dict and string
        if isinstance(state_json, dict):
            state = state_json
        elif isinstance(state_json, str):
            state = json.loads(state_json)
        else:
            return json.dumps({
                "success": False,
                "error": f"INVALID PARAMETER: state_json must be a JSON object or string, got {type(state_json).__name__}"
            })
        
        # Analyze state structure
        state_analysis = _analyze_state(state)
        
        # Get domain hints
        domain_hints = _get_domain_hints(domain_name)
        
       
        
        return json.dumps({
            "success": True,
            "state_analysis": state_analysis,
            "domain_hints": domain_hints,
            "next_step": "Now generate the complete JavaScript renderer code using this context."
        }, indent=2)
        
    except Exception as e:
        return json.dumps({
            "success": False,
            "error": str(e)
        })


@mcp.tool(
    name="validate_renderer",
    description="""Validate JavaScript renderer code for syntax errors and required functions.

CALL THIS TOOL AFTER generating code to check for errors.

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
    # Validate required parameters
    if not code or code == "":
        return json.dumps({
            "valid": False,
            "errors": ["MISSING PARAMETER: code is required. Pass the JavaScript code to validate."],
            "warnings": []
        })
    if not domain_name or domain_name == "":
        return json.dumps({
            "valid": False,
            "errors": ["MISSING PARAMETER: domain_name is required. Pass the domain name (e.g., 'depot', 'rovers')."],
            "warnings": []
        })
    
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
    
    # Background is optional
    if bg_func not in code:
        warnings.append(f"No background function (optional): {bg_func}")
    
    if "ctx" not in code:
        errors.append("Missing 'ctx' parameter - renderer needs canvas context")
    
    # Check for trailing non-code text
    last_brace = code.rfind('}')
    if last_brace != -1 and last_brace < len(code) - 10:
        trailing = code[last_brace + 1:].strip()
        if trailing and not trailing.startswith('//') and not trailing.startswith('/*'):
            if len(trailing) > 20 and not any(c in trailing[:50] for c in ['{', '}', '(', ')', ';', '=']):
                errors.append("Trailing non-code text detected after last function. Remove explanatory text.")
    
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


if __name__ == "__main__":
    mcp.run(transport="stdio")
