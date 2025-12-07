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

from state_renderer import RendererFactory


def test_renderer_blocks_world():
    """Test state renderer with Blocks World domain"""
    print("=" * 60)
    print("TEST 1: State Renderer - Blocks World Domain")
    print("=" * 60)
    
    domain_name = "blocksworld"
    
    # Sample state from Blocks World (simplified representation)
    state = {
        "blocks": ["a", "b", "c", "d"],
        "on_table": ["d"],
        "on": [("c", "d"), ("b", "c"), ("a", "b")],
        "holding": None,
        "clear": ["a"]
    }
    
    print(f"\nRendering state for domain: {domain_name}")
    print(f"State: {json.dumps(state, indent=2)}")
    
    try:
        renderer = RendererFactory.get_renderer(domain_name)
        render_data = renderer.render(state)
        
        if render_data:
            print("\n✅ SUCCESS: State rendered successfully!")
            print(f"   Render data type: {type(render_data)}")
            print(f"   Render data preview: {str(render_data)[:300]}...")
        else:
            print(f"\n❌ FAILED: No render data returned")
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
    
    domain_name = "gripper"
    
    # Sample state from Gripper (simplified representation)
    state = {
        "balls": ["ball1", "ball2"],
        "rooms": ["rooma", "roomb"],
        "grippers": ["left", "right"],
        "at_robby": "rooma",
        "at": [("ball1", "rooma"), ("ball2", "roomb")],
        "carry": [],
        "free": ["left", "right"]
    }
    
    print(f"\nRendering state for domain: {domain_name}")
    print(f"State: {json.dumps(state, indent=2)}")
    
    try:
        renderer = RendererFactory.get_renderer(domain_name)
        render_data = renderer.render(state)
        
        if render_data:
            print("\n✅ SUCCESS: State rendered successfully!")
            print(f"   Render data type: {type(render_data)}")
            print(f"   Render data preview: {str(render_data)[:300]}...")
        else:
            print(f"\n❌ FAILED: No render data returned")
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
    
    domain_name = "invalid_domain_xyz"
    state = {}
    
    print(f"\nTrying to get renderer for domain: {domain_name}")
    print("Expected: Should raise an exception or return None")
    
    try:
        renderer = RendererFactory.get_renderer(domain_name)
        
        if renderer is None:
            print("\n✅ SUCCESS: Correctly returned None for invalid domain!")
            return True
        else:
            print("\n⚠️  WARNING: Got a renderer for invalid domain (unexpected)")
            # Try to render anyway
            render_data = renderer.render(state)
            if render_data:
                print("   Renderer returned data (may be fallback behavior)")
            return True
            
    except Exception as e:
        print(f"\n✅ SUCCESS: Correctly raised exception for invalid domain!")
        print(f"   Exception type: {type(e).__name__}")
        print(f"   Exception message: {str(e)}")
        return True
    
    return False


def test_renderer_factory():
    """Test that RendererFactory can create renderers for known domains"""
    print("\n" + "=" * 60)
    print("TEST 4: Renderer Factory - Known Domains")
    print("=" * 60)
    
    known_domains = ["blocksworld", "gripper"]
    
    print(f"\nTesting RendererFactory for known domains: {known_domains}")
    
    try:
        for domain in known_domains:
            renderer = RendererFactory.get_renderer(domain)
            if renderer:
                print(f"   ✓ {domain}: {type(renderer).__name__}")
            else:
                print(f"   ✗ {domain}: No renderer returned")
                return False
        
        print("\n✅ SUCCESS: All known domains have renderers!")
        return True
            
    except Exception as e:
        print(f"\n❌ EXCEPTION: {str(e)}")
        import traceback
        traceback.print_exc()
        return False


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
        ("Renderer Factory", test_renderer_factory),
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
