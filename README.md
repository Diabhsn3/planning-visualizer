# Planning Visualizer

A modern web application for visualizing classical planning problems and solutions. It integrates the Fast Downward planning system with domain-specific renderers, allowing users to explore how different search strategies solve PDDL problems step-by-step.

![React](https://img.shields.io/badge/React-19-blue) ![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue) ![Python](https://img.shields.io/badge/Python-3.11+-green) ![Fast Downward](https://img.shields.io/badge/Fast%20Downward-Integrated-orange)

---

## Features

The Planning Visualizer provides an interactive environment for understanding automated planning. Users can select a planning domain, choose a search strategy, provide a custom problem, and watch the planner solve it with a visual, step-by-step animation.

**Core Capabilities:**

- **Interactive Canvas Visualization**: Domain-specific renderers draw each state on an HTML5 canvas. Users can zoom (10%–500%) with the mouse wheel and pan by clicking and dragging.
- **Search Strategy Selection**: Choose from 10+ Fast Downward search strategies, ranging from optimal (A* + LM-cut) to fast satisficing (Lazy Greedy + FF). The UI displays each strategy's speed, optimality, and a recommendation for when to use it.
- **Custom Problem Input**: Upload a `.pddl` file or paste the problem definition directly into a text area. The application parses the problem and runs the planner in real-time.
- **Playback Controls**: Play, pause, step forward/backward, and adjust animation speed. A timeline slider allows jumping to any state in the plan.
- **Real-time Feedback**: The UI shows elapsed time during planning, warns users when a slow strategy is selected, and suggests faster alternatives if a timeout occurs.
- **Automatic File Cleanup**: Temporary uploaded files are deleted after processing to prevent disk clutter.

---

## Supported Domains

The visualizer includes PDDL files and renderers for several classic planning domains. Five domains are fully implemented with custom renderers. Logistics and Satellite are provided as templates for future development.

| Domain | Status | Description |
|---|:---:|---|
| **Blocks World** | ✅ Implemented | Stack and unstack blocks on a table. Supports unlimited blocks with cycling colors. |
| **Gripper** | ✅ Implemented | A robot with two grippers moves balls between rooms. Supports up to 8 balls and 4 rooms. |
| **Depot** | ✅ Implemented | Transport crates between depots using trucks and hoists. |
| **Hanoi** | ✅ Implemented | The classic Tower of Hanoi puzzle. |
| **Rovers** | ✅ Implemented | Navigate rovers on a planet to collect samples and data. |
| Logistics | 📝 Template | Deliver packages between cities using trucks and airplanes. |
| Satellite | 📝 Template | Point satellite instruments to take images of celestial targets. |

---

## Search Strategies

The application provides a curated whitelist of Fast Downward search strategies. Users select a strategy by its name, and the backend maps it to the correct command-line arguments. Raw CLI arguments are never accepted from the frontend for security.

### Optimal Strategies (Guaranteed Shortest Plan)

| Strategy | Speed | When to Use |
|---|:---:|---|
| A* + LM-cut | 🔴 Slow | When you need the absolute shortest plan and can wait. |
| A* Blind | 🔴 Slow | For very small problems only (breadth-first behavior). |
| A* + h^max | 🔴 Slow | An alternative when LM-cut fails or is too slow. |

### Satisficing Strategies (Fast, Good Plans)

| Strategy | Speed | When to Use |
|---|:---:|---|
| **Lazy Greedy + FF** | 🟢 Fast | **Recommended default.** Best for quick results. |
| Greedy Best-First + FF | 🟢 Fast | General-purpose fast planning. |
| Greedy + h^add | 🟢 Fast | Alternative when FF doesn't work well for a domain. |
| LAMA-first | 🟡 Medium | Good balance of speed and plan quality. |
| Greedy + CEA | 🟡 Medium | Useful for domains with many actions. |

### Weighted A* (Bounded Suboptimal)

| Strategy | Speed | When to Use |
|---|:---:|---|
| Weighted A* (w=3) + FF | 🟡 Medium | Faster than optimal, with at most 3x optimal cost. |
| Weighted A* (w=2) + LM-cut | 🟡 Medium | Better quality than w=3, still faster than optimal. |

---

## Getting Started

### Prerequisites

Before you begin, ensure you have the following installed:

| Software | Version | Notes |
|---|---|---|
| **Node.js** | 18 or later | [Download](https://nodejs.org/) |
| **Python** | 3.11 or later | [Download](https://www.python.org/downloads/) |
| **pnpm** | Latest | Install with `npm install -g pnpm` |
| **Git** | Latest | [Download](https://git-scm.com/) |
| **C++ Compiler** | (Optional) | Required to build Fast Downward. GCC on Linux, Xcode on macOS, or Visual Studio Build Tools on Windows. |

### Installation

1.  **Clone the repository:**

    ```bash
    git clone https://github.com/Diabhsn3/planning-visualizer.git
    cd planning-visualizer
    ```

2.  **Initialize the Fast Downward submodule:**

    ```bash
    git submodule update --init --recursive
    ```

3.  **Run the setup script (Recommended):**

    The provided script checks dependencies, installs packages, builds Fast Downward, and starts the servers.

    ```bash
    # On macOS/Linux
    ./run_new.sh

    # On Windows
    run_new.bat
    ```

    The application will be available at **http://localhost:3000**.

### Manual Setup

If you prefer to run the steps manually:

1.  **Build Fast Downward:**

    ```bash
    cd planning-tools/downward
    ./build.py
    cd ../..
    ```

2.  **Install dependencies:**

    ```bash
    # Backend
    cd backend/api && pnpm install && cd ../..

    # Frontend
    cd frontend && pnpm install && cd ..
    ```

3.  **Start the servers (in separate terminals):**

    ```bash
    # Terminal 1: Backend API (runs on port 4000)
    cd backend/api && pnpm dev

    # Terminal 2: Frontend (runs on port 3000)
    cd frontend && pnpm dev
    ```

---

## Project Structure

```
planning-visualizer/
├── frontend/                     # React 19 + TypeScript + Tailwind CSS
│   ├── src/
│   │   ├── pages/
│   │   │   └── Visualizer.tsx    # Main application page
│   │   ├── components/
│   │   │   └── StateCanvas.tsx   # Canvas renderer with zoom/pan
│   │   └── ...
│   └── vite.config.ts            # Vite configuration with API proxy
│
├── backend/
│   ├── api/                      # Node.js + Express + tRPC API
│   │   ├── visualizer.ts         # Main API endpoints
│   │   ├── uploads/              # Temporary PDDL files (auto-cleaned)
│   │   └── ...
│   │
│   └── planner/                  # Python planning engine
│       ├── visualizer_api.py     # Main entry point for Node.js
│       ├── run_planner.py        # Fast Downward subprocess wrapper
│       ├── search_strategies.py  # Strategy whitelist and metadata
│       ├── domains/              # PDDL domain and problem files
│       │   ├── blocks_world/
│       │   ├── gripper/
│       │   └── ...
│       └── state_renderer/       # Domain-specific visualization logic
│           ├── base_renderer.py
│           ├── blocks_world_renderer.py
│           └── gripper_renderer.py
│
├── planning-tools/
│   └── downward/                 # Fast Downward (Git submodule)
│
├── run_new.sh                    # Setup and run script (macOS/Linux)
├── run_new.bat                   # Setup and run script (Windows)
└── README.md                     # This file
```

---

## How It Works

The application follows a layered architecture:

1.  **Frontend (React)**: The user selects a domain, strategy, and optionally provides a custom problem. The frontend sends a request to the backend via tRPC.

2.  **Backend API (Node.js)**: The API validates the request, saves any uploaded problem to a temporary file, and spawns a Python subprocess.

3.  **Python Wrapper**: The `visualizer_api.py` script receives the domain, problem path, and strategy ID. It calls `run_planner.py` to execute Fast Downward.

4.  **Fast Downward**: The planner runs with the selected search strategy. If a plan is found, it's written to a file.

5.  **State Generation**: The Python wrapper parses the plan, applies each action to the initial state, and generates a sequence of intermediate states.

6.  **Rendering**: Each state is passed to the domain-specific renderer (e.g., `blocks_world_renderer.py`), which outputs a JSON structure describing shapes, colors, and positions.

7.  **Visualization**: The JSON is returned to the frontend, which draws each state on the canvas and provides playback controls.

---

## Configuration

### Planner Timeout

The default timeout for the Fast Downward planner is **30 minutes (1800 seconds)**. This can be changed via an environment variable:

```bash
# Set a 1-hour timeout
export PLANNER_TIMEOUT=3600
```

### Python Command

If your Python executable is not `python3`, create a `.env` file in `backend/api/`:

```bash
echo "PYTHON_CMD=python" > backend/api/.env
```

---

## Extending the Visualizer

### Adding a New Domain

1.  **Create PDDL files** in `backend/planner/domains/your_domain/`:
    - `domain.pddl`: The domain definition.
    - `p1.pddl`: A sample problem.

2.  **Implement a renderer** in `backend/planner/state_renderer/your_domain_renderer.py`:
    - Extend `BaseRenderer`.
    - Implement `parse_state()` and `render_state()`.

3.  **Register the renderer** in `backend/planner/state_renderer/__init__.py`:
    - Import your class.
    - Add it to the `RENDERERS` dictionary.

4.  **Add the domain to the frontend** in `frontend/src/pages/Visualizer.tsx`:
    - Add an entry to the `DOMAIN_CONFIGS` array.

Templates for Depot, Hanoi, Logistics, Rovers, and Satellite are already provided in the codebase.

---

## Troubleshooting

### "Port already in use"

Kill the process using the port:

```bash
# macOS/Linux
lsof -ti:3000 | xargs kill -9
lsof -ti:4000 | xargs kill -9

# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

### "Python not found"

Ensure Python 3.11+ is installed and accessible. Set the `PYTHON_CMD` environment variable if needed (see Configuration above).

### "Fast Downward build failed on macOS"

This is a known issue with Xcode 15+. The application will still work using pre-computed example data. For custom problems, consider using a Linux environment or Docker.

### "Planner timed out"

Large problems with optimal strategies (A* + LM-cut) can take a very long time. Try:
1.  Selecting a **satisficing strategy** like "Lazy Greedy + FF".
2.  Reducing the problem size.
3.  Increasing the `PLANNER_TIMEOUT` environment variable.

---

## Technology Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 19, TypeScript 5.7, Tailwind CSS 4, Vite 6, tRPC 11, Radix UI |
| **Backend API** | Node.js, Express 4, tRPC 11, TypeScript 5.9, Zod 4 |
| **Planning Engine** | Python 3.11+, Fast Downward |

---

## Acknowledgments

- [Fast Downward](https://www.fast-downward.org/) – The classical planning system powering this application.
- [PDDL](https://planning.wiki/) – The Planning Domain Definition Language.
- The React, TypeScript, and Python open-source communities.
