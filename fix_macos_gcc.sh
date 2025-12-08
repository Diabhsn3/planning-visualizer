#!/bin/bash

# Simple script to install GCC and build Fast Downward on macOS
# Run this if the main script isn't working

echo "======================================"
echo "  macOS Fast Downward GCC Fix"
echo "======================================"
echo ""

# Check if we're on macOS
if [[ "$OSTYPE" != "darwin"* ]]; then
    echo "❌ This script is only for macOS"
    exit 1
fi

echo "✅ Running on macOS"
echo ""

# Step 1: Check Homebrew
echo "Step 1: Checking Homebrew..."
if ! command -v brew &> /dev/null; then
    echo "❌ Homebrew is not installed"
    echo ""
    echo "Please install Homebrew first:"
    echo '/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"'
    echo ""
    exit 1
fi
echo "✅ Homebrew found: $(which brew)"
echo ""

# Step 2: Check/Install GCC
echo "Step 2: Checking for GCC..."
GCC_VERSION=""
for ver in 14 13 12 11; do
    if command -v gcc-$ver &> /dev/null; then
        GCC_VERSION=$ver
        break
    fi
done

if [ -z "$GCC_VERSION" ]; then
    echo "⚠️  GCC not found. Installing..."
    echo "This will take 5-10 minutes..."
    echo ""
    brew install gcc
    
    # Check again
    for ver in 14 13 12 11; do
        if command -v gcc-$ver &> /dev/null; then
            GCC_VERSION=$ver
            break
        fi
    done
    
    if [ -z "$GCC_VERSION" ]; then
        echo "❌ GCC installation failed"
        exit 1
    fi
fi

GCC_PATH=$(which gcc-$GCC_VERSION)
GXX_PATH=$(which g++-$GCC_VERSION)

echo "✅ Found GCC $GCC_VERSION"
echo "   GCC: $GCC_PATH"
echo "   G++: $GXX_PATH"
echo ""

# Step 3: Verify we're in the right directory
echo "Step 3: Checking directory..."
if [ ! -d "planning-tools/downward" ]; then
    echo "❌ Error: planning-tools/downward not found"
    echo "Please run this script from the repository root:"
    echo "  cd ~/Desktop/planning-visualizer"
    echo "  ./fix_macos_gcc.sh"
    exit 1
fi
echo "✅ Directory OK"
echo ""

# Step 4: Clean old builds
echo "Step 4: Cleaning old builds..."
if [ -d "planning-tools/downward/builds" ]; then
    rm -rf planning-tools/downward/builds
    echo "✅ Cleaned builds directory"
else
    echo "✅ No old builds to clean"
fi
echo ""

# Step 5: Build with GCC
echo "Step 5: Building Fast Downward with GCC..."
echo "This will take 5-10 minutes..."
echo ""

cd planning-tools/downward

# Export compiler
export CC=$GCC_PATH
export CXX=$GXX_PATH

echo "Compiler configuration:"
echo "  CC=$CC"
echo "  CXX=$CXX"
echo ""

# Build
./build.py release

BUILD_EXIT_CODE=$?

cd ../..

echo ""
echo "======================================"
if [ $BUILD_EXIT_CODE -eq 0 ]; then
    echo "✅ SUCCESS! Fast Downward built with GCC"
    echo "======================================"
    echo ""
    echo "The planner is ready at:"
    echo "  planning-tools/downward/builds/release/bin/downward"
    echo ""
    echo "You can now run: ./run_new.sh"
else
    echo "❌ Build failed"
    echo "======================================"
    echo ""
    echo "Please share the error output above."
fi
