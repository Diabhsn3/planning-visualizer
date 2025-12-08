from pathlib import Path
import subprocess
import tempfile

# Planner directory (where domains are located)
PLANNER_DIR = Path(__file__).resolve().parent.parent
# Project root (where planning-tools is located)
PROJECT_ROOT = PLANNER_DIR.parent.parent

FD_PY = PROJECT_ROOT / "planning-tools" / "downward" / "fast-downward.py"

def run_planner(domain_rel, problem_rel):
    domain = PLANNER_DIR / domain_rel
    problem = PLANNER_DIR / problem_rel

    with tempfile.NamedTemporaryFile(delete=False) as tmp:
        plan_file = Path(tmp.name)

    cmd = [
        "python3",
        str(FD_PY),
        "--plan-file", str(plan_file),
        str(domain),
        str(problem),
        "--search", "astar(lmcut())"
    ]

    result = subprocess.run(cmd, capture_output=True, text=True)

    if result.returncode != 0:
        print("STDOUT:\n", result.stdout)
        print("STDERR:\n", result.stderr)
        raise RuntimeError("Planner failed")

    if not plan_file.exists():
        return []

    actions = [
        line.strip()
        for line in plan_file.read_text().splitlines()
        if line.strip() and not line.startswith(";")
    ]
    return actions
