#!/bin/bash

# Fast Downward macOS Build Script with GCC
# This script installs GCC via Homebrew and builds Fast Downward using GCC instead of AppleClang

set +e  # Don't exit on error

echo "======================================"
echo "  Fast Downward macOS Build Helper"
echo "======================================"
echo ""

# Check if we're on macOS
if [[ "$OSTYPE" != "darwin"* ]]; then
    echo "❌ This script is only for macOS"
    exit 1
fi

# Check if Homebrew is installed
if ! command -v brew &> /dev/null; then
    echo "❌ Homebrew is not installed"
    echo ""
    echo "Please install Homebrew first:"
    echo '/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"'
    exit 1
fi

echo "[OK] Homebrew found"
echo ""

# Check if GCC is installed
echo "Step 1: Checking for GCC..."
if ! command -v gcc-14 &> /dev/null && ! command -v gcc-13 &> /dev/null && ! command -v gcc-12 &> /dev/null; then
    echo "[INFO] GCC not found. Installing GCC via Homebrew..."
    echo "This may take 5-10 minutes..."
    brew install gcc
    
    if [ $? -ne 0 ]; then
        echo "❌ Failed to install GCC"
        exit 1
    fi
fi

# Find the installed GCC version
GCC_VERSION=""
for ver in 14 13 12 11; do
    if command -v gcc-$ver &> /dev/null; then
        GCC_VERSION=$ver
        break
    fi
done

if [ -z "$GCC_VERSION" ]; then
    echo "❌ Could not find GCC installation"
    exit 1
fi

GCC_PATH=$(which gcc-$GCC_VERSION)
GXX_PATH=$(which g++-$GCC_VERSION)

echo "[OK] Found GCC $GCC_VERSION"
echo "    GCC: $GCC_PATH"
echo "    G++: $GXX_PATH"
echo ""

# Navigate to Fast Downward directory
if [ ! -d "planning-tools/downward" ]; then
    echo "❌ Fast Downward directory not found"
    echo "Please run this script from the repository root"
    exit 1
fi

cd planning-tools/downward

# Clean any previous builds
echo "Step 2: Cleaning previous builds..."
rm -rf builds
echo "[OK] Clean complete"
echo ""

# Build with GCC
echo "Step 3: Building Fast Downward with GCC-$GCC_VERSION..."
echo "This may take 5-10 minutes..."
echo ""

# Set compiler environment variables and build
export CC=$GCC_PATH
export CXX=$GXX_PATH

# Pass compiler directly to build.py (it will pass to CMake)
CMAKE_C_COMPILER=$GCC_PATH CMAKE_CXX_COMPILER=$GXX_PATH ./build.py release

BUILD_EXIT_CODE=$?

echo ""
if [ $BUILD_EXIT_CODE -eq 0 ]; then
    echo "======================================"
    echo "✅ Fast Downward built successfully!"
    echo "======================================"
    echo ""
    echo "The planner is now available at:"
    echo "  planning-tools/downward/builds/release/bin/downward"
    echo ""
else
    echo "======================================"
    echo "❌ Fast Downward build failed"
    echo "======================================"
    echo ""
    echo "Please check the error messages above."
    echo "You may need to:"
    echo "  1. Update Homebrew: brew update"
    echo "  2. Upgrade GCC: brew upgrade gcc"
    echo "  3. Check Fast Downward requirements"
    echo ""
    exit 1
fi
