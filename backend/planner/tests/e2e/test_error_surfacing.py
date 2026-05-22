"""Error-surfacing audit.

Probes every boundary with bad input and asserts:
  1. The error is propagated, not swallowed.
  2. The error message is user-readable (not just a stack trace).
  3. The result is recorded for the dashboard's "errors are never silent" panel.

Captures captured messages to reports/error-surfacing.json so the demo
dashboard can show the supervisor exactly what users see for each failure.
"""

import json
import subprocess
import sys
import time
from pathlib import Path

import pytest

from state_generator import StateGenerator
from state_generator.pddl_parser import PDDLParser
from domain_detector import check_domain_mismatch
from visualizer_api import visualize_plan


pytestmark = [pytest.mark.e2e, pytest.mark.unit]


REPORTS_DIR = Path(__file__).resolve().parents[4] / "reports"
RESULTS_FILE = REPORTS_DIR / "error-surfacing.json"


def _record(case: str, surfaced: bool, message: str):
    REPORTS_DIR.mkdir(exist_ok=True)
    payload = {}
    if RESULTS_FILE.exists():
        try:
            payload = json.loads(RESULTS_FILE.read_text())
        except json.JSONDecodeError:
            payload = {}
    payload[case] = {
        "surfaced": surfaced,
        "user_visible_message": message[:400],
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S"),
    }
    RESULTS_FILE.write_text(json.dumps(payload, indent=2))


def test_parser_missing_domain_file_raises(tmp_path):
    """Boundary: PDDL parser. Bad input: nonexistent file."""
    case = "pddl_parser__missing_file"
    try:
        PDDLParser(str(tmp_path / "no.pddl"), str(tmp_path / "no.pddl"))
        _record(case, False, "no exception raised")
        pytest.fail("parser swallowed missing-file error")
    except (FileNotFoundError, OSError) as e:
        _record(case, True, str(e))
        assert "no.pddl" in str(e) or "No such file" in str(e)


def test_state_generator_unknown_action_surfaces_to_stderr(domains_dir, capsys):
    """Boundary: state generator. Bad input: action not in domain."""
    case = "state_generator__unknown_action"
    sg = StateGenerator(
        str(domains_dir / "blocks_world" / "domain.pddl"),
        str(domains_dir / "blocks_world" / "p1.pddl"),
    )
    ok = sg.apply_action("(teleport a)")
    err = capsys.readouterr().err
    surfaced = (not ok) and "teleport" in err.lower()
    _record(case, surfaced, err.strip().split("\n")[0] if err else "")
    assert surfaced, f"unknown action did not surface a clear message; stderr was: {err!r}"


def test_visualize_plan_bad_pddl_returns_error_object(tmp_path):
    """Boundary: visualizer_api. Bad input: malformed PDDL."""
    case = "visualizer_api__malformed_pddl"
    bad = tmp_path / "bad.pddl"
    bad.write_text("(not valid pddl at all")
    problem = tmp_path / "p.pddl"
    problem.write_text("(also not valid")
    result = visualize_plan(str(bad), str(problem), domain_name="blocks-world")
    surfaced = (
        isinstance(result, dict)
        and result.get("success") is False
        and bool(result.get("error"))
    )
    _record(case, surfaced, result.get("error", ""))
    assert surfaced, f"bad PDDL did not produce structured error: {result!r}"


def test_visualize_plan_missing_file_returns_error(tmp_path):
    """Boundary: visualizer_api. Bad input: file does not exist."""
    case = "visualizer_api__missing_file"
    result = visualize_plan(
        str(tmp_path / "missing.pddl"),
        str(tmp_path / "missing.pddl"),
        domain_name="blocks-world",
    )
    surfaced = (
        isinstance(result, dict)
        and result.get("success") is False
        and bool(result.get("error"))
    )
    _record(case, surfaced, result.get("error", ""))
    assert surfaced, f"missing file did not produce structured error: {result!r}"


def test_domain_mismatch_surfaces_suggestion(domains_dir):
    """Boundary: domain detector. Wrong domain selected → must surface a suggestion."""
    case = "domain_detector__mismatch_surface"
    gripper = (domains_dir / "gripper" / "p1.pddl").read_text()
    is_match, suggested, message = check_domain_mismatch(gripper, "blocks-world")
    surfaced = (
        is_match is False
        and suggested is not None
        and "gripper" in message.lower()
    )
    _record(case, surfaced, message)
    assert surfaced, f"domain mismatch did not produce clear suggestion: {message!r}"


def test_cli_no_args_exits_nonzero(planner_dir):
    """Boundary: visualizer_api CLI. Bad input: no args."""
    case = "cli__no_args"
    result = subprocess.run(
        [sys.executable, str(planner_dir / "visualizer_api.py")],
        capture_output=True,
        text=True,
        timeout=10,
    )
    text = (result.stdout + result.stderr).strip()
    surfaced = result.returncode != 0 and "usage" in text.lower()
    _record(case, surfaced, text.split("\n")[0] if text else "")
    assert surfaced, f"CLI ate the no-args case silently. exit={result.returncode}, out={text!r}"
