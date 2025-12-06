# Planning Visualizer - Troubleshooting Guide

This guide helps you resolve common issues when running the Planning Visualizer locally.

## Issue: "Fallback (predefined plan)" Warning

### Symptoms
- Yellow warning badge: "⚠ Fallback (predefined plan)"
- Message: "Fast Downward planner not available. Using fallback plan that may not match your problem."
- Visualization shows wrong initial state or plan doesn't match your problem

### Root Cause
Fast Downward is not properly built or not found on your local machine.

### Solution

#### Step 1: Verify Fast Downward Exists

```bash
cd planning-visualizer
ls -la planning-tools/downward/fast-downward.py
```

**If the file doesn't exist:**
```bash
# Initialize the submodule
git submodule update --init --recursive
```

#### Step 2: Build Fast Downward

```bash
cd planning-tools/downward
./build.py
```

**Expected output:**
- Compilation messages (takes 5-10 minutes)
- Final message: "Build completed successfully"

**If build fails:**

**On macOS:**
```bash
# Install Xcode Command Line Tools
xcode-select --install

# Try building again
./build.py
```

**On Linux:**
```bash
# Install build tools
sudo apt-get update
sudo apt-get install build-essential cmake g++ python3-dev

# Try building again
./build.py
```

**On Windows:**
- Use WSL2 (Windows Subsystem for Linux)
- Or install Visual Studio Build Tools
- Follow Linux instructions inside WSL2

#### Step 3: Verify Build Success

```bash
# Check if the build directory exists
ls -la planning-tools/downward/builds/release/

# You should see compiled binaries like:
# - downward
# - preprocess
# - translate
```

#### Step 4: Restart Development Server

```bash
cd web-app
pnpm dev
```

#### Step 5: Test in Browser

1. Open `http://localhost:3000` (or whatever port is shown)
2. Click **"Show System Status"**
3. You should see:
   - ✅ **Python Available** (green)
   - ✅ **Fast Downward Available** (green)

If you still see ❌ **Fast Downward Not Found**, continue to the next section.

---

## Issue: Fast Downward Built But Still Not Found

### Symptoms
- Fast Downward built successfully
- `planning-tools/downward/fast-downward.py` exists
- Still getting "Fallback plan" warning

### Root Cause
The Python script can't find Fast Downward due to directory structure mismatch.

### Solution

#### Check Directory Structure

Your directory structure should look like this:

```
planning-visualizer/              ← Repository root
├── web-app/                      ← Web application
│   ├── python_modules/
│   │   └── run_planner.py
│   └── .env                      ← Your config file
└── planning-tools/               ← Fast Downward location
    └── downward/
        └── fast-downward.py
```

**Verify:**
```bash
cd planning-visualizer
pwd  # Should show: /Users/yourname/.../planning-visualizer

ls -la web-app/
ls -la planning-tools/downward/fast-downward.py
```

If your structure is different, the path detection might fail.

#### Manual Path Override

If automatic detection fails, you can override the path:

1. Edit `web-app/python_modules/run_planner.py`
2. Find the `POSSIBLE_FD_PATHS` list (around line 17)
3. Add your custom path at the beginning:

```python
POSSIBLE_FD_PATHS = [
    # Add your custom path here
    Path("/full/path/to/your/planning-visualizer/planning-tools/downward/fast-downward.py"),
    # ... existing paths ...
]
```

Replace `/full/path/to/your/` with your actual path.

---

## Issue: Python Command Not Found

### Symptoms
- Terminal shows: `python3.11: command not found` or similar
- Server fails to start
- System Status shows: ❌ Python Not Available

### Root Cause
Your system has a different Python version than expected.

### Solution

#### Find Your Python Command

```bash
# Try these commands to find which one works:
python3 --version
python --version
python3.12 --version
python3.11 --version
python3.10 --version
```

#### Update .env File

Once you find the working command, update your `.env` file:

```bash
cd web-app

# Create or edit .env file
echo "PYTHON_CMD=python3" > .env

# Replace python3 with whichever command worked for you
```

#### Restart Server

```bash
pnpm dev
```

---

## Issue: Port Already in Use

### Symptoms
- Error: `Port 3000 is already in use`
- Server automatically uses port 3001 or higher

### Solution

This is normal behavior! The server will automatically find the next available port.

**Check the terminal output** to see which port is actually being used:

```
Server running on http://localhost:3001/
```

Open that URL in your browser.

**To force a specific port:**
```bash
PORT=3002 pnpm dev
```

---

## Issue: Visualization Shows Wrong Blocks

### Symptoms
- Initial state doesn't match your problem
- Blocks are in wrong positions
- Plan actions don't make sense

### Root Cause
Using fallback plan instead of Fast Downward.

### Solution
Follow the steps in **"Issue: Fallback (predefined plan)" Warning** above.

---

## Issue: Setup Script Fails

### Symptoms
- `./setup-local.sh` exits with errors
- Some steps fail during automated setup

### Solution

#### Make Script Executable

```bash
chmod +x setup-local.sh
```

#### Run with Verbose Output

```bash
bash -x ./setup-local.sh 2>&1 | tee setup-log.txt
```

This saves all output to `setup-log.txt` for debugging.

#### Manual Setup

If the script continues to fail, follow the manual setup steps in `QUICKSTART.md`.

---

## Issue: Dependencies Installation Fails

### Symptoms
- `pnpm install` fails
- Missing packages errors

### Solution

#### Update pnpm

```bash
npm install -g pnpm@latest
cd web-app
pnpm install
```

#### Clear Cache

```bash
cd web-app
rm -rf node_modules
rm pnpm-lock.yaml
pnpm install
```

#### Check Node.js Version

```bash
node --version
# Should be v18 or higher
```

If your Node.js is too old:
- **macOS**: `brew upgrade node`
- **Linux**: Use nvm or download from nodejs.org
- **Windows**: Download installer from nodejs.org

---

## Still Having Issues?

### Collect Diagnostic Information

1. **Check System Status** in the web app
2. **Check terminal logs** where `pnpm dev` is running
3. **Run diagnostic commands:**

```bash
cd planning-visualizer

# Check Python
python3 --version

# Check Node.js
node --version
pnpm --version

# Check Fast Downward
ls -la planning-tools/downward/fast-downward.py
ls -la planning-tools/downward/builds/release/

# Check .env file
cat web-app/.env
```

### Common Diagnostic Output

**Working Setup:**
```
✓ Python: python3 (3.12)
✓ Node.js: v22.16.0
✓ Fast Downward: /path/to/planning-tools/downward/fast-downward.py exists
✓ .env: PYTHON_CMD=python3
```

**Broken Setup:**
```
✗ Python: command not found
✗ Fast Downward: file not found
✗ .env: file not found
```

### Get Help

1. Check the GitHub Issues: https://github.com/Diabhsn3/planning-visualizer/issues
2. Review `QUICKSTART.md` for detailed setup instructions
3. Review `LOCAL_SETUP.md` for environment-specific notes

---

## Quick Reference

### Essential Commands

```bash
# Start development server
cd web-app && pnpm dev

# Rebuild Fast Downward
cd planning-tools/downward && ./build.py

# Update from GitHub
git pull origin main
git submodule update --recursive

# Clean install
cd web-app
rm -rf node_modules
pnpm install

# Check system status
# Open browser → Click "Show System Status"
```

### Essential Files

- `web-app/.env` - Your local configuration
- `web-app/python_modules/run_planner.py` - Python integration
- `planning-tools/downward/fast-downward.py` - Planner executable
- `setup-local.sh` - Automated setup script

### Directory Structure

```
planning-visualizer/
├── web-app/              ← Your working directory
│   ├── .env              ← Create this!
│   └── python_modules/
└── planning-tools/       ← Build Fast Downward here
    └── downward/
```

---

## Success Checklist

Before reporting an issue, verify:

- [ ] Python 3.10+ installed and working
- [ ] Node.js 18+ installed and working
- [ ] Fast Downward submodule initialized
- [ ] Fast Downward built successfully
- [ ] `.env` file created in `web-app/` directory
- [ ] `.env` contains correct `PYTHON_CMD`
- [ ] Development server starts without errors
- [ ] System Status shows all green checkmarks
- [ ] Test problem generates visualization with green "Fast Downward" badge

If all items are checked and you still have issues, please open a GitHub issue with:
1. Your operating system (macOS/Linux/Windows)
2. Python version (`python3 --version`)
3. Node.js version (`node --version`)
4. Terminal output from `pnpm dev`
5. Screenshot of System Status page
