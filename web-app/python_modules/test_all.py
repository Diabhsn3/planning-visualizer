#!/usr/bin/env python3
"""
Comprehensive test file for all Python modules
Run this file to test the complete pipeline: planner → generator → renderer

Usage:
    python test_all.py
"""

import sys
import json
from pathlib import Path

# Add parent directory to path so we can import modules
sys.path.insert(0, str(Path(__file__).parent))

from planner_runner import run_planner
from state_generator import generate_states
from state_renderer import render_state


def test_full_pipeline_blocks_world():
    """Test the complete pipeline with Blocks World domain"""
    print("=" * 60)
    print("FULL PIPELINE TEST: Blocks World")
    print("=" * 60)
    
    domain = "blocksworld"
    problem = None
    
    print(f"\nDomain: {domain}")
    print("Testing complete pipeline: Planner → Generator → Renderer\n")
    
    # Step 1: Run planner
    print("Step 1: Running planner...")
    try:
        planner_result = run_planner(domain, problem)
        if not planner_result["success"]:
            print(f"❌ Planner failed: {planner_result['error']}")
            return False
        print(f"✅ Planner succeeded")
        print(f"   Plan length: {len(planner_result['plan'])} actions")
        plan = planner_result['plan']
    except Exception as e:
        print(f"❌ Planner crashed: {e}")
        return False
    
    # Step 2: Generate states
    print("\nStep 2: Generating states...")
    try:
        generator_result = generate_states(domain, problem, plan)
        if not generator_result["success"]:
            print(f"❌ Generator failed: {generator_result['error']}")
            return False
        print(f"✅ Generator succeeded")
        print(f"   Generated {len(generator_result['states'])} states")
        states = generator_result['states']
    except Exception as e:
        print(f"❌ Generator crashed: {e}")
        return False
    
    # Step 3: Render states
    print("\nStep 3: Rendering states...")
    try:
        rendered_count = 0
        for i, state in enumerate(states):
            render_result = render_state(domain, state)
            if not render_result["success"]:
                print(f"❌ Renderer failed on state {i}: {render_result['error']}")
                return False
            rendered_count += 1
        print(f"✅ Renderer succeeded")
        print(f"   Rendered {rendered_count} states")
    except Exception as e:
        print(f"❌ Renderer crashed: {e}")
        return False
    
    print("\n✅ FULL PIPELINE TEST PASSED!")
    return True


def test_full_pipeline_gripper():
    """Test the complete pipeline with Gripper domain"""
    print("\n" + "=" * 60)
    print("FULL PIPELINE TEST: Gripper")
    print("=" * 60)
    
    domain = "gripper"
    problem = None
    
    print(f"\nDomain: {domain}")
    print("Testing complete pipeline: Planner → Generator → Renderer\n")
    
    # Step 1: Run planner
    print("Step 1: Running planner...")
    try:
        planner_result = run_planner(domain, problem)
        if not planner_result["success"]:
            print(f"❌ Planner failed: {planner_result['error']}")
            return False
        print(f"✅ Planner succeeded")
        print(f"   Plan length: {len(planner_result['plan'])} actions")
        plan = planner_result['plan']
    except Exception as e:
        print(f"❌ Planner crashed: {e}")
        return False
    
    # Step 2: Generate states
    print("\nStep 2: Generating states...")
    try:
        generator_result = generate_states(domain, problem, plan)
        if not generator_result["success"]:
            print(f"❌ Generator failed: {generator_result['error']}")
            return False
        print(f"✅ Generator succeeded")
        print(f"   Generated {len(generator_result['states'])} states")
        states = generator_result['states']
    except Exception as e:
        print(f"❌ Generator crashed: {e}")
        return False
    
    # Step 3: Render states
    print("\nStep 3: Rendering states...")
    try:
        rendered_count = 0
        for i, state in enumerate(states):
            render_result = render_state(domain, state)
            if not render_result["success"]:
                print(f"❌ Renderer failed on state {i}: {render_result['error']}")
                return False
            rendered_count += 1
        print(f"✅ Renderer succeeded")
        print(f"   Rendered {rendered_count} states")
    except Exception as e:
        print(f"❌ Renderer crashed: {e}")
        return False
    
    print("\n✅ FULL PIPELINE TEST PASSED!")
    return True


def test_integration_with_sample_data():
    """Test integration with manually provided sample data"""
    print("\n" + "=" * 60)
    print("INTEGRATION TEST: Manual Sample Data")
    print("=" * 60)
    
    domain = "blocksworld"
    
    # Manually provide plan and verify state generation + rendering
    plan = ["unstack d c", "put-down d", "pick-up c", "stack c d"]
    
    print(f"\nDomain: {domain}")
    print(f"Plan: {plan}\n")
    
    # Generate states
    print("Step 1: Generating states from manual plan...")
    try:
        generator_result = generate_states(domain, None, plan)
        if not generator_result["success"]:
            print(f"❌ Generator failed: {generator_result['error']}")
            return False
        print(f"✅ Generator succeeded")
        print(f"   Generated {len(generator_result['states'])} states")
        states = generator_result['states']
    except Exception as e:
        print(f"❌ Generator crashed: {e}")
        return False
    
    # Render first and last states
    print("\nStep 2: Rendering initial and final states...")
    try:
        # Initial state
        initial_render = render_state(domain, states[0])
        if not initial_render["success"]:
            print(f"❌ Renderer failed on initial state: {initial_render['error']}")
            return False
        
        # Final state
        final_render = render_state(domain, states[-1])
        if not final_render["success"]:
            print(f"❌ Renderer failed on final state: {final_render['error']}")
            return False
        
        print(f"✅ Renderer succeeded")
        print(f"   Initial state rendered: {json.dumps(initial_render['renderData'], indent=2)[:150]}...")
        print(f"   Final state rendered: {json.dumps(final_render['renderData'], indent=2)[:150]}...")
    except Exception as e:
        print(f"❌ Renderer crashed: {e}")
        return False
    
    print("\n✅ INTEGRATION TEST PASSED!")
    return True


def main():
    """Run all comprehensive tests"""
    print("\n" + "=" * 60)
    print("COMPREHENSIVE TEST SUITE - ALL MODULES")
    print("=" * 60)
    print("\nThis will test the complete pipeline:")
    print("  1. Planner (run_planner)")
    print("  2. State Generator (generate_states)")
    print("  3. State Renderer (render_state)")
    print("\nEach test validates that data flows correctly between modules.\n")
    
    tests = [
        ("Full Pipeline - Blocks World", test_full_pipeline_blocks_world),
        ("Full Pipeline - Gripper", test_full_pipeline_gripper),
        ("Integration - Manual Data", test_integration_with_sample_data),
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
            import traceback
            traceback.print_exc()
            failed += 1
    
    # Summary
    print("\n" + "=" * 60)
    print("COMPREHENSIVE TEST SUMMARY")
    print("=" * 60)
    print(f"Total tests: {passed + failed}")
    print(f"✅ Passed: {passed}")
    print(f"❌ Failed: {failed}")
    
    if failed == 0:
        print("\n🎉 All comprehensive tests passed!")
        print("The complete pipeline is working correctly!")
        return 0
    else:
        print(f"\n⚠️  {failed} test(s) failed")
        print("Please review the errors above and fix the issues.")
        return 1


if __name__ == "__main__":
    sys.exit(main())
