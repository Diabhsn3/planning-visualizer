# Local Development Setup Guide

This guide will help you set up the Planning Visualizer on your local machine (macOS, Linux, or Windows).

## Prerequisites

### Required Software

1. **Node.js 18+** and **pnpm**
   - Download from https://nodejs.org/
   - Install pnpm: `npm install -g pnpm`

2. **Python 3.11+**
   - **macOS**: 
     - Homebrew: `brew install python@3.11`
     - Or download from https://www.python.org/downloads/
   - **Linux (Ubuntu/Debian)**: `sudo apt-get install python3.11`
   - **Windows**: Download from https://www.python.org/downloads/

3. **Git**
   - Download from https://git-scm.com/

4. **CMake and C++ compiler** (for building Fast Downward)
   - **macOS**: `brew install cmake`
   - **Linux**: `sudo apt-get install cmake g++ make`
   - **Windows**: Download CMake from https://cmake.org/ and install Visual Studio Build Tools

## Installation Steps

### 1. Clone the Repository

```bash
git clone https://github.com/Diabhsn3/planning-visualizer.git
cd planning-visualizer
```

### 2. Build Fast Downward Planner

```bash
# Initialize and clone the Fast Downward submodule
git submodule update --init --recursive

# Navigate to Fast Downward directory
cd planning-tools/downward

# Build the planner
./build.py

# Return to repository root
cd ../..
```

### 3. Install Python Dependencies

```bash
pip3 install -r requirements.txt
```

### 4. Install Node.js Dependencies

```bash
cd web-app
pnpm install
```

### 5. Configure Python Path (if needed)

If Python 3.11 is not in your system PATH or has a different name, you need to configure it:

#### Option A: Set Environment Variable (Recommended)

Create a `.env` file in the `web-app` directory:

```bash
# Most common: Use python3 (works for Python 3.11, 3.12, 3.13, etc.)
echo "PYTHON_CMD=python3" > .env

# Or if you have a specific version:
echo "PYTHON_CMD=python3.12" > .env

# Or specify full path if needed:
# macOS (Homebrew)
echo "PYTHON_CMD=/usr/local/bin/python3" > .env

# macOS (Python.org)
echo "PYTHON_CMD=/Library/Frameworks/Python.framework/Versions/3.12/bin/python3" > .env

# Linux
echo "PYTHON_CMD=/usr/bin/python3" > .env
```

**Important:** The system will auto-detect Python, but if you see errors like "python3.11: command not found", create this `.env` file with the correct command for your system.

#### Option B: Check Python Version

Verify which Python command works on your system:

```bash
# Try these commands to find which one works:
python3.11 --version
python3 --version
python --version
```

Use the command that shows Python 3.11 or higher.

### 6. Start the Development Server

```bash
# From the web-app directory
pnpm dev
```

The application will be available at `http://localhost:3000`

## Troubleshooting

### Issue: "python3.11: command not found" or "python3.12: command not found"

**Solution**: 
1. Check which Python command works on your system:
   ```bash
   python3 --version    # Try this first
   python --version     # Or this
   python3.12 --version # Or specific version
   ```
2. Create a `.env` file in the `web-app` directory with the working command:
   ```bash
   # In web-app directory:
   echo "PYTHON_CMD=python3" > .env
   ```
3. Restart the dev server: `pnpm dev`

### Issue: "Fast Downward not found"

**Solution**:
1. Make sure you initialized the submodule: `git submodule update --init --recursive`
2. Build Fast Downward: `cd planning-tools/downward && ./build.py`
3. Check that `planning-tools/downward/fast-downward.py` exists

### Issue: "CMake not found" (during Fast Downward build)

**Solution**:
- **macOS**: `brew install cmake`
- **Linux**: `sudo apt-get install cmake`
- **Windows**: Download from https://cmake.org/

### Issue: Build errors on Windows

**Solution**:
- Install Visual Studio Build Tools from https://visualstudio.microsoft.com/downloads/
- Use "Developer Command Prompt for VS" to run build commands

### Issue: Port 3000 already in use

**Solution**:
1. Stop the process using port 3000, or
2. Change the port by creating a `.env` file:
   ```
   PORT=3001
   ```

## Verifying the Setup

### Test Python Integration

```bash
# From the repository root
cd web-app
python3.11 ../python_modules/visualizer_api.py \
  ../python_modules/domains/blocks_world/domain.pddl \
  ../python_modules/domains/blocks_world/problems/bw_example_1.pddl \
  blocks-world
```

You should see JSON output with states and a plan.

### Test Fast Downward

```bash
# From the repository root
cd planning-tools/downward
./fast-downward.py --help
```

You should see the Fast Downward help message.

### Test the Web Application

1. Start the dev server: `cd web-app && pnpm dev`
2. Open `http://localhost:3000` in your browser
3. Select "Blocks World" domain
4. Check "Use custom problem"
5. Click "Paste Text"
6. Click "Load Example"
7. Click "Solve Problem"

You should see the visualization with animated blocks.

## Environment Variables Reference

Create a `.env` file in the `web-app` directory with these optional variables:

```bash
# Python Command (optional)
# Specify if Python 3.11+ is not in PATH or has a different name
PYTHON_CMD=python3.11

# Development Server Port (optional)
# Change if port 3000 is already in use
PORT=3000
```

## Platform-Specific Notes

### macOS

- If using Homebrew Python: `PYTHON_CMD=/usr/local/bin/python3.11`
- If using Python.org installer: `PYTHON_CMD=/Library/Frameworks/Python.framework/Versions/3.11/bin/python3.11`

### Linux

- Python 3.11 might be named `python3.11` or `python3`
- Make sure you have `python3-pip` installed: `sudo apt-get install python3-pip`

### Windows

- Use forward slashes in paths: `PYTHON_CMD=C:/Python311/python.exe`
- Or use double backslashes: `PYTHON_CMD=C:\\Python311\\python.exe`
- Fast Downward build on Windows requires Visual Studio Build Tools

## Next Steps

Once the application is running:

1. Try the example problems in each domain
2. Create your own PDDL problems and test them
3. Experiment with different planning domains
4. Check the main README.md for architecture details and development guidelines

## Getting Help

If you encounter issues not covered here:

1. Check the main README.md for more details
2. Verify all prerequisites are installed correctly
3. Check the browser console for error messages
4. Check the terminal output for Python errors
5. Open an issue on GitHub with details about your environment and the error message
