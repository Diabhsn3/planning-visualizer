# Planning Visualizer

An interactive web application for visualizing classical planning problems and solutions with domain-specific renderers and real-time animations.

![Planning Visualizer](https://img.shields.io/badge/React-19-blue) ![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue) ![Python](https://img.shields.io/badge/Python-3.11+-green)

**Supported Domains:** Blocks World • Gripper

---

## ✨ Features

- 🎨 **Interactive Visualization** - Canvas-based rendering with domain-specific visualizations
- 🔍 **Zoom & Pan Controls** - Mouse wheel zoom and click-drag panning for detailed inspection
- 📝 **Custom Problems** - Upload PDDL files or paste problem definitions directly
- ⚡ **Real-time Controls** - Play, pause, adjust speed, and navigate through plan steps
- 🎯 **Domain-Specific Rendering** - Tailored visualizations for Blocks World and Gripper domains
- 🔄 **Automatic File Cleanup** - Temporary uploaded files are automatically deleted after processing
- 🚀 **Modern Stack** - React 19, TypeScript, Tailwind CSS 4, tRPC, Node.js, Python

---

## 🚀 Quick Start

### Prerequisites

| Requirement | Version | Installation |
|------------|---------|--------------|
| **Python** | 3.11+ | [python.org](https://www.python.org/downloads/) |
| **Node.js** | 18+ | [nodejs.org](https://nodejs.org/) |
| **pnpm** | Latest | `npm install -g pnpm` |
| **Git** | Latest | [git-scm.com](https://git-scm.com/) |

**Optional:**
- **C++ Compiler** - For building Fast Downward (GCC on Linux, Xcode on Mac, Visual Studio Build Tools on Windows)

### Installation

```bash
# Clone repository
git clone https://github.com/Diabhsn3/planning-visualizer.git
cd planning-visualizer

# Initialize Fast Downward submodule (optional)
git submodule update --init --recursive

# Install backend dependencies
cd backend/api
pnpm install

# Install frontend dependencies
cd ../../frontend
pnpm install
```

### Running the Application

**Terminal 1 - Backend API:**
```bash
cd backend/api
pnpm dev
```
Backend runs on **http://localhost:4000**

**Terminal 2 - Frontend:**
```bash
cd frontend
pnpm dev
```
Frontend runs on **http://localhost:3000**

**Access the application:** http://localhost:3000

> **Note:** The application works without Fast Downward using pre-computed example data. Custom problem solving requires Fast Downward installation.

---

## 📁 Project Structure

```
planning-visualizer/
│
├── frontend/                      # React Frontend (Port 3000)
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Visualizer.tsx    # Main visualizer interface
│   │   │   └── NotFound.tsx      # 404 page
│   │   ├── components/
│   │   │   ├── StateCanvas.tsx   # Canvas renderer with zoom/pan
│   │   │   ├── ErrorBoundary.tsx # Error boundary component
│   │   │   └── ui/               # Radix UI components
│   │   ├── hooks/                # Custom React hooks
│   │   │   ├── useComposition.ts # Input composition handling
│   │   │   ├── useMobile.tsx     # Mobile detection
│   │   │   └── usePersistFn.ts   # Function persistence
│   │   ├── lib/
│   │   │   ├── trpc.ts           # tRPC client setup
│   │   │   └── utils.ts          # Utility functions
│   │   ├── contexts/
│   │   │   └── ThemeContext.tsx  # Theme provider
│   │   └── main.tsx              # Application entry point
│   ├── public/
│   │   └── rooboot.png           # Robot image for gripper domain
│   ├── vite.config.ts            # Vite configuration
│   └── package.json
│
├── backend/
│   ├── api/                      # Node.js/Express API (Port 4000)
│   │   ├── _core/                # Core server infrastructure
│   │   │   ├── index.ts          # Server entry point
│   │   │   ├── trpc.ts           # tRPC setup
│   │   │   ├── context.ts        # Request context
│   │   │   ├── systemRouter.ts   # System health endpoints
│   │   │   └── types/            # Shared types
│   │   ├── data/                 # Pre-computed example data
│   │   │   ├── blocks_world_rendered.json
│   │   │   └── gripper_rendered.json
│   │   ├── uploads/              # Temporary PDDL file uploads (auto-cleaned)
│   │   ├── visualizer.ts         # Main API endpoints
│   │   ├── routers.ts            # tRPC route definitions
│   │   └── package.json
│   │
│   └── planner/                  # Python Planning Engine
│       ├── visualizer_api.py     # Main Python API entry point
│       ├── run_planner.py        # Fast Downward integration
│       ├── domains/              # PDDL domain definitions
│       │   ├── blocks_world/     # Blocks World (implemented)
│       │   │   ├── domain.pddl
│       │   │   └── p1.pddl
│       │   ├── gripper/          # Gripper (implemented)
│       │   │   ├── domain.pddl
│       │   │   └── p1.pddl
│       │   ├── depot/            # Depot (template only)
│       │   ├── hanoi/            # Hanoi (template only)
│       │   ├── logistics/        # Logistics (template only)
│       │   ├── rovers/           # Rovers (template only)
│       │   ├── satellite/        # Satellite (template only)
│       │   └── README.md         # Domain implementation guide
│       ├── state_generator/      # State generation from plans
│       │   ├── __init__.py
│       │   ├── pddl_parser.py    # PDDL parsing utilities
│       │   └── state_generator.py
│       ├── state_renderer/       # Domain-specific renderers
│       │   ├── __init__.py
│       │   ├── base_renderer.py  # Base renderer class
│       │   ├── blocks_world_renderer.py  # Blocks World renderer
│       │   ├── gripper_renderer.py       # Gripper renderer
│       │   ├── depot_renderer.py         # Depot template
│       │   ├── hanoi_renderer.py         # Hanoi template
│       │   ├── logistics_renderer.py     # Logistics template
│       │   ├── rovers_renderer.py        # Rovers template
│       │   └── satellite_renderer.py     # Satellite template
│       ├── planner_runner/       # Planner execution
│       │   ├── __init__.py
│       │   └── runner.py
│       ├── output/               # Generated state files
│       ├── tests/                # Python test files
│       └── README.md             # Planner module documentation
│
├── planning-tools/               # Fast Downward Planner (Git Submodule)
│   └── downward/
│
└── README.md                     # This file
```

---

## 🎮 Usage

### 1. Select a Domain
Choose from available planning domains:
- **Blocks World** - Classic block stacking problem with pick-up, put-down, stack, and unstack actions
- **Gripper** - Robot with grippers moving balls between rooms (supports up to 8 balls and 4 rooms)

### 2. Provide a Problem (Optional)
Two options for custom problems:
- **Use custom problem** checkbox unchecked - Uses default example problem
- **Use custom problem** checkbox checked:
  - **Upload File** - Upload a `.pddl` problem file
  - **Paste Text** - Paste PDDL problem definition directly

### 3. Generate Visualization
Click **"Generate States"** to:
- Parse the PDDL problem
- Run the planner (Fast Downward if available, fallback otherwise)
- Generate intermediate states
- Render domain-specific visualization

### 4. Control Visualization
- 🔍 **Zoom** - Mouse wheel to zoom in/out (10% to 500%)
- 🖱️ **Pan** - Click and drag to navigate the canvas
- ➕➖ **Zoom Buttons** - Click +/− buttons in top-right corner
- 🔄 **Reset** - Click reset button to return to default view
- ▶️ **Play/Pause** - Control animation playback
- ⏮️⏭️ **Previous/Next** - Step through states manually
- 🎚️ **Speed Control** - Adjust animation speed (slider below visualization)
- 📍 **Timeline** - Jump to any state directly using the slider

---

## 🔧 API Endpoints

### `visualizer.generateStates`
Loads pre-computed example data for a domain.

**Input:**
```typescript
{
  domain: "blocks-world" | "gripper"
}
```

**Output:**
```typescript
{
  success: boolean;
  domain: string;
  problem: string;
  plan: string[];
  num_states: number;
  states: RenderedState[];
}
```

### `visualizer.uploadAndGenerate`
Processes custom PDDL problems.

**Input:**
```typescript
{
  domainContent: string;      // Empty string to use repository domain
  problemContent: string;     // PDDL problem definition
  domainName: "blocks-world" | "gripper";
}
```

**Output:**
```typescript
{
  success: boolean;
  domain: string;
  problem: string;
  plan: string[];
  num_states: number;
  states: RenderedState[];
  used_planner: boolean;
  planner_info: string;
}
```

### `visualizer.listDomains`
Returns list of available domains.

### `visualizer.checkStatus`
Checks Python and Fast Downward availability.

---

## 🧪 Testing

### Python Modules

```bash
cd backend/planner

# Test state generator
python tests/test_state_generator.py

# Test state renderer
python tests/test_state_renderer.py
```

---

## 💻 Technology Stack

### Frontend
- **React 19** - UI framework
- **TypeScript 5.7** - Type safety
- **Tailwind CSS 4** - Utility-first styling
- **tRPC 11** - Type-safe API client
- **Vite 6** - Build tool and dev server
- **Radix UI** - Accessible component primitives
- **Lucide React** - Icon library
- **Wouter** - Lightweight routing

### Backend API
- **Node.js** - Runtime environment
- **Express 4** - Web framework
- **tRPC 11** - Type-safe API server
- **TypeScript 5.9** - Type safety
- **Zod 4** - Schema validation
- **SuperJSON** - JSON serialization with type preservation

### Planning Engine
- **Python 3.11+** - Core language (no external dependencies)
- **Fast Downward** - Classical planner (optional)
- **Custom PDDL Parsers** - Problem and state parsing
- **Domain Renderers** - Visualization logic

---

## 🔧 Implementation Details

### Zoom & Pan System
The `StateCanvas` component implements interactive zoom and pan:
- **Zoom Range:** 10% to 500%
- **Zoom Method:** Mouse wheel (centered on cursor position)
- **Pan Method:** Click and drag
- **Controls:** Floating UI with +/− buttons and reset
- **Implementation:** Canvas 2D context transformations

### Automatic File Cleanup
Uploaded PDDL files are automatically deleted after processing:
- Problem files deleted after successful or failed processing
- Custom domain files deleted (repository domains preserved)
- Cleanup happens in `visualizer.ts` `uploadAndGenerate` endpoint
- Prevents disk space accumulation in `backend/api/uploads/`

### Renderer Architecture
Each domain has a dedicated renderer extending `BaseRenderer`:
- **`parse_state()`** - Extracts objects and predicates from PDDL state
- **`render_state()`** - Converts parsed state to `RenderedState` format
- **Color Schemes** - Pre-defined colors for visual consistency
- **Extensibility** - Templates provided for 5 additional domains

### State Generation
The `StateGenerator` class:
- Parses initial state from PDDL problem
- Applies action sequences to generate intermediate states
- Tracks object positions and relationships
- Outputs structured state data for renderers

---

## 🤝 Contributing

### Adding a New Domain

See `backend/planner/domains/README.md` for detailed instructions. Summary:

1. **Create PDDL files** in `backend/planner/domains/new_domain/`
   - `domain.pddl` - Domain definition
   - `p1.pddl` - Example problem

2. **Implement renderer** in `backend/planner/state_renderer/new_domain_renderer.py`
   - Extend `BaseRenderer`
   - Implement `parse_state()` and `render_state()`

3. **Register renderer** in `backend/planner/state_renderer/__init__.py`
   - Import renderer class
   - Add to `RendererFactory._renderers` dictionary

4. **Update API** in `backend/api/visualizer.ts`
   - Add domain to `DOMAIN_CONFIGS`
   - Add to enum in `generateStates` and `uploadAndGenerate` input schemas

5. **Test** with example problem

Templates for Depot, Hanoi, Logistics, Rovers, and Satellite domains are already provided.

---

## 🐛 Troubleshooting

### Port Already in Use

**Mac/Linux:**
```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill

# Kill process on port 4000
lsof -ti:4000 | xargs kill
```

**Windows:**
```cmd
# Find process using port
netstat -ano | findstr :3000

# Kill the process (replace <PID> with actual process ID)
taskkill /PID <PID> /F
```

### Python Not Found

Create `.env` file in `backend/api/`:
```bash
cd backend/api
echo "PYTHON_CMD=python3" > .env
```

Replace `python3` with your Python command (`python`, `python3.11`, etc.).

### Frontend Can't Connect to Backend

1. Verify backend is running: http://localhost:4000
2. Check `frontend/vite.config.ts` proxy configuration (should point to `http://localhost:4000`)
3. Ensure no firewall is blocking local connections

### Fast Downward Not Available

The application works without Fast Downward:
- Pre-computed example data is used for default problems
- Custom problems will use fallback plans if Fast Downward is not installed
- To install Fast Downward:
  ```bash
  git submodule update --init --recursive
  cd planning-tools/downward
  ./build.py release
  ```

---

## 📄 License

MIT License

---

## 🙏 Acknowledgments

- [Fast Downward](https://www.fast-downward.org/) - Classical planning system
- [PDDL](https://planning.wiki/) - Planning Domain Definition Language
- React, TypeScript, and Python communities

---

## 📞 Support

- **Issues:** [GitHub Issues](https://github.com/Diabhsn3/planning-visualizer/issues)
- **Discussions:** [GitHub Discussions](https://github.com/Diabhsn3/planning-visualizer/discussions)

---

<div align="center">

**Built for the planning community**

[⭐ Star this repo](https://github.com/Diabhsn3/planning-visualizer) • [🐛 Report Bug](https://github.com/Diabhsn3/planning-visualizer/issues) • [✨ Request Feature](https://github.com/Diabhsn3/planning-visualizer/issues)

</div>
