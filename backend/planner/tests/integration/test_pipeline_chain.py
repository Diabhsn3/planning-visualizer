"""Integration tests for the planner pipeline (no Fast Downward required).

We feed a hand-crafted plan into the StateGenerator → RendererFactory chain
and assert the output shape that the TypeScript API consumes. This catches
breakage at the python-bridge contract WITHOUT needing the actual planner —
that's covered separately in tests/e2e.
"""

import json
import subprocess
import sys
from pathlib import Path

import pytest

from state_generator import StateGenerator
from state_renderer import RendererFactory
from predicate_utils import serialize_state, serialize_predicate_schema, serialize_objects


pytestmark = pytest.mark.integration


HARDCODED_PLANS = {
    "blocks_world": ["(pick-up a)", "(stack a b)"],
    "gripper": [
        "(pick ball1 rooma left)",
        "(move rooma roomb)",
        "(drop ball1 roomb left)",
    ],
}


@pytest.mark.parametrize("domain_id", ["blocks_world", "gripper"])
def test_state_gen_renderer_chain(domains_dir, domain_id):
    """Apply a known plan, get rendered states with the schema the TS side expects."""
    sg = StateGenerator(
        str(domains_dir / domain_id / "domain.pddl"),
        str(domains_dir / domain_id / "p1.pddl"),
    )
    plan = HARDCODED_PLANS[domain_id]
    states = sg.apply_plan(plan)
    assert len(states) == len(plan) + 1  # initial + one per action

    # Now feed each state through the renderer.
    renderer = RendererFactory.get_renderer(domain_id.replace("_", "-"))
    for state in states:
        out = renderer.render(state, sg.parser.objects, sg.parser.predicates_schema)
        # Renderer returns a RenderedState dataclass — must have the fields
        # the TS API consumes after JSON serialization.
        assert hasattr(out, "domain"), "renderer output missing 'domain' field"
        assert hasattr(out, "objects"), "renderer output missing 'objects' field"
        assert hasattr(out, "relations"), "renderer output missing 'relations' field"
        assert isinstance(out.objects, list)
        assert isinstance(out.relations, list)


def test_serialized_state_is_json_safe(domains_dir):
    """The TS API consumes serialized predicates as JSON strings — must be encodable."""
    sg = StateGenerator(
        str(domains_dir / "blocks_world" / "domain.pddl"),
        str(domains_dir / "blocks_world" / "p1.pddl"),
    )
    payload = {
        "predicates": serialize_state(sg.get_current_state()),
        "schema": serialize_predicate_schema(sg.parser.predicates_schema),
        "objects": serialize_objects(sg.parser.objects),
    }
    encoded = json.dumps(payload)
    decoded = json.loads(encoded)
    assert sorted(decoded["predicates"]) == decoded["predicates"]
    assert decoded["schema"][0]["name"]
    assert decoded["objects"][0]["name"]


def test_list_strategies_returns_json_via_cli(planner_dir):
    """visualizer_api.py list-strategies — exercises the CLI contract the TS API uses."""
    script = planner_dir / "visualizer_api.py"
    result = subprocess.run(
        [sys.executable, str(script), "list-strategies"],
        capture_output=True,
        text=True,
        timeout=20,
    )
    assert result.returncode == 0, f"stderr: {result.stderr}"
    payload = json.loads(result.stdout)
    assert payload["success"] is True
    assert isinstance(payload["strategies"], list)
    assert len(payload["strategies"]) > 0
    for s in payload["strategies"]:
        assert "id" in s and "name" in s


def test_bad_args_exits_nonzero(planner_dir):
    """Missing args should NOT silently succeed — must exit non-zero (no silent failure)."""
    script = planner_dir / "visualizer_api.py"
    result = subprocess.run(
        [sys.executable, str(script)],
        capture_output=True,
        text=True,
        timeout=10,
    )
    assert result.returncode != 0
    # Usage message goes to stdout per the script; either stream is fine.
    output = result.stdout + result.stderr
    assert "usage" in output.lower()
