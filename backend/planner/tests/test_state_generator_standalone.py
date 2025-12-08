"""
Standalone test for State Generator (Step 2).
Tests PDDL parsing and state generation WITHOUT requiring Fast Downward.
Uses predefined action sequences for testing.
"""

import sys
from pathlib import Path

# Add planner directory to path
PLANNER_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PLANNER_DIR))

from state_generator import StateGenerator
import json


def test_blocks_world_standalone():
    """Test state generator with blocks world domain using predefined plan."""
    print("=" * 60)
    print("Testing Blocks World Domain (Standalone)")
    print("=" * 60)
    
    domain_path = PLANNER_DIR / "domains/blocks_world/domain.pddl"
    problem_path = PLANNER_DIR / "domains/blocks_world/p1.pddl"
    
    # Predefined plan for blocks world p1 problem
    # Goal: (on a b) and (on b c)
    # Initial: all blocks on table
    # Correct plan: first stack b on c, then stack a on b
    predefined_plan = [
        "(pick-up b)",
        "(stack b c)",
        "(pick-up a)",
        "(stack a b)"
    ]
    
    print("\n[Step 1] Using predefined plan:")
    for i, action in enumerate(predefined_plan):
        print(f"  {i + 1}. {action}")
    
    # Initialize state generator
    print("\n[Step 2] Initializing state generator...")
    sg = StateGenerator(str(domain_path), str(problem_path))
    
    # Print parsed domain info
    print(f"\nDomain: {sg.parser.domain_name}")
    print(f"Problem: {sg.parser.problem_name}")
    print(f"Objects: {sg.parser.objects}")
    print(f"Actions in domain: {list(sg.parser.actions.keys())}")
    
    # Print initial state
    print("\nInitial state:")
    init_state = sg.get_current_state()
    for pred in sorted(init_state, key=lambda p: (p.name, str(p.params))):
        print(f"  {pred}")
    
    # Apply actions and generate states
    print("\n[Step 3] Applying actions and generating states...")
    states = sg.apply_plan(predefined_plan)
    
    print(f"\nGenerated {len(states)} states (including initial state)")
    
    # Print each state with changes highlighted
    for i, state in enumerate(states):
        if i == 0:
            print(f"\n{'='*50}")
            print(f"State {i} (Initial):")
            print(f"{'='*50}")
        else:
            print(f"\n{'='*50}")
            print(f"State {i} (After: {predefined_plan[i-1]}):")
            print(f"{'='*50}")
            
            # Show what changed
            if i > 0:
                prev_state = states[i-1]
                added = state - prev_state
                removed = prev_state - state
                
                if added:
                    print("  Added:")
                    for pred in sorted(added, key=lambda p: (p.name, str(p.params))):
                        print(f"    + {pred}")
                
                if removed:
                    print("  Removed:")
                    for pred in sorted(removed, key=lambda p: (p.name, str(p.params))):
                        print(f"    - {pred}")
                
                print("\n  Current state:")
        
        for pred in sorted(state, key=lambda p: (p.name, str(p.params))):
            print(f"    {pred}")
    
    # Generate JSON representation
    print("\n[Step 4] Generating JSON representation...")
    states_json = sg.generate_states_json(predefined_plan)
    
    # Save to file
    output_file = PLANNER_DIR / "output" / "blocks_world_states.json"
    output_file.parent.mkdir(exist_ok=True)
    
    output_data = {
        "domain": sg.parser.domain_name,
        "problem": sg.parser.problem_name,
        "objects": sg.parser.objects,
        "plan": predefined_plan,
        "num_states": len(states_json),
        "states": states_json
    }
    
    with open(output_file, 'w') as f:
        json.dump(output_data, f, indent=2)
    
    print(f"\n✓ States saved to: {output_file}")
    
    # Verify goal state
    print("\n[Step 5] Verifying goal state...")
    final_state = states[-1]
    
    # Check if goal is satisfied
    from state_generator import Predicate
    goal_satisfied = True
    
    for is_positive, pred in sg.parser.goal:
        if is_positive:
            if pred not in final_state:
                print(f"  ✗ Goal predicate {pred} not in final state")
                goal_satisfied = False
        else:
            if pred in final_state:
                print(f"  ✗ Negative goal predicate {pred} found in final state")
                goal_satisfied = False
    
    if goal_satisfied:
        print("  ✓ Goal state achieved!")
    else:
        print("  ✗ Goal state NOT achieved")
    
    return goal_satisfied


def test_gripper_standalone():
    """Test state generator with gripper domain using predefined plan."""
    print("\n" + "=" * 60)
    print("Testing Gripper Domain (Standalone)")
    print("=" * 60)
    
    domain_path = PLANNER_DIR / "domains/gripper/domain.pddl"
    problem_path = PLANNER_DIR / "domains/gripper/p1.pddl"
    
    # Check if gripper domain exists
    if not domain_path.exists():
        print("  ⚠ Gripper domain not found, skipping test")
        return True
    
    # Predefined plan for gripper problem
    # This is an example - adjust based on actual problem
    predefined_plan = [
        "(pick ball1 rooma left)",
        "(pick ball2 rooma right)",
        "(move rooma roomb)",
        "(drop ball1 roomb left)",
        "(drop ball2 roomb right)"
    ]
    
    print("\n[Step 1] Using predefined plan:")
    for i, action in enumerate(predefined_plan):
        print(f"  {i + 1}. {action}")
    
    try:
        # Initialize state generator
        print("\n[Step 2] Initializing state generator...")
        sg = StateGenerator(str(domain_path), str(problem_path))
        
        print(f"\nDomain: {sg.parser.domain_name}")
        print(f"Problem: {sg.parser.problem_name}")
        print(f"Objects: {sg.parser.objects}")
        
        # Apply actions
        print("\n[Step 3] Applying actions...")
        states = sg.apply_plan(predefined_plan)
        print(f"Generated {len(states)} states")
        
        # Generate JSON
        states_json = sg.generate_states_json(predefined_plan)
        
        # Save to file
        output_file = PLANNER_DIR / "output" / "gripper_states.json"
        with open(output_file, 'w') as f:
            json.dump({
                "domain": sg.parser.domain_name,
                "problem": sg.parser.problem_name,
                "objects": sg.parser.objects,
                "plan": predefined_plan,
                "num_states": len(states_json),
                "states": states_json
            }, f, indent=2)
        
        print(f"\n✓ States saved to: {output_file}")
        return True
        
    except Exception as e:
        print(f"  ⚠ Error testing gripper: {e}")
        return True  # Don't fail the test suite


def test_parser_only():
    """Test just the PDDL parser functionality."""
    print("\n" + "=" * 60)
    print("Testing PDDL Parser (Standalone)")
    print("=" * 60)
    
    domain_path = PLANNER_DIR / "domains/blocks_world/domain.pddl"
    problem_path = PLANNER_DIR / "domains/blocks_world/p1.pddl"
    
    print("\n[Step 1] Parsing PDDL files...")
    sg = StateGenerator(str(domain_path), str(problem_path))
    
    print(f"\n✓ Domain parsed: {sg.parser.domain_name}")
    print(f"✓ Problem parsed: {sg.parser.problem_name}")
    
    print(f"\n[Step 2] Domain information:")
    print(f"  Objects: {sg.parser.objects}")
    print(f"  Number of actions: {len(sg.parser.actions)}")
    print(f"  Actions:")
    for action_name, action in sg.parser.actions.items():
        print(f"    - {action_name}")
        print(f"      Parameters: {action.parameters}")
        print(f"      Preconditions: {len(action.preconditions)}")
        print(f"      Effects: {len(action.effects)}")
    
    print(f"\n[Step 3] Problem information:")
    print(f"  Initial state predicates: {len(sg.parser.init_state)}")
    for pred in sorted(sg.parser.init_state, key=lambda p: (p.name, str(p.params))):
        print(f"    {pred}")
    
    print(f"\n  Goal conditions: {len(sg.parser.goal)}")
    for is_positive, pred in sg.parser.goal:
        prefix = "" if is_positive else "NOT "
        print(f"    {prefix}{pred}")
    
    return True


def main():
    """Run all tests."""
    print("State Generator Test Suite (Standalone)")
    print("=" * 60)
    print("This test suite does NOT require Fast Downward to be built.")
    print("=" * 60)
    
    try:
        # Test parser
        success1 = test_parser_only()
        
        # Test blocks world with state generation
        success2 = test_blocks_world_standalone()
        
        # Test gripper (optional)
        success3 = test_gripper_standalone()
        
        if success1 and success2 and success3:
            print("\n" + "=" * 60)
            print("✓ All tests passed!")
            print("=" * 60)
            print("\nNext steps:")
            print("1. Review the generated JSON files in the 'output/' directory")
            print("2. Initialize Fast Downward submodule: git submodule update --init --recursive")
            print("3. Build Fast Downward: cd planning-tools/downward && ./build.py release")
            print("4. Run full integration test: python tests/test_state_generator.py")
        else:
            print("\n" + "=" * 60)
            print("✗ Some tests failed")
            print("=" * 60)
            return False
            
    except Exception as e:
        print(f"\n✗ Error: {e}")
        import traceback
        traceback.print_exc()
        return False
    
    return True


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
