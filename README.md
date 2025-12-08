# Planning Visualizer

Visualize classical planning algorithms with domain-specific renderers.

**Supported domains**: Blocks World, Gripper

---

## 🚀 Quick Start

### Mac/Linux
```bash
git clone https://github.com/Diabhsn3/planning-visualizer.git
cd planning-visualizer
git checkout front_back
./run_new.sh
```

### Windows
```cmd
git clone https://github.com/Diabhsn3/planning-visualizer.git
cd planning-visualizer
git checkout front_back
run_new.bat
```

The script will:
1. Check dependencies (Python 3.11+, Node.js 18+, pnpm)
2. Install all required packages
3. Build Fast Downward planner (optional)
4. Start both frontend and backend servers

**Access the application at:** `http://localhost:3000`

**Note**: If Fast Downward build fails (common on macOS), the app runs in **fallback mode** with pre-defined example problems.

---

## 📁 Project Structure

```
planning-visualizer/
├── frontend/                    # React + Vite + Tailwind CSS
│   ├── src/                    # React components and pages
│   └── package.json
│
├── backend/
│   ├── api/                    # Node.js/Express API (port 4000)
│   │   ├── visualizer.ts       # Main API endpoints
│   │   └── package.json
│   │
│   └── planner/                # Python planning modules
│       ├── domains/            # PDDL domain files
│       ├── state_generator/    # State generation
│       ├── state_renderer/     # Visualization rendering
│       └── visualizer_api.py   # Python API
│
├── planning-tools/              # Fast Downward planner (submodule)
├── run_new.sh                   # Quick start (Mac/Linux)
└── run_new.bat                  # Quick start (Windows)
```

---

## 🛠 Manual Setup

### Prerequisites
- **Python 3.11+**
- **Node.js 18+**
- **pnpm** (install with `npm install -g pnpm`)

### Installation Steps

**1. Clone and setup:**
```bash
git clone https://github.com/Diabhsn3/planning-visualizer.git
cd planning-visualizer
git checkout front_back
git submodule update --init --recursive  # For Fast Downward (optional)
```

**2. Install dependencies:**
```bash
# Backend
cd backend/api
pnpm install

# Frontend
cd ../../frontend
pnpm install
```

**3. Start servers:**

Terminal 1 (Backend):
```bash
cd backend/api
pnpm dev
```

Terminal 2 (Frontend):
```bash
cd frontend
pnpm dev
```

**4. Open browser:** `http://localhost:3000`

---

## 🎯 Features

- ✅ Visualize planning problems with interactive animations
- ✅ Upload custom PDDL problems or paste text
- ✅ Step-by-step animation controls (play, pause, speed)
- ✅ Domain-specific renderers (Blocks World, Gripper)
- ✅ Works without Fast Downward (fallback mode)

---

## 🔧 Troubleshooting

### Fast Downward Build Fails

**Common Issue**: Directory path contains spaces

Fast Downward cannot be built in paths with spaces (e.g., "final project", "My Documents").

**Solution**: Move the project to a path without spaces:
```bash
mv "~/Documents/final project/planning-visualizer" ~/planning-visualizer
cd ~/planning-visualizer
```

The run scripts will automatically detect and warn you about this.

### Port Already in Use

If ports 3000 or 4000 are busy:

**Mac/Linux:**
```bash
lsof -ti:3000 | xargs kill
lsof -ti:4000 | xargs kill
```

**Windows:**
```cmd
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

### Backend Can't Find Python

Set the Python command in `backend/api/.env`:
```
PYTHON_CMD=python3.12
```

---

## 🧪 Testing

Test Python modules:
```bash
cd backend/planner
python test_blocksworld.py
python test_gripper.py
```

---

## 💻 Technology Stack

**Frontend**: React 19, TypeScript, Tailwind CSS 4, tRPC, Vite

**Backend API**: Node.js, Express, tRPC, TypeScript

**Planner**: Python 3.11+, Fast Downward, Custom PDDL parsers

---

## 📄 License

MIT

---

**Questions?** Open an issue on GitHub.
