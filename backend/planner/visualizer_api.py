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
from run_planner import (
    solve_problem,
    PlannerError,
    PlannerNotFoundError,
    PlannerTimeoutError,
    UnsolvableProblemError,
    InvalidProblemError
)
from search_strategies import (
    get_strategy, 
    get_default_strategy_id, 
    validate_strategy,
    get_strategies_for_api
)
from domain_detector import check_domain_mismatch, detect_domain, DOMAIN_SIGNATURES


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
        domain_name: Optional domain name for logging
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
                        f"Use 'list-strategies' to see available options.",
                "error_type": "invalid_strategy"
            }
        
        # Get strategy info for response
        if strategy_id is None:
            strategy_id = get_default_strategy_id()
        strategy = get_strategy(strategy_id)
        
        # Step 0: Check for domain mismatch BEFORE running planner
        # Skip mismatch detection for custom domains (they are user-defined)
        is_custom_domain = domain_name == "custom" or domain_name not in DOMAIN_SIGNATURES
        if domain_name and not is_custom_domain:
            try:
                with open(problem_path, 'r') as f:
                    problem_content = f.read()
                
                is_match, suggested_domain, mismatch_message = check_domain_mismatch(
                    problem_content, domain_name
                )
                
                if not is_match and suggested_domain:
                    # Get the suggested domain's display name
                    suggested_name = DOMAIN_SIGNATURES.get(suggested_domain, {}).get("name", suggested_domain)
                    selected_name = DOMAIN_SIGNATURES.get(domain_name, {}).get("name", domain_name)
                    
                    return {
                        "success": False,
                        "error": mismatch_message,
                        "error_type": "domain_mismatch",
                        "selected_domain": domain_name,
                        "selected_domain_name": selected_name,
                        "suggested_domain": suggested_domain,
                        "suggested_domain_name": suggested_name,
                    }
            except Exception as detect_error:
                # If domain detection fails, continue with planner
                # (don't block the user due to detection issues)
                pass
        
        # Step 1: Solve the problem using Fast Downward
        plan, used_planner, strategy_name = solve_problem(
            domain_path, problem_path, domain_name, strategy_id
        )
        
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
            "planner_info": strategy_name,
            "search_strategy": {
                "id": strategy.id,
                "name": strategy.name,
                "isOptimal": strategy.is_optimal,
                "speed": strategy.speed
            } if strategy else None
        }
        
        return result
    
    except PlannerNotFoundError as e:
        return {
            "success": False,
            "error": str(e),
            "error_type": "planner_not_found",
            "user_message": (
                "The Fast Downward planner is not installed on this system.\n\n"
                "Please ensure Fast Downward is properly installed and configured. "
                "Contact your system administrator for assistance."
            )
        }
    
    except PlannerTimeoutError as e:
        return {
            "success": False,
            "error": str(e),
            "error_type": "timeout",
            "user_message": (
                "The planner took too long to find a solution.\n\n"
                "Suggestions:\n"
                "• Try a faster search strategy (e.g., 'lazy-greedy-ff')\n"
                "• Simplify your problem (fewer objects or simpler goals)\n"
                "• Increase the timeout if the problem is complex"
            )
        }
    
    except UnsolvableProblemError as e:
        error_response = {
            "success": False,
            "error": str(e),
            "error_type": "unsolvable",
            "user_message": (
                "The planner could not find a solution to this problem.\n\n"
                "This could mean:\n"
                "• The goal is impossible to achieve from the initial state\n"
                "• There are missing predicates in the initial state\n"
                "• The domain actions cannot connect the initial state to the goal\n\n"
                "Please check your problem definition."
            )
        }
        
        # Try to suggest the correct domain
        if domain_name:
            try:
                with open(problem_path, 'r') as f:
                    problem_content = f.read()
                
                detected_domain, ranked_matches, explanation = detect_domain(problem_content)
                
                if detected_domain and detected_domain != domain_name:
                    suggested_name = DOMAIN_SIGNATURES.get(detected_domain, {}).get("name", detected_domain)
                    selected_name = DOMAIN_SIGNATURES.get(domain_name, {}).get("name", domain_name)
                    
                    error_response["user_message"] = (
                        f"The planner could not find a solution.\n\n"
                        f"It appears your problem might belong to a different domain. "
                        f"You selected '{selected_name}', but the problem looks like it might be for '{suggested_name}'.\n\n"
                        f"Please verify you selected the correct domain."
                    )
                    error_response["error_type"] = "possible_domain_mismatch"
                    error_response["selected_domain"] = domain_name
                    error_response["selected_domain_name"] = selected_name
                    error_response["suggested_domain"] = detected_domain
                    error_response["suggested_domain_name"] = suggested_name
            except Exception:
                pass
        
        return error_response
    
    except InvalidProblemError as e:
        return {
            "success": False,
            "error": str(e),
            "error_type": "invalid_problem",
            "user_message": (
                "There is a syntax error in your domain or problem file.\n\n"
                "Please check:\n"
                "• All parentheses are properly matched\n"
                "• All predicates and actions are correctly defined\n"
                "• Object types match the domain definition\n"
                "• All referenced predicates exist in the domain"
            )
        }
    
    except PlannerError as e:
        return {
            "success": False,
            "error": str(e),
            "error_type": "planner_error",
            "user_message": (
                "The planner encountered an error.\n\n"
                "Please check your domain and problem files for issues, "
                "or try a different search strategy."
            )
        }
        
    except Exception as e:
        import traceback
        return {
            "success": False,
            "error": str(e),
            "error_type": "general_error",
            "user_message": (
                "An unexpected error occurred.\n\n"
                "Please check your domain and problem files, "
                "or contact support if the issue persists."
            ),
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
