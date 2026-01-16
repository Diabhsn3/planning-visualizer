# MCP Architecture Deep Analysis

## Current Architecture Overview

### MCP Server Tools (11 tools total)

| Tool | Purpose | Typical Use |
|------|---------|-------------|
| `get_domain_rendered_data` | Get state data for a domain | Redundant - state already in user prompt |
| `list_available_domains` | List domains with data | Redundant - domain already known |
| `get_domain_hints` | Get styling hints | Useful for domain-specific styling |
| `prepare_generation_artifacts` | Format prompts | Never used - orchestrator does this |
| `validate_renderer` | Validate code syntax | Useful - catches errors |
| `clean_code` | Remove markdown/TS | Never used - orchestrator does this locally |
| `get_example_renderer` | Get blocks_world example | Useful - shows code patterns |
| `get_legend_guidelines` | Legend sizing rules | Redundant - covered in system prompt |
| `get_state_handling_guidelines` | State handling rules | Redundant - covered in system prompt |
| `analyze_state_structure` | Analyze state JSON | Useful - detects relations |
| `get_spatial_relationship_guidelines` | Containment/stacking patterns | Useful - complex code patterns |

### Current Flow (Typical 8+ iterations)

1. **Iteration 1**: LLM calls `analyze_state_structure`
2. **Iteration 2**: LLM calls `get_domain_hints`
3. **Iteration 3**: LLM calls `get_spatial_relationship_guidelines`
4. **Iteration 4**: LLM calls `get_example_renderer`
5. **Iteration 5**: LLM calls `get_legend_guidelines`
6. **Iteration 6**: LLM calls `validate_renderer` (often with incomplete code!)
7. **Iteration 7**: LLM generates text explanation instead of code
8. **Iteration 8**: LLM finally generates code

### Problems Identified

#### 1. Too Many Tool Calls
- LLM calls tools one-by-one, each requiring a full API round-trip
- Many tools return information already in system/user prompt
- Tools don't batch well - each call is separate

#### 2. Redundant Tools
- `list_available_domains` - Domain is already specified
- `get_domain_rendered_data` - State is already in user prompt
- `prepare_generation_artifacts` - Never used, orchestrator builds prompt
- `clean_code` - Never used, orchestrator cleans locally
- `get_legend_guidelines` - Same info is in system prompt
- `get_state_handling_guidelines` - Same info is in system prompt

#### 3. Information Duplication
- System prompt has code rules
- `get_state_handling_guidelines` repeats the same rules
- `get_legend_guidelines` repeats legend rules from system prompt
- `get_spatial_relationship_guidelines` has 11KB of patterns (too much!)

#### 4. LLM Behavior Issues
- LLM often returns text explanation before code
- LLM calls `validate_renderer` before generating code
- LLM doesn't follow "generate code first" instructions

#### 5. Prompt Contradictions
- System prompt says "EXPLORE ALL AVAILABLE TOOLS"
- User prompt says "DO NOT call list_available_domains"
- Mixed signals confuse the LLM

---

## Recommendations

### Option A: Minimal MCP (3-4 iterations)

**Keep only essential tools:**
1. `analyze_state_structure` - Detects relations, provides insights
2. `get_domain_hints` - Domain-specific styling
3. `validate_renderer` - Syntax validation

**Remove:**
- `list_available_domains` (redundant)
- `get_domain_rendered_data` (redundant)
- `prepare_generation_artifacts` (unused)
- `clean_code` (unused)
- `get_legend_guidelines` (in system prompt)
- `get_state_handling_guidelines` (in system prompt)
- `get_example_renderer` (embed in system prompt)
- `get_spatial_relationship_guidelines` (too verbose, embed key patterns in system prompt)

**New Flow:**
1. LLM calls `analyze_state_structure` → gets relation insights
2. LLM calls `get_domain_hints` → gets styling
3. LLM generates code
4. Orchestrator validates locally + MCP `validate_renderer`

### Option B: Single Combined Tool (2-3 iterations)

**Create one "super tool":**
```python
@mcp.tool(name="get_all_generation_context")
def get_all_generation_context(state_json: str, domain_name: str) -> str:
    """Returns everything needed to generate a renderer in ONE call."""
    return {
        "state_analysis": analyze_state_structure(state_json),
        "domain_hints": get_domain_hints(domain_name),
        "spatial_patterns": get_spatial_patterns_if_needed(state_json),
        "example_code": get_example_snippet()
    }
```

**New Flow:**
1. LLM calls `get_all_generation_context` → gets EVERYTHING
2. LLM generates code
3. Orchestrator validates

### Option C: No MCP Tools for Investigation (1-2 iterations)

**Move all context to the prompt:**
- Embed state analysis in user prompt (orchestrator does this)
- Embed domain hints in user prompt
- Embed example code in system prompt
- Embed spatial patterns in system prompt

**Keep only:**
- `validate_renderer` for post-generation validation

**New Flow:**
1. LLM generates code (all context in prompt)
2. Orchestrator validates

---

## Recommended Approach: Option A + Improvements

### Changes to Implement

#### 1. Remove Redundant Tools
Delete from `mcp_server.py`:
- `list_available_domains`
- `get_domain_rendered_data`
- `prepare_generation_artifacts`
- `clean_code`
- `get_legend_guidelines`
- `get_state_handling_guidelines`

#### 2. Simplify `get_spatial_relationship_guidelines`
- Currently 11KB of code patterns
- Reduce to key patterns only (2-3KB)
- Make it return ONLY the relevant pattern based on detected relations

#### 3. Embed Example in System Prompt
- Move `get_example_renderer` content into system prompt
- One less tool call

#### 4. Fix User Prompt
Remove contradictory instructions. New prompt:
```
Generate a JavaScript renderer for "${domainName}".

REQUIRED FUNCTIONS:
- render${domainPascal}(ctx, state)
- render${domainPascal}Legend(ctx, x, y)

STATE DATA:
${JSON.stringify(exampleState, null, 2)}

BEFORE GENERATING CODE:
1. Call analyze_state_structure with the state data above
2. Call get_domain_hints for "${domainName}"

THEN generate complete JavaScript code.
```

#### 5. Fix System Prompt
Remove "EXPLORE ALL AVAILABLE TOOLS" - be specific:
```
You have 3 tools available:
1. analyze_state_structure - Call this FIRST to understand the state
2. get_domain_hints - Call this to get styling hints
3. validate_renderer - Call this AFTER generating code to check syntax

WORKFLOW:
1. Call analyze_state_structure
2. Call get_domain_hints
3. Generate complete JavaScript code
4. (Orchestrator will validate)
```

---

## Expected Results

| Metric | Current | After Changes |
|--------|---------|---------------|
| Iterations | 8-10 | 3-4 |
| Time | 100-120s | 30-50s |
| Tool calls | 6-7 | 2-3 |
| API cost | High | ~50% reduction |

---

## Implementation Priority

1. **High**: Remove redundant tools (immediate impact)
2. **High**: Fix prompts to be specific, not contradictory
3. **Medium**: Simplify `get_spatial_relationship_guidelines`
4. **Medium**: Embed example code in system prompt
5. **Low**: Consider Option B (single combined tool) for future
