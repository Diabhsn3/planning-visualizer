#!/usr/bin/env python3
"""
Planner integration script - runs Fast Downward if available, otherwise uses predefined plans.
"""

import sys
import subprocess
import tempfile
import os
import re
from pathlib import Path
from typing import List, Optional, Tuple, Set

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


def extract_objects_from_problem(problem_path: str) -> Set[str]:
    """
    Extract object names from a PDDL problem file.
    
    Args:
        problem_path: Path to problem PDDL file
        
    Returns:
        Set of object names defined in the problem
    """
    objects = set()
    try:
        with open(problem_path, 'r') as f:
            content = f.read().lower()
        
        # Find :objects section
        objects_match = re.search(r'\(:objects\s+(.*?)\)', content, re.DOTALL)
        if objects_match:
            objects_text = objects_match.group(1)
            # Remove type annotations (- type)
            objects_text = re.sub(r'-\s*\w+', '', objects_text)
            # Extract individual object names
            for word in objects_text.split():
                word = word.strip()
                if word and not word.startswith('(') and not word.startswith(')'):
                    objects.add(word)
    except Exception:
        pass
    
    return objects


def extract_objects_from_plan(plan: List[str]) -> Set[str]:
    """
    Extract object names referenced in a plan.
    
    Args:
        plan: List of action strings
        
    Returns:
        Set of object names used in the plan
    """
    objects = set()
    for action in plan:
        # Parse action: (action-name arg1 arg2 ...)
        action = action.strip().lower()
        if action.startswith('(') and action.endswith(')'):
            action = action[1:-1]
        parts = action.split()
        if len(parts) > 1:
            # Skip the action name, collect arguments
            for arg in parts[1:]:
                objects.add(arg)
    return objects


def validate_plan_matches_problem(plan: List[str], problem_path: str) -> Tuple[bool, str]:
    """
    Validate that a plan's objects match the problem's objects.
    
    This catches the case where a fallback plan is used that doesn't
    match the actual problem being solved.
    
    Args:
        plan: List of action strings
        problem_path: Path to problem PDDL file
        
    Returns:
        Tuple of (is_valid, error_message)
    """
    if not plan:
        return True, ""  # Empty plan is valid (unsolvable or trivial)
    
    problem_objects = extract_objects_from_problem(problem_path)
    plan_objects = extract_objects_from_plan(plan)
    
    if not problem_objects:
        # Couldn't parse problem, skip validation
        return True, ""
    
    # Check if plan objects are a subset of problem objects
    unknown_objects = plan_objects - problem_objects
    
    if unknown_objects:
        return False, (
            f"Plan references objects not in the problem: {', '.join(sorted(unknown_objects))}. "
            f"Problem objects: {', '.join(sorted(problem_objects))}. "
            f"This usually means the planner failed and a fallback plan was incorrectly used."
        )
    
    return True, ""


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
        # Use --log-level warning to suppress verbose search logs (reduces output by 90%+)
        cmd = [
            sys.executable,
            str(FD_PATH),
            "--log-level", "warning",  # Suppress verbose logs to prevent stdout buffer overflow
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
    
    NOTE: These fallback plans are ONLY valid for the built-in default problems.
    They should NOT be used for custom user problems.
    
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
        ],
        "hanoi": [
            # Move 2 disks from peg A to peg C using B as auxiliary
            # Initial: d1 on d2 on A, goal: d1 on d2 on C
            "(move d1 d2 b)",    # Move d1 from d2 to peg B
            "(move d2 a c)",     # Move d2 from peg A to peg C
            "(move d1 b d2)"     # Move d1 from peg B to d2 (on C)
        ],
        "depot": [
            # Simple depot plan - move one crate
            "(drive truck0 depot0 distributor0)",
            "(lift hoist0 crate0 pallet0 depot0)",
            "(load hoist0 crate0 truck0 depot0)",
            "(drive truck0 depot0 distributor0)",
            "(unload hoist1 crate0 truck0 distributor0)",
            "(drop hoist1 crate0 pallet1 distributor0)"
        ],
        "rovers": [
            # Simple rover plan - navigate, calibrate, take-image, communicate
            "(navigate rover0 waypoint0 waypoint1)",
            "(calibrate rover0 waypoint1)",
            "(take-image rover0 target0 waypoint1)",
            "(communicate rover0 target0)"
        ]
    }
    
    return fallback_plans.get(domain_name, [])


def solve_problem(
    domain_path: str, 
    problem_path: str, 
    domain_name: str = None, 
    strategy_id: str = None,
    timeout: int = None,
    allow_fallback: bool = True
) -> Tuple[List[str], bool, str]:
    """
    Solve a planning problem using Fast Downward or fallback to predefined plan.
    
    Args:
        domain_path: Path to domain PDDL file
        problem_path: Path to problem PDDL file
        domain_name: Optional domain name for fallback
        strategy_id: Search strategy ID (from whitelist)
        timeout: Optional timeout in seconds (default: from environment or 1800s)
        allow_fallback: If False, raise error instead of using fallback plan
        
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
        # Check if fallback is allowed
        if not allow_fallback:
            raise RuntimeError(
                f"Fast Downward planner is not available: {e}. "
                f"Please ensure Fast Downward is installed and accessible."
            )
        
        # Fall back to predefined plan
        print(f"Warning: Could not run Fast Downward ({e}). Using fallback plan.", file=sys.stderr)
        if domain_name:
            actions = get_fallback_plan(domain_name)
            
            # CRITICAL: Validate that fallback plan matches the problem
            is_valid, error_msg = validate_plan_matches_problem(actions, problem_path)
            if not is_valid:
                raise RuntimeError(
                    f"Fast Downward is not available and the fallback plan does not match your problem. "
                    f"{error_msg}\n\n"
                    f"To solve custom problems, Fast Downward must be installed. "
                    f"The fallback plans only work with the built-in default examples."
                )
            
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
