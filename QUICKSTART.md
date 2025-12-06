# Planning Visualizer - Quick Start Guide

Get the Planning Visualizer running on your local machine in 5 minutes!

## Prerequisites

Before you begin, ensure you have:
- **Python 3.10+** installed (`python3 --version`)
- **Node.js 18+** installed (`node --version`)
- **Git** installed
- **CMake** and **build tools** (for Fast Downward)
  - macOS: `xcode-select --install`
  - Linux: `sudo apt-get install build-essential cmake`

## Automated Setup (Recommended)

### Option 1: One-Command Setup

```bash
# Clone the repository
git clone https://github.com/Diabhsn3/planning-visualizer.git
cd planning-visualizer

# Run the automated setup script
chmod +x setup-local.sh
./setup-local.sh

# Start the development server
cd web-app
pnpm dev
```

That's it! The app will be available at `http://localhost:3000`

### Option 2: Manual Setup

If the automated script doesn't work, follow these steps:

#### 1. Clone and Navigate

```bash
git clone https://github.com/Diabhsn3/planning-visualizer.git
cd planning-visualizer
```

#### 2. Initialize Fast Downward Submodule

```bash
git submodule update --init --recursive
```

#### 3. Build Fast Downward

```bash
cd planning-tools/downward
./build.py
cd ../..
```

**Note**: This step takes 5-10 minutes. You'll see compilation output.

#### 4. Configure Python Command

```bash
cd web-app

# Check which Python command works on your system
python3 --version    # Try this first
python --version     # Or this

# Create .env file with the working command
echo "PYTHON_CMD=python3" > .env
```

**Important**: Replace `python3` with whichever command worked for you.

#### 5. Install Node.js Dependencies

```bash
# Still in web-app directory
pnpm install

# If pnpm is not installed:
npm install -g pnpm
pnpm install
```

#### 6. Start Development Server

```bash
pnpm dev
```

The application will start on `http://localhost:3000` (or the next available port if 3000 is busy).

## Verify Your Setup

1. Open `http://localhost:3000` in your browser
2. Click **"Show System Status"** at the top
3. You should see:
   - ✅ **Python Available** (green) - with your Python version
   - ✅ **Fast Downward Available** (green) - if built successfully
   - ❌ **Fast Downward Not Found** (red) - if build failed

## Test the Visualizer

1. Select **"Blocks World"** domain
2. Check **"Use custom problem"**
3. Click **"Paste Text"**
4. Click **"Load Example"** to populate a sample problem
5. Click **"Solve Problem"**

You should see:
- ✅ Green badge: "Fast Downward (A* + LM-cut)"
- A canvas visualization with colored blocks
- A timeline with play controls
- A list of plan steps

## Common Issues

### Issue: "python3.11: command not found"

**Solution**:
```bash
# Find which Python command works
python3 --version
python --version

# Update .env file in web-app directory
echo "PYTHON_CMD=python3" > web-app/.env

# Restart the dev server
cd web-app
pnpm dev
```

### Issue: "Fast Downward Not Found"

**Solution**:
```bash
# Make sure you're in the project root
cd planning-visualizer

# Initialize and build Fast Downward
git submodule update --init --recursive
cd planning-tools/downward
./build.py
cd ../..

# Restart the dev server
cd web-app
pnpm dev
```

### Issue: "Port 3000 is already in use"

**Solution**: The dev server will automatically use the next available port (e.g., 3001). Check the terminal output for the actual URL.

### Issue: Build fails with "CMake not found"

**Solution**:
- **macOS**: `xcode-select --install`
- **Linux**: `sudo apt-get install build-essential cmake`
- **Windows**: Install Visual Studio Build Tools or use WSL2

### Issue: "Fallback plan" warning appears

**Cause**: Fast Downward is not properly built or not found.

**Solution**:
1. Check System Status to see specific error
2. Rebuild Fast Downward: `cd planning-tools/downward && ./build.py`
3. Verify `.env` file exists in `web-app/` with `PYTHON_CMD=python3`

## Project Structure

```
planning-visualizer/
├── web-app/                    # Main web application
│   ├── client/                 # React frontend
│   ├── server/                 # Express backend
│   ├── python_modules/         # Python integration
│   └── .env                    # Your local configuration (create this!)
├── planning-tools/
│   └── downward/               # Fast Downward planner (submodule)
├── setup-local.sh              # Automated setup script
└── QUICKSTART.md               # This file
```

## Development Workflow

### Running the App
```bash
cd web-app
pnpm dev
```

### Stopping the App
Press `Ctrl+C` in the terminal

### Updating from GitHub
```bash
git pull origin main
git submodule update --recursive
cd web-app
pnpm install
pnpm dev
```

### Clearing Cache (if things break)
```bash
cd web-app
rm -rf node_modules
pnpm install
pnpm dev
```

## Features

- **Dual Input Modes**: Upload PDDL files or paste text directly
- **Fast Downward Integration**: Dynamic problem solving with optimal plans
- **Visual Feedback**: Animated canvas showing block movements
- **System Diagnostics**: Built-in status checker for troubleshooting
- **Multiple Domains**: Blocks World and Gripper (extensible)

## Need Help?

1. **Check System Status**: Click "Show System Status" in the app
2. **Review Logs**: Check the terminal where `pnpm dev` is running
3. **Read Documentation**: See `LOCAL_SETUP.md` for detailed setup instructions
4. **Check GitHub Issues**: https://github.com/Diabhsn3/planning-visualizer/issues

## Next Steps

Once everything is working:
1. Try creating your own PDDL problems
2. Experiment with different block configurations
3. Test the Gripper domain
4. Explore the codebase to understand the architecture

Happy planning! 🎉
