#!/usr/bin/env python3
"""
Planner integration script - runs Fast Downward if available, otherwise uses predefined plans.
"""

import sys
import subprocess
import tempfile
import os
from pathlib import Path
from typing import List, Optional, Tuple

# Import search strategies
from search_strategies import (
    get_strategy, 
    get_default_strategy_id, 
    validate_strategy,
    SearchStrategy
)

# Configurable timeout for Fast Downward (in seconds)
# Can be overridden via environment variable PLANNER_TIMEOUT
DEFAULT_PLANNER_TIMEOUT = 1800  # 30 minutes default

def get_planner_timeout() -> int:
    """Get the planner timeout from environment or use default."""
    try:
        return int(os.environ.get('PLANNER_TIMEOUT', DEFAULT_PLANNER_TIMEOUT))
    except (ValueError, TypeError):
        return DEFAULT_PLANNER_TIMEOUT

# Path to Fast Downward - try multiple possible locations
# This handles local development (Mac/Windows), server deployment, and Manus sandbox
SCRIPT_DIR = Path(__file__).resolve().parent  # backend/planner/
BACKEND_DIR = SCRIPT_DIR.parent  # backend/
PROJECT_ROOT = BACKEND_DIR.parent  # planning-visualizer/

# Try multiple possible locations for Fast Downward
POSSIBLE_FD_PATHS = [
    # Location 1: Project root (standard structure - works for local & server)
    PROJECT_ROOT / "planning-tools" / "downward" / "fast-downward.py",
    # Location 2: Server deployment path (/home/user/)
    Path("/home/user/planning-visualizer/planning-tools/downward/fast-downward.py"),
    # Location 3: Manus sandbox path (/home/ubuntu/)
    Path("/home/ubuntu/planning-visualizer/planning-tools/downward/fast-downward.py"),
    # Location 4: User's home directory (macOS/Linux local development)
    Path.home() / "planning-visualizer" / "planning-tools" / "downward" / "fast-downward.py",
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


def run_fast_downward(
    domain_path: str, 
    problem_path: str, 
    strategy_id: str = None,
    timeout: int = None
) -> Tuple[List[str], str]:
    """
    Run Fast Downward planner to solve the problem.
    
    Args:
        domain_path: Path to domain PDDL file
        problem_path: Path to problem PDDL file
        strategy_id: Search strategy ID (from whitelist)
        timeout: Timeout in seconds (default: from environment or 1800s)
        
    Returns:
        Tuple of (list of action strings, strategy name used)
        
    Raises:
        RuntimeError: If planner fails
        subprocess.TimeoutExpired: If planner times out
        ValueError: If strategy_id is invalid
    """
    if not FD_PATH.exists():
        raise FileNotFoundError(f"Fast Downward not found at {FD_PATH}")
    
    # Get and validate search strategy
    if strategy_id is None:
        strategy_id = get_default_strategy_id()
    
    if not validate_strategy(strategy_id):
        raise ValueError(f"Invalid search strategy: {strategy_id}. "
                        f"Strategy must be from the whitelist.")
    
    strategy = get_strategy(strategy_id)
    
    # Use provided timeout or get from environment/default
    if timeout is None:
        timeout = get_planner_timeout()
    
    # Create temporary file for plan output
    with tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.plan') as tmp:
        plan_file = Path(tmp.name)
    
    try:
        # Build command with strategy-specific arguments
        cmd = [
            sys.executable,
            str(FD_PATH),
            "--plan-file", str(plan_file),
            domain_path,
            problem_path,
        ] + strategy.fd_args  # Add strategy-specific search arguments
        
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
            return [], strategy.name
        
        actions = []
        for line in plan_file.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith(";"):
                actions.append(line)
        
        return actions, strategy.name
        
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


def solve_problem(
    domain_path: str, 
    problem_path: str, 
    domain_name: str = None, 
    strategy_id: str = None,
    timeout: int = None
) -> Tuple[List[str], bool, str]:
    """
    Solve a planning problem using Fast Downward or fallback to predefined plan.
    
    Args:
        domain_path: Path to domain PDDL file
        problem_path: Path to problem PDDL file
        domain_name: Optional domain name for fallback
        strategy_id: Search strategy ID (from whitelist)
        timeout: Optional timeout in seconds (default: from environment or 1800s)
        
    Returns:
        Tuple of (plan actions, used_planner, strategy_name)
        - plan actions: List of action strings
        - used_planner: True if Fast Downward was used, False if fallback
        - strategy_name: Name of the strategy used (or "Fallback" if not using planner)
    """
    # Get strategy for error messages
    if strategy_id is None:
        strategy_id = get_default_strategy_id()
    
    strategy = get_strategy(strategy_id)
    strategy_name = strategy.name if strategy else "Unknown"
    
    try:
        # Try to run Fast Downward
        actions, used_strategy = run_fast_downward(
            domain_path, problem_path, strategy_id, timeout
        )
        return actions, True, used_strategy
    except subprocess.TimeoutExpired as e:
        # Re-raise timeout errors with more context
        timeout_used = timeout if timeout else get_planner_timeout()
        
        # Build helpful suggestion based on strategy
        suggestion = ""
        if strategy and strategy.is_optimal:
            suggestion = " Try using a satisficing strategy like 'lazy-greedy-ff' for faster results."
        
        raise subprocess.TimeoutExpired(
            e.cmd, 
            timeout_used,
            output=f"Fast Downward timed out after {timeout_used} seconds using {strategy_name}.{suggestion}"
        )
    except (FileNotFoundError, RuntimeError) as e:
        # Fall back to predefined plan
        print(f"Warning: Could not run Fast Downward ({e}). Using fallback plan.", file=sys.stderr)
        if domain_name:
            actions = get_fallback_plan(domain_name)
            return actions, False, "Fallback (predefined plan)"
        else:
            raise RuntimeError("Fast Downward not available and no domain name provided for fallback")


def main():
    """CLI interface for testing."""
    if len(sys.argv) < 3:
        print("Usage: run_planner.py <domain_path> <problem_path> [domain_name] [strategy_id] [timeout_seconds]")
        print(f"\nCurrent timeout: {get_planner_timeout()} seconds")
        print("Set PLANNER_TIMEOUT environment variable to override.")
        print("\nAvailable strategies:")
        from search_strategies import get_all_strategies
        for s in get_all_strategies():
            opt = "optimal" if s.is_optimal else "satisficing"
            print(f"  {s.id}: {s.name} ({opt}, {s.speed})")
        sys.exit(1)
    
    domain_path = sys.argv[1]
    problem_path = sys.argv[2]
    domain_name = sys.argv[3] if len(sys.argv) > 3 else None
    strategy_id = sys.argv[4] if len(sys.argv) > 4 else None
    timeout = int(sys.argv[5]) if len(sys.argv) > 5 else None
    
    try:
        actions, used_planner, strategy_name = solve_problem(
            domain_path, problem_path, domain_name, strategy_id, timeout
        )
        
        print(f"Planner: {'Fast Downward' if used_planner else 'Fallback'}")
        print(f"Strategy: {strategy_name}")
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
