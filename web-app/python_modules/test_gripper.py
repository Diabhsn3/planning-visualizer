#!/usr/bin/env python3
"""
Simple test for Gripper domain
Just runs the visualizer and shows the output
"""

import sys
import json
from pathlib import Path

# Add current directory to path
sys.path.insert(0, str(Path(__file__).parent))

from visualizer_api import visualize_plan_fallback

print("=" * 70)
print("GRIPPER DOMAIN TEST")
print("=" * 70)
print("\nRunning visualizer for Gripper domain...")
print("This uses the built-in example problem.\n")

try:
    result = visualize_plan_fallback("gripper")
    
    if result["success"]:
        print("✅ SUCCESS!\n")
        print(f"Domain: {result['metadata']['domain']}")
        print(f"Planner used: {result['metadata']['planner_used']}")
        print(f"Plan length: {len(result['metadata']['plan'])} actions")
        print(f"Number of states: {len(result['states'])}")
        
        print("\n📋 Plan:")
        for i, action in enumerate(result['metadata']['plan'], 1):
            print(f"   {i}. {action}")
        
        print("\n🎨 Rendered states:")
        print(f"   Initial state: {json.dumps(result['states'][0], indent=2)[:200]}...")
        print(f"   Final state: {json.dumps(result['states'][-1], indent=2)[:200]}...")
        
        print("\n✅ All steps completed successfully!")
        print("The visualizer is working correctly for Gripper domain.")
        
    else:
        print(f"❌ FAILED: {result.get('error', 'Unknown error')}")
        sys.exit(1)
        
except Exception as e:
    print(f"❌ EXCEPTION: {str(e)}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

print("\n" + "=" * 70)
