"""Unit tests for the PDDL parser.

These tests are hermetic — they read PDDL files from disk but never invoke
Fast Downward or any LLM. They verify the parser handles each built-in domain
correctly and surfaces errors on malformed input rather than failing silently.
"""

from pathlib import Path

import pytest

from state_generator.pddl_parser import PDDLParser, Predicate


pytestmark = pytest.mark.unit


# ---------------------------------------------------------------------------
# Happy paths — one assertion per domain that the parser produces sane output.
# ---------------------------------------------------------------------------

def test_blocks_world_parses(domains_dir):
    p = PDDLParser(
        str(domains_dir / "blocks_world" / "domain.pddl"),
        str(domains_dir / "blocks_world" / "p1.pddl"),
    )
    assert p.domain_name == "blocks-world"
    assert p.problem_name == "bw-1"
    assert set(p.actions) == {"pick-up", "put-down", "stack", "unstack"}
    assert {"a", "b", "c"} <= set(p.objects)
    for obj in ("a", "b", "c"):
        assert p.objects[obj] == "block"
    assert Predicate("ontable", ["a"]) in p.init_state
    assert Predicate("handempty", []) in p.init_state


def test_gripper_parses(domains_dir):
    p = PDDLParser(
        str(domains_dir / "gripper" / "domain.pddl"),
        str(domains_dir / "gripper" / "p1.pddl"),
    )
    assert p.domain_name == "gripper"
    assert set(p.actions) == {"move", "pick", "drop"}
    assert p.objects["ball1"] == "ball"
    assert p.objects["rooma"] == "room"
    assert p.objects["left"] == "gripper"
    assert Predicate("at-robby", ["rooma"]) in p.init_state


def test_every_builtin_domain_parses(builtin_domain):
    """Smoke: every built-in domain parses without raising."""
    p = PDDLParser(str(builtin_domain["domain_pddl"]), str(builtin_domain["problem_pddl"]))
    assert p.domain_name, f"domain_name empty for {builtin_domain['id']}"
    assert p.actions, f"no actions parsed for {builtin_domain['id']}"
    assert p.objects, f"no objects parsed for {builtin_domain['id']}"
    assert p.init_state, f"empty init state for {builtin_domain['id']}"


# ---------------------------------------------------------------------------
# Behavior of the parser internals.
# ---------------------------------------------------------------------------

def test_predicate_equality_and_hash():
    a = Predicate("on", ["x", "y"])
    b = Predicate("on", ["x", "y"])
    c = Predicate("on", ["y", "x"])
    assert a == b
    assert hash(a) == hash(b)
    assert a != c
    s = {a, b, c}
    assert len(s) == 2  # a and b dedupe


def test_predicate_str_format():
    assert str(Predicate("on", ["a", "b"])) == "(on a b)"
    assert str(Predicate("handempty", [])) == "(handempty)"


def test_tokens_are_lowercased(tmp_path):
    """PDDL is case-insensitive; the parser lowercases tokens for consistent matching."""
    domain_txt = """
    (define (domain TEST)
      (:requirements :strips)
      (:predicates (Foo ?x))
      (:action ACT :parameters (?x) :precondition (Foo ?x) :effect (not (Foo ?x))))
    """
    problem_txt = """
    (define (problem TEST-1)
      (:domain TEST)
      (:objects A)
      (:init (Foo A))
      (:goal (not (Foo A))))
    """
    domain_path = tmp_path / "domain.pddl"
    problem_path = tmp_path / "problem.pddl"
    domain_path.write_text(domain_txt)
    problem_path.write_text(problem_txt)

    p = PDDLParser(str(domain_path), str(problem_path))
    assert p.domain_name == "test"
    assert "act" in p.actions
    assert Predicate("foo", ["a"]) in p.init_state


def test_comments_are_stripped(tmp_path):
    domain_txt = """
    ; this is a comment about the domain
    (define (domain c)
      (:requirements :strips)
      ; another comment
      (:predicates (p ?x))
      (:action a :parameters (?x) :precondition (p ?x) :effect (not (p ?x))))
    """
    problem_txt = """
    (define (problem c-1)
      (:domain c)
      (:objects x)
      (:init (p x))
      (:goal (not (p x))))
    """
    d = tmp_path / "d.pddl"; pr = tmp_path / "p.pddl"
    d.write_text(domain_txt); pr.write_text(problem_txt)
    p = PDDLParser(str(d), str(pr))
    assert "a" in p.actions


def test_missing_file_raises_clear_error(tmp_path):
    """Parser must surface a file-not-found error, not silently produce empty output."""
    with pytest.raises((FileNotFoundError, OSError)):
        PDDLParser(str(tmp_path / "nope.pddl"), str(tmp_path / "also-nope.pddl"))


def test_action_lookup_raises_on_unknown_name(domains_dir):
    p = PDDLParser(
        str(domains_dir / "blocks_world" / "domain.pddl"),
        str(domains_dir / "blocks_world" / "p1.pddl"),
    )
    with pytest.raises(ValueError, match="not found"):
        p.get_action_by_name("nonexistent-action")
