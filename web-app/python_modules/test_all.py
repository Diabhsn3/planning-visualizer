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

from run_planner import solve_problem
from state_generator import StateGenerator
from state_renderer import RendererFactory


# Get paths to domain and problem files
PROJECT_ROOT = Path(__file__).resolve().parents[2]
DOMAINS_DIR = PROJECT_ROOT / "planning-tools" / "downward" / "benchmarks"


def test_full_pipeline_blocks_world():
    """Test the complete pipeline with Blocks World domain"""
    print("=" * 60)
    print("FULL PIPELINE TEST: Blocks World")
    print("=" * 60)
    
    domain_path = str(DOMAINS_DIR / "blocksworld" / "domain.pddl")
    problem_path = str(DOMAINS_DIR / "blocksworld" / "probBLOCKS-4-0.pddl")
    domain_name = "blocksworld"
    
    print(f"\nDomain: {domain_name}")
    print(f"Domain file: {domain_path}")
    print(f"Problem file: {problem_path}")
    print("\nTesting complete pipeline: Planner → Generator → Renderer\n")
    
    # Step 1: Run planner
    print("Step 1: Running planner...")
    try:
        plan, planner_used = solve_problem(domain_path, problem_path, domain_name)
        if not plan:
            print("❌ Planner failed: No plan found")
            return False
        print(f"✅ Planner succeeded ({planner_used})")
        print(f"   Plan length: {len(plan)} actions")
    except Exception as e:
        print(f"❌ Planner crashed: {e}")
        return False
    
    # Step 2: Generate states
    print("\nStep 2: Generating states...")
    try:
        sg = StateGenerator(domain_path, problem_path)
        states = sg.generate_states(plan)
        if not states:
            print("❌ Generator failed: No states generated")
            return False
        print(f"✅ Generator succeeded")
        print(f"   Generated {len(states)} states")
    except Exception as e:
        print(f"❌ Generator crashed: {e}")
        return False
    
    # Step 3: Render states
    print("\nStep 3: Rendering states...")
    try:
        renderer = RendererFactory.get_renderer(domain_name)
        if not renderer:
            print("❌ Renderer failed: No renderer for domain")
            return False
        
        rendered_count = 0
        for i, state in enumerate(states):
            render_data = renderer.render(state)
            if not render_data:
                print(f"❌ Renderer failed on state {i}")
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
    
    domain_path = str(DOMAINS_DIR / "gripper" / "domain.pddl")
    problem_path = str(DOMAINS_DIR / "gripper" / "prob01.pddl")
    domain_name = "gripper"
    
    print(f"\nDomain: {domain_name}")
    print(f"Domain file: {domain_path}")
    print(f"Problem file: {problem_path}")
    print("\nTesting complete pipeline: Planner → Generator → Renderer\n")
    
    # Step 1: Run planner
    print("Step 1: Running planner...")
    try:
        plan, planner_used = solve_problem(domain_path, problem_path, domain_name)
        if not plan:
            print("❌ Planner failed: No plan found")
            return False
        print(f"✅ Planner succeeded ({planner_used})")
        print(f"   Plan length: {len(plan)} actions")
    except Exception as e:
        print(f"❌ Planner crashed: {e}")
        return False
    
    # Step 2: Generate states
    print("\nStep 2: Generating states...")
    try:
        sg = StateGenerator(domain_path, problem_path)
        states = sg.generate_states(plan)
        if not states:
            print("❌ Generator failed: No states generated")
            return False
        print(f"✅ Generator succeeded")
        print(f"   Generated {len(states)} states")
    except Exception as e:
        print(f"❌ Generator crashed: {e}")
        return False
    
    # Step 3: Render states
    print("\nStep 3: Rendering states...")
    try:
        renderer = RendererFactory.get_renderer(domain_name)
        if not renderer:
            print("❌ Renderer failed: No renderer for domain")
            return False
        
        rendered_count = 0
        for i, state in enumerate(states):
            render_data = renderer.render(state)
            if not render_data:
                print(f"❌ Renderer failed on state {i}")
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
    
    domain_path = str(DOMAINS_DIR / "blocksworld" / "domain.pddl")
    problem_path = str(DOMAINS_DIR / "blocksworld" / "probBLOCKS-4-0.pddl")
    domain_name = "blocksworld"
    
    # Manually provide plan and verify state generation + rendering
    plan = ["unstack d c", "put-down d", "pick-up c", "stack c d"]
    
    print(f"\nDomain: {domain_name}")
    print(f"Plan: {plan}\n")
    
    # Generate states
    print("Step 1: Generating states from manual plan...")
    try:
        sg = StateGenerator(domain_path, problem_path)
        states = sg.generate_states(plan)
        if not states:
            print("❌ Generator failed: No states generated")
            return False
        print(f"✅ Generator succeeded")
        print(f"   Generated {len(states)} states")
    except Exception as e:
        print(f"❌ Generator crashed: {e}")
        return False
    
    # Render first and last states
    print("\nStep 2: Rendering initial and final states...")
    try:
        renderer = RendererFactory.get_renderer(domain_name)
        if not renderer:
            print("❌ Renderer failed: No renderer for domain")
            return False
        
        # Initial state
        initial_render = renderer.render(states[0])
        if not initial_render:
            print("❌ Renderer failed on initial state")
            return False
        
        # Final state
        final_render = renderer.render(states[-1])
        if not final_render:
            print("❌ Renderer failed on final state")
            return False
        
        print(f"✅ Renderer succeeded")
        print(f"   Initial state rendered: {str(initial_render)[:100]}...")
        print(f"   Final state rendered: {str(final_render)[:100]}...")
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
    print("  1. Planner (solve_problem)")
    print("  2. State Generator (StateGenerator)")
    print("  3. State Renderer (RendererFactory)")
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
