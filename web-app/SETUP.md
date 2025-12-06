# Web Application Setup Guide

Complete step-by-step instructions to run the Planning Visualizer web application locally.

---

## Prerequisites

Before starting, ensure you have:

- **Node.js 22+** - [Download](https://nodejs.org/)
- **pnpm** - Package manager
- **Python 3.11+** - For backend integration
- **Git** - For cloning the repository

---

## Step 1: Clone the Repository

```bash
# Clone the repository
git clone https://github.com/Diabhsn3/planning-visualizer.git

# Navigate to the web-app directory
cd planning-visualizer/web-app
```

---

## Step 2: Install pnpm (if not already installed)

```bash
# Install pnpm globally
npm install -g pnpm

# Verify installation
pnpm --version
```

---

## Step 3: Install Dependencies

```bash
# Install all Node.js dependencies
pnpm install
```

This will install:
- React 19 + TypeScript
- tRPC for API
- Tailwind CSS for styling
- All UI components and utilities

**Expected output**: Dependencies installed successfully (may take 1-2 minutes)

---

## Step 4: Set Up Environment Variables

The web app requires some environment variables. For local development, you can use minimal configuration:

```bash
# Create .env file in web-app directory
cat > .env << 'EOF'
# Database (optional for basic visualization)
DATABASE_URL=

# JWT Secret (required for auth features)
JWT_SECRET=your-secret-key-here

# OAuth (optional for local dev)
OAUTH_SERVER_URL=
VITE_OAUTH_PORTAL_URL=

# App Configuration
VITE_APP_TITLE=Planning Visualizer
VITE_APP_LOGO=
EOF
```

**Note**: For basic visualization features (without user authentication), you only need `JWT_SECRET`. The database and OAuth are optional.

---

## Step 5: Start the Development Server

```bash
# Start the dev server
pnpm dev
```

**Expected output**:
```
> planning-visualizer-web@1.0.0 dev
> NODE_ENV=development tsx watch server/_core/index.ts

[HH:MM:SS] Server running on http://localhost:3000/
```

---

## Step 6: Access the Application

Open your browser and navigate to:

```
http://localhost:3000
```

You should see the Planning Visualizer interface with:
- Domain selection dropdown
- Generate States button
- Option to upload custom problem files

---

## Step 7: Test the Visualizer

### Option A: Use Pre-built Examples

1. Select **"Blocks World"** from the domain dropdown
2. Click **"Generate States"**
3. Watch the visualization appear with timeline controls
4. Use play/pause buttons to animate through states

### Option B: Upload Custom Problem

1. Select a domain (e.g., **"Blocks World"**)
2. Check **"Upload custom problem file"**
3. Click **"Choose File"** and select a PDDL problem file
   - Example: `../domains/blocks_world/p1.pddl`
4. Click **"Solve Problem"**
5. The system will solve and visualize your problem

---

## Troubleshooting

### Issue: Port 3000 already in use

```bash
# Kill the process using port 3000
# On macOS/Linux:
lsof -ti:3000 | xargs kill -9

# On Windows:
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Or use a different port
PORT=3001 pnpm dev
```

### Issue: Python version mismatch

The backend requires Python 3.11. If you have a different version:

```bash
# Check your Python version
python3 --version

# If not 3.11, install it:
# macOS (using Homebrew):
brew install python@3.11

# Ubuntu/Debian:
sudo apt install python3.11

# Update the Python path in server/visualizer.ts if needed
```

### Issue: pnpm not found

```bash
# Install pnpm
npm install -g pnpm

# Or use npm instead (slower):
npm install
npm run dev
```

### Issue: Module not found errors

```bash
# Clear cache and reinstall
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

---

## Development Commands

```bash
# Start development server (hot reload)
pnpm dev

# Type checking (without running)
pnpm check

# Run tests
pnpm test

# Build for production
pnpm build

# Start production server
pnpm start

# Format code
pnpm format

# Push database schema changes
pnpm db:push
```

---

## Project Structure

```
web-app/
├── client/                    # Frontend
│   ├── src/
│   │   ├── components/       # React components
│   │   │   ├── StateCanvas.tsx    # Canvas renderer
│   │   │   └── ui/                # UI components
│   │   ├── pages/
│   │   │   └── Visualizer.tsx     # Main page
│   │   ├── lib/
│   │   │   └── trpc.ts            # API client
│   │   └── App.tsx           # Routes
│   └── index.html
├── server/                    # Backend
│   ├── visualizer.ts         # Visualizer API
│   ├── routers.ts            # Main router
│   └── _core/                # Framework code
├── python_modules/            # Python integration
│   ├── state_generator/      # State generation
│   ├── state_renderer/       # Visual rendering
│   ├── domains/              # PDDL files
│   └── visualizer_api.py     # Python API
└── package.json
```

---

## Next Steps

### Enable Fast Downward Planner

Currently, the system uses fallback plans. To enable actual planning:

1. **Build Fast Downward** in the parent directory:
   ```bash
   cd ../planning-tools/downward
   ./build.py release
   cd ../../web-app
   ```

2. **Restart the dev server**:
   ```bash
   pnpm dev
   ```

The system will automatically detect and use Fast Downward when available.

### Add More Domains

To add visualization for other domains:

1. Implement a renderer in `python_modules/state_renderer/`
2. Register it in `python_modules/state_renderer/__init__.py`
3. Add domain config in `server/visualizer.ts`
4. Restart the server

---

## Production Deployment

For production deployment:

```bash
# Build the application
pnpm build

# Set production environment variables
export NODE_ENV=production
export DATABASE_URL=your-production-db-url
export JWT_SECRET=your-production-secret

# Start production server
pnpm start
```

The built application will be in the `dist/` directory.

---

## Getting Help

- **GitHub Issues**: https://github.com/Diabhsn3/planning-visualizer/issues
- **Documentation**: See README.md files in each directory
- **Examples**: Check `domains/` for PDDL examples

---

## Summary

**Quick Start Commands**:
```bash
cd planning-visualizer/web-app
pnpm install
pnpm dev
# Open http://localhost:3000
```

That's it! You should now have the Planning Visualizer running locally. 🎉
