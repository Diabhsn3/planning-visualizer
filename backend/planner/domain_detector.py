#!/usr/bin/env python3
"""
Domain Detector - Detects which planning domain a problem file belongs to.

This module analyzes PDDL problem files to identify their domain based on:
- Object types (e.g., block, ball, room, gripper)
- Predicates used in :init section (e.g., on, ontable, at-robby)
- Keywords and patterns specific to each domain
"""

import re
from typing import Dict, List, Tuple, Optional, Set
from pathlib import Path


# Domain signatures: unique predicates and types that identify each domain
DOMAIN_SIGNATURES = {
    "blocks-world": {
        "name": "Blocks World",
        "types": {"block"},
        "predicates": {"on", "ontable", "clear", "handempty", "holding"},
        "unique_predicates": {"ontable", "handempty"},  # Predicates unique to this domain
        "weight": 0,  # Will be calculated
    },
    "gripper": {
        "name": "Gripper",
        "types": {"room", "ball", "gripper"},
        "predicates": {"at-robby", "at", "carry", "free"},
        "unique_predicates": {"at-robby", "carry", "free"},
        "weight": 0,
    },
    "depot": {
        "name": "Depot",
        "types": {"depot", "distributor", "truck", "package", "location"},
        "predicates": {"at", "at-truck", "in-truck"},
        "unique_predicates": {"at-truck", "in-truck", "distributor"},
        "weight": 0,
    },
    "hanoi": {
        "name": "Tower of Hanoi",
        "types": {"disk", "peg"},
        "predicates": {"on", "smaller"},
        "unique_predicates": {"disk", "peg", "smaller"},
        "weight": 0,
    },
    "rovers": {
        "name": "Rovers",
        "types": {"rover", "waypoint", "camera", "objective", "mode"},
        "predicates": {"at-rover", "at-target", "calibrated", "communicated", "connected", "have-image"},
        "unique_predicates": {"at-rover", "calibrated", "communicated", "have-image", "waypoint"},
        "weight": 0,
    },
}


def extract_problem_info(problem_content: str) -> Dict:
    """
    Extract types, objects, and predicates from a PDDL problem file.
    
    Args:
        problem_content: Content of the PDDL problem file
        
    Returns:
        Dictionary with extracted information
    """
    # Normalize content
    content = problem_content.lower()
    
    # Extract object types from :objects section
    types_found: Set[str] = set()
    objects_match = re.search(r'\(:objects\s+(.*?)\)', content, re.DOTALL)
    if objects_match:
        objects_section = objects_match.group(1)
        # Find type declarations like "a b c - block"
        type_matches = re.findall(r'-\s*(\w+)', objects_section)
        types_found.update(type_matches)
    
    # Extract predicates from :init section
    predicates_found: Set[str] = set()
    init_match = re.search(r'\(:init\s+(.*?)\)\s*\(:goal', content, re.DOTALL)
    if not init_match:
        init_match = re.search(r'\(:init\s+(.*?)\)', content, re.DOTALL)
    
    if init_match:
        init_section = init_match.group(1)
        # Find predicate names (first word after opening paren)
        pred_matches = re.findall(r'\((\w+[-\w]*)', init_section)
        predicates_found.update(pred_matches)
    
    # Also check :goal section for predicates
    goal_match = re.search(r'\(:goal\s+(.*?)\)\s*\)', content, re.DOTALL)
    if goal_match:
        goal_section = goal_match.group(1)
        pred_matches = re.findall(r'\((\w+[-\w]*)', goal_section)
        predicates_found.update(pred_matches)
    
    # Extract domain name if specified
    domain_match = re.search(r'\(:domain\s+(\w+[-\w]*)\)', content)
    declared_domain = domain_match.group(1) if domain_match else None
    
    return {
        "types": types_found,
        "predicates": predicates_found,
        "declared_domain": declared_domain,
    }


def detect_domain(problem_content: str) -> Tuple[Optional[str], List[Dict], str]:
    """
    Detect which domain a problem file belongs to.
    
    Args:
        problem_content: Content of the PDDL problem file
        
    Returns:
        Tuple of (detected_domain_id, ranked_matches, explanation)
        - detected_domain_id: Best matching domain ID or None
        - ranked_matches: List of {domain_id, score, name} sorted by score
        - explanation: Human-readable explanation of the detection
    """
    info = extract_problem_info(problem_content)
    types_found = info["types"]
    predicates_found = info["predicates"]
    declared_domain = info["declared_domain"]
    
    # Calculate match scores for each domain
    scores: List[Dict] = []
    
    for domain_id, signature in DOMAIN_SIGNATURES.items():
        score = 0
        matches = []
        
        # Check type matches (high weight)
        type_matches = types_found & signature["types"]
        if type_matches:
            score += len(type_matches) * 3
            matches.append(f"types: {', '.join(type_matches)}")
        
        # Check predicate matches (medium weight)
        pred_matches = predicates_found & signature["predicates"]
        if pred_matches:
            score += len(pred_matches) * 2
            matches.append(f"predicates: {', '.join(pred_matches)}")
        
        # Check unique predicate matches (high weight - these are definitive)
        unique_matches = (types_found | predicates_found) & signature["unique_predicates"]
        if unique_matches:
            score += len(unique_matches) * 5
        
        # Check if declared domain name matches
        if declared_domain:
            domain_name_lower = signature["name"].lower().replace(" ", "-")
            if declared_domain in [domain_id, domain_name_lower, domain_id.replace("-", "_")]:
                score += 10
                matches.append(f"declared domain: {declared_domain}")
        
        scores.append({
            "domain_id": domain_id,
            "name": signature["name"],
            "score": score,
            "matches": matches,
        })
    
    # Sort by score descending
    scores.sort(key=lambda x: x["score"], reverse=True)
    
    # Determine best match
    if scores[0]["score"] > 0:
        best_match = scores[0]
        detected_domain = best_match["domain_id"]
        
        # Build explanation
        if best_match["score"] >= 10:
            confidence = "high"
        elif best_match["score"] >= 5:
            confidence = "medium"
        else:
            confidence = "low"
        
        explanation = (
            f"Detected domain: {best_match['name']} ({confidence} confidence). "
            f"Matched: {'; '.join(best_match['matches']) if best_match['matches'] else 'partial patterns'}"
        )
    else:
        detected_domain = None
        explanation = "Could not detect domain from problem file."
    
    return detected_domain, scores, explanation


def check_domain_mismatch(
    problem_content: str, 
    selected_domain: str
) -> Tuple[bool, Optional[str], str]:
    """
    Check if the problem content matches the selected domain.
    
    Args:
        problem_content: Content of the PDDL problem file
        selected_domain: The domain ID selected by the user
        
    Returns:
        Tuple of (is_match, suggested_domain, message)
        - is_match: True if problem matches selected domain
        - suggested_domain: Suggested domain ID if mismatch, None otherwise
        - message: Human-readable message about the result
    """
    detected_domain, ranked_matches, explanation = detect_domain(problem_content)
    
    # Normalize domain IDs for comparison
    selected_normalized = selected_domain.lower().replace("_", "-")
    
    if detected_domain is None:
        # Could not detect domain - let the planner try
        return True, None, "Domain could not be auto-detected. Proceeding with selected domain."
    
    detected_normalized = detected_domain.lower().replace("_", "-")
    
    if detected_normalized == selected_normalized:
        return True, None, f"Problem matches selected domain: {DOMAIN_SIGNATURES[detected_domain]['name']}"
    
    # Domain mismatch detected
    suggested_name = DOMAIN_SIGNATURES[detected_domain]["name"]
    selected_name = DOMAIN_SIGNATURES.get(selected_domain, {}).get("name", selected_domain)
    
    # Build helpful message
    message = (
        f"It seems your problem belongs to a different domain. "
        f"You selected '{selected_name}', but the problem appears to be for '{suggested_name}'."
    )
    
    # Add suggestion if we have high confidence
    if ranked_matches and ranked_matches[0]["score"] >= 5:
        message += f"\n\nSuggestion: Try selecting the '{suggested_name}' domain instead."
    
    return False, detected_domain, message


def get_supported_domains() -> List[Dict]:
    """
    Get list of supported domains for detection.
    
    Returns:
        List of domain info dictionaries
    """
    return [
        {
            "id": domain_id,
            "name": sig["name"],
            "types": list(sig["types"]),
            "predicates": list(sig["predicates"]),
        }
        for domain_id, sig in DOMAIN_SIGNATURES.items()
    ]


# CLI interface for testing
if __name__ == "__main__":
    import sys
    
    if len(sys.argv) < 2:
        print("Usage: domain_detector.py <problem_file> [selected_domain]")
        print("       domain_detector.py --list")
        sys.exit(1)
    
    if sys.argv[1] == "--list":
        print("Supported domains:")
        for domain in get_supported_domains():
            print(f"  {domain['id']}: {domain['name']}")
            print(f"    Types: {', '.join(domain['types'])}")
            print(f"    Predicates: {', '.join(domain['predicates'])}")
        sys.exit(0)
    
    problem_file = sys.argv[1]
    selected_domain = sys.argv[2] if len(sys.argv) > 2 else None
    
    with open(problem_file, 'r') as f:
        content = f.read()
    
    if selected_domain:
        is_match, suggested, message = check_domain_mismatch(content, selected_domain)
        print(f"Match: {is_match}")
        if suggested:
            print(f"Suggested domain: {suggested}")
        print(f"Message: {message}")
    else:
        detected, ranked, explanation = detect_domain(content)
        print(f"Detected domain: {detected}")
        print(f"Explanation: {explanation}")
        print("\nRanked matches:")
        for match in ranked[:3]:
            print(f"  {match['domain_id']}: score={match['score']}, {match['name']}")
