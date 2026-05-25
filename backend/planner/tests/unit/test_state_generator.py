"""Unit tests for the state generator.

Exercises predicate transitions without invoking the planner — we feed
hand-crafted plans (blocks-world is convenient because each action's effect
on the predicate set is obvious).
"""

import pytest

from state_generator import StateGenerator
from state_generator.pddl_parser import Predicate


pytestmark = pytest.mark.unit


@pytest.fixture
def bw(domains_dir):
    return StateGenerator(
        str(domains_dir / "blocks_world" / "domain.pddl"),
        str(domains_dir / "blocks_world" / "p1.pddl"),
    )


def test_initial_state_matches_problem(bw):
    state = bw.get_current_state()
    assert Predicate("ontable", ["a"]) in state
    assert Predicate("ontable", ["b"]) in state
    assert Predicate("ontable", ["c"]) in state
    assert Predicate("handempty", []) in state
    assert Predicate("clear", ["a"]) in state


def test_pick_up_action_adds_and_removes_correct_predicates(bw):
    ok = bw.apply_action("(pick-up a)", force_apply=False)
    assert ok is True
    state = bw.get_current_state()
    assert Predicate("holding", ["a"]) in state
    assert Predicate("ontable", ["a"]) not in state
    assert Predicate("clear", ["a"]) not in state
    assert Predicate("handempty", []) not in state


def test_state_history_grows_with_each_action(bw):
    bw.apply_action("(pick-up a)", force_apply=False)
    bw.apply_action("(stack a b)", force_apply=False)
    history = bw.get_state_history()
    # initial + 2 applied
    assert len(history) == 3


def test_precondition_failure_returns_false(bw):
    # pick-up requires (handempty); apply pick-up twice — second should fail.
    assert bw.apply_action("(pick-up a)", force_apply=False) is True
    ok = bw.apply_action("(pick-up b)", force_apply=False)
    assert ok is False  # handempty no longer holds


def test_force_apply_overrides_precondition_failure(bw):
    bw.apply_action("(pick-up a)", force_apply=False)
    # Without force_apply this would fail; with it, effects still apply.
    ok = bw.apply_action("(pick-up b)", force_apply=True)
    assert ok is True


def test_reset_restores_initial_state(bw):
    bw.apply_action("(pick-up a)", force_apply=False)
    bw.reset()
    assert Predicate("ontable", ["a"]) in bw.get_current_state()
    assert len(bw.get_state_history()) == 1


def test_unknown_action_returns_false_and_warns(bw, capsys):
    ok = bw.apply_action("(teleport a)", force_apply=False)
    assert ok is False
    err = capsys.readouterr().err
    assert "teleport" in err.lower() or "not found" in err.lower()


def test_param_count_mismatch_returns_false(bw, capsys):
    # pick-up takes 1 param; provide 2.
    ok = bw.apply_action("(pick-up a b)", force_apply=False)
    assert ok is False
    err = capsys.readouterr().err
    assert "parameter count" in err.lower() or "mismatch" in err.lower()


def test_apply_plan_produces_state_per_step(bw):
    plan = ["(pick-up a)", "(stack a b)", "(pick-up c)"]
    states = bw.apply_plan(plan)
    # initial + 3 actions
    assert len(states) == 4
    # final state should have (on a b) and (holding c)
    final = states[-1]
    assert Predicate("on", ["a", "b"]) in final
    assert Predicate("holding", ["c"]) in final


def test_state_to_dict_serializes_predicates(bw):
    state = bw.get_current_state()
    d = bw.state_to_dict(state)
    assert "ontable" in d
    assert ["a"] in d["ontable"]
    assert d["handempty"] == [[]]


def test_grounded_action_parsing_lowercases(bw):
    name, params = bw.parse_grounded_action("(PICK-UP A)")
    assert name == "pick-up"
    assert params == ["a"]
