# Development Guide

This guide explains how to run the Planning Visualizer locally for development and how to deploy changes to the production server.

## Prerequisites

### Required Software
- **Node.js** 18+ (recommended: 20+)
- **pnpm** (package manager)
- **Python** 3.11+
- **Git**

### Optional (for full planner functionality)
- **Fast Downward** planner (built from source)
- C++ compiler (for building Fast Downward)

## Quick Start (Local Development)

### 1. Clone the Repository
```bash
git clone https://github.com/Diabhsn3/planning-visualizer.git
cd planning-visualizer
```

### 2. Run the Setup Script
```bash
# macOS/Linux
./run_new.sh

# Windows
run_new.bat
```

This script will:
- Check Python and Node.js installations
- Install dependencies
- Build Fast Downward (if possible)
- Start both frontend and backend servers

### 3. Access the Application
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:4000

## Manual Setup (Alternative)

If the quick start script doesn't work, follow these steps:

### Install Dependencies
```bash
# Install backend dependencies
cd backend/api
pnpm install

# Install frontend dependencies
cd ../../frontend
pnpm install
```

### Initialize Fast Downward (Optional)
```bash
cd planning-tools
git submodule update --init --recursive
cd downward
./build.py
```

> **Note**: On macOS with Xcode 15+, Fast Downward may fail to build. The app will work in "fallback mode" with pre-computed plans.

### Start Development Servers

**Terminal 1 - Backend:**
```bash
cd backend/api
pnpm dev
```

**Terminal 2 - Frontend:**
```bash
cd frontend
pnpm dev
```

## Project Structure

```
planning-visualizer/
├── backend/
│   ├── api/              # Express.js API server
│   │   ├── _core/        # API routes and handlers
│   │   └── dist/         # Built output
│   └── planner/          # Python planner modules
│       ├── domains/      # PDDL domain files
│       ├── state_generator/
│       ├── state_renderer/
│       └── visualizer_api.py
├── frontend/
│   ├── src/
│   │   ├── components/   # React components
│   │   ├── pages/        # Page components
│   │   └── lib/          # Utilities
│   └── dist/             # Built output
└── planning-tools/
    └── downward/         # Fast Downward planner (submodule)
```

## Development Workflow

### Making Changes

1. **Create a feature branch:**
   ```bash
   git checkout -b feature/my-feature
   ```

2. **Make your changes** and test locally

3. **Commit your changes:**
   ```bash
   git add .
   git commit -m "feat: description of changes"
   ```

4. **Push to GitHub:**
   ```bash
   git push origin feature/my-feature
   ```

5. **Merge to main** (after testing):
   ```bash
   git checkout main
   git merge feature/my-feature
   git push origin main
   ```

### Testing Changes Locally

- Frontend changes: Hot-reload automatically at http://localhost:3000
- Backend API changes: Auto-restart with `tsx watch`
- Python changes: Restart backend server to apply

## Deploying to Production Server

### Server Details
- **Host**: `user@132.73.84.70`
- **Project Path**: `/home/user/planning-visualizer`

### Deployment Steps

```bash
# 1. SSH into the server
ssh user@132.73.84.70

# 2. Navigate to project
cd /home/user/planning-visualizer

# 3. Pull latest changes
git pull origin main

# 4. Rebuild backend
cd backend/api
pnpm run build

# 5. Rebuild frontend
cd ../../frontend
pnpm run build

# 6. Restart backend service
pm2 restart planning-visualizer-backend
```

### Quick Deploy Script
You can create a deploy script on the server:

```bash
#!/bin/bash
# deploy.sh
cd /home/user/planning-visualizer
git pull origin main
cd backend/api && pnpm run build
cd ../../frontend && pnpm run build
pm2 restart planning-visualizer-backend
echo "Deployment complete!"
```

## Environment Variables

### Backend (`backend/api/.env`)
```env
PYTHON_CMD=python3
NODE_ENV=development
PORT=4000
```

### Frontend (`.env` or `.env.local`)
```env
VITE_API_URL=http://localhost:4000
```

## Troubleshooting

### Fast Downward Build Fails on macOS
This is a known issue with Xcode 15+. The app will work in fallback mode with pre-computed plans.

### Port Already in Use
```bash
# Find and kill process on port 3000
lsof -i :3000
kill -9 <PID>

# Or use different ports
PORT=3001 pnpm dev  # backend
```

### Python Module Not Found
Ensure you're running from the correct directory:
```bash
cd backend/planner
python3 visualizer_api.py ...
```

## Adding New Domains

1. Create domain folder: `backend/planner/domains/your-domain/`
2. Add `domain.pddl` and `p1.pddl` files
3. Create renderer: `backend/planner/state_renderer/your_domain_renderer.py`
4. Register in `RendererFactory`
5. Add frontend renderer: `frontend/src/components/renderYourDomain.ts`
6. Update `StateCanvas.tsx` to handle the new domain

## Useful Commands

```bash
# Check TypeScript errors
cd frontend && pnpm tsc --noEmit

# Format code
pnpm format

# Run tests
pnpm test

# Build for production
pnpm build
```
