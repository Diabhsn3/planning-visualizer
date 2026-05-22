"""End-to-end test for UNSEEN domains (not used during development).

Acceptance bar from the capstone report: ≥90% pass rate. Failures here are
recorded (not always fatal) because:
  - The LLM-renderer stage (skipped here — we only test the planner pipeline)
    has stochastic behavior; nightly real-LLM runs may need a re-run.
  - The custom-domain path falls through DefaultRenderer when no specific
    renderer is registered, which is the intended behavior.

This file tests ONLY the planner + state-generator path. The LLM-renderer
side is exercised in the Playwright suite where real LLM calls are gated
to the nightly job.
"""

import json
import time
from pathlib import Path

import pytest

from visualizer_api import visualize_plan


pytestmark = pytest.mark.e2e


UNSEEN_DIR = Path(__file__).resolve().parent / "unseen_domains"
REPORTS_DIR = Path(__file__).resolve().parents[4] / "reports"
RESULTS_FILE = REPORTS_DIR / "e2e-unseen.json"


UNSEEN_DOMAINS = sorted(
    [d.name for d in UNSEEN_DIR.iterdir() if d.is_dir()]
) if UNSEEN_DIR.exists() else []


def _record(domain_id: str, ok: bool, detail: str, duration: float):
    REPORTS_DIR.mkdir(exist_ok=True)
    payload = {}
    if RESULTS_FILE.exists():
        try:
            payload = json.loads(RESULTS_FILE.read_text())
        except json.JSONDecodeError:
            payload = {}
    payload[domain_id] = {"ok": ok, "detail": detail, "duration_s": round(duration, 3)}
    RESULTS_FILE.write_text(json.dumps(payload, indent=2))


@pytest.mark.parametrize("domain_id", UNSEEN_DOMAINS)
def test_unseen_domain_planner_pipeline(domain_id):
    """Planner + state-gen pipeline must produce a non-empty plan and states for an unseen domain."""
    if not UNSEEN_DOMAINS:
        pytest.skip("no unseen domains configured")
    domain_pddl = str(UNSEEN_DIR / domain_id / "domain.pddl")
    problem_pddl = str(UNSEEN_DIR / domain_id / "p1.pddl")

    started = time.time()
    try:
        result = visualize_plan(domain_pddl, problem_pddl, domain_name=domain_id)
        ok = bool(result.get("success") and result.get("plan") and result.get("states"))
        detail = (
            f"plan={len(result.get('plan', []))} states={len(result.get('states', []))}"
            if ok
            else result.get("error", "unknown failure")
        )
    except Exception as e:
        ok = False
        detail = f"{type(e).__name__}: {e}"
    duration = time.time() - started
    _record(domain_id, ok, detail, duration)

    assert ok, f"{domain_id} failed unseen-domain pipeline: {detail}"
