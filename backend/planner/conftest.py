"""
Shared pytest configuration for the planner test suite.

Adds the planner directory to sys.path so tests can import the same way
production code does (e.g. `from state_generator import StateGenerator`).
"""

import sys
from pathlib import Path

import pytest

PLANNER_DIR = Path(__file__).resolve().parent
if str(PLANNER_DIR) not in sys.path:
    sys.path.insert(0, str(PLANNER_DIR))

DOMAINS_DIR = PLANNER_DIR / "domains"

# The legacy scripts in `tests/` (not under tests/unit, tests/integration,
# or tests/e2e) are ad-hoc developer scripts that pre-date this pytest setup.
# They use relative paths that only work when invoked from the repo root.
# Exclude them from collection so the structured suite remains green.
collect_ignore_glob = ["tests/test_*.py"]

BUILT_IN_DOMAINS = [
    "blocks_world",
    "depot",
    "gripper",
    "hanoi",
    "rovers",
    "satellite",
]


@pytest.fixture(scope="session")
def planner_dir() -> Path:
    return PLANNER_DIR


@pytest.fixture(scope="session")
def domains_dir() -> Path:
    return DOMAINS_DIR


@pytest.fixture(params=BUILT_IN_DOMAINS)
def builtin_domain(request, domains_dir):
    """Yields (domain_id, domain.pddl path, p1.pddl path) for each built-in domain."""
    name = request.param
    return {
        "id": name,
        "domain_pddl": domains_dir / name / "domain.pddl",
        "problem_pddl": domains_dir / name / "p1.pddl",
    }
