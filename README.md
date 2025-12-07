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

### Easy Setup (Recommended)

The easiest way to run the Planning Visualizer:

**Mac/Linux:**
```bash
git clone https://github.com/Diabhsn3/planning-visualizer.git
cd planning-visualizer
git submodule update --init --recursive
./run.sh
```

**Windows:**
```cmd
git clone https://github.com/Diabhsn3/planning-visualizer.git
cd planning-visualizer
git submodule update --init --recursive
run.bat
```

The script will automatically:
- ✅ Check Python and Node.js installation
- ✅ Install all dependencies
- ✅ Configure environment variables
- ✅ Build Fast Downward planner (optional - app works in fallback mode if build fails)
- ✅ Start the web application at `http://localhost:3000`

**Note**: If Fast Downward build fails (common on newer macOS), the app will run in **fallback mode** with pre-defined example problems. See troubleshooting guides for details.

### Platform-Specific Setup Guides

For detailed setup instructions and troubleshooting:
- **Mac users**: See [web-app/SETUP_MAC.md](web-app/SETUP_MAC.md)
- **Windows users**: See [web-app/SETUP_WINDOWS.md](web-app/SETUP_WINDOWS.md)

---

## Features

- ✅ PDDL domain and problem parsing
- ✅ Fast Downward planner integration (A* + LM-cut) - *optional*
- ✅ **Fallback mode** - works without Fast Downward for pre-defined problems
- ✅ State-by-state plan execution
- ✅ Domain-specific visual rendering
- ✅ Interactive web interface with HTML5 Canvas
- ✅ Timeline controls and animation playback
- ✅ Custom problem file upload (requires Fast Downward)
- ✅ Support for Blocks World and Gripper domains

---

## Project Structure

```
planning-visualizer/
├── web-app/                      # Main web application
│   ├── client/                  # React frontend
│   │   ├── src/
│   │   │   ├── components/      # UI components (Canvas, Timeline, etc.)
│   │   │   └── pages/           # Page components
│   ├── server/                  # Node.js backend (tRPC API)
│   ├── python_modules/          # Python planning integration
│   │   ├── run_planner.py      # Fast Downward integration
│   │   ├── state_generator.py  # PDDL parsing & state generation
│   │   └── state_renderer.py   # Domain-specific renderers
│   ├── README.md               # Web app documentation
│   ├── SETUP_MAC.md            # Mac setup guide
│   └── SETUP_WINDOWS.md        # Windows setup guide
├── planning-tools/              # Fast Downward planner (submodule)
│   └── downward/
├── run.sh                        # Easy run script (Mac/Linux)
├── run.bat                       # Easy run script (Windows)
└── requirements.txt              # Python dependencies (none required)
```

---

## Usage

### Command Line (Python)

```python
import sys
sys.path.append('web-app/python_modules')

from run_planner import solve_problem
from state_generator import StateGenerator
from state_renderer import RendererFactory

# Run planner and generate states
result = solve_problem(
    domain="blocks-world",
    problem_content="(define (problem blocks-4)...)"
)

print(f"Success: {result['success']}")
print(f"States: {len(result['states'])}")
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

1. Add domain renderer to `web-app/python_modules/state_renderer.py`
2. Register domain in `web-app/server/routers/visualizer.ts`
3. Add domain-specific rendering logic in `web-app/client/src/components/StateCanvas.tsx`
4. Test with example PDDL problems

---

## Documentation

- [web-app/README.md](web-app/README.md) - Web Application Documentation
- [web-app/SETUP_MAC.md](web-app/SETUP_MAC.md) - Mac Setup Guide
- [web-app/SETUP_WINDOWS.md](web-app/SETUP_WINDOWS.md) - Windows Setup Guide

---

## Troubleshooting

### Fast Downward Build Fails

**Most Common Issue**: Directory path contains spaces

Fast Downward cannot be built in directories with spaces in the path. If your path contains spaces (e.g., "final project", "My Documents"), move the project:

```bash
# Move to a path without spaces
mv "~/Documents/final project/planning-visualizer" ~/planning-visualizer
cd ~/planning-visualizer

# Then rebuild
git submodule update --init --recursive
cd planning-tools/downward
./build.py
```

The run scripts (run.sh / run.bat) will automatically detect and warn you about this issue.

### Python Not Found

Make sure Python 3.11+ is installed:
```bash
python3 --version  # Should show 3.11 or higher
```

### Node.js Issues

Install Node.js 18 or higher from [nodejs.org](https://nodejs.org)

### Platform-Specific Issues

- **Mac**: See [web-app/SETUP_MAC.md](web-app/SETUP_MAC.md)
- **Windows**: See [web-app/SETUP_WINDOWS.md](web-app/SETUP_WINDOWS.md)

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
