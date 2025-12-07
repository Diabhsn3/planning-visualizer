#!/usr/bin/env python3
"""
Test file for state_renderer module
Run this file directly in VS Code to test if the state renderer works correctly.

Usage:
    python test_renderer.py
"""

import sys
import json
from pathlib import Path

# Add parent directory to path so we can import modules
sys.path.insert(0, str(Path(__file__).parent))

from state_renderer import render_state


def test_renderer_blocks_world():
    """Test state renderer with Blocks World domain"""
    print("=" * 60)
    print("TEST 1: State Renderer - Blocks World Domain")
    print("=" * 60)
    
    domain = "blocksworld"
    
    # Sample state from Blocks World
    state = {
        "blocks": ["a", "b", "c", "d"],
        "stacks": [
            ["d", "c", "b", "a"]
        ],
        "holding": None,
        "table": []
    }
    
    print(f"\nRendering state for domain: {domain}")
    print(f"State: {json.dumps(state, indent=2)}")
    
    try:
        result = render_state(domain, state)
        
        if result["success"]:
            print("\n✅ SUCCESS: State rendered successfully!")
            print(f"   Render data keys: {list(result['renderData'].keys())}")
            print(f"   Render data: {json.dumps(result['renderData'], indent=2)[:300]}...")
        else:
            print(f"\n❌ FAILED: {result['error']}")
            return False
            
    except Exception as e:
        print(f"\n❌ EXCEPTION: {str(e)}")
        import traceback
        traceback.print_exc()
        return False
    
    return True


def test_renderer_gripper():
    """Test state renderer with Gripper domain"""
    print("\n" + "=" * 60)
    print("TEST 2: State Renderer - Gripper Domain")
    print("=" * 60)
    
    domain = "gripper"
    
    # Sample state from Gripper
    state = {
        "balls": ["ball1", "ball2"],
        "rooms": ["rooma", "roomb"],
        "grippers": ["left", "right"],
        "robot_location": "rooma",
        "ball_locations": {
            "ball1": "rooma",
            "ball2": "roomb"
        },
        "gripper_states": {
            "left": None,
            "right": None
        }
    }
    
    print(f"\nRendering state for domain: {domain}")
    print(f"State: {json.dumps(state, indent=2)}")
    
    try:
        result = render_state(domain, state)
        
        if result["success"]:
            print("\n✅ SUCCESS: State rendered successfully!")
            print(f"   Render data keys: {list(result['renderData'].keys())}")
            print(f"   Render data: {json.dumps(result['renderData'], indent=2)[:300]}...")
        else:
            print(f"\n❌ FAILED: {result['error']}")
            return False
            
    except Exception as e:
        print(f"\n❌ EXCEPTION: {str(e)}")
        import traceback
        traceback.print_exc()
        return False
    
    return True


def test_renderer_invalid_domain():
    """Test state renderer with invalid domain (should fail gracefully)"""
    print("\n" + "=" * 60)
    print("TEST 3: State Renderer - Invalid Domain")
    print("=" * 60)
    
    domain = "invalid_domain_xyz"
    state = {}
    
    print(f"\nRendering state for domain: {domain}")
    print("Expected: Should fail gracefully with error message")
    
    try:
        result = render_state(domain, state)
        
        if not result["success"]:
            print("\n✅ SUCCESS: Correctly rejected invalid domain!")
            print(f"   Error message: {result['error']}")
        else:
            print("\n❌ FAILED: Should have rejected invalid domain")
            return False
            
    except Exception as e:
        print(f"\n❌ EXCEPTION: {str(e)}")
        print("   Note: Exceptions should be caught and returned as error messages")
        import traceback
        traceback.print_exc()
        return False
    
    return True


def test_renderer_blocks_world_complex():
    """Test state renderer with complex Blocks World state"""
    print("\n" + "=" * 60)
    print("TEST 4: State Renderer - Complex Blocks World State")
    print("=" * 60)
    
    domain = "blocksworld"
    
    # More complex state with multiple stacks and holding
    state = {
        "blocks": ["a", "b", "c", "d", "e", "f"],
        "stacks": [
            ["d", "c"],
            ["f", "e"]
        ],
        "holding": "b",
        "table": ["a"]
    }
    
    print(f"\nRendering state for domain: {domain}")
    print(f"State: {json.dumps(state, indent=2)}")
    
    try:
        result = render_state(domain, state)
        
        if result["success"]:
            print("\n✅ SUCCESS: Complex state rendered successfully!")
            print(f"   Render data keys: {list(result['renderData'].keys())}")
            print(f"   Number of stacks: {len(result['renderData'].get('stacks', []))}")
            print(f"   Holding block: {result['renderData'].get('holding')}")
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
    """Run all state renderer tests"""
    print("\n" + "=" * 60)
    print("STATE RENDERER MODULE TEST SUITE")
    print("=" * 60)
    print("\nThis will test if the state_renderer module works correctly.")
    print("It will convert planning states to renderable data structures.\n")
    
    tests = [
        ("Blocks World", test_renderer_blocks_world),
        ("Gripper", test_renderer_gripper),
        ("Invalid Domain", test_renderer_invalid_domain),
        ("Complex Blocks World", test_renderer_blocks_world_complex),
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
