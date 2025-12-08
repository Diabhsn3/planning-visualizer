# macOS Build Issues - Fast Downward

## Problem

On macOS with Xcode 15+, Fast Downward fails to build with C++ compilation errors like:

```
error: no type named 'size_t' in namespace 'std'
error: no type named 'nothrow_t' in namespace 'std'
error: expected ';' after top level declarator
```

This is a **known compatibility issue** between Fast Downward and newer versions of Xcode/Clang.

## Quick Fix

### Option 1: Use the Fix Script (Try This First)

```bash
./fix_macos_build.sh
```

This script will:
1. Update Fast Downward to the latest version (which may have fixes)
2. Clean previous build attempts
3. Rebuild with the updated code

### Option 2: Run in Fallback Mode (Easiest)

The application **works perfectly** without Fast Downward:

```bash
./run_new.sh
```

**What works in fallback mode:**
- ✅ All visualization features
- ✅ Pre-defined example problems
- ✅ Animation controls
- ✅ Domain-specific rendering
- ⚠️ Custom PDDL problems use pre-computed fallback plans

**This is the recommended approach for most users on macOS.**

### Option 3: Manual Fast Downward Update

If the fix script doesn't work, try manually updating:

```bash
cd planning-tools/downward
git fetch origin
git checkout origin/main
rm -rf builds
./build.py release
cd ../..
```

## Why This Happens

**Root Cause:** Apple's Xcode 15+ changed how C++ standard library headers are structured. Fast Downward's older code may not be compatible with these changes.

**Affected Systems:**
- macOS Sonoma (14.x) with Xcode 15+
- macOS Sequoia (15.x) with Xcode 16+
- Any Mac with Command Line Tools from Xcode 15+

**Not Affected:**
- macOS Monterey (12.x) with Xcode 13
- macOS Ventura (13.x) with Xcode 14
- Linux systems
- Windows systems

## Advanced Solutions

### Solution A: Install Older Command Line Tools

1. **Uninstall current tools:**
   ```bash
   sudo rm -rf /Library/Developer/CommandLineTools
   ```

2. **Download Xcode 14 Command Line Tools:**
   - Visit: https://developer.apple.com/download/all/
   - Sign in with Apple ID (free)
   - Search for "Command Line Tools for Xcode 14"
   - Download and install

3. **Rebuild Fast Downward:**
   ```bash
   cd planning-tools/downward
   rm -rf builds
   ./build.py release
   ```

### Solution B: Use Homebrew GCC

Install GCC via Homebrew instead of using Clang:

```bash
# Install Homebrew GCC
brew install gcc

# Set environment variables
export CC=gcc-13
export CXX=g++-13

# Build Fast Downward
cd planning-tools/downward
rm -rf builds
./build.py release
```

### Solution C: Use Docker (Most Reliable)

Run Fast Downward in a Linux container:

1. **Install Docker Desktop for Mac**
   - Download from: https://www.docker.com/products/docker-desktop

2. **Create Dockerfile in project root:**
   ```dockerfile
   FROM ubuntu:22.04
   
   RUN apt-get update && apt-get install -y \
       build-essential \
       cmake \
       python3 \
       git
   
   WORKDIR /app
   COPY planning-tools/downward /app/downward
   
   RUN cd /app/downward && ./build.py release
   ```

3. **Build and use:**
   ```bash
   docker build -t fast-downward .
   docker run -v $(pwd):/workspace fast-downward \
       /app/downward/fast-downward.py \
       /workspace/domain.pddl \
       /workspace/problem.pddl
   ```

## Checking Your Xcode Version

```bash
# Check Xcode Command Line Tools version
xcodebuild -version

# Check Clang version
clang --version
```

**If you see Xcode 15.x or 16.x**, you're likely affected by this issue.

## Recommended Approach

For most users, we recommend:

1. **Try the fix script first:**
   ```bash
   ./fix_macos_build.sh
   ```

2. **If that fails, use fallback mode:**
   ```bash
   ./run_new.sh
   ```
   
   The app works great in fallback mode!

3. **Only if you need custom PDDL solving:**
   - Try installing older Xcode Command Line Tools (Solution A)
   - Or use Docker (Solution C)

## Testing If Fast Downward Works

After any fix attempt, test with:

```bash
cd backend/planner
python3 run_planner.py \
    domains/blocks_world/domain.pddl \
    domains/blocks_world/p1.pddl \
    blocks-world
```

**Expected output if working:**
```
Planner: Fast Downward
Plan length: 4
Actions:
  1. (unstack d c)
  2. (put-down d)
  ...
```

**Expected output if using fallback:**
```
Warning: Could not run Fast Downward (...)
Planner: Fallback
Plan length: 4
Actions:
  1. (pick-up b)
  2. (stack b c)
  ...
```

## Still Having Issues?

If none of these solutions work:

1. **Verify your path has no spaces:**
   ```bash
   pwd
   # Should NOT contain spaces like "final project"
   ```

2. **Check system requirements:**
   - macOS 12.0 or later
   - At least 2GB free disk space
   - Internet connection for submodule download

3. **Use fallback mode** - it's reliable and works on all systems!

## Related Files

- `setup_fast_downward.sh` - General setup script
- `fix_macos_build.sh` - macOS-specific fix script
- `run_new.sh` - Main application launcher
- `README.md` - Main documentation

## Contributing

If you find a solution that works for your macOS version, please:
1. Open an issue on GitHub
2. Share your Xcode version and solution
3. Help other macOS users!

---

**Bottom Line:** Don't spend hours fighting the build. Use fallback mode and enjoy the visualizer! 🎉
