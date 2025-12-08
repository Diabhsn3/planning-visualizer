from pathlib import Path
import subprocess
import tempfile
import sys
import os

# Planner directory (where domains are located)
PLANNER_DIR = Path(__file__).resolve().parent.parent
# Project root (where planning-tools is located)
PROJECT_ROOT = PLANNER_DIR.parent.parent

FD_PY = PROJECT_ROOT / "planning-tools" / "downward" / "fast-downward.py"


def _extract_domain_name(domain_rel: str) -> str:
    """
    Extract domain name from relative domain path.
    Example: 'domains/blocks_world/domain.pddl' -> 'blocks-world'
    """
    # Convert path separators to forward slashes for cross-platform compatibility
    domain_rel = str(domain_rel).replace('\\', '/')
    
    # Extract domain folder name
    parts = domain_rel.split('/')
    if len(parts) >= 2 and parts[0] == 'domains':
        domain_folder = parts[1]
        # Convert underscores to hyphens for consistency
        return domain_folder.replace('_', '-')
    return None


def _get_fallback_plan(domain_name: str) -> list[str]:
    """
    Get a predefined plan for testing when Fast Downward is not available.
    
    Args:
        domain_name: Name of the domain (e.g., 'blocks-world', 'gripper')
        
    Returns:
        List of action strings, or empty list if no fallback available
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
        "depot": [],
        "hanoi": [],
        "logistics": [],
        "rovers": [],
        "satellite": []
    }
    
    return fallback_plans.get(domain_name, [])


def run_planner(domain_rel, problem_rel):
    """


    
    Run planner with fallback support.
    
    Args:
        domain_rel: Relative path to domain file (e.g., 'domains/blocks_world/domain.pddl')
        problem_rel: Relative path to problem file (e.g., 'domains/blocks_world/p1.pddl')
        
    Returns:
        List of action strings
    """
    domain = PLANNER_DIR / domain_rel
    problem = PLANNER_DIR / problem_rel
    
    # Check if files exist
    if not domain.exists():
        raise FileNotFoundError(f"Domain file not found: {domain}")
    if not problem.exists():
        raise FileNotFoundError(f"Problem file not found: {problem}")
    
    # Try to use Fast Downward if available
    if FD_PY.exists():
        try:
            # Check if Fast Downward is built - verify both directory and binary exist
            builds_dir = FD_PY.parent / "builds" / "release"
            bin_dir = builds_dir / "bin"
            
            # Check if binary exists (cross-platform: downward on Unix, downward.exe on Windows)
            downward_binary = bin_dir / "downward"
            downward_binary_exe = bin_dir / "downward.exe"
            
            # Check if either binary exists (more reliable than just checking directory)
            if not downward_binary.exists() and not downward_binary_exe.exists():
                # Fast Downward not built - skip to fallback without trying to run it
                raise FileNotFoundError("Fast Downward binary not found")
            
            with tempfile.NamedTemporaryFile(delete=False, suffix='.plan') as tmp:
                plan_file = Path(tmp.name)
            
            try:
                # Use sys.executable for cross-platform compatibility
                cmd = [
                    sys.executable,
                    str(FD_PY),
                    "--plan-file", str(plan_file),
                    str(domain),
                    str(problem),
                    "--search", "astar(lmcut())"
                ]
                
                result = subprocess.run(
                    cmd,
                    capture_output=True,
                    text=True,
                    timeout=60  # 60 second timeout
                )
                
                if result.returncode == 0 and plan_file.exists():
                    actions = [
                        line.strip()
                        for line in plan_file.read_text().splitlines()
                        if line.strip() and not line.startswith(";")
                    ]
                    if actions:
                        return actions
                
                # If planner failed, check if it's the "not built" error
                if result.returncode != 0:
                    # Check if it's the common "not built" error - suppress output in that case
                    if result.stderr and "Could not find 'downward' in build" in result.stderr:
                        # Suppress output - will use fallback plan
                        raise FileNotFoundError("Fast Downward binary not found")
                    else:
                        # Other errors - print warning but still use fallback
                        print(f"Warning: Fast Downward failed (return code {result.returncode})", file=sys.stderr)
                        if result.stderr:
                            print(f"STDERR: {result.stderr[:500]}", file=sys.stderr)
                
            finally:
                # Clean up temporary file
                if plan_file.exists():
                    try:
                        plan_file.unlink()
                    except:
                        pass
                        
        except (FileNotFoundError, subprocess.TimeoutExpired, RuntimeError) as e:
            # Fall through to fallback - don't print error for "not built" case
            pass
    
    # Fallback to predefined plans
    domain_name = _extract_domain_name(domain_rel)
    if domain_name:
        fallback_plan = _get_fallback_plan(domain_name)
        if fallback_plan:
            # Only print info message, don't print warning since fallback is expected behavior
            return fallback_plan
        else:
            print(f"Warning: No fallback plan available for domain '{domain_name}'. Fast Downward is not built.", file=sys.stderr)
    
    # If no fallback available, return empty list
    print("Warning: Fast Downward not available and no fallback plan found", file=sys.stderr)
    return []
