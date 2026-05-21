"""
Predicate serialization utilities for the verification agent.

The planner emits states as `Set[Predicate]` where each `Predicate` has
`name` and `params`. The verification agent (in TypeScript) needs them as
plain JSON strings in canonical PDDL S-expression form:

    {"(on b1 b2)", "(ontable b3)", "(clear b1)", "(handempty)"}

Sort + dedupe for deterministic output so identical states across runs
serialize to identical lists (lets downstream caches and equality checks
work without surprises).
"""

from typing import List, Set, Tuple
from state_generator.pddl_parser import Predicate


def serialize_state(state: Set[Predicate]) -> List[str]:
    """Serialize a set of predicates to a sorted list of S-expressions."""
    return sorted({str(p) for p in state})


def serialize_predicate_schema(
    schema: List[Tuple[str, List[str]]]
) -> List[dict]:
    """Serialize the predicate schema from PDDLParser.predicates_schema.

    Input shape (from pddl_parser.PDDLParser.predicates_schema):
        [(name, [type1, type2, ...]), ...]

    Output is a list of dicts so the TS side can render readable signatures
    without re-parsing PDDL:
        [{"name": "on", "arg_types": ["block", "block"]}, ...]
    """
    return [{"name": name, "arg_types": list(types)} for name, types in schema]


def serialize_objects(objects: dict) -> List[dict]:
    """Serialize PDDLParser.objects (object_name -> type) to a stable list.

    Output:
        [{"name": "b1", "type": "block"}, ...]
    """
    return [{"name": name, "type": typ} for name, typ in sorted(objects.items())]
