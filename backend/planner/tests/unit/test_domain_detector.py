"""Unit tests for the domain detector.

The detector reads a problem file and identifies which built-in domain it
belongs to. Critical for the visualizer because the wrong domain → wrong
renderer → meaningless output. Tests cover correct detection for each
built-in domain, mismatch detection, and the unknown-domain fallback.
"""

import pytest

from domain_detector import (
    detect_domain,
    check_domain_mismatch,
    extract_problem_info,
    get_supported_domains,
)


pytestmark = pytest.mark.unit


# id -> expected detected_domain id (note: detector returns "blocks-world")
DOMAIN_ID_MAP = {
    "blocks_world": "blocks-world",
    "depot": "depot",
    "gripper": "gripper",
    "hanoi": "hanoi",
    "rovers": "rovers",
    "satellite": "satellite",
}


def test_each_builtin_problem_is_detected_correctly(builtin_domain):
    content = builtin_domain["problem_pddl"].read_text()
    detected, ranked, explanation = detect_domain(content)
    expected = DOMAIN_ID_MAP[builtin_domain["id"]]
    assert detected == expected, (
        f"detector returned {detected!r} for {builtin_domain['id']!r}; "
        f"top 3 scores: {[(r['domain_id'], r['score']) for r in ranked[:3]]}"
    )
    assert "confidence" in explanation.lower() or detected in explanation.lower()


def test_unknown_problem_returns_none():
    content = """
    (define (problem nope)
      (:domain unknown-thing)
      (:objects x y z)
      (:init (zzz x))
      (:goal (zzz y)))
    """
    detected, ranked, explanation = detect_domain(content)
    assert detected is None
    assert "could not detect" in explanation.lower()


def test_mismatch_is_flagged(domains_dir):
    """A gripper problem with user-selected blocks-world should fail mismatch check."""
    gripper_problem = (domains_dir / "gripper" / "p1.pddl").read_text()
    is_match, suggested, message = check_domain_mismatch(gripper_problem, "blocks-world")
    assert is_match is False
    assert suggested == "gripper"
    assert "gripper" in message.lower()


def test_matching_selection_passes(domains_dir):
    bw_problem = (domains_dir / "blocks_world" / "p1.pddl").read_text()
    is_match, suggested, message = check_domain_mismatch(bw_problem, "blocks-world")
    assert is_match is True
    assert suggested is None


def test_underscore_and_hyphen_normalize(domains_dir):
    """User may pass 'blocks_world' instead of 'blocks-world' — detector should accept."""
    bw_problem = (domains_dir / "blocks_world" / "p1.pddl").read_text()
    is_match, _, _ = check_domain_mismatch(bw_problem, "blocks_world")
    assert is_match is True


def test_extract_problem_info_pulls_types_and_predicates(domains_dir):
    bw_problem = (domains_dir / "blocks_world" / "p1.pddl").read_text()
    info = extract_problem_info(bw_problem)
    assert "block" in info["types"]
    assert "ontable" in info["predicates"]
    assert info["declared_domain"] == "blocks-world"


def test_get_supported_domains_returns_six():
    domains = get_supported_domains()
    ids = {d["id"] for d in domains}
    assert ids == {"blocks-world", "depot", "gripper", "hanoi", "rovers", "satellite"}
    for d in domains:
        assert d["name"]
        assert d["types"]
        assert d["predicates"]


def test_undetectable_proceeds_with_selected():
    """If detector can't identify the domain, mismatch check should not block."""
    is_match, suggested, message = check_domain_mismatch(
        "(define (problem x) (:objects) (:init) (:goal ()))", "blocks-world"
    )
    assert is_match is True
    assert suggested is None
    assert "could not be auto-detected" in message.lower() or "proceeding" in message.lower()
