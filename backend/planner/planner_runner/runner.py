from pathlib import Path
import subprocess
import tempfile
import sys


# =========================
# Project paths
# =========================

# planning-visualizer/
PROJECT_ROOT = Path(__file__).resolve().parents[3]

FD_ROOT = PROJECT_ROOT / "planning-tools" / "downward"
FD_PY = FD_ROOT / "fast-downward.py"


# =========================
# Main planner function
# =========================

def run_planner(domain_rel: str, problem_rel: str):
    """
    Run Fast Downward on given domain & problem files.

    Args:
        domain_rel: relative path to domain.pddl (from project root)
        problem_rel: relative path to problem.pddl (from project root)

    Returns:
        List of grounded action strings
    """

    domain = PROJECT_ROOT / domain_rel
    problem = PROJECT_ROOT / problem_rel

    # Debug prints (can be removed later)
    print(domain)
    print(problem)

    if not FD_PY.exists():
        raise FileNotFoundError(f"Fast Downward script not found: {FD_PY}")

    if not domain.exists():
        raise FileNotFoundError(f"Domain file not found: {domain}")

    if not problem.exists():
        raise FileNotFoundError(f"Problem file not found: {problem}")

    # Temporary plan file
    with tempfile.NamedTemporaryFile(delete=False, suffix=".plan") as tmp:
        plan_file = Path(tmp.name)

    cmd = [
        sys.executable,
        str(FD_PY),
        "--plan-file", str(plan_file),
        str(domain),
        str(problem),
        "--search", "astar(lmcut())",
    ]

    result = subprocess.run(
        cmd,
        cwd=FD_ROOT,
        capture_output=True,
        text=True,
    )

    if result.returncode != 0:
        print("=== Fast Downward FAILED ===", file=sys.stderr)
        print("STDOUT:\n", result.stdout, file=sys.stderr)
        print("STDERR:\n", result.stderr, file=sys.stderr)
        raise RuntimeError("Planner failed")

    if not plan_file.exists():
        return []

    actions = [
        line.strip()
        for line in plan_file.read_text().splitlines()
        if line.strip() and not line.startswith(";")
    ]

    return actions
