#!/usr/bin/env python3
"""
Planner integration script - runs Fast Downward if available, otherwise uses predefined plans.
"""

import sys
import subprocess
import tempfile
import os
from pathlib import Path

# Configurable timeout for Fast Downward (in seconds)
# Can be overridden via environment variable PLANNER_TIMEOUT
DEFAULT_PLANNER_TIMEOUT = 300  # 5 minutes default (was 60 seconds)

def get_planner_timeout() -> int:
    """Get the planner timeout from environment or use default."""
    try:
        return int(os.environ.get('PLANNER_TIMEOUT', DEFAULT_PLANNER_TIMEOUT))
    except (ValueError, TypeError):
        return DEFAULT_PLANNER_TIMEOUT

# Path to Fast Downward - try multiple possible locations
# This handles both local development and Manus environment
SCRIPT_DIR = Path(__file__).resolve().parent  # python_modules/
WEB_APP_DIR = SCRIPT_DIR.parent  # web-app/

# Try multiple possible locations for Fast Downward
POSSIBLE_FD_PATHS = [
    # Location 1: Sibling to web-app directory (local development)
    WEB_APP_DIR.parent / "planning-tools" / "downward" / "fast-downward.py",
    # Location 2: In parent's planning-visualizer directory (Manus environment)
    WEB_APP_DIR.parent.parent / "planning-visualizer" / "planning-tools" / "downward" / "fast-downward.py",
    # Location 3: Absolute path in Manus environment
    Path("/home/ubuntu/planning-visualizer/planning-tools/downward/fast-downward.py"),
]

# Find the first path that exists
FD_PATH = None
for path in POSSIBLE_FD_PATHS:
    if path.exists():
        FD_PATH = path
        break

# If no path found, use the first one (will fail later with clear error)
if FD_PATH is None:
    FD_PATH = POSSIBLE_FD_PATHS[0]


def run_fast_downward(domain_path: str, problem_path: str, timeout: int = None) -> list[str]:
    """
    Run Fast Downward planner to solve the problem.
    
    Args:
        domain_path: Path to domain PDDL file
        problem_path: Path to problem PDDL file
        timeout: Timeout in seconds (default: from environment or 300s)
        
    Returns:
        List of action strings
        
    Raises:
        RuntimeError: If planner fails
        subprocess.TimeoutExpired: If planner times out
    """
    if not FD_PATH.exists():
        raise FileNotFoundError(f"Fast Downward not found at {FD_PATH}")
    
    # Use provided timeout or get from environment/default
    if timeout is None:
        timeout = get_planner_timeout()
    
    # Create temporary file for plan output
    with tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.plan') as tmp:
        plan_file = Path(tmp.name)
    
    try:
        # Run Fast Downward with A* and LM-cut heuristic
        # Use the same Python interpreter that's running this script
        cmd = [
            sys.executable,
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
            timeout=timeout
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


def solve_problem(domain_path: str, problem_path: str, domain_name: str = None, timeout: int = None) -> tuple[list[str], bool]:
    """
    Solve a planning problem using Fast Downward or fallback to predefined plan.
    
    Args:
        domain_path: Path to domain PDDL file
        problem_path: Path to problem PDDL file
        domain_name: Optional domain name for fallback
        timeout: Optional timeout in seconds (default: from environment or 300s)
        
    Returns:
        Tuple of (plan actions, used_planner)
        - plan actions: List of action strings
        - used_planner: True if Fast Downward was used, False if fallback
    """
    try:
        # Try to run Fast Downward
        actions = run_fast_downward(domain_path, problem_path, timeout)
        return actions, True
    except subprocess.TimeoutExpired as e:
        # Re-raise timeout errors with more context
        timeout_used = timeout if timeout else get_planner_timeout()
        raise subprocess.TimeoutExpired(
            e.cmd, 
            timeout_used,
            output=f"Fast Downward timed out after {timeout_used} seconds. "
                   f"For large problems, try increasing PLANNER_TIMEOUT environment variable."
        )
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
        print("Usage: run_planner.py <domain_path> <problem_path> [domain_name] [timeout_seconds]")
        print(f"\nCurrent timeout: {get_planner_timeout()} seconds")
        print("Set PLANNER_TIMEOUT environment variable to override.")
        sys.exit(1)
    
    domain_path = sys.argv[1]
    problem_path = sys.argv[2]
    domain_name = sys.argv[3] if len(sys.argv) > 3 else None
    timeout = int(sys.argv[4]) if len(sys.argv) > 4 else None
    
    try:
        actions, used_planner = solve_problem(domain_path, problem_path, domain_name, timeout)
        
        print(f"Planner: {'Fast Downward' if used_planner else 'Fallback'}")
        print(f"Timeout: {timeout if timeout else get_planner_timeout()} seconds")
        print(f"Plan length: {len(actions)}")
        print("Actions:")
        for i, action in enumerate(actions, 1):
            print(f"  {i}. {action}")
            
    except subprocess.TimeoutExpired as e:
        print(f"Error: {e.output}", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
