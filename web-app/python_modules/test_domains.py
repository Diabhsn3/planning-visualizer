#!/usr/bin/env python3
"""
Simple test runner for all domains
Runs the visualizer on each domain and shows results
"""

import sys
import json
from pathlib import Path

# Add current directory to path
sys.path.insert(0, str(Path(__file__).parent))

from visualizer_api import visualize_plan_fallback

def test_domain(domain_name):
    """Test a single domain"""
    print("=" * 70)
    print(f"{domain_name.upper()} DOMAIN TEST")
    print("=" * 70)
    print(f"\nRunning visualizer for {domain_name} domain...\n")
    
    try:
        result = visualize_plan_fallback(domain_name)
        
        if result["success"]:
            print("✅ SUCCESS!\n")
            print(f"Domain: {result['metadata']['domain']}")
            print(f"Planner used: {result['metadata']['planner_used']}")
            print(f"Plan length: {len(result['metadata']['plan'])} actions")
            print(f"Number of states: {len(result['states'])}")
            
            print("\n📋 Plan:")
            for i, action in enumerate(result['metadata']['plan'], 1):
                print(f"   {i}. {action}")
            
            print(f"\n✅ {domain_name} test passed!")
            return True
            
        else:
            print(f"❌ FAILED: {result.get('error', 'Unknown error')}")
            return False
            
    except Exception as e:
        print(f"❌ EXCEPTION: {str(e)}")
        import traceback
        traceback.print_exc()
        return False


def main():
    """Run tests for all domains"""
    print("\n" + "=" * 70)
    print("PLANNING VISUALIZER - DOMAIN TESTS")
    print("=" * 70)
    print("\nTesting all available domains with example problems...\n")
    
    domains = ["blocksworld", "gripper"]
    results = {}
    
    for domain in domains:
        results[domain] = test_domain(domain)
        print()
    
    # Summary
    print("=" * 70)
    print("TEST SUMMARY")
    print("=" * 70)
    
    passed = sum(1 for v in results.values() if v)
    failed = len(results) - passed
    
    for domain, success in results.items():
        status = "✅ PASSED" if success else "❌ FAILED"
        print(f"{domain:15} {status}")
    
    print(f"\nTotal: {len(results)} domains")
    print(f"✅ Passed: {passed}")
    print(f"❌ Failed: {failed}")
    
    if failed == 0:
        print("\n🎉 All domain tests passed!")
        print("The Planning Visualizer is working correctly!")
        return 0
    else:
        print(f"\n⚠️  {failed} domain test(s) failed")
        return 1


if __name__ == "__main__":
    sys.exit(main())
