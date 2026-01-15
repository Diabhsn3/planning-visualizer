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

USE THIS TOOL WHEN: You want styling suggestions (colors, layout, background) for a domain.

RETURNS: Hints about visual style, layout approach, background, and legend content.
For unknown domains, returns generic suggestions.""",
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

USE THIS TOOL WHEN: You have generated code and want to check if it's valid before returning it.

CHECKS:
- JavaScript syntax (using Node.js --check)
- Required functions: renderDomainName(ctx, state), renderDomainNameLegend(ctx, state)
- Optional function: renderDomainNameBackground(ctx, width, height)
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
    description="""Clean generated code by removing markdown formatting, TypeScript annotations, and conversational text.

USE THIS TOOL WHEN: Your generated code contains markdown code blocks (```), TypeScript types, or explanatory text before the actual code.

REMOVES:
- Markdown code block markers (```)
- TypeScript type annotations (: string, : number, etc.)
- TypeScript interfaces and type declarations
- 'as Type' casts
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


if __name__ == "__main__":
    mcp.run(transport="stdio")
