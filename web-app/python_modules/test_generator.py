#!/usr/bin/env python3
"""
Test file for state_generator module
Run this file directly in VS Code to test if the state generator works correctly.

Usage:
    python test_generator.py
"""

import sys
import json
from pathlib import Path

# Add parent directory to path so we can import modules
sys.path.insert(0, str(Path(__file__).parent))

from state_generator import StateGenerator


# Get paths to domain and problem files
PROJECT_ROOT = Path(__file__).resolve().parents[2]
DOMAINS_DIR = PROJECT_ROOT / "planning-tools" / "downward" / "benchmarks"


def test_generator_blocks_world():
    """Test state generator with Blocks World domain"""
    print("=" * 60)
    print("TEST 1: State Generator - Blocks World Domain")
    print("=" * 60)
    
    domain_path = str(DOMAINS_DIR / "blocksworld" / "domain.pddl")
    problem_path = str(DOMAINS_DIR / "blocksworld" / "probBLOCKS-4-0.pddl")
    
    plan = [
        "unstack d c",
        "put-down d",
        "unstack c b",
        "stack c d",
        "pick-up b",
        "stack b c",
        "pick-up a",
        "stack a b"
    ]
    
    print(f"\nGenerating states for Blocks World")
    print(f"Domain: {domain_path}")
    print(f"Problem: {problem_path}")
    print(f"Plan length: {len(plan)} actions")
    print("Plan:")
    for i, action in enumerate(plan, 1):
        print(f"   {i}. {action}")
    
    try:
        sg = StateGenerator(domain_path, problem_path)
        states = sg.generate_states(plan)
        
        if states:
            print("\n✅ SUCCESS: States generated successfully!")
            print(f"   Number of states: {len(states)}")
            print(f"   Initial state preview: {str(states[0])[:150]}...")
            print(f"   Final state preview: {str(states[-1])[:150]}...")
        else:
            print(f"\n❌ FAILED: No states generated")
            return False
            
    except Exception as e:
        print(f"\n❌ EXCEPTION: {str(e)}")
        import traceback
        traceback.print_exc()
        return False
    
    return True


def test_generator_gripper():
    """Test state generator with Gripper domain"""
    print("\n" + "=" * 60)
    print("TEST 2: State Generator - Gripper Domain")
    print("=" * 60)
    
    domain_path = str(DOMAINS_DIR / "gripper" / "domain.pddl")
    problem_path = str(DOMAINS_DIR / "gripper" / "prob01.pddl")
    
    plan = [
        "pick ball1 rooma left",
        "pick ball2 rooma right",
        "move rooma roomb",
        "drop ball1 roomb left",
        "drop ball2 roomb right"
    ]
    
    print(f"\nGenerating states for Gripper")
    print(f"Domain: {domain_path}")
    print(f"Problem: {problem_path}")
    print(f"Plan length: {len(plan)} actions")
    print("Plan:")
    for i, action in enumerate(plan, 1):
        print(f"   {i}. {action}")
    
    try:
        sg = StateGenerator(domain_path, problem_path)
        states = sg.generate_states(plan)
        
        if states:
            print("\n✅ SUCCESS: States generated successfully!")
            print(f"   Number of states: {len(states)}")
            print(f"   Initial state preview: {str(states[0])[:150]}...")
            print(f"   Final state preview: {str(states[-1])[:150]}...")
        else:
            print(f"\n❌ FAILED: No states generated")
            return False
            
    except Exception as e:
        print(f"\n❌ EXCEPTION: {str(e)}")
        import traceback
        traceback.print_exc()
        return False
    
    return True


def test_generator_empty_plan():
    """Test state generator with empty plan (should return initial state only)"""
    print("\n" + "=" * 60)
    print("TEST 3: State Generator - Empty Plan")
    print("=" * 60)
    
    domain_path = str(DOMAINS_DIR / "blocksworld" / "domain.pddl")
    problem_path = str(DOMAINS_DIR / "blocksworld" / "probBLOCKS-4-0.pddl")
    
    plan = []
    
    print(f"\nGenerating states for Blocks World")
    print(f"Domain: {domain_path}")
    print(f"Problem: {problem_path}")
    print("Plan: (empty)")
    
    try:
        sg = StateGenerator(domain_path, problem_path)
        states = sg.generate_states(plan)
        
        if states:
            print("\n✅ SUCCESS: States generated successfully!")
            print(f"   Number of states: {len(states)}")
            if len(states) == 1:
                print("   ✓ Correctly returned only initial state")
            else:
                print(f"   ⚠️  Expected 1 state, got {len(states)}")
        else:
            print(f"\n❌ FAILED: No states generated")
            return False
            
    except Exception as e:
        print(f"\n❌ EXCEPTION: {str(e)}")
        import traceback
        traceback.print_exc()
        return False
    
    return True


def main():
    """Run all state generator tests"""
    print("\n" + "=" * 60)
    print("STATE GENERATOR MODULE TEST SUITE")
    print("=" * 60)
    print("\nThis will test if the state_generator module works correctly.")
    print("It will generate intermediate states from plans.\n")
    
    tests = [
        ("Blocks World", test_generator_blocks_world),
        ("Gripper", test_generator_gripper),
        ("Empty Plan", test_generator_empty_plan),
    ]
    
    passed = 0
    failed = 0
    
    for name, test_func in tests:
        try:
            if test_func():
                passed += 1
            else:
                failed += 1
        except Exception as e:
            print(f"\n❌ Test '{name}' crashed: {e}")
            failed += 1
    
    # Summary
    print("\n" + "=" * 60)
    print("TEST SUMMARY")
    print("=" * 60)
    print(f"Total tests: {passed + failed}")
    print(f"✅ Passed: {passed}")
    print(f"❌ Failed: {failed}")
    
    if failed == 0:
        print("\n🎉 All tests passed!")
        return 0
    else:
        print(f"\n⚠️  {failed} test(s) failed")
        return 1


if __name__ == "__main__":
    sys.exit(main())
