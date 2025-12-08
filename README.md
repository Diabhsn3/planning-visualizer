# Planning Visualizer

An interactive web application for visualizing classical planning problems and solutions with domain-specific renderers and real-time animations.

![Planning Visualizer](https://img.shields.io/badge/React-19-blue) ![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue) ![Python](https://img.shields.io/badge/Python-3.11+-green)

**Supported Domains:** Blocks World • Gripper

---

## ✨ Features

- 🎨 **Interactive Visualization** - Watch planning solutions unfold with smooth animations
- 📝 **Custom Problems** - Upload PDDL files or paste problem definitions directly
- ⚡ **Real-time Controls** - Play, pause, adjust speed, and navigate through plan steps
- 🎯 **Domain-Specific Rendering** - Tailored visualizations for each planning domain
- 🔄 **Fallback Mode** - Works without Fast Downward using pre-computed examples
- 🚀 **Modern Stack** - React 19, TypeScript, Tailwind CSS, Node.js, Python

---

## 🚀 Quick Start

### One-Command Setup

#### Mac / Linux
```bash
git clone https://github.com/Diabhsn3/planning-visualizer.git
cd planning-visualizer
git checkout front_back
./run_new.sh
```

#### Windows
```cmd
git clone https://github.com/Diabhsn3/planning-visualizer.git
cd planning-visualizer
git checkout front_back
run_new.bat
```

The script automatically:
1. ✅ Checks for Python 3.11+, Node.js 18+, and pnpm
2. ✅ Installs all dependencies (frontend + backend)
3. ✅ Builds Fast Downward planner (optional)
4. ✅ Starts both servers

**🌐 Access the app at:** http://localhost:3000

> **Note:** If Fast Downward build fails (common on macOS with Xcode 15+), the app runs in **fallback mode** with pre-defined example problems. Full functionality is maintained.

---

## 📋 Prerequisites

Before running the application, ensure you have:

| Requirement | Version | Installation |
|------------|---------|--------------|
| **Python** | 3.11+ | [python.org](https://www.python.org/downloads/) |
| **Node.js** | 18+ | [nodejs.org](https://nodejs.org/) |
| **pnpm** | Latest | `npm install -g pnpm` |
| **Git** | Latest | [git-scm.com](https://git-scm.com/) |

**Optional:**
- **C++ Compiler** - For building Fast Downward (GCC on Linux, Xcode on Mac, Visual Studio Build Tools on Windows)

---

## 🛠️ Manual Setup

If you prefer to run each step manually:

### 1. Clone Repository
```bash
git clone https://github.com/Diabhsn3/planning-visualizer.git
cd planning-visualizer
git checkout front_back
```

### 2. Initialize Fast Downward (Optional)
```bash
git submodule update --init --recursive
```

### 3. Install Dependencies

**Backend:**
```bash
cd backend/api
pnpm install
```

**Frontend:**
```bash
cd ../../frontend
pnpm install
```

### 4. Start Servers

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

### 5. Open Application
Navigate to **http://localhost:3000** in your browser.

---

## 📁 Project Structure

```
planning-visualizer/
│
├── frontend/                      # React Frontend (Port 3000)
│   ├── src/
│   │   ├── pages/                # Page components
│   │   │   └── Visualizer.tsx    # Main visualizer interface
│   │   ├── components/           # Reusable UI components
│   │   ├── lib/                  # tRPC client & utilities
│   │   └── main.tsx              # Application entry point
│   ├── public/                   # Static assets
│   ├── vite.config.ts            # Vite configuration
│   └── package.json
│
├── backend/
│   ├── api/                      # Node.js/Express API (Port 4000)
│   │   ├── _core/                # Core server setup
│   │   ├── visualizer.ts         # Main API endpoints
│   │   ├── routers.ts            # tRPC route definitions
│   │   └── package.json
│   │
│   └── planner/                  # Python Planning Engine
│       ├── visualizer_api.py     # Main Python API
│       ├── run_planner.py        # Fast Downward integration
│       ├── domains/              # PDDL domain definitions
│       │   ├── blocks_world/     # Blocks World domain
│       │   └── gripper/          # Gripper domain
│       ├── state_generator/      # State generation logic
│       └── state_renderer/       # Domain-specific renderers
│
├── planning-tools/               # Fast Downward Planner (Submodule)
│   └── downward/
│
├── run_new.sh                    # Quick start script (Mac/Linux)
├── run_new.bat                   # Quick start script (Windows)
└── README.md                     # This file
```

---

## 🎮 Usage

### 1. Select a Domain
Choose from available planning domains:
- **Blocks World** - Classic block stacking problem
- **Gripper** - Robot with grippers moving balls between rooms

### 2. Provide a Problem
Two options:
- **Upload File** - Upload a `.pddl` problem file
- **Paste Text** - Paste PDDL problem definition directly

### 3. Generate Visualization
Click **"Generate States"** to:
- Run the planner (Fast Downward or fallback)
- Generate intermediate states
- Render domain-specific visualization

### 4. Control Animation
- ▶️ **Play/Pause** - Control animation playback
- ⏮️ **Previous/Next** - Step through states manually
- 🎚️ **Speed Control** - Adjust animation speed
- 📍 **Timeline** - Jump to any state directly

---

## 🔧 Troubleshooting

### ⚠️ Fast Downward Build Fails

**Most Common Issue:** Directory path contains spaces

Fast Downward C++ build fails if the project path contains spaces (e.g., `"final project"`, `"My Documents"`).

**Solution:**
```bash
# Move to a path without spaces
mv "~/Documents/final project/planning-visualizer" ~/planning-visualizer
cd ~/planning-visualizer
./run_new.sh
```

The run scripts automatically detect this issue and warn you.

---

### ⚠️ Port Already in Use

If ports 3000 or 4000 are occupied:

**Mac/Linux:**
```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill

# Kill process on port 4000
lsof -ti:4000 | xargs kill
```

**Windows:**
```cmd
# Find process using port 3000
netstat -ano | findstr :3000

# Kill the process (replace <PID> with actual process ID)
taskkill /PID <PID> /F
```

---

### ⚠️ Python Not Found

If the backend can't find Python, create a `.env` file:

```bash
cd backend/api
echo "PYTHON_CMD=python3.12" > .env
```

Replace `python3.12` with your Python command (`python3`, `python`, etc.).

---

### ⚠️ Frontend Can't Connect to Backend

1. Verify backend is running: http://localhost:4000
2. Check frontend proxy in `frontend/vite.config.ts`
3. Ensure no firewall is blocking local connections

---

### ⚠️ Windows-Specific Issues

**Fast Downward requires Visual Studio Build Tools:**

1. Download: https://visualstudio.microsoft.com/downloads/
2. Install "Desktop development with C++"
3. Restart your terminal
4. Run `run_new.bat` again

**Alternatively:** Use fallback mode (works without Fast Downward)

---

## 🧪 Testing

### Test Python Modules

```bash
cd backend/planner

# Test individual domains
python test_blocksworld.py
python test_gripper.py

# Test all domains
python test_domains.py
```

### Test Backend API

```bash
cd backend/api
pnpm test
```

---

## 💻 Technology Stack

### Frontend
- **React 19** - UI framework
- **TypeScript** - Type safety
- **Tailwind CSS 4** - Styling
- **tRPC** - Type-safe API client
- **Vite** - Build tool
- **Framer Motion** - Animations

### Backend API
- **Node.js** - Runtime
- **Express** - Web framework
- **tRPC** - Type-safe API server
- **TypeScript** - Type safety

### Planning Engine
- **Python 3.11+** - Core language
- **Fast Downward** - Classical planner
- **Custom PDDL Parsers** - Problem parsing
- **Domain Renderers** - Visualization logic

---

## 🤝 Contributing

Contributions are welcome! To add a new planning domain:

1. Add PDDL files to `backend/planner/domains/new_domain/`
2. Create renderer in `backend/planner/state_renderer/new_domain_renderer.py`
3. Register renderer in `backend/planner/state_renderer/renderer_factory.py`
4. Add domain config in `backend/api/visualizer.ts`
5. Create test file `backend/planner/test_newdomain.py`

---

## 📄 License

MIT License - See [LICENSE](LICENSE) for details

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

**Built with ❤️ for the planning community**

[⭐ Star this repo](https://github.com/Diabhsn3/planning-visualizer) • [🐛 Report Bug](https://github.com/Diabhsn3/planning-visualizer/issues) • [✨ Request Feature](https://github.com/Diabhsn3/planning-visualizer/issues)

</div>
