"""
Test script for State Renderer (Step 3).
Tests rendering of states to RenderedState (JSON) format.
"""

import sys
from pathlib import Path
import json

# Add planner directory to path
PLANNER_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PLANNER_DIR))

from state_generator import StateGenerator
from state_renderer import RendererFactory, RenderedState



################## sola
def test_depot_renderer():
    """Test Depot domain renderer with state sequence."""
    print("=" * 60)
    print("Testing Depot Renderer")
    print("=" * 60)

    domain_path = PLANNER_DIR / "domains/depot/domain.pddl"
    problem_path = PLANNER_DIR / "domains/depot/p1.pddl"

    # Step 1: Generate states
    print("\n[Step 1] Generating states...")
    sg = StateGenerator(str(domain_path), str(problem_path))

    plan = [
        "(load c1 t1 d1)",
        "(drive t1 d1 s1)",
        "(unload c1 t1 s1)"
    ]

    states = sg.apply_plan(plan)
    print(f"Generated {len(states)} states")

    # Step 2: Get renderer
    print("\n[Step 2] Getting renderer...")
    renderer = RendererFactory.get_renderer(sg.parser.domain_name)
    print(f"Using renderer: {renderer.__class__.__name__}")

    # Step 3: Render states
    print("\n[Step 3] Rendering states...")
    rendered_states = renderer.render_sequence(states, sg.parser.objects, plan)
    print(f"Rendered {len(rendered_states)} states")

    # Show each rendered state
    for i, rendered in enumerate(rendered_states):
        if i == 0:
            print(f"\n{'='*50}")
            print(f"Rendered State {i} (Initial)")
            print(f"{'='*50}")
        else:
            print(f"\n{'='*50}")
            print(f"Rendered State {i} (After: {plan[i-1]})")
            print(f"{'='*50}")

        print(f"  Domain: {rendered.domain}")
        print(f"  Objects: {len(rendered.objects)}")
        print(f"  Relations: {len(rendered.relations)}")

        print("\n  Visual Objects:")
        for obj in rendered.objects:
            pos_str = f"at {obj.position}" if obj.position else "no position"
            props_str = f", props: {obj.properties}" if obj.properties else ""
            print(f"    - {obj.label} ({obj.type}): {pos_str}{props_str}")

        if rendered.relations:
            print("\n  Visual Relations:")
            for rel in rendered.relations:
                if rel.target:
                    print(f"    - {rel.type}: {rel.source} → {rel.target}")
                else:
                    print(f"    - {rel.type}: {rel.source}")

    # Step 4: Export to JSON
    print("\n[Step 4] Exporting to JSON...")
    json_output = renderer.render_sequence_to_json(states, sg.parser.objects, plan)

    output_file = PLANNER_DIR / "output" / "depot_rendered.json"
    output_file.parent.mkdir(exist_ok=True)

    with open(output_file, 'w') as f:
        f.write(json_output)

    print(f"✓ Rendered states saved to: {output_file}")

    # Validate JSON structure
    data = json.loads(json_output)
    assert data['domain'] == 'depot'
    assert data['num_states'] == len(states)
    assert len(data['states']) == len(states)

    print("✓ JSON structure validated")

    return True
    

################## sola    
def test_blocks_world_renderer():
    """Test blocks world renderer with state sequence."""
    print("=" * 60)
    print("Testing Blocks World Renderer")
    print("=" * 60)
    
    domain_path = PLANNER_DIR / "domains/blocks_world/domain.pddl"
    problem_path = PLANNER_DIR / "domains/blocks_world/p1.pddl"
    
    # Generate states
    print("\n[Step 1] Generating states...")
    sg = StateGenerator(str(domain_path), str(problem_path))
    
    plan = [
        "(pick-up b)",
        "(stack b c)",
        "(pick-up a)",
        "(stack a b)"
    ]
    
    states = sg.apply_plan(plan)
    print(f"Generated {len(states)} states")
    
    # Get renderer
    print("\n[Step 2] Getting renderer...")
    renderer = RendererFactory.get_renderer(sg.parser.domain_name)
    print(f"Using renderer: {renderer.__class__.__name__}")
    
    # Render states
    print("\n[Step 3] Rendering states...")
    rendered_states = renderer.render_sequence(
        states,
        sg.parser.objects,
        plan
    )
    
    print(f"Rendered {len(rendered_states)} states")
    
    # Display each rendered state
    for i, rendered in enumerate(rendered_states):
        if i == 0:
            print(f"\n{'='*50}")
            print(f"Rendered State {i} (Initial)")
            print(f"{'='*50}")
        else:
            print(f"\n{'='*50}")
            print(f"Rendered State {i} (After: {plan[i-1]})")
            print(f"{'='*50}")
        
        print(f"  Domain: {rendered.domain}")
        print(f"  Objects: {len(rendered.objects)}")
        print(f"  Relations: {len(rendered.relations)}")
        
        # Show objects with positions
        print("\n  Visual Objects:")
        for obj in rendered.objects:
            pos_str = f"at {obj.position}" if obj.position else "no position"
            props_str = f", props: {obj.properties}" if obj.properties else ""
            print(f"    - {obj.label} ({obj.type}): {pos_str}{props_str}")
        
        # Show relations
        if rendered.relations:
            print("\n  Visual Relations:")
            for rel in rendered.relations:
                if rel.target:
                    print(f"    - {rel.type}: {rel.source} → {rel.target}")
                else:
                    print(f"    - {rel.type}: {rel.source}")
    
    # Export to JSON
    print("\n[Step 4] Exporting to JSON...")
    json_output = renderer.render_sequence_to_json(states, sg.parser.objects, plan)
    
    output_file = PLANNER_DIR / "output" / "blocks_world_rendered.json"
    output_file.parent.mkdir(exist_ok=True)
    
    with open(output_file, 'w') as f:
        f.write(json_output)
    
    print(f"✓ Rendered states saved to: {output_file}")
    
    # Validate JSON structure
    data = json.loads(json_output)
    assert data['domain'] == 'blocks-world'
    assert data['num_states'] == len(states)
    assert len(data['states']) == len(states)
    
    print("✓ JSON structure validated")
    
    return True


def test_gripper_renderer():
    """Test gripper renderer with state sequence."""
    print("\n" + "=" * 60)
    print("Testing Gripper Renderer")
    print("=" * 60)
    
    domain_path = PLANNER_DIR / "domains/gripper/domain.pddl"
    problem_path = PLANNER_DIR / "domains/gripper/p1.pddl"
    
    if not domain_path.exists():
        print("  ⚠ Gripper domain not found, skipping test")
        return True
    
    # Generate states
    print("\n[Step 1] Generating states...")
    sg = StateGenerator(str(domain_path), str(problem_path))
    
    plan = [
        "(pick ball1 rooma left)",
        "(pick ball2 rooma right)",
        "(move rooma roomb)",
        "(drop ball1 roomb left)",
        "(drop ball2 roomb right)"
    ]
    
    states = sg.apply_plan(plan)
    print(f"Generated {len(states)} states")
    
    # Get renderer
    print("\n[Step 2] Getting renderer...")
    renderer = RendererFactory.get_renderer(sg.parser.domain_name)
    print(f"Using renderer: {renderer.__class__.__name__}")
    
    # Render states
    print("\n[Step 3] Rendering states...")
    rendered_states = renderer.render_sequence(states, sg.parser.objects, plan)
    
    print(f"Rendered {len(rendered_states)} states")
    
    # Show summary of first and last state
    for i in [0, len(rendered_states) - 1]:
        rendered = rendered_states[i]
        if i == 0:
            print(f"\n{'='*50}")
            print(f"Rendered State {i} (Initial)")
        else:
            print(f"\n{'='*50}")
            print(f"Rendered State {i} (Final)")
        print(f"{'='*50}")
        
        print(f"  Objects: {len(rendered.objects)}")
        print(f"  Relations: {len(rendered.relations)}")
        
        # Count by type
        obj_types = {}
        for obj in rendered.objects:
            obj_types[obj.type] = obj_types.get(obj.type, 0) + 1
        
        print(f"  Object types: {obj_types}")
    
    # Export to JSON
    print("\n[Step 4] Exporting to JSON...")
    json_output = renderer.render_sequence_to_json(states, sg.parser.objects, plan)
    
    output_file = PLANNER_DIR / "output" / "gripper_rendered.json"
    with open(output_file, 'w') as f:
        f.write(json_output)
    
    print(f"✓ Rendered states saved to: {output_file}")
    
    return True


def test_renderer_factory():
    """Test renderer factory functionality."""
    print("\n" + "=" * 60)
    print("Testing Renderer Factory")
    print("=" * 60)
    
    # List supported domains
    print("\n[Step 1] Listing supported domains...")
    domains = RendererFactory.list_supported_domains()
    print(f"Supported domains: {domains}")
    
    assert 'blocks-world' in domains
    assert 'gripper' in domains
    
    # Get renderers
    print("\n[Step 2] Getting renderers...")
    for domain in domains:
        renderer = RendererFactory.get_renderer(domain)
        print(f"  {domain}: {renderer.__class__.__name__}")
        assert renderer is not None
    
    # Test default renderer for unknown domain
    print("\n[Step 3] Testing default renderer...")
    unknown_renderer = RendererFactory.get_renderer("unknown-domain")
    print(f"  unknown-domain: {unknown_renderer.__class__.__name__}")
    assert unknown_renderer.__class__.__name__ == "DefaultRenderer"
    
    print("\n✓ Renderer factory tests passed")
    
    return True


def test_rendered_state_format():
    """Test RenderedState data structure."""
    print("\n" + "=" * 60)
    print("Testing RenderedState Format")
    print("=" * 60)
    
    from state_renderer import VisualObject, VisualRelation, RenderedState
    
    # Create sample rendered state
    print("\n[Step 1] Creating sample RenderedState...")
    
    obj1 = VisualObject(
        id="block_a",
        type="block",
        label="A",
        position=[100, 200],
        properties={"color": "#FF0000", "size": 50}
    )
    
    obj2 = VisualObject(
        id="block_b",
        type="block",
        label="B",
        position=[100, 250],
        properties={"color": "#00FF00", "size": 50}
    )
    
    rel1 = VisualRelation(
        type="on",
        source="block_a",
        target="block_b",
        properties={"relationship": "stacked"}
    )
    
    rendered = RenderedState(
        domain="test-domain",
        objects=[obj1, obj2],
        relations=[rel1],
        metadata={"step": 0}
    )
    
    # Convert to dict
    print("\n[Step 2] Converting to dictionary...")
    data = rendered.to_dict()
    
    print(f"  Domain: {data['domain']}")
    print(f"  Objects: {len(data['objects'])}")
    print(f"  Relations: {len(data['relations'])}")
    print(f"  Metadata: {data['metadata']}")
    
    # Convert to JSON
    print("\n[Step 3] Converting to JSON...")
    json_str = rendered.to_json()
    parsed = json.loads(json_str)
    
    assert parsed['domain'] == 'test-domain'
    assert len(parsed['objects']) == 2
    assert len(parsed['relations']) == 1
    
    print("\n✓ RenderedState format tests passed")
    print(f"\nSample JSON output:\n{json_str}")
    
    return True

def main():
    """Run all tests."""
    print("State Renderer Test Suite")
    print("=" * 60)   

    test_depot_renderer()

# def main():
#     """Run all tests."""
#     print("State Renderer Test Suite")
#     print("=" * 60)
    
#     try:
#         # Test RenderedState format
#         success1 = test_rendered_state_format()
        
#         # Test renderer factory
#         success2 = test_renderer_factory()
        
#         # Test blocks world renderer
#         success3 = test_blocks_world_renderer()
        
#         # Test gripper renderer
#         success4 = test_gripper_renderer()
        
#         if success1 and success2 and success3 and success4:
#             print("\n" + "=" * 60)
#             print("✓ All tests passed!")
#             print("=" * 60)
#             print("\nGenerated files:")
#             print("  - output/blocks_world_rendered.json")
#             print("  - output/gripper_rendered.json")
#             print("\nNext steps:")
#             print("  1. Review the rendered JSON files")
#             print("  2. Proceed to Step 3.2: Complete domain-specific renderers")
#             print("  3. Create visualization frontend")
#         else:
#             print("\n" + "=" * 60)
#             print("✗ Some tests failed")
#             print("=" * 60)
#             return False
            
#     except Exception as e:
#         print(f"\n✗ Error: {e}")
#         import traceback
#         traceback.print_exc()
#         return False
    
#     return True


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
