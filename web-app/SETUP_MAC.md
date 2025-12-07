# Planning Visualizer - macOS Setup Guide

Complete step-by-step guide to run the Planning Visualizer on your Mac.

---

## Prerequisites

Before starting, ensure you have:
- **macOS** 10.15 (Catalina) or later
- **Terminal** access
- **Internet connection** for downloading dependencies

---

## Step 1: Install Homebrew (if not already installed)

Homebrew is a package manager for macOS that makes installing software easy.

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

After installation, follow the on-screen instructions to add Homebrew to your PATH.

---

## Step 2: Install Required Tools

### Install Git
```bash
brew install git
```

### Install Python 3
```bash
brew install python@3.12
```

Verify installation:
```bash
python3 --version  # Should show Python 3.x
```

### Install Node.js and pnpm
```bash
brew install node
npm install -g pnpm
```

Verify installation:
```bash
node --version   # Should show v18.x or later
pnpm --version   # Should show 8.x or later
```

### Install CMake (for Fast Downward)
```bash
brew install cmake
```

---

## Step 3: Clone the Repository

**⚠️ IMPORTANT**: Choose a directory path WITHOUT spaces. Fast Downward cannot be built in paths with spaces.

```bash
# Good locations (no spaces):
cd ~                    # Home directory
# cd ~/projects         # Projects folder
# cd ~/Desktop          # Desktop

# Clone the repository
git clone https://github.com/Diabhsn3/planning-visualizer.git
cd planning-visualizer
```

**Avoid paths like**: `~/Documents/final project/`, `~/My Documents/`, or any folder with spaces in the name.

---

## Step 4: Build Fast Downward Planner

Fast Downward is the AI planner that solves PDDL problems.

```bash
# Initialize and update git submodules
git submodule update --init --recursive

# Build Fast Downward
cd planning-tools/downward
./build.py

# Verify the build
ls -la builds/release/bin/downward  # Should show the executable
cd ../..  # Return to project root
```

**Expected output**: You should see compilation messages and finally "Build completed successfully".

---

## Step 5: Set Up the Web Application

```bash
cd web-app

# Create environment configuration
echo "PYTHON_CMD=python3" > .env

# Install dependencies
pnpm install
```

**Note**: The `.env` file tells the app which Python command to use. If `python3` doesn't work, try `python` or `python3.12`.

---

## Step 6: Start the Development Server

```bash
pnpm dev
```

**Expected output**:
```
Server running on http://localhost:3000/
```

---

## Step 7: Open the Application

Open your web browser and navigate to:
```
http://localhost:3000
```

You should see the Planning Visualizer interface!

---

## Testing the Installation

1. **Select a domain**: Choose "Blocks World" from the dropdown
2. **Click "Generate States"**: This uses the default problem
3. **Verify**: You should see:
   - Green badge "✓ Fast Downward (A* + LM-cut)"
   - Animated visualization with blocks
   - Timeline controls

If you see a yellow "⚠ Fallback" badge, Fast Downward wasn't built correctly. Go back to Step 4.

---

## Troubleshooting

### Problem: `python3: command not found`

**Solution**: Python might be installed as `python` instead:
```bash
# Check which Python command works
which python
which python3
which python3.12

# Update .env with the working command
echo "PYTHON_CMD=python" > .env  # Or python3.12
```

### Problem: `pnpm: command not found`

**Solution**: Install pnpm globally:
```bash
npm install -g pnpm
```

### Problem: Fast Downward build fails with C++ errors

**Most Common Cause**: Directory path contains spaces (e.g., "final project", "My Documents")

**Solution**: Fast Downward cannot be built in directories with spaces. Move the project:
```bash
# Bad paths (contain spaces):
# ~/Documents/final project/planning-visualizer ❌
# ~/My Documents/planning-visualizer ❌

# Good paths (no spaces):
# ~/planning-visualizer ✓
# ~/projects/planning-visualizer ✓
# ~/Desktop/planning-visualizer ✓

# Example: Move the project
mv "~/Documents/final project/planning-visualizer" ~/planning-visualizer
cd ~/planning-visualizer
git submodule update --init --recursive
cd planning-tools/downward
./build.py
```

**Other causes**: Make sure CMake is installed:
```bash
brew install cmake
cd planning-tools/downward
./build.py
```

### Problem: Port 3000 already in use

**Solution**: Kill the process using port 3000:
```bash
lsof -ti:3000 | xargs kill -9
```

Then restart the server:
```bash
pnpm dev
```

### Problem: "Module not found" errors

**Solution**: Reinstall dependencies:
```bash
rm -rf node_modules
pnpm install
```

### Problem: Fast Downward C++ compilation errors (namespace std, size_t, nothrow_t)

**This is a known compatibility issue** between Fast Downward and newer macOS Command Line Tools (Xcode 15+).

**Workaround - Use Fallback Mode**:

The app works perfectly without Fast Downward! Just skip the build and use fallback mode:

1. Run the app normally: `pnpm dev`
2. You'll see a yellow "⚠ Fallback" badge instead of green
3. The visualizer still works with pre-defined example problems

**What you can do in fallback mode**:
- ✅ Visualize Blocks World with default 4-block problem
- ✅ Visualize Gripper domain with default problem
- ✅ Use all animation controls (play, pause, timeline)
- ✅ See step-by-step state transitions
- ❌ Cannot solve custom PDDL problems (requires Fast Downward)

**Alternative - Downgrade Command Line Tools** (Advanced):

If you really need Fast Downward for custom problems:

1. Download Xcode Command Line Tools 14.x from [Apple Developer Downloads](https://developer.apple.com/download/all/)
2. Install the older version
3. Rebuild Fast Downward: `cd planning-tools/downward && ./build.py`

Note: This may affect other development tools on your system.

---

## System Status Check

Click **"Show System Status"** in the web interface to see:
- Python version and command
- Fast Downward availability
- Specific error messages if something is wrong

---

## Stopping the Server

Press `Ctrl + C` in the terminal where the server is running.

---

## Next Steps

- Try custom PDDL problems by clicking "Use custom problem"
- Explore the Gripper domain
- Read the main README for feature documentation

---

## Getting Help

If you encounter issues not covered here:
1. Check `TROUBLESHOOTING.md` for detailed diagnostics
2. Verify all prerequisites are installed correctly
3. Make sure you're in the correct directory (`web-app/`)
4. Check the browser console for JavaScript errors (F12 → Console)

---

**Last Updated**: December 2024
