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


# Directory containing domain hints
DOMAIN_HINTS_DIR = Path(__file__).parent / "domain_hints"


@mcp.resource("domain://hints/index")
def get_domain_hints_index() -> str:
    """
    Get the index of all available domain hints.
    
    URI: domain://hints/index
    
    Returns a list of available domains with their aliases.
    Use this to find if hints exist for a specific domain.
    """
    index_path = DOMAIN_HINTS_DIR / "index.json"
    if not index_path.exists():
        return json.dumps({"error": "Domain hints index not found", "domains": []})
    with open(index_path, "r") as f:
        return f.read()


@mcp.resource("domain://hints/{domain_name}")
def get_domain_hints_resource(domain_name: str) -> str:
    """
    Get visualization hints for a specific planning domain.
    
    URI: domain://hints/depot, domain://hints/blocks-world, etc.
    
    Returns domain-specific hints including:
    - description: What the domain is about
    - layout: How to arrange visual elements
    - background: Suggested background style
    - legend: What to show in the legend
    - critical_relations: How to interpret key relations
    - positioning_rules: Rules for placing objects
    - code_pattern: Example code patterns (if available)
    """
    # Normalize domain name
    domain_name = domain_name.strip().lower().replace("_", "-")
    
    # Try direct match first
    hints_path = DOMAIN_HINTS_DIR / f"{domain_name}.json"
    if hints_path.exists():
        with open(hints_path, "r") as f:
            return f.read()
    
    # Try to find by alias
    index_path = DOMAIN_HINTS_DIR / "index.json"
    if index_path.exists():
        with open(index_path, "r") as f:
            index = json.load(f)
            for domain in index.get("domains", []):
                if domain_name in domain.get("aliases", []):
                    alias_path = DOMAIN_HINTS_DIR / domain["file"]
                    if alias_path.exists():
                        with open(alias_path, "r") as hf:
                            return hf.read()
    
    return json.dumps({
        "error": f"No hints found for domain '{domain_name}'",
        "suggestion": "Generate visualization based on state analysis alone"
    })


# =============================================================================
# DOMAIN HINTS DATABASE (kept for backward compatibility)
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
    
    # Detect containment ('in' or 'at' relations - both indicate object belongs to/is inside another)
    # Exclude 'holding' from 'in' detection as it's handled separately
    in_relations = [r for r in relation_types if "in" in r.lower() and "holding" not in r.lower()]
    at_relations = [r for r in relation_types if (r.lower().startswith("at") or "-at" in r.lower()) and "holding" not in r.lower()]
    containment_relations = list(set(in_relations + at_relations))
    
    if containment_relations:
        # Build containment/location map
        location_map = {}
        for rel in relations:
            rel_type = rel.get("type", "").lower()
            # Exclude holding relations from location map
            if "holding" in rel_type:
                continue
            if "in" in rel_type or rel_type.startswith("at") or "-at" in rel_type:
                location_map[rel.get("source")] = rel.get("target")
        
        insights.append(f"CONTAINMENT/LOCATION: Found relations {containment_relations} that indicate object placement.")
        insights.append(f"LOCATION MAP: {location_map}")
        insights.append("CRITICAL: Draw each object ONLY at its assigned location/container!")
        insights.append("TIP: Both 'at-X' and 'in-X' relations mean the source object belongs to/is at the target.")
    
    # Detect stacking ('on' relations)
    on_relations = [r for r in relation_types if "on" in r.lower() and "in" not in r.lower()]
    if on_relations:
        insights.append(f"STACKING: Found 'on' relations {on_relations}. Draw objects ABOVE (vertically stacked on) their target.")
    
    # Detect holding (explicit 'holding' relation)
    holding_relations = [r for r in relation_types if "holding" in r.lower()]
    if holding_relations:
        # Build holding map
        holding_map = {}
        for rel in relations:
            if "holding" in rel.get("type", "").lower():
                holding_map[rel.get("source")] = rel.get("target")
        insights.append(f"HOLDING: Found holding relations {holding_relations}.")
        insights.append(f"HOLDING MAP: {holding_map}")
        insights.append("CRITICAL: Draw held objects ATTACHED to the holder (e.g., near gripper/crane arm)!")
    
    return {
        "object_types": object_types,
        "relation_types": relation_types,
        "insights": insights
    }


def _get_domain_hints(domain_name: str) -> dict:
    """Get domain-specific hints from dictionary or resource files."""
    # Normalize domain name
    domain_name = domain_name.strip() if domain_name else ""
    domain_key = domain_name.lower().replace(" ", "-").replace("_", "-")
    domain_key_underscore = domain_name.lower().replace(" ", "_").replace("-", "_")
    
    # Try dictionary first (backward compatibility)
    if domain_key in DOMAIN_HINTS:
        return {"found": True, "source": "dictionary", "hints": DOMAIN_HINTS[domain_key]}
    elif domain_key_underscore in DOMAIN_HINTS:
        return {"found": True, "source": "dictionary", "hints": DOMAIN_HINTS[domain_key_underscore]}
    
    # Try resource files
    hints_path = DOMAIN_HINTS_DIR / f"{domain_key}.json"
    if hints_path.exists():
        try:
            with open(hints_path, "r") as f:
                hints = json.load(f)
                return {"found": True, "source": "resource_file", "hints": hints}
        except Exception as e:
            pass
    
    # Try aliases in index
    index_path = DOMAIN_HINTS_DIR / "index.json"
    if index_path.exists():
        try:
            with open(index_path, "r") as f:
                index = json.load(f)
                for domain in index.get("domains", []):
                    if domain_key in domain.get("aliases", []) or domain_key_underscore in domain.get("aliases", []):
                        alias_path = DOMAIN_HINTS_DIR / domain["file"]
                        if alias_path.exists():
                            with open(alias_path, "r") as hf:
                                hints = json.load(hf)
                                return {"found": True, "source": "resource_file", "hints": hints}
        except Exception as e:
            pass
    
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
3. Action context analysis (detects implicit states like 'holding' from action names)

RETURNS: Complete context including:
- object_types: What objects exist and their properties
- relation_types: What relations exist (in, on, at-*, holding, etc.)
- insights: How to handle the detected relations
- domain_hints: Styling and layout suggestions for this domain
- action_insights: Implicit states detected from action context

After calling this tool, you have everything needed to generate the renderer.""",
)
def get_generation_context(
    state_json: Any = Field(description="The example state data (can be JSON string or object)"),
    domain_name: str = Field(description="Name of the planning domain (e.g., 'depot', 'blocks_world')"),
    action_context: Optional[str] = Field(default=None, description="Optional: Current action being visualized (e.g., 'lift hoist1 crate1 surface1 depot1'). Helps detect implicit states like 'holding'."),
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
        
        # Analyze action context for implicit states and visual feedback
        action_insights = []
        visual_feedback_suggestions = []
        
        # Check if action_context is a valid string (not None, not empty, not FieldInfo)
        if action_context and isinstance(action_context, str) and action_context.strip():
            action_lower = action_context.lower()
            
            # === MOVEMENT ACTIONS ===
            # Detect lift/unstack actions that imply holding
            if any(word in action_lower for word in ["lift", "unstack", "pick-up", "pickup", "grab"]):
                action_insights.append("IMPLICIT HOLDING: This action implies an object is being held/lifted.")
                action_insights.append("TIP: After lift/unstack, the object should be shown attached to the hoist/gripper, not on any surface.")
            
            # Detect drop/stack actions that imply releasing
            if any(word in action_lower for word in ["drop", "stack", "put-down", "putdown", "release"]):
                action_insights.append("IMPLICIT RELEASE: This action implies an object is being placed down.")
            
            # Detect load/unload for trucks
            if "load" in action_lower:
                action_insights.append("LOADING: Object is being moved into a vehicle/container.")
                action_insights.append("TIP: Show the object INSIDE the truck/container after loading.")
            if "unload" in action_lower:
                action_insights.append("UNLOADING: Object is being moved out of a vehicle/container.")
            
            # Detect navigation/movement
            if any(word in action_lower for word in ["move", "drive", "navigate", "travel", "go", "walk"]):
                action_insights.append("MOVEMENT: Object is changing location.")
            
            # === NON-MOVEMENT ACTIONS (need visual feedback!) ===
            # Calibration actions
            if any(word in action_lower for word in ["calibrate", "calibration", "align"]):
                visual_feedback_suggestions.append("CALIBRATE ACTION: Draw crosshair/alignment marks on the calibrated instrument.")
                visual_feedback_suggestions.append("TIP: Add a 'CAL' badge or green checkmark to show calibration complete.")
            
            # Image/photo actions
            if any(word in action_lower for word in ["take-image", "take_image", "photograph", "capture", "image", "photo", "picture"]):
                visual_feedback_suggestions.append("IMAGE ACTION: Draw a camera flash effect or camera icon near the target.")
                visual_feedback_suggestions.append("TIP: Add an 'IMG' badge or camera emoji (📷) on photographed objects.")
            
            # Communication/transmission actions
            if any(word in action_lower for word in ["communicate", "transmit", "send", "broadcast", "relay"]):
                visual_feedback_suggestions.append("COMMUNICATE ACTION: Draw transmission waves or a data link line.")
                visual_feedback_suggestions.append("TIP: Add a 'TX' badge or antenna icon, draw curved lines emanating from transmitter.")
            
            # Sample collection actions
            if any(word in action_lower for word in ["sample", "collect", "gather", "extract", "drill"]):
                visual_feedback_suggestions.append("SAMPLE ACTION: Draw a sample container or collection indicator.")
                visual_feedback_suggestions.append("TIP: Add a sample vial icon or counter badge showing samples collected.")
            
            # Power/activation actions
            if any(word in action_lower for word in ["power", "switch", "turn-on", "turn_on", "activate", "enable"]):
                visual_feedback_suggestions.append("POWER ACTION: Show the object glowing or with a power indicator.")
                visual_feedback_suggestions.append("TIP: Add a green LED dot or glow effect to powered-on objects.")
            
            # Analysis/processing actions
            if any(word in action_lower for word in ["analyze", "process", "compute", "scan"]):
                visual_feedback_suggestions.append("ANALYSIS ACTION: Show processing indicator or results badge.")
                visual_feedback_suggestions.append("TIP: Add a progress bar, spinning indicator, or 'DONE' checkmark.")
            
            # Pointing/aiming actions
            if any(word in action_lower for word in ["point", "aim", "turn", "rotate", "orient"]):
                visual_feedback_suggestions.append("POINTING ACTION: Draw an arrow or line showing the pointing direction.")
                visual_feedback_suggestions.append("TIP: Use a dashed line from the object to its target direction.")
        
        # Always add the critical reminder about visual feedback
        visual_feedback_reminder = [
            "CRITICAL: Every action MUST produce a visible change in the visualization!",
            "For non-movement actions (calibrate, take-image, communicate, etc.), use:",
            "  - Status badges (CAL, IMG, TX) on affected objects",
            "  - Color changes (glow, highlight) to show state changes",
            "  - Icons/symbols (camera, antenna, checkmark) near objects",
            "  - Visual effects (flash, waves, sparkles) during action",
            "Users watch the plan step-by-step - if nothing changes visually, they think it's broken!"
        ]
        
        return json.dumps({
            "success": True,
            "state_analysis": state_analysis,
            "domain_hints": domain_hints,
            "action_insights": action_insights,
            "visual_feedback_suggestions": visual_feedback_suggestions,
            "visual_feedback_reminder": visual_feedback_reminder,
            "next_step": "Now generate the complete JavaScript renderer code using this context. REMEMBER: Every action must have visible feedback!"
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
