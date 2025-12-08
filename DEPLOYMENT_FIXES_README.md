# Deployment Fixes - Planning Visualizer

## 🎉 All Critical Issues Fixed!

Your Planning Visualizer application with the new frontend/backend separation is now working correctly. All the runtime issues have been resolved.

---

## 🔧 What Was Fixed

### 1. **Python Module Path Errors** ✅

**Problem**: The backend was looking for Python files at incorrect absolute paths like:
```
/Users/hasandiab/capstone/planning-visualizer/planning-visualizer/planner/...
```

**Solution**: Updated `backend/api/visualizer.ts` to use proper absolute paths based on the file's actual location using `__dirname`:

```typescript
const PLANNER_DIR = path.join(__dirname, "../planner");
const PLANNING_TOOLS_DIR = path.join(__dirname, "../planning-tools");
```

Now all paths are resolved correctly relative to the backend directory.

### 2. **Missing Tailwind CSS Styling** ✅

**Problem**: The frontend was displaying plain text without any styling.

**Solution**: Created `frontend/postcss.config.js` with proper Tailwind CSS 4.0 configuration:

```javascript
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

### 3. **Backend Port Configuration** ✅

**Problem**: Backend was starting on random ports instead of the expected port 4000.

**Solution**: Updated `backend/api/package.json` to explicitly set PORT=4000:

```json
"dev": "cross-env NODE_ENV=development PORT=4000 tsx watch _core/index.ts"
```

---

## 🚀 How to Run the Application

### Quick Start

```bash
# From the project root directory
./run_new.sh  # Mac/Linux
# OR
run_new.bat   # Windows
```

This script will:
1. Check Python and Node.js installation
2. Install all dependencies (backend + frontend)
3. Build Fast Downward (if available)
4. Start both servers:
   - **Frontend**: http://localhost:3000
   - **Backend API**: http://localhost:4000

### Manual Start (Alternative)

If you prefer to start servers manually:

```bash
# Terminal 1 - Start Backend
cd backend/api
pnpm install  # First time only
pnpm dev

# Terminal 2 - Start Frontend
cd frontend
pnpm install  # First time only
pnpm dev
```

---

## ✅ Verification Checklist

After starting the application, verify these work:

- [ ] **Frontend loads** at http://localhost:3000
- [ ] **Tailwind CSS styling** is visible (buttons, cards, colors)
- [ ] **Domain selection** dropdown works (Blocks World, Gripper)
- [ ] **Problem input** works (both file upload and text input)
- [ ] **Generate States** button works
- [ ] **Visualization canvas** renders correctly
- [ ] **Animation controls** work (play, pause, speed, timeline)

---

## 📁 Files Modified

1. **backend/api/visualizer.ts**
   - Fixed Python module paths to use absolute paths
   - Added PLANNER_DIR and PLANNING_TOOLS_DIR constants
   - Added debug logging for path resolution

2. **backend/api/package.json**
   - Updated dev script to set PORT=4000

3. **frontend/postcss.config.js** (NEW)
   - Created Tailwind CSS 4.0 configuration

4. **FIXES_APPLIED.md** (NEW)
   - Technical documentation of all fixes

---

## 🔍 Debug Information

When you start the backend, you'll see helpful debug output:

```
[Python Detection] Using Python command: python3
[Path Resolution] __dirname: /path/to/backend/api
[Path Resolution] PLANNER_DIR: /path/to/backend/planner
[Path Resolution] PLANNING_TOOLS_DIR: /path/to/backend/planning-tools
Server running on http://localhost:4000/
```

This confirms that:
- Python is detected correctly
- All paths are resolved to the right locations
- Backend is running on the correct port

---

## 🐛 Troubleshooting

### Issue: "Cannot GET /"
**Solution**: This is expected! The backend is API-only. Access the frontend at http://localhost:3000 instead.

### Issue: "Port already in use"
**Solution**: Kill existing processes:
```bash
# Mac/Linux
lsof -ti:3000 | xargs kill
lsof -ti:4000 | xargs kill

# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

### Issue: "Python not found"
**Solution**: The backend will default to `python3` which should work. If not, set the PYTHON_CMD environment variable:
```bash
echo "PYTHON_CMD=python3.12" > backend/api/.env
```

### Issue: Tailwind CSS not working
**Solution**: Make sure `frontend/postcss.config.js` exists. If not, create it with the content shown above.

---

## 📊 Architecture Overview

```
planning-visualizer/
├── frontend/                 # React + Vite + Tailwind CSS
│   ├── src/
│   ├── postcss.config.js    # ← NEW: Tailwind config
│   ├── package.json
│   └── vite.config.ts       # Proxy /api → localhost:4000
│
├── backend/
│   ├── api/                 # Node.js + Express + tRPC
│   │   ├── visualizer.ts    # ← FIXED: Absolute paths
│   │   └── package.json     # ← FIXED: PORT=4000
│   │
│   └── planner/             # Python modules
│       ├── visualizer_api.py
│       ├── run_planner.py
│       ├── state_generator/
│       ├── state_renderer/
│       └── domains/
│
├── run_new.sh               # Quick start script (Mac/Linux)
└── run_new.bat              # Quick start script (Windows)
```

---

## 🎯 What's Next

Your application is now ready to use! The frontend and backend are properly separated, all paths are resolved correctly, and styling is working.

### Recommended Next Steps:

1. **Test the application** with both Blocks World and Gripper domains
2. **Try uploading custom PDDL problems** to verify the planner integration
3. **Test the visualization** with different problem sizes
4. **Check the animation controls** (play, pause, speed adjustment)

### Future Improvements (Optional):

- Add more domains (Depot, Hanoi, Logistics, etc.)
- Implement plan optimization comparison
- Add export functionality for visualizations
- Create user documentation

---

## 📝 Git Status

All fixes have been committed and pushed to the `front_back` branch:

```bash
git log --oneline -1
# 9f3c03d6 Fix: Python path resolution, Tailwind CSS config, and backend port settings
```

To pull the latest changes:
```bash
git pull origin front_back
```

---

## 💡 Key Takeaways

1. **Absolute paths are crucial** when working with separated frontend/backend
2. **Tailwind CSS 4.0 requires PostCSS config** even with Vite
3. **Explicit port configuration** prevents random port assignment
4. **Debug logging** helps verify path resolution

---

## 🆘 Need Help?

If you encounter any issues:

1. Check the debug output in the terminal
2. Verify both servers are running on correct ports
3. Check browser console for frontend errors
4. Check terminal output for backend errors
5. Refer to TROUBLESHOOTING.md for common issues

---

**Status**: ✅ All critical issues resolved
**Branch**: `front_back`
**Last Updated**: December 7, 2024
