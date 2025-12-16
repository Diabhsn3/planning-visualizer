import sys
from pathlib import Path

# Add planner directory to path
PLANNER_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PLANNER_DIR))

from planner_runner.runner import run_planner

CASES = [
    ("Blocks World p1", "backend/planner/domains/blocks_world/domain.pddl", "backend/planner/domains/blocks_world/p1.pddl"),
    ("Logistics p1",    "backend/planner/domains/logistics/domain.pddl",    "backend/planner/domains/logistics/p1.pddl"),
    ("Gripper p1",      "backend/planner/domains/gripper/domain.pddl",      "backend/planner/domains/gripper/p1.pddl"),
    ("Depot p1",        "backend/planner/domains/depot/domain.pddl",        "backend/planner/domains/depot/p1.pddl"),
    ("Hanoi p1",        "backend/planner/domains/hanoi/domain.pddl",        "backend/planner/domains/hanoi/p1.pddl"),
    ("Rovers p1",       "backend/planner/domains/rovers/domain.pddl",       "backend/planner/domains/rovers/p1.pddl"),
    ("Satellite p1",    "backend/planner/domains/satellite/domain.pddl",    "backend/planner/domains/satellite/p1.pddl"),
]






def run_case(name: str, domain: str, problem: str):
    print(f"\n=== {name} ===")
    actions = run_planner(domain, problem)
    if not actions:
        print("No plan found.")
        return actions

    for i, act in enumerate(actions, start=1):
        print(f"{i:02d}. {act}")
    return actions


if __name__ == "__main__":
    for name, dom, prob in CASES:
        run_case(name, dom, prob)
        print("done")
