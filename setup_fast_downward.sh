#!/bin/bash
# Standalone script to set up Fast Downward
# Can be run independently or shared with collaborators

set -e

echo "======================================"
echo "  Fast Downward Setup Script"
echo "======================================"
echo ""

# Check if in correct directory
if [ ! -f "README.md" ] || [ ! -d "backend" ]; then
    echo "❌ Error: Run this script from the planning-visualizer root directory"
    exit 1
fi

# Check for spaces in path
if [[ "$PWD" == *" "* ]]; then
    echo "❌ ERROR: Directory path contains spaces!"
    echo ""
    echo "Fast Downward cannot be built in paths with spaces."
    echo "Please move the project to a path without spaces."
    echo ""
    echo "Example:"
    echo "  Current path: $PWD"
    echo "  Move to: ~/planning-visualizer"
    echo ""
    echo "Command to move:"
    echo "  mv \"$PWD\" ~/planning-visualizer"
    echo ""
    exit 1
fi

# Step 1: Initialize submodule
echo "Step 1: Initializing Fast Downward submodule..."
if [ -f "planning-tools/downward/fast-downward.py" ]; then
    echo "[OK] Submodule already initialized"
else
    echo "[INFO] Downloading Fast Downward from GitHub (~50MB)..."
    if git submodule update --init --recursive; then
        echo "[OK] Submodule initialized successfully"
    else
        echo "[ERROR] Failed to initialize submodule"
        echo ""
        echo "Possible causes:"
        echo "  - No internet connection"
        echo "  - GitHub is unreachable"
        echo "  - Git version too old (need 1.6.5+)"
        echo ""
        echo "Try manually:"
        echo "  git submodule update --init --recursive"
        echo ""
        exit 1
    fi
fi

# Step 2: Check for C++ compiler
echo ""
echo "Step 2: Checking for C++ compiler..."
if command -v g++ &> /dev/null || command -v clang++ &> /dev/null; then
    echo "[OK] C++ compiler found"
else
    echo "[WARNING] C++ compiler not found"
    echo ""
    echo "Fast Downward requires a C++ compiler to build."
    echo ""
    if [[ "$OSTYPE" == "darwin"* ]]; then
        echo "On macOS, install Xcode Command Line Tools:"
        echo "  xcode-select --install"
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        echo "On Ubuntu/Debian, install build tools:"
        echo "  sudo apt-get update"
        echo "  sudo apt-get install build-essential cmake"
    fi
    echo ""
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Step 3: Build Fast Downward
echo ""
echo "Step 3: Building Fast Downward..."
if [ -d "planning-tools/downward/builds/release" ]; then
    echo "[OK] Fast Downward already built"
    echo "[INFO] Binary location: planning-tools/downward/builds/release/bin/downward"
    
    # Verify the binary exists
    if [ -f "planning-tools/downward/builds/release/bin/downward" ]; then
        echo "[OK] Binary verified"
    else
        echo "[WARNING] Build directory exists but binary not found"
        echo "[INFO] Rebuilding..."
        cd planning-tools/downward
        rm -rf builds/release
        if ./build.py release; then
            echo "[OK] Fast Downward rebuilt successfully!"
            cd ../..
        else
            echo "[ERROR] Rebuild failed"
            cd ../..
            exit 1
        fi
    fi
else
    echo "[INFO] This may take 2-5 minutes depending on your system..."
    cd planning-tools/downward
    
    if ./build.py release; then
        echo ""
        echo "✅ Fast Downward built successfully!"
        echo "📍 Binary location: planning-tools/downward/builds/release/bin/downward"
        cd ../..
    else
        echo ""
        echo "⚠️  Build failed!"
        echo ""
        echo "Common causes:"
        echo ""
        echo "1. Missing C++ compiler"
        if [[ "$OSTYPE" == "darwin"* ]]; then
            echo "   Mac: xcode-select --install"
        elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
            echo "   Linux: sudo apt-get install build-essential cmake"
        else
            echo "   Windows: Install Visual Studio Build Tools with C++"
        fi
        echo ""
        echo "2. macOS Xcode 15+ compatibility issues"
        echo "   Try updating Fast Downward:"
        echo "   cd planning-tools/downward && git pull origin main && ./build.py release"
        echo ""
        echo "3. Path contains spaces (already checked)"
        echo ""
        echo "The app will still work in fallback mode with example problems."
        echo ""
        cd ../..
        exit 1
    fi
fi

# Step 4: Test the build
echo ""
echo "Step 4: Testing Fast Downward..."
if [ -f "planning-tools/downward/builds/release/bin/downward" ]; then
    echo "[OK] Fast Downward binary exists"
    
    # Try to run it with --help
    if planning-tools/downward/fast-downward.py --help &> /dev/null; then
        echo "[OK] Fast Downward is executable"
    else
        echo "[WARNING] Fast Downward exists but may not be properly configured"
    fi
else
    echo "[ERROR] Fast Downward binary not found after build"
    exit 1
fi

echo ""
echo "======================================"
echo "✅ Setup complete!"
echo "======================================"
echo ""
echo "Fast Downward has been successfully set up."
echo ""
echo "You can now run the application:"
echo "  ./run_new.sh"
echo ""
echo "Or test the planner directly:"
echo "  cd backend/planner"
echo "  python3 run_planner.py domains/blocks_world/domain.pddl domains/blocks_world/p1.pddl blocks-world"
echo ""
