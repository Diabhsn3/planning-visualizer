#!/usr/bin/env python3
"""
API wrapper for the planning visualizer pipeline.
Integrates planner_runner, state_generator, and state_renderer.
"""

import sys
import os

# Suppress all warnings to prevent them from polluting JSON output
import warnings
warnings.filterwarnings('ignore')
os.environ['PYTHONWARNINGS'] = 'ignore'

import json
from pathlib import Path

# Add modules to path
SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR))

from state_generator import StateGenerator
from state_renderer import RendererFactory
from run_planner import solve_problem
from search_strategies import (
    get_strategy, 
    get_default_strategy_id, 
    validate_strategy,
    get_strategies_for_api
)


def visualize_plan(
    domain_path: str, 
    problem_path: str, 
    domain_name: str = None,
    strategy_id: str = None
) -> dict:
    """
    Run the full visualization pipeline with actual planner.
    
    Args:
        domain_path: Path to domain PDDL file
        problem_path: Path to problem PDDL file
        domain_name: Optional domain name for fallback plans
        strategy_id: Search strategy ID (from whitelist)
        
    Returns:
        Dictionary with rendered states and metadata
    """
    try:
        # Validate strategy if provided
        if strategy_id and not validate_strategy(strategy_id):
            return {
                "success": False,
                "error": f"Invalid search strategy: {strategy_id}. "
                        f"Use 'list-strategies' to see available options."
            }
        
        # Get strategy info for response
        if strategy_id is None:
            strategy_id = get_default_strategy_id()
        strategy = get_strategy(strategy_id)
        
        # Step 1: Solve the problem using Fast Downward (or fallback)
        plan, used_planner, strategy_name = solve_problem(
            domain_path, problem_path, domain_name, strategy_id
        )
        
        if not plan:
            return {
                "success": False,
                "error": "No solution found for the problem"
            }
        
        # Step 2: Generate states
        sg = StateGenerator(domain_path, problem_path)
        states = sg.apply_plan(plan)
        
        # Step 3: Render states
        renderer = RendererFactory.get_renderer(sg.parser.domain_name)
        rendered_states = renderer.render_sequence(states, sg.parser.objects, plan)
        
        # Step 4: Convert to JSON
        result = {
            "success": True,
            "domain": sg.parser.domain_name,
            "problem": sg.parser.problem_name,
            "plan": plan,
            "num_states": len(rendered_states),
            "states": [rs.to_dict() for rs in rendered_states],
            "used_planner": used_planner,
            "planner_info": strategy_name if used_planner else "Fallback (predefined plan)",
            "search_strategy": {
                "id": strategy.id,
                "name": strategy.name,
                "isOptimal": strategy.is_optimal,
                "speed": strategy.speed
            } if strategy else None
        }
        
        return result
        
    except Exception as e:
        import traceback
        error_msg = str(e)
        
        # Check if it's a timeout error and provide helpful suggestion
        if "timed out" in error_msg.lower():
            strategy = get_strategy(strategy_id) if strategy_id else None
            if strategy and strategy.is_optimal:
                error_msg += "\n\nSuggestion: Try using a faster satisficing strategy like 'lazy-greedy-ff' or 'greedy-ff'."
        
        return {
            "success": False,
            "error": error_msg,
            "traceback": traceback.format_exc()
        }


def list_strategies() -> dict:
    """
    Return list of available search strategies.
    
    Returns:
        Dictionary with list of strategies
    """
    return {
        "success": True,
        "strategies": get_strategies_for_api()
    }


def main():
    """CLI interface for testing."""
    if len(sys.argv) < 2:
        print("Usage: visualizer_api.py <domain_path> <problem_path> [domain_name] [strategy_id]")
        print("       visualizer_api.py list-strategies")
        sys.exit(1)
    
    # Handle list-strategies command
    if sys.argv[1] == "list-strategies":
        result = list_strategies()
        print(json.dumps(result, indent=2))
        return
    
    if len(sys.argv) < 3:
        print("Usage: visualizer_api.py <domain_path> <problem_path> [domain_name] [strategy_id]")
        sys.exit(1)
    
    domain_path = sys.argv[1]
    problem_path = sys.argv[2]
    domain_name = sys.argv[3] if len(sys.argv) > 3 else None
    strategy_id = sys.argv[4] if len(sys.argv) > 4 else None
    
    result = visualize_plan(domain_path, problem_path, domain_name, strategy_id)
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
