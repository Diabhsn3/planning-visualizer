#!/usr/bin/env python3
"""
Planner integration script - runs Fast Downward to solve planning problems.
No fallback plans - if the planner fails, users get a clear error message.
"""

import sys
import subprocess
import tempfile
import shutil
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


class PlannerError(Exception):
    """Base exception for planner errors."""
    pass


class PlannerNotFoundError(PlannerError):
    """Raised when Fast Downward is not installed."""
    pass


class PlannerTimeoutError(PlannerError):
    """Raised when the planner times out."""
    pass


class UnsolvableProblemError(PlannerError):
    """Raised when the problem has no solution."""
    pass


class InvalidProblemError(PlannerError):
    """Raised when the problem or domain file is invalid."""
    pass


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
        PlannerNotFoundError: If Fast Downward is not installed
        PlannerTimeoutError: If planner times out
        UnsolvableProblemError: If the problem has no solution
        InvalidProblemError: If the domain or problem file is invalid
        PlannerError: For other planner failures
    """
    if not FD_PATH.exists():
        raise PlannerNotFoundError(
            f"Fast Downward planner is not installed.\n\n"
            f"To use this application, you need to install Fast Downward:\n"
            f"1. Clone: git clone https://github.com/aibasel/downward.git planning-tools/downward\n"
            f"2. Build: cd planning-tools/downward && ./build.py\n\n"
            f"Expected location: {FD_PATH}"
        )
    
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
    
    # Create an isolated working directory for THIS run. Concurrent planner
    # invocations must never share Fast Downward's intermediate files — most
    # importantly the translator's output.sas, which defaults to a RELATIVE
    # path resolved against the process CWD. If two simultaneous solves ran
    # in the same directory, one run's translator output could overwrite the
    # file another run's search is reading, producing wrong plans, spurious
    # "no solution" errors, or crashes. We give each run its own temp dir and
    # pass an explicit --sas-file inside it (plan-file too), then remove it.
    run_dir = Path(tempfile.mkdtemp(prefix="fd_run_"))
    plan_file = run_dir / "plan.out"
    sas_file = run_dir / "output.sas"

    try:
        # Build command with strategy-specific arguments
        # Use --log-level warning to suppress verbose search logs (reduces output by 90%+)
        cmd = [
            sys.executable,
            str(FD_PATH),
            "--log-level", "warning",  # Suppress verbose logs to prevent stdout buffer overflow
            "--sas-file", str(sas_file),  # Per-run translator output (isolate concurrent runs)
            "--plan-file", str(plan_file),
            domain_path,
            problem_path,
        ] + strategy.fd_args  # Add strategy-specific search arguments

        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=timeout,
            cwd=str(run_dir),  # any stray relative output stays inside this run's dir
        )
        
        # Check for specific error conditions
        stdout = result.stdout.lower() if result.stdout else ""
        stderr = result.stderr.lower() if result.stderr else ""
        combined_output = stdout + stderr
        
        # Check for unsolvable problem
        if "no solution" in combined_output or "unsolvable" in combined_output:
            raise UnsolvableProblemError(
                f"The problem has no solution.\n\n"
                f"This could mean:\n"
                f"1. The goal is impossible to achieve from the initial state\n"
                f"2. There are missing predicates in the initial state\n"
                f"3. The domain actions cannot connect the initial state to the goal\n\n"
                f"Please check your problem definition."
            )
        
        # Check for parsing errors
        if "error" in combined_output and ("parsing" in combined_output or "syntax" in combined_output):
            raise InvalidProblemError(
                f"Failed to parse the domain or problem file.\n\n"
                f"Please check for syntax errors in your PDDL files.\n\n"
                f"Details: {result.stderr or result.stdout}"
            )
        
        if result.returncode != 0:
            raise PlannerError(
                f"The planner encountered an error.\n\n"
                f"Exit code: {result.returncode}\n"
                f"Output: {result.stderr or result.stdout}"
            )
        
        # Read plan from file
        if not plan_file.exists():
            # No plan file means no solution found
            raise UnsolvableProblemError(
                f"The planner could not find a solution.\n\n"
                f"The problem may be unsolvable or require more time.\n"
                f"Try a different search strategy or simplify the problem."
            )
        
        actions = []
        for line in plan_file.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith(";"):
                actions.append(line)
        
        if not actions:
            raise UnsolvableProblemError(
                f"The planner found an empty plan.\n\n"
                f"This usually means the initial state already satisfies the goal,\n"
                f"or the problem definition has an issue."
            )
        
        return actions, strategy.name
        
    except subprocess.TimeoutExpired:
        suggestion = ""
        if strategy and strategy.is_optimal:
            suggestion = "\n\nTip: Try using a satisficing strategy like 'lazy-greedy-ff' for faster results."
        
        raise PlannerTimeoutError(
            f"The planner timed out after {timeout} seconds.\n\n"
            f"Strategy used: {strategy.name}\n"
            f"The problem may be too complex or require a different approach.{suggestion}"
        )
        
    finally:
        # Clean up the entire isolated run directory (plan + sas + any strays)
        shutil.rmtree(run_dir, ignore_errors=True)


def solve_problem(
    domain_path: str, 
    problem_path: str, 
    domain_name: str = None, 
    strategy_id: str = None,
    timeout: int = None
) -> Tuple[List[str], bool, str]:
    """
    Solve a planning problem using Fast Downward.
    
    Args:
        domain_path: Path to domain PDDL file
        problem_path: Path to problem PDDL file
        domain_name: Domain name (for logging purposes only)
        strategy_id: Search strategy ID (from whitelist)
        timeout: Optional timeout in seconds (default: from environment or 1800s)
        
    Returns:
        Tuple of (plan actions, used_planner, strategy_name)
        - plan actions: List of action strings
        - used_planner: Always True (no fallback)
        - strategy_name: Name of the strategy used
        
    Raises:
        PlannerNotFoundError: If Fast Downward is not installed
        PlannerTimeoutError: If planner times out
        UnsolvableProblemError: If the problem has no solution
        InvalidProblemError: If the domain or problem file is invalid
        PlannerError: For other planner failures
    """
    # Get strategy for error messages
    if strategy_id is None:
        strategy_id = get_default_strategy_id()
    
    strategy = get_strategy(strategy_id)
    
    # Run Fast Downward - no fallback, errors propagate to caller
    actions, used_strategy = run_fast_downward(
        domain_path, problem_path, strategy_id, timeout
    )
    return actions, True, used_strategy


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
        
        print(f"Strategy: {strategy_name}")
        print(f"Plan ({len(actions)} actions):")
        for i, action in enumerate(actions, 1):
            print(f"  {i}. {action}")
            
    except PlannerNotFoundError as e:
        print(f"ERROR: Planner not found\n{e}", file=sys.stderr)
        sys.exit(2)
    except PlannerTimeoutError as e:
        print(f"ERROR: Planner timeout\n{e}", file=sys.stderr)
        sys.exit(3)
    except UnsolvableProblemError as e:
        print(f"ERROR: Unsolvable problem\n{e}", file=sys.stderr)
        sys.exit(4)
    except InvalidProblemError as e:
        print(f"ERROR: Invalid problem\n{e}", file=sys.stderr)
        sys.exit(5)
    except PlannerError as e:
        print(f"ERROR: Planner error\n{e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
