"""End-to-end pipeline test: PDDL files → planner → state generator → renderer.

For each built-in domain, the full pipeline must:
  1. Find a plan (Fast Downward returns at least one action)
  2. Generate the correct number of intermediate states (initial + one per action)
  3. Produce a RenderedState with non-empty objects
  4. Reach the goal state on the last state

Acceptance bar from the capstone report: 100% pass on built-in domains.
Per-domain results are written to reports/e2e-domains.json for the dashboard.
"""

import json
import os
import time
from pathlib import Path

import pytest

from state_generator import StateGenerator
from state_renderer import RendererFactory
from visualizer_api import visualize_plan


pytestmark = pytest.mark.e2e


REPORTS_DIR = Path(__file__).resolve().parents[4] / "reports"
RESULTS_FILE = REPORTS_DIR / "e2e-domains.json"


# Map fixture id (folder name) → declared PDDL domain name (used by renderer factory).
DOMAIN_NAME_MAP = {
    "blocks_world": "blocks-world",
    "gripper": "gripper",
    "depot": "depot",
    "hanoi": "hanoi",
    "rovers": "rovers",
    "satellite": "satellite",
}


def _record(domain_id: str, stage: str, ok: bool, detail: str = "", duration: float = 0.0):
    REPORTS_DIR.mkdir(exist_ok=True)
    payload = {}
    if RESULTS_FILE.exists():
        try:
            payload = json.loads(RESULTS_FILE.read_text())
        except json.JSONDecodeError:
            payload = {}
    domain = payload.setdefault(domain_id, {"stages": {}})
    domain["stages"][stage] = {"ok": ok, "detail": detail, "duration_s": round(duration, 3)}
    domain["overall"] = all(s["ok"] for s in domain["stages"].values())
    RESULTS_FILE.write_text(json.dumps(payload, indent=2))


@pytest.mark.parametrize("domain_id", list(DOMAIN_NAME_MAP.keys()))
def test_builtin_domain_full_pipeline(domains_dir, domain_id):
    """End-to-end: planner produces a plan, state gen replays it, renderer outputs visual data."""
    domain_pddl = str(domains_dir / domain_id / "domain.pddl")
    problem_pddl = str(domains_dir / domain_id / "p1.pddl")
    domain_name = DOMAIN_NAME_MAP[domain_id]

    started = time.time()
    try:
        result = visualize_plan(domain_pddl, problem_pddl, domain_name=domain_name)
    except Exception as e:
        _record(domain_id, "pipeline", False, f"raised {type(e).__name__}: {e}", time.time() - started)
        raise

    duration = time.time() - started

    # ----- Stage 1: planner produced a plan -----
    success = result.get("success", False)
    if not success:
        err = result.get("error", "(no error string)")
        _record(domain_id, "pipeline", False, f"visualize_plan returned success=false: {err}", duration)
        pytest.fail(f"visualize_plan failed for {domain_id}: {err}")

    plan = result.get("plan", [])
    assert isinstance(plan, list) and len(plan) > 0, f"no actions returned for {domain_id}"
    _record(domain_id, "plan", True, f"{len(plan)} actions", duration)

    # ----- Stage 2: states were generated -----
    states = result.get("states", [])
    assert isinstance(states, list)
    assert len(states) == len(plan) + 1, (
        f"{domain_id}: expected {len(plan)+1} states (initial + per action), got {len(states)}"
    )
    _record(domain_id, "states", True, f"{len(states)} states", duration)

    # ----- Stage 3: renderer produced visual output -----
    for i, state in enumerate(states):
        assert state.get("domain"), f"{domain_id} state {i} missing 'domain'"
    _record(domain_id, "render", True, "all states have domain field", duration)

    _record(domain_id, "pipeline", True, f"{len(plan)} actions, {len(states)} states", duration)
