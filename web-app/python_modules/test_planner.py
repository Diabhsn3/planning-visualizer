#!/usr/bin/env python3
"""
Test file for planner_runner module
Run this file directly in VS Code to test if the planner works correctly.

Usage:
    python test_planner.py
"""

import sys
import os
from pathlib import Path

# Add parent directory to path so we can import modules
sys.path.insert(0, str(Path(__file__).parent))

from planner_runner import run_planner


def test_planner_blocks_world():
    """Test planner with Blocks World domain"""
    print("=" * 60)
    print("TEST 1: Planner - Blocks World Domain")
    print("=" * 60)
    
    domain = "blocksworld"
    problem = None  # Use default problem
    
    print(f"\nRunning planner for domain: {domain}")
    print("Using default problem...")
    
    try:
        result = run_planner(domain, problem)
        
        if result["success"]:
            print("\n✅ SUCCESS: Planner executed successfully!")
            print(f"   Planner used: {result['planner']}")
            print(f"   Plan length: {len(result['plan'])} actions")
            print(f"\n   Plan actions:")
            for i, action in enumerate(result['plan'], 1):
                print(f"      {i}. {action}")
        else:
            print(f"\n❌ FAILED: {result['error']}")
            return False
            
    except Exception as e:
        print(f"\n❌ EXCEPTION: {str(e)}")
        import traceback
        traceback.print_exc()
        return False
    
    return True


def test_planner_gripper():
    """Test planner with Gripper domain"""
    print("\n" + "=" * 60)
    print("TEST 2: Planner - Gripper Domain")
    print("=" * 60)
    
    domain = "gripper"
    problem = None  # Use default problem
    
    print(f"\nRunning planner for domain: {domain}")
    print("Using default problem...")
    
    try:
        result = run_planner(domain, problem)
        
        if result["success"]:
            print("\n✅ SUCCESS: Planner executed successfully!")
            print(f"   Planner used: {result['planner']}")
            print(f"   Plan length: {len(result['plan'])} actions")
            print(f"\n   Plan actions:")
            for i, action in enumerate(result['plan'], 1):
                print(f"      {i}. {action}")
        else:
            print(f"\n❌ FAILED: {result['error']}")
            return False
            
    except Exception as e:
        print(f"\n❌ EXCEPTION: {str(e)}")
        import traceback
        traceback.print_exc()
        return False
    
    return True


def main():
    """Run all planner tests"""
    print("\n" + "=" * 60)
    print("PLANNER MODULE TEST SUITE")
    print("=" * 60)
    print("\nThis will test if the planner_runner module works correctly.")
    print("It will attempt to solve planning problems using Fast Downward")
    print("or fallback to pre-computed plans if Fast Downward is not available.\n")
    
    tests = [
        ("Blocks World", test_planner_blocks_world),
        ("Gripper", test_planner_gripper),
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
