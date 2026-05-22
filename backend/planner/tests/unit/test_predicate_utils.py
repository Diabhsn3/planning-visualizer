"""Unit tests for predicate serialization utilities.

These helpers bridge Python (Predicate objects) → TypeScript (JSON strings),
so deterministic ordering matters: downstream caches and equality checks
depend on it.
"""

import pytest

from state_generator.pddl_parser import Predicate
from predicate_utils import (
    serialize_state,
    serialize_predicate_schema,
    serialize_objects,
)


pytestmark = pytest.mark.unit


def test_serialize_state_round_trip():
    state = {
        Predicate("on", ["b1", "b2"]),
        Predicate("ontable", ["b3"]),
        Predicate("clear", ["b1"]),
        Predicate("handempty", []),
    }
    out = serialize_state(state)
    assert set(out) == {"(on b1 b2)", "(ontable b3)", "(clear b1)", "(handempty)"}


def test_serialize_state_is_sorted_deterministic():
    state_a = {Predicate("on", ["a", "b"]), Predicate("clear", ["a"])}
    state_b = {Predicate("clear", ["a"]), Predicate("on", ["a", "b"])}
    assert serialize_state(state_a) == serialize_state(state_b)


def test_serialize_state_dedupes():
    state = {Predicate("on", ["a", "b"]), Predicate("on", ["a", "b"])}
    assert len(serialize_state(state)) == 1


def test_serialize_state_empty():
    assert serialize_state(set()) == []


def test_serialize_predicate_schema():
    schema = [("on", ["block", "block"]), ("clear", ["block"]), ("handempty", [])]
    out = serialize_predicate_schema(schema)
    assert out == [
        {"name": "on", "arg_types": ["block", "block"]},
        {"name": "clear", "arg_types": ["block"]},
        {"name": "handempty", "arg_types": []},
    ]


def test_serialize_objects_is_sorted():
    objects = {"c": "block", "a": "block", "b": "block"}
    out = serialize_objects(objects)
    assert [o["name"] for o in out] == ["a", "b", "c"]
    for entry in out:
        assert entry["type"] == "block"


def test_serialize_objects_empty():
    assert serialize_objects({}) == []
