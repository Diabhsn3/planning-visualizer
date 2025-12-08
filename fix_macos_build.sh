#!/bin/bash
# Fix Fast Downward build issues on macOS with Xcode 15+
# This script updates Fast Downward to a version compatible with newer Xcode

set -e

echo "======================================"
echo "  Fast Downward macOS Build Fix"
echo "======================================"
echo ""

# Check if we're on macOS
if [[ "$OSTYPE" != "darwin"* ]]; then
    echo "This script is only needed on macOS."
    echo "On your system, try running ./setup_fast_downward.sh instead."
    exit 0
fi

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
    exit 1
fi

echo "Step 1: Checking Fast Downward submodule..."
if [ ! -d "planning-tools/downward/.git" ]; then
    echo "[INFO] Initializing Fast Downward submodule..."
    git submodule update --init --recursive
fi

echo ""
echo "Step 2: Updating Fast Downward to latest version..."
echo "[INFO] This fixes compatibility issues with Xcode 15+"

cd planning-tools/downward

# Save current branch/commit
ORIGINAL_COMMIT=$(git rev-parse HEAD 2>/dev/null || echo "")

# Fetch latest updates
echo "[INFO] Fetching latest Fast Downward updates..."
git fetch origin

# Try to update to latest main branch
echo "[INFO] Updating to latest stable version..."
if git checkout origin/main; then
    echo "[OK] Updated to latest Fast Downward version"
else
    echo "[WARNING] Could not update to latest version, using current version"
fi

echo ""
echo "Step 3: Cleaning previous build..."
if [ -d "builds" ]; then
    rm -rf builds
    echo "[OK] Cleaned previous build"
fi

echo ""
echo "Step 4: Building Fast Downward..."
echo "[INFO] This may take 2-5 minutes..."

if ./build.py release; then
    echo ""
    echo "✅ Fast Downward built successfully!"
    echo "📍 Binary location: planning-tools/downward/builds/release/bin/downward"
    cd ../..
    
    echo ""
    echo "======================================"
    echo "✅ Build fix complete!"
    echo "======================================"
    echo ""
    echo "You can now run the application:"
    echo "  ./run_new.sh"
    echo ""
    exit 0
else
    echo ""
    echo "⚠️  Build still failed after update!"
    echo ""
    echo "This means Fast Downward has deeper compatibility issues with your Xcode version."
    echo ""
    echo "Solutions:"
    echo ""
    echo "1. Use Fallback Mode (Recommended)"
    echo "   The app works without Fast Downward using pre-computed plans."
    echo "   Just run: ./run_new.sh"
    echo ""
    echo "2. Try Installing Older Xcode Command Line Tools"
    echo "   Sometimes older versions work better:"
    echo "   - Download from: https://developer.apple.com/download/all/"
    echo "   - Look for 'Command Line Tools for Xcode 14'"
    echo ""
    echo "3. Use Docker (Advanced)"
    echo "   Run Fast Downward in a Linux container"
    echo ""
    cd ../..
    exit 1
fi
