from src.planner_runner.runner import run_planner

CASES = [
    ("Blocks World p1", "domains/blocks_world/domain.pddl", "domains/blocks_world/p1.pddl"),
    ("Logistics p1",    "domains/logistics/domain.pddl",    "domains/logistics/p1.pddl"),
    ("Gripper p1",      "domains/gripper/domain.pddl",      "domains/gripper/p1.pddl"),
    ("Depot p1",        "domains/depot/domain.pddl",        "domains/depot/p1.pddl"),
    ("Hanoi p1",        "domains/hanoi/domain.pddl",        "domains/hanoi/p1.pddl"),
    ("Rovers p1",       "domains/rovers/domain.pddl",       "domains/rovers/p1.pddl"),
    ("Satellite p1",    "domains/satellite/domain.pddl",    "domains/satellite/p1.pddl"),
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
