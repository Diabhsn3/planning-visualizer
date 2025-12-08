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

The scripts will:
1. Check dependencies (Python, Node.js, pnpm)
2. Install packages for frontend and backend
3. Build Fast Downward planner (optional)
4. Start both servers
5. Open the application at `http://localhost:3000`

**Note**: If Fast Downward build fails (common on newer macOS), the app will run in **fallback mode** with pre-defined example problems.

---

## 📁 Project Structure

```
planning-visualizer/
├── frontend/                    # React frontend application
│   ├── src/                    # React components, pages, hooks
│   ├── public/                 # Static assets
│   ├── package.json
│   └── vite.config.ts
│
├── backend/                     # Backend services
│   ├── api/                    # Node.js/Express API server
│   │   ├── _core/              # Core server setup
│   │   ├── routers.ts          # tRPC API routes
│   │   ├── visualizer.ts       # Visualizer endpoints
│   │   └── package.json
│   │
│   └── planner/                # Python planning modules
│       ├── domains/            # PDDL domain files
│       ├── planner_runner/     # Fast Downward integration
│       ├── state_generator/    # State generation logic
│       ├── state_renderer/     # Visualization rendering
│       └── visualizer_api.py   # Main Python API
│
├── planning-tools/              # Fast Downward planner
│   └── downward/
│
├── run_new.sh                   # Quick start (Mac/Linux)
└── run_new.bat                  # Quick start (Windows)
```

---

## 🛠 Manual Setup

### Prerequisites
- **Python 3.11+** - For planning algorithms
- **Node.js 18+** - For backend API
- **pnpm** - Package manager
- **Git** - Version control

### Installation

**1. Clone repository:**
```bash
git clone https://github.com/Diabhsn3/planning-visualizer.git
cd planning-visualizer
git checkout front_back
```

**2. Initialize Fast Downward (optional):**
```bash
git submodule update --init --recursive
```

**3. Install backend dependencies:**
```bash
cd backend/api
pnpm install
```

**4. Install frontend dependencies:**
```bash
cd ../../frontend
pnpm install
```

**5. Start backend (Terminal 1):**
```bash
cd backend/api
pnpm dev
```

**6. Start frontend (Terminal 2):**
```bash
cd frontend
pnpm dev
```

**7. Open browser:**
```
http://localhost:3000
```

---

## 🎯 Features

### Supported Planning Domains
- **Blocks World** - Classic block stacking problem
- **Gripper** - Robot with grippers moving balls between rooms

### Capabilities
- ✅ Visualize planning problems with domain-specific renderers
- ✅ Upload custom PDDL problems
- ✅ Step-by-step animation controls
- ✅ Fallback mode (works without Fast Downward)
- ✅ Pre-computed example problems

---

## 🧪 Testing

### Test Python Modules
```bash
cd backend/planner
python test_blocksworld.py  # Test Blocks World
python test_gripper.py      # Test Gripper
python test_domains.py      # Test all domains
```

### Test Backend API
```bash
cd backend/api
pnpm test
```

---

## 📝 Development

### Adding a New Planning Domain

1. **Add PDDL files** to `backend/planner/domains/new_domain/`
2. **Create renderer** in `backend/planner/state_renderer/new_domain_renderer.py`
3. **Register renderer** in `backend/planner/state_renderer/renderer_factory.py`
4. **Add domain config** in `backend/api/visualizer.ts`
5. **Create test file** `backend/planner/test_newdomain.py`

See [backend/planner/README.md](backend/planner/README.md) for detailed instructions.

### Technology Stack

**Frontend:**
- React 19
- TypeScript
- Tailwind CSS 4
- tRPC client
- Vite

**Backend API:**
- Node.js
- Express
- tRPC server
- TypeScript
- Drizzle ORM

**Backend Planner:**
- Python 3.11+
- Fast Downward planner
- Custom PDDL parsers
- Domain-specific renderers

---

## 🔧 Troubleshooting

### Fast Downward Build Fails

**Most Common Issue**: Directory path contains spaces

Fast Downward cannot be built in directories with spaces in the path. If your path contains spaces (e.g., "final project", "My Documents"), move the project:

```bash
# Move to a path without spaces
mv "~/Documents/final project/planning-visualizer" ~/planning-visualizer
cd ~/planning-visualizer
```

The run scripts (run_new.sh / run_new.bat) will automatically detect and warn you about this issue.

### Frontend can't connect to backend
- Ensure backend is running on port 5000
- Check Vite proxy configuration in `frontend/vite.config.ts`

### Backend can't find Python modules
- Check Python path in `backend/api/visualizer.ts`
- Verify `backend/planner/visualizer_api.py` exists

### Platform-Specific Issues

**macOS:**
- C++ compilation errors are common with Xcode 15+
- App works in fallback mode without Fast Downward
- See `backend/api/SETUP_MAC.md` for troubleshooting

**Windows:**
- Requires Visual Studio Build Tools with C++ support
- Download from: https://visualstudio.microsoft.com/downloads/
- See `backend/api/SETUP_WINDOWS.md` for detailed instructions

---

## 📚 Documentation

- [README_NEW_STRUCTURE.md](README_NEW_STRUCTURE.md) - Complete guide to project structure
- [frontend/README.md](frontend/README.md) - Frontend development guide
- [backend/planner/README.md](backend/planner/README.md) - Python modules guide
- [backend/planner/TESTING.md](backend/planner/TESTING.md) - Testing guide
- [backend/api/SETUP_MAC.md](backend/api/SETUP_MAC.md) - macOS setup guide
- [backend/api/SETUP_WINDOWS.md](backend/api/SETUP_WINDOWS.md) - Windows setup guide

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

MIT

---

## 🙏 Acknowledgments

- Fast Downward planning system
- PDDL benchmark problems
- React and TypeScript communities

---

**Questions or issues?** Create an issue on GitHub or check the documentation in the `backend/` and `frontend/` directories.
