# Planning Visualizer - Python Planner Module

Python modules for classical planning, state generation, and domain-specific visualization rendering.

## 📁 Module Structure

```
backend/planner/
├── visualizer_api.py       # Main API entry point (called by Node.js backend)
├── run_planner.py          # Fast Downward integration and fallback plans
├── domains/                # PDDL domain and problem files
│   ├── blocks_world/       # ✅ Implemented
│   │   ├── domain.pddl
│   │   └── p1.pddl
│   ├── gripper/            # ✅ Implemented
│   │   ├── domain.pddl
│   │   └── p1.pddl
│   ├── depot/              # 🔨 Template only
│   ├── hanoi/              # 🔨 Template only
│   ├── logistics/          # 🔨 Template only
│   ├── rovers/             # 🔨 Template only
│   ├── satellite/          # 🔨 Template only
│   └── README.md           # Domain implementation guide
├── state_generator/        # State generation from action sequences
│   ├── __init__.py
│   ├── pddl_parser.py      # PDDL parsing utilities
│   └── state_generator.py  # State generation logic
├── state_renderer/         # Domain-specific visualization renderers
│   ├── __init__.py
│   ├── base_renderer.py    # Base renderer class and types
│   ├── blocks_world_renderer.py  # ✅ Blocks World renderer
│   ├── gripper_renderer.py       # ✅ Gripper renderer
│   ├── depot_renderer.py         # 🔨 Template with TODO markers
│   ├── hanoi_renderer.py         # 🔨 Template with TODO markers
│   ├── logistics_renderer.py     # 🔨 Template with TODO markers
│   ├── rovers_renderer.py        # 🔨 Template with TODO markers
│   └── satellite_renderer.py     # 🔨 Template with TODO markers
├── planner_runner/         # Planner execution wrapper
│   ├── __init__.py
│   └── runner.py
├── output/                 # Generated state files (JSON)
│   ├── blocks_world_rendered.json
│   ├── blocks_world_states.json
│   ├── gripper_rendered.json
│   └── gripper_states.json
└── tests/                  # Test files
    ├── test_state_generator.py
    ├── test_state_generator_standalone.py
    └── test_state_renderer.py
```

---

## 🚀 How It Works

### 1. API Entry Point (`visualizer_api.py`)

Main entry point called by the Node.js backend:

```bash
python visualizer_api.py <domain_path> <problem_path> <domain_name>
```

**Arguments:**
- `domain_path` - Path to PDDL domain file
- `problem_path` - Path to PDDL problem file
- `domain_name` - Domain identifier (`blocks-world`, `gripper`)

**Output:** JSON to stdout
```json
{
  "success": true,
  "domain": "blocks-world",
  "problem": "p1",
  "plan": ["(unstack d c)", "(put-down d)", ...],
  "num_states": 9,
  "states": [
    {
      "domain": "blocks-world",
      "objects": [...],
      "relations": [...],
      "metadata": {"step": 0}
    },
    ...
  ],
  "used_planner": false,
  "planner_info": "Fallback (predefined plan)"
}
```

### 2. Planner Integration (`run_planner.py`)

Runs Fast Downward planner or uses fallback plans:

```python
from run_planner import solve_problem

actions, used_planner = solve_problem(
    domain_path="domains/blocks_world/domain.pddl",
    problem_path="domains/blocks_world/p1.pddl",
    domain_name="blocks-world"
)
```

**Behavior:**
- Attempts to use Fast Downward if available
- Falls back to pre-defined plans if Fast Downward not found
- Returns tuple: `(actions: list[str], used_planner: bool)`

**Fallback Plans:**
- Blocks World: Pre-defined action sequence for default problem
- Gripper: Pre-defined action sequence for default problem

### 3. State Generation (`state_generator/`)

Generates intermediate states from action sequences:

```python
from state_generator import StateGenerator

sg = StateGenerator(domain_path, problem_path)
states = sg.generate_states(actions)
```

**Process:**
1. Parses initial state from PDDL problem
2. Applies each action sequentially
3. Generates intermediate state after each action
4. Returns list of state dictionaries

### 4. State Rendering (`state_renderer/`)

Converts states to visualization format:

```python
from state_renderer import RendererFactory

renderer = RendererFactory.get_renderer("blocks-world")
rendered_states = [renderer.render_state(state, i) for i, state in enumerate(states)]
```

**Renderer Types:**
- `BaseRenderer` - Abstract base class with common functionality
- `BlocksWorldRenderer` - Renders block stacking visualization
- `GripperRenderer` - Renders robot, grippers, rooms, and balls

**Output Format:**
```python
RenderedState = {
    "domain": str,
    "objects": List[VisualObject],
    "relations": List[VisualRelation],
    "metadata": Dict[str, Any]
}
```

---

## 🧪 Testing

### Test State Generator

```bash
cd backend/planner
python tests/test_state_generator.py
```

Tests PDDL parsing and state generation logic.

### Test State Renderer

```bash
cd backend/planner
python tests/test_state_renderer.py
```

Tests renderer output format and consistency.

---

## 🔧 Implementation Details

### Renderer Architecture

All renderers extend `BaseRenderer` and implement:

```python
class DomainRenderer(BaseRenderer):
    def parse_state(self, state_str: str) -> Dict[str, Any]:
        """Parse PDDL state string into structured data."""
        pass
    
    def render_state(self, state_data: Dict[str, Any], state_index: int) -> RenderedState:
        """Convert parsed state to visualization format."""
        pass
```

### Blocks World Renderer

**Features:**
- Renders blocks as colored rectangles
- Stacks blocks vertically based on `(on A B)` predicates
- Shows table as brown base
- Displays gripper hand with held block
- Uses distinct colors per block (red, teal, yellow, green, pink, purple)

**Key Predicates:**
- `(on A B)` - Block A is on block B
- `(ontable A)` - Block A is on the table
- `(holding A)` - Gripper is holding block A
- `(clear A)` - Block A has nothing on top
- `(handempty)` - Gripper is empty

### Gripper Renderer

**Features:**
- Renders up to 4 rooms with distinct colors
- Renders up to 8 balls with unique colors
- Shows robot with grippers at current room
- Displays balls in rooms or in grippers
- Ball labels show only number (e.g., "1" not "BALL-1")
- Larger font size (18px bold) for readability

**Key Predicates:**
- `(at-robby ROOM)` - Robot location
- `(at BALL ROOM)` - Ball location
- `(carry BALL GRIPPER)` - Gripper holding ball
- `(free GRIPPER)` - Gripper is empty

**Room Colors:**
- room-a: Light Green (#E8F5E9)
- room-b: Light Blue (#E3F2FD)
- room-c: Light Orange (#FFF3E0)
- room-d: Light Purple (#F3E5F5)

**Ball Colors:**
- ball-1: Red (#FF6B6B)
- ball-2: Teal (#4ECDC4)
- ball-3: Blue (#5DADE2)
- ball-4: Orange (#F39C12)
- ball-5: Yellow (#FFE66D)
- ball-6: Mint (#95E1D3)
- ball-7: Pink (#F38181)
- ball-8: Purple (#AA96DA)

---

## 📝 Adding a New Domain

See `domains/README.md` for comprehensive guide. Summary:

### 1. Create PDDL Files

```
domains/new_domain/
├── domain.pddl     # Domain definition
└── p1.pddl         # Example problem
```

### 2. Implement Renderer

Create `state_renderer/new_domain_renderer.py`:

```python
from .base_renderer import BaseRenderer, RenderedState
from typing import Dict, List, Any

class NewDomainRenderer(BaseRenderer):
    def __init__(self):
        super().__init__()
        self.colors = {
            "object_type": "#COLOR",
        }
    
    def parse_state(self, state_str: str) -> Dict[str, Any]:
        # Extract objects and predicates from PDDL state
        return {
            "objects": [...],
            "predicates": [...]
        }
    
    def render_state(self, state_data: Dict[str, Any], state_index: int) -> RenderedState:
        # Convert to visualization format
        return {
            "domain": "new-domain",
            "objects": [...],
            "relations": [...],
            "metadata": {"step": state_index}
        }
```

### 3. Register Renderer

Update `state_renderer/__init__.py`:

```python
from .new_domain_renderer import NewDomainRenderer

class RendererFactory:
    _renderers = {
        'blocks-world': BlocksWorldRenderer,
        'gripper': GripperRenderer,
        'new-domain': NewDomainRenderer,  # Add here
    }
```

### 4. Update Backend API

Update `backend/api/visualizer.ts`:

```typescript
const DOMAIN_CONFIGS = {
  "blocks-world": {...},
  "gripper": {...},
  "new-domain": {
    name: "New Domain",
    description: "Description",
    domainFile: path.join(PLANNER_DIR, "domains/new_domain/domain.pddl"),
  },
};

// Update enum in generateStates input schema
z.enum(["blocks-world", "gripper", "new-domain"])

// Update enum in uploadAndGenerate input schema
z.enum(["blocks-world", "gripper", "new-domain"])
```

### 5. Add Fallback Plan (Optional)

Update `run_planner.py`:

```python
def get_fallback_plan(domain_name: str) -> list[str]:
    fallback_plans = {
        "blocks-world": [...],
        "gripper": [...],
        "new-domain": [
            "action1 param1 param2",
            "action2 param3 param4",
        ],
    }
    return fallback_plans.get(domain_name, [])
```

---

## 🔍 Troubleshooting

### Fast Downward Not Found

- Check `../../planning-tools/downward/fast-downward.py` exists
- Build Fast Downward: `cd ../../planning-tools/downward && ./build.py release`
- Application uses fallback plans if Fast Downward unavailable

### Import Errors

- Ensure running from `backend/planner/` directory
- Python modules use relative imports
- No external dependencies required (standard library only)

### PDDL Parsing Errors

- Verify PDDL syntax in domain and problem files
- Ensure files follow PDDL standard
- Test with Fast Downward directly: `fast-downward.py domain.pddl problem.pddl --search "astar(lmcut())"`

---

## 📚 Dependencies

- **Python 3.11+** - Required
- **Standard Library Only** - No external packages needed
- **Fast Downward** - Optional (fallback plans available)

---

## 🔗 Integration with Backend API

The Node.js backend (`backend/api/visualizer.ts`) calls `visualizer_api.py`:

```typescript
const pythonScript = path.join(PLANNER_DIR, "visualizer_api.py");
const { stdout, stderr } = await execAsync(
  `"${PYTHON_CMD}" "${pythonScript}" "${domainPath}" "${problemPath}" "${domainName}"`,
  {
    maxBuffer: 10 * 1024 * 1024,
    timeout: 120000, // 2 minute timeout
  }
);
const result = JSON.parse(stdout);
```

**Python Command Detection:**
The backend automatically detects Python installation:
1. Checks `PYTHON_CMD` environment variable
2. Tries common Python commands (`python3`, `python`, `python3.11`, `python3.12`)
3. Falls back to `python3` if none found

**Error Handling:**
- Python errors are captured from stderr
- JSON parsing errors are caught and reported
- Timeout after 2 minutes to prevent hanging

---

## 📖 Further Reading

- `domains/README.md` - Comprehensive domain implementation guide
- `state_renderer/base_renderer.py` - Renderer base class and type definitions
- `state_renderer/blocks_world_renderer.py` - Reference implementation
- `state_renderer/gripper_renderer.py` - Advanced multi-room implementation
