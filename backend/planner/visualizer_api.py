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


def visualize_plan(domain_path: str, problem_path: str, domain_name: str = None) -> dict:
    """
    Run the full visualization pipeline with actual planner.
    
    Args:
        domain_path: Path to domain PDDL file
        problem_path: Path to problem PDDL file
        domain_name: Optional domain name for fallback plans
        
    Returns:
        Dictionary with rendered states and metadata
    """
    try:
        # Step 1: Solve the problem using Fast Downward (or fallback)
        plan, used_planner = solve_problem(domain_path, problem_path, domain_name)
        
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
            "planner_info": "Fast Downward (A* + LM-cut)" if used_planner else "Fallback (predefined plan)"
        }
        
        return result
        
    except Exception as e:
        import traceback
        return {
            "success": False,
            "error": str(e),
            "traceback": traceback.format_exc()
        }


def main():
    """CLI interface for testing."""
    if len(sys.argv) < 3:
        print("Usage: visualizer_api.py <domain_path> <problem_path> [domain_name]")
        sys.exit(1)
    
    domain_path = sys.argv[1]
    problem_path = sys.argv[2]
    domain_name = sys.argv[3] if len(sys.argv) > 3 else None
    
    result = visualize_plan(domain_path, problem_path, domain_name)
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
