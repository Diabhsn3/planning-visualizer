# Planning Domains

This directory contains PDDL domain and problem files for classical planning domains.

## ✅ Implemented Domains

### Blocks World
**Status:** Fully implemented with renderer  
**Files:** `blocks_world/domain.pddl`, `blocks_world/p1.pddl`  
**Renderer:** `state_renderer/blocks_world_renderer.py`  
**Description:** Classic block stacking problem with pick-up, put-down, stack, and unstack actions.

**Features:**
- Supports arbitrary number of blocks
- Visual stacking representation
- Color-coded blocks (red, teal, yellow, green, pink, purple)
- Gripper hand visualization
- Table surface rendering

### Gripper
**Status:** Fully implemented with renderer  
**Files:** `gripper/domain.pddl`, `gripper/p1.pddl`  
**Renderer:** `state_renderer/gripper_renderer.py`  
**Description:** Robot with grippers moving balls between rooms.

**Features:**
- Supports up to 8 balls with unique colors
- Supports up to 4 rooms with distinct backgrounds
- Robot visualization with left and right grippers
- Ball labels show only number (e.g., "1" instead of "BALL-1")
- Large, bold font (18px) for readability
- Dynamic room layout based on problem definition

---

## 🔨 Template Domains (Ready for Implementation)

The following domains have PDDL files and renderer templates with TODO markers. To activate:

### Depot
**Status:** PDDL files ready, renderer template created  
**Files:** `depot/domain.pddl`, `depot/p1.pddl`  
**Renderer Template:** `state_renderer/depot_renderer.py`  
**Description:** Trucks and hoists transporting crates between depots and distributors.

**Implementation Steps:**
1. Open `state_renderer/depot_renderer.py`
2. Implement `parse_state()` method (extract trucks, crates, locations)
3. Implement `render_state()` method (create visual layout)
4. Uncomment import in `state_renderer/__init__.py`
5. Add `'depot': DepotRenderer` to `_renderers` dictionary
6. Add to `DOMAIN_CONFIGS` in `backend/api/visualizer.ts`
7. Update enum in API input schemas
8. Test with `depot/p1.pddl`

### Hanoi (Tower of Hanoi)
**Status:** PDDL files ready, renderer template created  
**Files:** `hanoi/domain.pddl`, `hanoi/p1.pddl`  
**Renderer Template:** `state_renderer/hanoi_renderer.py`  
**Description:** Classic Tower of Hanoi puzzle with disks and pegs.

**Implementation Steps:**
1. Open `state_renderer/hanoi_renderer.py`
2. Implement `parse_state()` method (extract disks and pegs)
3. Implement `render_state()` method (vertical stacking visualization)
4. Uncomment import in `state_renderer/__init__.py`
5. Add `'hanoi': HanoiRenderer` to `_renderers` dictionary
6. Add to `DOMAIN_CONFIGS` in `backend/api/visualizer.ts`
7. Update enum in API input schemas
8. Test with `hanoi/p1.pddl`

### Logistics
**Status:** PDDL files ready, renderer template created  
**Files:** `logistics/domain.pddl`, `logistics/p1.pddl`  
**Renderer Template:** `state_renderer/logistics_renderer.py`  
**Description:** Trucks and airplanes delivering packages between cities.

**Implementation Steps:**
1. Open `state_renderer/logistics_renderer.py`
2. Implement `parse_state()` method (extract packages, vehicles, locations)
3. Implement `render_state()` method (network layout with cities)
4. Uncomment import in `state_renderer/__init__.py`
5. Add `'logistics': LogisticsRenderer` to `_renderers` dictionary
6. Add to `DOMAIN_CONFIGS` in `backend/api/visualizer.ts`
7. Update enum in API input schemas
8. Test with `logistics/p1.pddl`

### Rovers
**Status:** PDDL files ready, renderer template created  
**Files:** `rovers/domain.pddl`, `rovers/p1.pddl`  
**Renderer Template:** `state_renderer/rovers_renderer.py`  
**Description:** Planetary rovers navigating waypoints and collecting samples.

**Implementation Steps:**
1. Open `state_renderer/rovers_renderer.py`
2. Implement `parse_state()` method (extract rovers, waypoints, samples)
3. Implement `render_state()` method (waypoint network visualization)
4. Uncomment import in `state_renderer/__init__.py`
5. Add `'rovers': RoversRenderer` to `_renderers` dictionary
6. Add to `DOMAIN_CONFIGS` in `backend/api/visualizer.ts`
7. Update enum in API input schemas
8. Test with `rovers/p1.pddl`

### Satellite
**Status:** PDDL files ready, renderer template created  
**Files:** `satellite/domain.pddl`, `satellite/p1.pddl`  
**Renderer Template:** `state_renderer/satellite_renderer.py`  
**Description:** Satellites with instruments observing celestial targets.

**Implementation Steps:**
1. Open `state_renderer/satellite_renderer.py`
2. Implement `parse_state()` method (extract satellites, instruments, targets)
3. Implement `render_state()` method (orbital visualization)
4. Uncomment import in `state_renderer/__init__.py`
5. Add `'satellite': SatelliteRenderer` to `_renderers` dictionary
6. Add to `DOMAIN_CONFIGS` in `backend/api/visualizer.ts`
7. Update enum in API input schemas
8. Test with `satellite/p1.pddl`

---

## 📝 Adding a Completely New Domain

To add a domain not listed above:

### 1. Create Domain Folder

```
domains/your_domain/
├── domain.pddl    # PDDL domain definition
└── p1.pddl        # Example problem
```

### 2. Create Renderer

Create `state_renderer/your_domain_renderer.py`:

```python
from .base_renderer import BaseRenderer, RenderedState, VisualObject, VisualRelation
from typing import Dict, List, Any
import re

class YourDomainRenderer(BaseRenderer):
    """Renderer for Your Domain visualization."""
    
    def __init__(self):
        super().__init__()
        # Define color scheme
        self.colors = {
            "object_type_1": "#FF6B6B",
            "object_type_2": "#4ECDC4",
            "background": "#F8F9FA",
        }
    
    def parse_state(self, state_str: str) -> Dict[str, Any]:
        """
        Parse PDDL state string into structured data.
        
        Args:
            state_str: Raw PDDL state string
            
        Returns:
            Dictionary with 'objects' and 'predicates' keys
        """
        # Extract objects
        objects = []
        # Use regex to find objects: (object-name - type)
        
        # Extract predicates
        predicates = []
        # Use regex to find predicates: (predicate-name arg1 arg2 ...)
        
        return {
            "objects": objects,
            "predicates": predicates
        }
    
    def render_state(self, state_data: Dict[str, Any], state_index: int) -> RenderedState:
        """
        Convert parsed state to visualization format.
        
        Args:
            state_data: Parsed state from parse_state()
            state_index: Index of this state in the sequence
            
        Returns:
            RenderedState dictionary for frontend canvas
        """
        objects: List[VisualObject] = []
        relations: List[VisualRelation] = []
        
        # Create visual objects
        # Example:
        # objects.append({
        #     "id": "obj1",
        #     "type": "object_type",
        #     "label": "Object 1",
        #     "position": [x, y],
        #     "properties": {
        #         "color": self.colors["object_type_1"],
        #         "width": 50,
        #         "height": 50,
        #     }
        # })
        
        # Create visual relations
        # Example:
        # relations.append({
        #     "type": "connection",
        #     "source": "obj1",
        #     "target": "obj2",
        #     "properties": {}
        # })
        
        return {
            "domain": "your-domain",
            "objects": objects,
            "relations": relations,
            "metadata": {
                "step": state_index,
                # Add any domain-specific metadata
            }
        }
```

### 3. Register Renderer

Update `state_renderer/__init__.py`:

```python
from .your_domain_renderer import YourDomainRenderer

class RendererFactory:
    _renderers = {
        'blocks-world': BlocksWorldRenderer,
        'gripper': GripperRenderer,
        'your-domain': YourDomainRenderer,  # Add here
    }
    
    @staticmethod
    def get_renderer(domain_name: str):
        renderer_class = RendererFactory._renderers.get(domain_name)
        if renderer_class is None:
            raise ValueError(f"No renderer found for domain: {domain_name}")
        return renderer_class()
```

### 4. Update Backend API

Update `backend/api/visualizer.ts`:

```typescript
const DOMAIN_CONFIGS = {
  "blocks-world": {...},
  "gripper": {...},
  "your-domain": {
    name: "Your Domain",
    description: "Brief description of your domain",
    domainFile: path.join(PLANNER_DIR, "domains/your_domain/domain.pddl"),
  },
};

// Update generateStates input schema
generateStates: publicProcedure
  .input(
    z.object({
      domain: z.enum(["blocks-world", "gripper", "your-domain"]),
    })
  )

// Update uploadAndGenerate input schema
uploadAndGenerate: publicProcedure
  .input(
    z.object({
      domainContent: z.string(),
      problemContent: z.string(),
      domainName: z.enum(["blocks-world", "gripper", "your-domain"]),
    })
  )
```

### 5. Add Fallback Plan (Optional)

Update `run_planner.py`:

```python
def get_fallback_plan(domain_name: str) -> list[str]:
    """Get pre-defined fallback plan for a domain."""
    fallback_plans = {
        "blocks-world": [...],
        "gripper": [...],
        "your-domain": [
            "(action1 param1 param2)",
            "(action2 param3 param4)",
            # Add fallback action sequence
        ],
    }
    return fallback_plans.get(domain_name, [])
```

### 6. Test Implementation

```bash
cd backend/planner
python visualizer_api.py \
  domains/your_domain/domain.pddl \
  domains/your_domain/p1.pddl \
  your-domain
```

Or use the web interface:
1. Start backend and frontend servers
2. Select your domain from dropdown
3. Click "Generate States"
4. Verify visualization renders correctly

---

## 🎨 Renderer Design Guidelines

### State Parsing Best Practices

**Extract All Relevant Information:**
- Parse object declarations with types
- Extract all predicates that affect visualization
- Handle variable problem sizes (e.g., 3 blocks vs 10 blocks)

**Use Regular Expressions:**
```python
# Extract objects: (object-name - type)
object_pattern = r'\((\w+)\s*-\s*(\w+)\)'
objects = re.findall(object_pattern, state_str)

# Extract predicates: (predicate-name arg1 arg2 ...)
predicate_pattern = r'\((\w+(?:-\w+)*)\s+([^)]+)\)'
predicates = re.findall(predicate_pattern, state_str)
```

**Handle Edge Cases:**
- Empty predicates (initial state)
- Missing objects
- Malformed PDDL

### Visual Representation Guidelines

**Color Schemes:**
- Use distinct colors for different object types
- Maintain consistency across states
- Consider colorblind-friendly palettes
- Reference existing renderers for color choices

**Layout:**
- Scale layout based on number of objects
- Use fixed positions for static elements (e.g., table, rooms)
- Calculate dynamic positions for movable objects
- Ensure adequate spacing to prevent overlap

**Labels:**
- Keep labels concise (e.g., "1" not "BALL-1")
- Use readable font sizes (14px minimum, 18px for emphasis)
- Position labels to avoid overlap with objects
- Use contrasting colors for text visibility

**State Changes:**
- Make transitions visually obvious
- Highlight changed objects (optional)
- Maintain object identity across states
- Use consistent positioning when possible

### Reference Implementations

**Simple Domain (Blocks World):**
- See `state_renderer/blocks_world_renderer.py`
- Demonstrates vertical stacking
- Shows gripper interaction
- Uses color-coded blocks

**Complex Domain (Gripper):**
- See `state_renderer/gripper_renderer.py`
- Demonstrates multi-room layout
- Shows robot movement
- Handles variable room/ball counts
- Uses dynamic positioning

**Color Consistency:**
```python
# Blocks World colors
"#FF6B6B"  # Red
"#4ECDC4"  # Teal
"#FFE66D"  # Yellow
"#95E1D3"  # Mint
"#F38181"  # Pink
"#AA96DA"  # Purple

# Gripper room colors
"#E8F5E9"  # Light Green
"#E3F2FD"  # Light Blue
"#FFF3E0"  # Light Orange
"#F3E5F5"  # Light Purple
```

---

## 🧪 Testing Your Renderer

### Unit Testing

Create `tests/test_your_domain.py`:

```python
from visualizer_api import visualize_plan
from pathlib import Path

DOMAINS_DIR = Path(__file__).parent.parent / "domains"
DOMAIN_PATH = str(DOMAINS_DIR / "your_domain" / "domain.pddl")
PROBLEM_PATH = str(DOMAINS_DIR / "your_domain" / "p1.pddl")

result = visualize_plan(DOMAIN_PATH, PROBLEM_PATH, "your-domain")

assert result["success"], "Visualization failed"
assert len(result["states"]) > 0, "No states generated"
print(f"✅ Generated {result['num_states']} states")
print(f"✅ Plan: {result['plan']}")
```

### Integration Testing

1. Start backend: `cd backend/api && pnpm dev`
2. Start frontend: `cd frontend && pnpm dev`
3. Open http://localhost:3000
4. Select your domain
5. Click "Generate States"
6. Verify:
   - States load without errors
   - Visualization renders correctly
   - Animation plays smoothly
   - Zoom and pan work
   - State transitions are clear

### Debugging Tips

**Check Python Output:**
```bash
cd backend/planner
python visualizer_api.py \
  domains/your_domain/domain.pddl \
  domains/your_domain/p1.pddl \
  your-domain | python -m json.tool
```

**Verify Renderer Output:**
```python
from state_renderer import RendererFactory

renderer = RendererFactory.get_renderer("your-domain")
# Test with sample state
state_data = {"objects": [...], "predicates": [...]}
rendered = renderer.render_state(state_data, 0)
print(rendered)
```

**Check Frontend Console:**
- Open browser DevTools (F12)
- Look for errors in Console tab
- Check Network tab for API responses
- Verify state data structure

---

## 📚 Additional Resources

- **PDDL Reference:** https://planning.wiki/
- **Fast Downward:** https://www.fast-downward.org/
- **Base Renderer:** `state_renderer/base_renderer.py`
- **Planner README:** `../README.md`
- **Main README:** `../../README.md`

---

## 🤝 Contributing

When implementing a new domain:

1. Follow the structure of existing renderers
2. Add comprehensive docstrings
3. Test with multiple problem sizes
4. Ensure visual clarity
5. Update this README with domain details
6. Submit pull request with:
   - PDDL files
   - Renderer implementation
   - Test file
   - Documentation updates
