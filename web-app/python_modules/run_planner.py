#!/usr/bin/env python3
"""
Planner integration script - runs Fast Downward if available, otherwise uses predefined plans.
"""

import sys
import subprocess
import tempfile
from pathlib import Path

# Path to Fast Downward (adjust if needed)
FD_PATH = Path(__file__).resolve().parents[2] / "planning-visualizer" / "planning-tools" / "downward" / "fast-downward.py"

# Check if we're in the Manus web app directory, adjust path accordingly
if not FD_PATH.exists():
    # Try alternative path for Manus web app
    FD_PATH = Path("/home/ubuntu/planning-visualizer/planning-tools/downward/fast-downward.py")


def run_fast_downward(domain_path: str, problem_path: str) -> list[str]:
    """
    Run Fast Downward planner to solve the problem.
    
    Args:
        domain_path: Path to domain PDDL file
        problem_path: Path to problem PDDL file
        
    Returns:
        List of action strings
        
    Raises:
        RuntimeError: If planner fails
    """
    if not FD_PATH.exists():
        raise FileNotFoundError(f"Fast Downward not found at {FD_PATH}")
    
    # Create temporary file for plan output
    with tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.plan') as tmp:
        plan_file = Path(tmp.name)
    
    try:
        # Run Fast Downward with A* and LM-cut heuristic
        cmd = [
            "/usr/bin/python3.11",
            str(FD_PATH),
            "--plan-file", str(plan_file),
            domain_path,
            problem_path,
            "--search", "astar(lmcut())"
        ]
        
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=60  # 60 second timeout
        )
        
        if result.returncode != 0:
            raise RuntimeError(f"Planner failed:\nSTDOUT: {result.stdout}\nSTDERR: {result.stderr}")
        
        # Read plan from file
        if not plan_file.exists():
            return []
        
        actions = []
        for line in plan_file.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith(";"):
                actions.append(line)
        
        return actions
        
    finally:
        # Clean up temporary file
        if plan_file.exists():
            plan_file.unlink()


def get_fallback_plan(domain_name: str) -> list[str]:
    """
    Get a predefined plan for testing when Fast Downward is not available.
    
    Args:
        domain_name: Name of the domain
        
    Returns:
        List of action strings
    """
    fallback_plans = {
        "blocks-world": [
            "(pick-up b)",
            "(stack b c)",
            "(pick-up a)",
            "(stack a b)"
        ],
        "gripper": [
            "(pick ball1 rooma left)",
            "(pick ball2 rooma right)",
            "(move rooma roomb)",
            "(drop ball1 roomb left)",
            "(drop ball2 roomb right)"
        ]
    }
    
    return fallback_plans.get(domain_name, [])


def solve_problem(domain_path: str, problem_path: str, domain_name: str = None) -> tuple[list[str], bool]:
    """
    Solve a planning problem using Fast Downward or fallback to predefined plan.
    
    Args:
        domain_path: Path to domain PDDL file
        problem_path: Path to problem PDDL file
        domain_name: Optional domain name for fallback
        
    Returns:
        Tuple of (plan actions, used_planner)
        - plan actions: List of action strings
        - used_planner: True if Fast Downward was used, False if fallback
    """
    try:
        # Try to run Fast Downward
        actions = run_fast_downward(domain_path, problem_path)
        return actions, True
    except (FileNotFoundError, RuntimeError) as e:
        # Fall back to predefined plan
        print(f"Warning: Could not run Fast Downward ({e}). Using fallback plan.", file=sys.stderr)
        if domain_name:
            actions = get_fallback_plan(domain_name)
            return actions, False
        else:
            raise RuntimeError("Fast Downward not available and no domain name provided for fallback")


def main():
    """CLI interface for testing."""
    if len(sys.argv) < 3:
        print("Usage: run_planner.py <domain_path> <problem_path> [domain_name]")
        sys.exit(1)
    
    domain_path = sys.argv[1]
    problem_path = sys.argv[2]
    domain_name = sys.argv[3] if len(sys.argv) > 3 else None
    
    try:
        actions, used_planner = solve_problem(domain_path, problem_path, domain_name)
        
        print(f"Planner: {'Fast Downward' if used_planner else 'Fallback'}")
        print(f"Plan length: {len(actions)}")
        print("Actions:")
        for i, action in enumerate(actions, 1):
            print(f"  {i}. {action}")
            
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
