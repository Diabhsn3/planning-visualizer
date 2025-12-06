# Planning Visualizer

A comprehensive system for visualizing classical planning algorithms using domain-independent planners. The project includes a complete pipeline from PDDL parsing through state generation to interactive web visualization.

**Supported domains**: Blocks World, Logistics, Depot, Gripper, Hanoi, Rovers, Satellite.

---

## Project Overview

This project implements a four-stage pipeline:

1. **Planner Runner** - Integrates with Fast Downward planner
2. **State Generator** - Parses PDDL and generates state sequences  
3. **State Renderer** - Converts states to visual representations
4. **Web Visualizer** - Interactive web application with HTML5 Canvas

---

## Quick Start

### Python Modules

```bash
# Clone and setup
git clone https://github.com/Diabhsn3/planning-visualizer.git
cd planning-visualizer
git submodule update --init --recursive

# Create virtual environment
python3 -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Build Fast Downward
cd planning-tools/downward
./build.py release
cd ../..

# Run tests
python tests/test1.py
python tests/test_state_generator_standalone.py
python tests/test_state_renderer.py
```

### Web Application

```bash
cd web-app

# Install dependencies
pnpm install

# Start development server
pnpm dev
```

Visit `http://localhost:3000` to use the interactive visualizer.

---

## Features

- ✅ PDDL domain and problem parsing
- ✅ Fast Downward planner integration (A* + LM-cut)
- ✅ State-by-state plan execution
- ✅ Domain-specific visual rendering
- ✅ Interactive web interface with HTML5 Canvas
- ✅ Timeline controls and animation playback
- ✅ Custom problem file upload
- ✅ Support for 7 planning domains

---

## Project Structure

```
planning-visualizer/
├── src/                          # Python modules
│   ├── planner_runner/          # Step 1: Planner integration
│   ├── state_generator/         # Step 2: State generation
│   └── state_renderer/          # Step 3: Visual rendering
├── domains/                      # PDDL domain and problem files
│   ├── blocks_world/
│   ├── logistics/
│   ├── depot/
│   ├── gripper/
│   ├── hanoi/
│   ├── rovers/
│   └── satellite/
├── tests/                        # Unit tests
├── output/                       # Generated visualization data
├── web-app/                      # Step 4: Web application
│   ├── client/                  # React frontend
│   ├── server/                  # Node.js backend
│   └── python_modules/          # Python integration
└── planning-tools/              # Fast Downward planner (submodule)
    └── downward/
```

---

## Usage

### Command Line (Python)

```python
from src.planner_runner.runner import run_planner

# Run planner
actions = run_planner(
    "domains/blocks_world/domain.pddl",
    "domains/blocks_world/p1.pddl",
)

# Generate and render states
from src.state_generator import StateGenerator
from src.state_renderer import RendererFactory

sg = StateGenerator("domains/blocks_world/domain.pddl", 
                    "domains/blocks_world/p1.pddl")
states = sg.apply_plan(actions)

renderer = RendererFactory.get_renderer(sg.parser.domain_name)
rendered_states = renderer.render_sequence(states, sg.parser.objects, actions)
```

### Web Interface

1. **Pre-built Examples**:
   - Select domain (Blocks World or Gripper)
   - Click "Generate States"
   - Use timeline controls to navigate

2. **Custom Problems**:
   - Select a domain
   - Check "Upload custom problem file"
   - Choose your PDDL problem file
   - Click "Solve Problem"
   - Watch the animated solution

---

## Architecture

### Pipeline Flow

```
PDDL Files → Planner → Plan → State Generator → States → Renderer → Visual JSON → Web UI
```

### Components

#### 1. Planner Runner (`src/planner_runner/`)
- Integrates with Fast Downward
- Executes A* with LM-cut heuristic
- Returns grounded action sequences

#### 2. State Generator (`src/state_generator/`)
- Parses PDDL domain and problem files
- Applies actions sequentially
- Validates preconditions and effects
- Tracks complete state history

#### 3. State Renderer (`src/state_renderer/`)
- Base renderer interface
- Domain-specific renderers:
  - **Blocks World**: Vertical stacking layout
  - **Gripper**: Multi-room layout with robot
- Outputs RenderedState JSON format

#### 4. Web Application (`web-app/`)
- **Frontend**: React + TypeScript + HTML5 Canvas
- **Backend**: Node.js + tRPC + Express  
- **Integration**: Calls Python modules
- **Features**: Timeline, animation, file upload

See [web-app/README.md](web-app/README.md) for detailed documentation.

---

## Development

### Adding a New Domain

1. Create PDDL files in `domains/your_domain/`
2. Implement renderer in `src/state_renderer/your_domain_renderer.py`
3. Register in `src/state_renderer/__init__.py`
4. Add to web app in `web-app/server/visualizer.ts`
5. Test with example problems

### Running Tests

```bash
# Python tests
python tests/test_state_generator_standalone.py
python tests/test_state_renderer.py

# Web app tests
cd web-app
pnpm test
```

---

## Documentation

- [STEP1_README.md](STEP1_README.md) - Planner Runner
- [STEP2_README.md](STEP2_README.md) - State Generator  
- [STEP3_README.md](STEP3_README.md) - State Renderer
- [web-app/README.md](web-app/README.md) - Web Application

---

## Troubleshooting

### ModuleNotFoundError

Run Python from repository root:

```bash
cd planning-visualizer
source venv/bin/activate
python tests/test1.py
```

### Submodule Missing

```bash
git submodule update --init --recursive
cd planning-tools/downward
./build.py release
```

### Web App Issues

See [web-app/README.md](web-app/README.md) for web-specific troubleshooting.

---

## Roadmap

- [x] Step 1: Domain definitions + Planner integration
- [x] Step 2: State Generator (PDDL parser + state generation)
- [x] Step 3.1: State Renderer (RenderedState format)
- [x] Step 4: Web Visualizer (HTML5 Canvas + interactive UI)
- [ ] Step 3.2: Complete renderers for all 7 domains
- [ ] Export visualizations as GIF/video
- [ ] Share visualizations via public links

---

## Technologies

- **Python 3.11+**: PDDL parsing, state generation, rendering
- **Fast Downward**: Classical planning
- **React 19**: Frontend UI
- **TypeScript**: Type-safe development
- **HTML5 Canvas**: Visual rendering
- **tRPC 11**: Type-safe API
- **Tailwind CSS 4**: Styling

---

## License

MIT

---

## Contact

For questions or issues, please open a GitHub issue.
