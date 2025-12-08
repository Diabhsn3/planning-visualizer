# Planning Visualizer - Python Planner

Python modules for planning, state generation, and visualization rendering.

## 🚀 Quick Start

```bash
# Test all domains
python test_domains.py

# Test individual domains
python test_blocksworld.py
python test_gripper.py
```

## 📁 Structure

```
backend/planner/
├── domains/                # PDDL domain files
│   ├── blocks_world/
│   │   ├── domain.pddl
│   │   └── p1.pddl
│   └── gripper/
│       ├── domain.pddl
│       └── p1.pddl
├── planner_runner/         # Fast Downward integration
│   ├── __init__.py
│   └── runner.py
├── state_generator/        # State generation logic
│   ├── __init__.py
│   ├── pddl_parser.py
│   └── state_generator.py
├── state_renderer/         # Visualization rendering
│   ├── __init__.py
│   ├── blocks_world_renderer.py
│   ├── gripper_renderer.py
│   └── renderer_factory.py
├── visualizer_api.py       # Main API (called by Node.js)
├── run_planner.py          # Planner execution
└── test_*.py               # Test files
```

## 🔧 How It Works

### 1. visualizer_api.py
Main entry point called by Node.js backend:
```bash
python visualizer_api.py <domain_path> <problem_path> <domain_name>
```

Returns JSON with plan and rendered states.

### 2. run_planner.py
Runs Fast Downward planner or uses fallback plans:
```python
from run_planner import solve_problem

actions, used_planner = solve_problem(
    domain_path="domains/blocks_world/domain.pddl",
    problem_path="domains/blocks_world/p1.pddl",
    domain_name="blocksworld"
)
```

### 3. state_generator/
Generates intermediate states from plan:
```python
from state_generator import StateGenerator

sg = StateGenerator(domain_path, problem_path)
states = sg.generate_states(actions)
```

### 4. state_renderer/
Renders states for visualization:
```python
from state_renderer import RendererFactory

renderer = RendererFactory.get_renderer("blocksworld")
rendered_states = [renderer.render(state) for state in states]
```

## 🧪 Testing

### Test All Domains
```bash
python test_domains.py
```

Output:
```
======================================================================
PLANNING VISUALIZER - DOMAIN TESTS
======================================================================

Testing all available domains with example problems...

======================================================================
BLOCKSWORLD DOMAIN TEST
======================================================================
...
✅ blocksworld test passed!

======================================================================
GRIPPER DOMAIN TEST
======================================================================
...
✅ gripper test passed!

======================================================================
TEST SUMMARY
======================================================================
blocksworld     ✅ PASSED
gripper         ✅ PASSED

Total: 2 domains
✅ Passed: 2
❌ Failed: 0

🎉 All domain tests passed!
```

### Test Individual Domain
```bash
python test_blocksworld.py
python test_gripper.py
```

## 📝 Adding a New Domain

### 1. Add PDDL Files
Create directory `domains/new_domain/`:
```
domains/new_domain/
├── domain.pddl     # Domain definition
└── p1.pddl         # Example problem
```

### 2. Create Renderer
Create `state_renderer/new_domain_renderer.py`:
```python
class NewDomainRenderer:
    def render(self, state):
        # Convert state to visualization format
        return {
            "type": "new_domain",
            "objects": [...],
            "predicates": [...]
        }
```

### 3. Register Renderer
Update `state_renderer/renderer_factory.py`:
```python
from .new_domain_renderer import NewDomainRenderer

class RendererFactory:
    @staticmethod
    def get_renderer(domain_name: str):
        renderers = {
            "blocksworld": BlocksWorldRenderer(),
            "gripper": GripperRenderer(),
            "newdomain": NewDomainRenderer(),  # Add here
        }
        return renderers.get(domain_name)
```

### 4. Add Fallback Plan (Optional)
Update `run_planner.py`:
```python
def get_fallback_plan(domain_name: str) -> list[str]:
    fallback_plans = {
        "blocksworld": [...],
        "gripper": [...],
        "newdomain": [  # Add fallback plan
            "action1 param1 param2",
            "action2 param3 param4",
        ],
    }
    return fallback_plans.get(domain_name, [])
```

### 5. Create Test File
Create `test_newdomain.py`:
```python
from visualizer_api import visualize_plan
from pathlib import Path

DOMAINS_DIR = Path(__file__).parent / "domains"
DOMAIN_PATH = str(DOMAINS_DIR / "new_domain" / "domain.pddl")
PROBLEM_PATH = str(DOMAINS_DIR / "new_domain" / "p1.pddl")

result = visualize_plan(DOMAIN_PATH, PROBLEM_PATH, "newdomain")
print("✅ SUCCESS!" if result["success"] else "❌ FAILED")
```

### 6. Update Backend API
Update `backend/api/visualizer.ts`:
```typescript
const DOMAIN_CONFIGS = {
  "blocks-world": {...},
  "gripper": {...},
  "new-domain": {
    name: "New Domain",
    description: "Description of new domain",
    domainFile: "../planner/domains/new_domain/domain.pddl",
  },
};
```

## 🔍 Troubleshooting

### Fast Downward not found
- Check `planning-tools/downward/fast-downward.py` exists
- Build Fast Downward: `cd ../../planning-tools/downward && ./build.py`
- Tests will use fallback plans if Fast Downward unavailable

### Import errors
- Ensure you're running from `backend/planner/` directory
- Python needs to find modules relative to current directory

### PDDL parsing errors
- Check PDDL syntax in domain and problem files
- Ensure files follow PDDL 3.1 standard
- Test with Fast Downward directly: `fast-downward.py domain.pddl problem.pddl`

## 📚 Dependencies

- Python 3.11+
- No external Python packages required (uses only standard library)
- Fast Downward planner (optional, fallback plans available)

## 🔗 Integration with Backend API

The Node.js backend (`backend/api/visualizer.ts`) calls `visualizer_api.py`:

```typescript
const pythonScript = path.join(__dirname, "../planner/visualizer_api.py");
const { stdout } = await execAsync(
  `python3 "${pythonScript}" "${domainPath}" "${problemPath}" "${domainName}"`
);
const result = JSON.parse(stdout);
```

Returns JSON:
```json
{
  "success": true,
  "domain": "blocksworld",
  "problem": "p1",
  "plan": ["unstack d c", "put-down d", ...],
  "num_states": 9,
  "states": [{...}, {...}, ...],
  "used_planner": false,
  "planner_info": "fallback"
}
```

---

For more information, see [TESTING.md](./TESTING.md) and [README_NEW_STRUCTURE.md](../../README_NEW_STRUCTURE.md).
