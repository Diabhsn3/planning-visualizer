# Planning Visualizer - New Project Structure

This document explains the reorganized project structure that separates frontend and backend concerns.

## 📁 New Directory Structure

```
planning-visualizer/
├── frontend/                    # React frontend application
│   ├── src/                    # React components, pages, hooks
│   ├── public/                 # Static assets
│   ├── package.json            # Frontend dependencies
│   ├── vite.config.ts          # Vite configuration
│   └── tsconfig.json           # TypeScript configuration
│
├── backend/                     # Backend services
│   ├── api/                    # Node.js/Express API server
│   │   ├── _core/              # Core server setup
│   │   ├── routers.ts          # tRPC API routes
│   │   ├── visualizer.ts       # Visualizer API endpoints
│   │   ├── db.ts               # Database queries
│   │   ├── drizzle/            # Database schema & migrations
│   │   ├── package.json        # Backend dependencies
│   │   └── tsconfig.json       # TypeScript configuration
│   │
│   └── planner/                # Python planning modules
│       ├── domains/            # PDDL domain files
│       │   ├── blocks_world/
│       │   └── gripper/
│       ├── planner_runner/     # Fast Downward integration
│       ├── state_generator/    # State generation logic
│       ├── state_renderer/     # Visualization rendering
│       ├── visualizer_api.py   # Main Python API
│       ├── run_planner.py      # Planner execution
│       ├── test_blocksworld.py # Test files
│       ├── test_gripper.py
│       └── test_domains.py
│
├── planning-tools/              # Fast Downward planner
│   └── downward/
│
├── run.sh                       # Quick start script (Mac/Linux)
├── run.bat                      # Quick start script (Windows)
└── README.md                    # Main documentation

```

## 🎯 Benefits of New Structure

### Clear Separation of Concerns
- **Frontend** (`frontend/`): All React code, UI components, and client-side logic
- **Backend API** (`backend/api/`): Node.js/Express server, tRPC routes, database
- **Backend Planner** (`backend/planner/`): Python planning algorithms and domain logic

### Easier Development
- Work on frontend without touching backend
- Modify Python planning logic independently
- Clear boundaries between different technologies

### Better Scalability
- Each part can be deployed separately if needed
- Frontend can be served from CDN
- Backend API and Python planner can scale independently

### Improved Testing
- Test frontend components in isolation
- Test API endpoints separately
- Test Python modules with dedicated test files

## 🚀 Quick Start

### Option 1: Use Run Scripts (Recommended)

**Mac/Linux:**
```bash
./run.sh
```

**Windows:**
```cmd
run.bat
```

The run scripts will:
1. Check dependencies
2. Install packages for both frontend and backend
3. Start both servers
4. Open the application at `http://localhost:3000`

### Option 2: Manual Start

**Terminal 1 - Backend API:**
```bash
cd backend/api
pnpm install
pnpm dev
```

**Terminal 2 - Frontend:**
```bash
cd frontend
pnpm install
pnpm dev
```

**Test Python Modules:**
```bash
cd backend/planner
python test_domains.py
```

## 📡 How It Works

### Request Flow

1. **User interacts with frontend** (`http://localhost:3000`)
   - React app running on Vite dev server
   - UI components in `frontend/src/`

2. **Frontend calls backend API** (`http://localhost:5000/api`)
   - tRPC client makes type-safe API calls
   - Requests proxied through Vite to backend

3. **Backend API processes request** (`backend/api/`)
   - Express server receives request
   - tRPC router handles endpoint logic
   - Calls Python planner if needed

4. **Python planner executes** (`backend/planner/`)
   - Node.js spawns Python process
   - Python runs Fast Downward planner
   - Generates states and renders visualization
   - Returns JSON to Node.js

5. **Response flows back to frontend**
   - Backend API returns data to frontend
   - React components update with results
   - User sees visualization

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

## 🔧 Development Workflow

### Adding a New Frontend Feature

1. Create component in `frontend/src/components/`
2. Add page in `frontend/src/pages/`
3. Update routes in `frontend/src/App.tsx`
4. Call backend API using tRPC hooks

### Adding a New Backend API Endpoint

1. Add procedure to `backend/api/routers.ts`
2. Define input/output schemas with Zod
3. Implement logic (call Python if needed)
4. Frontend automatically gets type-safe access

### Adding a New Planning Domain

1. Add PDDL files to `backend/planner/domains/new_domain/`
2. Create renderer in `backend/planner/state_renderer/`
3. Add domain config to `backend/api/visualizer.ts`
4. Add test file `backend/planner/test_newdomain.py`

## 📝 Migration from Old Structure

### Old Structure
```
web-app/
├── client/          → Now: frontend/
├── server/          → Now: backend/api/
└── python_modules/  → Now: backend/planner/
```

### What Changed

**File Paths:**
- `web-app/client/` → `frontend/`
- `web-app/server/` → `backend/api/`
- `web-app/python_modules/` → `backend/planner/`

**Import Paths in Python:**
- No changes needed - all relative imports still work

**Import Paths in TypeScript:**
- Updated in `backend/api/visualizer.ts`
- Python script path: `../planner/visualizer_api.py`
- Domain files: `../planner/domains/*/domain.pddl`

**Run Commands:**
- Backend: `cd backend/api && pnpm dev`
- Frontend: `cd frontend && pnpm dev`
- Tests: `cd backend/planner && python test_domains.py`

## 🧪 Testing

### Frontend Tests
```bash
cd frontend
pnpm test
```

### Backend API Tests
```bash
cd backend/api
pnpm test
```

### Python Module Tests
```bash
cd backend/planner
python test_blocksworld.py  # Test Blocks World
python test_gripper.py      # Test Gripper
python test_domains.py      # Test all domains
```

## 📦 Deployment

### Frontend
- Build: `cd frontend && pnpm build`
- Output: `frontend/dist/`
- Serve with any static file server or CDN

### Backend API
- Build: `cd backend/api && pnpm build`
- Output: `backend/api/dist/`
- Run: `node dist/index.js`

### Backend Planner
- No build needed - Python runs directly
- Ensure Fast Downward is built: `cd planning-tools/downward && ./build.py`

## 🔍 Troubleshooting

### Frontend can't connect to backend
- Check backend is running on port 5000
- Check Vite proxy configuration in `frontend/vite.config.ts`

### Backend can't find Python modules
- Check Python path in `backend/api/visualizer.ts`
- Verify `backend/planner/visualizer_api.py` exists

### Python tests fail
- Check you're in `backend/planner/` directory
- Verify domain files exist in `domains/` subdirectories

## 📚 Additional Resources

- Frontend README: `frontend/README.md`
- Backend API README: `backend/api/README.md`
- Python Testing Guide: `backend/planner/TESTING.md`
- Original README: `README.md`

---

**Questions or issues?** Check the original README.md or create an issue on GitHub.
