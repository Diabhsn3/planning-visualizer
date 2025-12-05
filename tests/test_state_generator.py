"""
Test script for State Generator (Step 2).
Tests PDDL parsing and state generation with blocks world domain.
"""

import sys
from pathlib import Path

# Add src to path
PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT))

from src.planner_runner.runner import run_planner
from src.state_generator import StateGenerator
import json


def test_blocks_world():
    """Test state generator with blocks world domain."""
    print("=" * 60)
    print("Testing Blocks World Domain")
    print("=" * 60)
    
    domain_path = "domains/blocks_world/domain.pddl"
    problem_path = "domains/blocks_world/p1.pddl"
    
    # Step 1: Run planner to get action sequence
    print("\n[Step 1] Running planner...")
    actions = run_planner(domain_path, problem_path)
    print(f"Plan found with {len(actions)} actions:")
    for i, action in enumerate(actions):
        print(f"  {i + 1}. {action}")
    
    # Step 2: Initialize state generator
    print("\n[Step 2] Initializing state generator...")
    sg = StateGenerator(
        str(PROJECT_ROOT / domain_path),
        str(PROJECT_ROOT / problem_path)
    )
    
    # Print initial state
    print("\nInitial state:")
    init_state = sg.get_current_state()
    for pred in sorted(init_state, key=lambda p: (p.name, str(p.params))):
        print(f"  {pred}")
    
    # Step 3: Apply actions and generate states
    print("\n[Step 3] Applying actions and generating states...")
    states = sg.apply_plan(actions)
    
    print(f"\nGenerated {len(states)} states (including initial state)")
    
    # Print each state
    for i, state in enumerate(states):
        if i == 0:
            print(f"\nState {i} (Initial):")
        else:
            print(f"\nState {i} (After action: {actions[i-1]}):")
        
        for pred in sorted(state, key=lambda p: (p.name, str(p.params))):
            print(f"  {pred}")
    
    # Step 4: Generate JSON representation
    print("\n[Step 4] Generating JSON representation...")
    states_json = sg.generate_states_json(actions)
    
    print("\nJSON representation:")
    print(json.dumps(states_json, indent=2))
    
    # Save to file
    output_file = PROJECT_ROOT / "output" / "blocks_world_states.json"
    output_file.parent.mkdir(exist_ok=True)
    with open(output_file, 'w') as f:
        json.dump({
            "domain": "blocks-world",
            "problem": "bw-1",
            "plan": actions,
            "states": states_json
        }, f, indent=2)
    
    print(f"\nStates saved to: {output_file}")
    
    return True


def test_gripper():
    """Test state generator with gripper domain."""
    print("\n" + "=" * 60)
    print("Testing Gripper Domain")
    print("=" * 60)
    
    domain_path = "domains/gripper/domain.pddl"
    problem_path = "domains/gripper/p1.pddl"
    
    # Step 1: Run planner
    print("\n[Step 1] Running planner...")
    actions = run_planner(domain_path, problem_path)
    print(f"Plan found with {len(actions)} actions:")
    for i, action in enumerate(actions):
        print(f"  {i + 1}. {action}")
    
    # Step 2: Initialize state generator
    print("\n[Step 2] Initializing state generator...")
    sg = StateGenerator(
        str(PROJECT_ROOT / domain_path),
        str(PROJECT_ROOT / problem_path)
    )
    
    # Print initial state
    print("\nInitial state:")
    init_state = sg.get_current_state()
    for pred in sorted(init_state, key=lambda p: (p.name, str(p.params))):
        print(f"  {pred}")
    
    # Step 3: Apply actions
    print("\n[Step 3] Applying actions...")
    states = sg.apply_plan(actions)
    print(f"Generated {len(states)} states")
    
    # Step 4: Generate JSON
    states_json = sg.generate_states_json(actions)
    
    # Save to file
    output_file = PROJECT_ROOT / "output" / "gripper_states.json"
    output_file.parent.mkdir(exist_ok=True)
    with open(output_file, 'w') as f:
        json.dump({
            "domain": "gripper",
            "problem": "gripper-1",
            "plan": actions,
            "states": states_json
        }, f, indent=2)
    
    print(f"States saved to: {output_file}")
    
    return True


def main():
    """Run all tests."""
    print("State Generator Test Suite")
    print("=" * 60)
    
    try:
        # Test blocks world
        success1 = test_blocks_world()
        
        # Test gripper
        success2 = test_gripper()
        
        if success1 and success2:
            print("\n" + "=" * 60)
            print("✓ All tests passed!")
            print("=" * 60)
        else:
            print("\n" + "=" * 60)
            print("✗ Some tests failed")
            print("=" * 60)
            
    except Exception as e:
        print(f"\n✗ Error: {e}")
        import traceback
        traceback.print_exc()
        return False
    
    return True


if __name__ == "__main__":
    main()
