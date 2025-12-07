#!/usr/bin/env python3
"""
Simple test for Blocks World domain
Just runs the visualizer and shows the output
"""

import sys
import json
from pathlib import Path

# Add current directory to path
sys.path.insert(0, str(Path(__file__).parent))

from visualizer_api import visualize_plan
from run_planner import get_fallback_plan

# Get paths to built-in domain files
DOMAINS_DIR = Path(__file__).parent / "domains"
DOMAIN_PATH = str(DOMAINS_DIR / "blocks_world" / "domain.pddl")
PROBLEM_PATH = str(DOMAINS_DIR / "blocks_world" / "p1.pddl")

print("=" * 70)
print("BLOCKS WORLD DOMAIN TEST")
print("=" * 70)
print("\nRunning visualizer for Blocks World domain...")
print("Using built-in example problem.\n")

try:
    result = visualize_plan(DOMAIN_PATH, PROBLEM_PATH, "blocksworld")
    
    if result["success"]:
        print("✅ SUCCESS!\n")
        print(f"Domain: blocksworld")
        print(f"Plan length: {len(result['metadata']['plan'])} actions")
        print(f"Number of states: {len(result['states'])}")
        
        print("\n📋 Plan:")
        for i, action in enumerate(result['metadata']['plan'], 1):
            print(f"   {i}. {action}")
        
        print("\n🎨 Rendered states:")
        print(f"   Initial state: {json.dumps(result['states'][0], indent=2)[:200]}...")
        print(f"   Final state: {json.dumps(result['states'][-1], indent=2)[:200]}...")
        
        print("\n✅ All steps completed successfully!")
        print("The visualizer is working correctly for Blocks World domain.")
        
    else:
        print(f"❌ FAILED: {result.get('error', 'Unknown error')}")
        sys.exit(1)
        
except Exception as e:
    print(f"❌ EXCEPTION: {str(e)}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

print("\n" + "=" * 70)
