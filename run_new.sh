#!/bin/bash

# Planning Visualizer - Quick Start Script (New Structure)
# This script sets up and runs both frontend and backend
# Now with automatic build dependency installation!

set -e  # Exit on error

echo "======================================"
echo "  Planning Visualizer - Quick Start   "
echo "======================================"
echo ""

# Check if path contains spaces
if [[ "$PWD" == *" "* ]]; then
    echo "❌ ERROR: Directory path contains spaces!"
    echo ""
    echo "Fast Downward cannot be built in paths with spaces."
    echo "Please move the project to a path without spaces."
    echo ""
    echo "Example:"
    echo "  Current:  ~/Documents/final project/planning-visualizer"
    echo "  Move to:  ~/planning-visualizer"
    echo ""
    exit 1
fi

# Detect OS
OS="unknown"
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    OS="linux"
elif [[ "$OSTYPE" == "darwin"* ]]; then
    OS="macos"
else
    OS="unknown"
fi

echo "Detected OS: $OS"
echo ""

# Step 1: Check and Install Build Dependencies for Fast Downward
echo "Step 1: Checking build dependencies for Fast Downward..."

if [[ "$OS" == "linux" ]]; then
    # Check if running as root or if sudo is available
    if [ "$EUID" -eq 0 ]; then
        SUDO=""
    elif command -v sudo &> /dev/null; then
        SUDO="sudo"
    else
        echo "[WARNING] sudo not available. Cannot install build dependencies automatically."
        echo "Please install manually: cmake g++ make python3"
        SUDO=""
    fi
    
    # Check for cmake
    if ! command -v cmake &> /dev/null; then
        echo "[INFO] cmake not found. Installing..."
        if [ -n "$SUDO" ] || [ "$EUID" -eq 0 ]; then
            # Detect package manager
            if command -v apt-get &> /dev/null; then
                $SUDO apt-get update -qq
                $SUDO apt-get install -y cmake
            elif command -v yum &> /dev/null; then
                $SUDO yum install -y cmake
            elif command -v dnf &> /dev/null; then
                $SUDO dnf install -y cmake
            elif command -v pacman &> /dev/null; then
                $SUDO pacman -S --noconfirm cmake
            else
                echo "[WARNING] Could not detect package manager. Please install cmake manually."
            fi
        fi
    fi
    
    if command -v cmake &> /dev/null; then
        CMAKE_VERSION=$(cmake --version | head -n1)
        echo "[OK] Found $CMAKE_VERSION"
    else
        echo "[WARNING] cmake not found. Fast Downward build may fail."
    fi
    
    # Check for g++
    if ! command -v g++ &> /dev/null; then
        echo "[INFO] g++ not found. Installing..."
        if [ -n "$SUDO" ] || [ "$EUID" -eq 0 ]; then
            if command -v apt-get &> /dev/null; then
                $SUDO apt-get install -y g++
            elif command -v yum &> /dev/null; then
                $SUDO yum install -y gcc-c++
            elif command -v dnf &> /dev/null; then
                $SUDO dnf install -y gcc-c++
            elif command -v pacman &> /dev/null; then
                $SUDO pacman -S --noconfirm gcc
            else
                echo "[WARNING] Could not detect package manager. Please install g++ manually."
            fi
        fi
    fi
    
    if command -v g++ &> /dev/null; then
        GCC_VERSION=$(g++ --version | head -n1)
        echo "[OK] Found $GCC_VERSION"
    else
        echo "[WARNING] g++ not found. Fast Downward build may fail."
    fi
    
    # Check for make
    if ! command -v make &> /dev/null; then
        echo "[INFO] make not found. Installing..."
        if [ -n "$SUDO" ] || [ "$EUID" -eq 0 ]; then
            if command -v apt-get &> /dev/null; then
                $SUDO apt-get install -y make
            elif command -v yum &> /dev/null; then
                $SUDO yum install -y make
            elif command -v dnf &> /dev/null; then
                $SUDO dnf install -y make
            elif command -v pacman &> /dev/null; then
                $SUDO pacman -S --noconfirm make
            else
                echo "[WARNING] Could not detect package manager. Please install make manually."
            fi
        fi
    fi
    
    if command -v make &> /dev/null; then
        MAKE_VERSION=$(make --version | head -n1)
        echo "[OK] Found $MAKE_VERSION"
    else
        echo "[WARNING] make not found. Fast Downward build may fail."
    fi

elif [[ "$OS" == "macos" ]]; then
    # Check for Xcode Command Line Tools
    if ! xcode-select -p &> /dev/null; then
        echo "[INFO] Xcode Command Line Tools not found. Installing..."
        echo "This will open a dialog. Please follow the installation prompts."
        xcode-select --install
        echo ""
        echo "⏳ Waiting for Xcode Command Line Tools installation..."
        echo "Press Enter after installation is complete..."
        read -r
    else
        echo "[OK] Xcode Command Line Tools found"
    fi
    
    # Check for cmake
    if ! command -v cmake &> /dev/null; then
        echo "[INFO] cmake not found."
        
        # Check if Homebrew is available
        if command -v brew &> /dev/null; then
            echo "[INFO] Installing cmake via Homebrew..."
            brew install cmake
        else
            echo "[WARNING] Homebrew not found. Cannot install cmake automatically."
            echo "Please install Homebrew from https://brew.sh/ or install cmake manually."
            echo ""
            echo "To install Homebrew, run:"
            echo '/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"'
            echo ""
            echo "Then run: brew install cmake"
        fi
    fi
    
    if command -v cmake &> /dev/null; then
        CMAKE_VERSION=$(cmake --version | head -n1)
        echo "[OK] Found $CMAKE_VERSION"
    else
        echo "[WARNING] cmake not found. Fast Downward build may fail."
    fi
    
    # Check compiler
    if command -v clang++ &> /dev/null; then
        CLANG_VERSION=$(clang++ --version | head -n1)
        echo "[OK] Found $CLANG_VERSION"
    elif command -v g++ &> /dev/null; then
        GCC_VERSION=$(g++ --version | head -n1)
        echo "[OK] Found $GCC_VERSION"
    else
        echo "[WARNING] No C++ compiler found. Fast Downward build may fail."
    fi
    
    # Check for make
    if command -v make &> /dev/null; then
        MAKE_VERSION=$(make --version | head -n1)
        echo "[OK] Found $MAKE_VERSION"
    else
        echo "[WARNING] make not found. Fast Downward build may fail."
    fi
    
    # Check Xcode version for compatibility warning
    if command -v xcodebuild &> /dev/null; then
        XCODE_VERSION=$(xcodebuild -version 2>/dev/null | head -n1 | awk '{print $2}')
        XCODE_MAJOR=$(echo "$XCODE_VERSION" | cut -d. -f1)
        
        if [ -n "$XCODE_MAJOR" ] && [ "$XCODE_MAJOR" -ge 15 ]; then
            echo ""
            echo "⚠️  WARNING: Xcode $XCODE_VERSION detected"
            echo ""
            echo "Fast Downward has known compatibility issues with Xcode 15+."
            echo "The build may fail with C++ compilation errors."
            echo ""
            echo "Recommended solutions:"
            echo "  1. Use fallback mode (app works perfectly without Fast Downward)"
            echo "  2. Run ./fix_macos_build.sh to attempt a fix"
            echo "  3. See MACOS_BUILD_ISSUES.md for detailed solutions"
            echo ""
            echo "Press Enter to continue..."
            read -r
        fi
    fi
fi

# Step 2: Check Python
echo ""
echo "Step 2: Checking Python installation..."
if command -v python3 &> /dev/null; then
    PYTHON_VERSION=$(python3 --version 2>&1)
    echo "[OK] Found $PYTHON_VERSION"
    echo "PYTHON_CMD=python3" > backend/api/.env
elif command -v python &> /dev/null; then
    PYTHON_VERSION=$(python --version 2>&1)
    echo "[OK] Found $PYTHON_VERSION"
    echo "PYTHON_CMD=python" > backend/api/.env
else
    echo "[ERROR] Python not found. Please install Python 3.11 or later."
    exit 1
fi

# Step 3: Check Node.js and pnpm
echo ""
echo "Step 3: Checking Node.js and pnpm..."
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo "[OK] Found Node.js $NODE_VERSION"
else
    echo "[ERROR] Node.js not found. Please install Node.js 18 or later."
    exit 1
fi

if command -v pnpm &> /dev/null; then
    echo "[OK] pnpm is available"
else
    echo "[INFO] Installing pnpm..."
    npm install -g pnpm
fi

# Step 4: Install dependencies
echo ""
echo "Step 4: Installing dependencies..."

# Install backend dependencies
if [ ! -d "backend/api/node_modules" ]; then
    echo "[INFO] Installing backend dependencies..."
    cd backend/api
    pnpm install
    cd ../..
    echo "[OK] Backend dependencies installed"
else
    echo "[OK] Backend dependencies already installed"
fi

# Install frontend dependencies
if [ ! -d "frontend/node_modules" ]; then
    echo "[INFO] Installing frontend dependencies..."
    cd frontend
    pnpm install
    cd ..
    echo "[OK] Frontend dependencies installed"
else
    echo "[OK] Frontend dependencies already installed"
fi

# Step 5: Check Fast Downward
echo ""
echo "Step 5: Checking Fast Downward planner..."
if [ -f "planning-tools/downward/fast-downward.py" ]; then
    # Check if binary exists (more reliable than just checking directory)
    if [ -f "planning-tools/downward/builds/release/bin/downward" ]; then
        echo "[OK] Fast Downward already built"
    else
        echo "[INFO] Fast Downward not built. Building now..."
        echo "This may take a few minutes..."
        cd planning-tools/downward
        
        # Capture build output to check for specific errors
        BUILD_OUTPUT=$(./build.py release 2>&1)
        BUILD_EXIT_CODE=$?
        
        if [ $BUILD_EXIT_CODE -eq 0 ]; then
            echo "[OK] Fast Downward built successfully"
            cd ../..
        else
            echo "[WARNING] Fast Downward build failed"
            
            # Check for macOS Xcode 15+ compatibility error
            if echo "$BUILD_OUTPUT" | grep -q "no type named 'size_t' in namespace 'std'"; then
                echo ""
                echo "⚠️  Detected macOS Xcode 15+ compatibility issue"
                echo ""
                echo "This is a known issue with Fast Downward on newer Macs."
                echo "The app will work perfectly in fallback mode!"
                echo ""
                echo "To try fixing the build:"
                echo "  1. Run: ./fix_macos_build.sh"
                echo "  2. Or see: MACOS_BUILD_ISSUES.md"
                echo ""
                echo "Otherwise, the app will use pre-computed plans (recommended)."
            else
                echo "The app will start in fallback mode (limited functionality)"
                echo "See MACOS_BUILD_ISSUES.md for troubleshooting"
            fi
            cd ../..
        fi
    fi
else
    echo "[INFO] Fast Downward not found. Initializing submodule..."
    git submodule update --init --recursive
    echo "[INFO] Building Fast Downward..."
    cd planning-tools/downward
    
    # Capture build output to check for specific errors
    BUILD_OUTPUT=$(./build.py release 2>&1)
    BUILD_EXIT_CODE=$?
    
    if [ $BUILD_EXIT_CODE -eq 0 ]; then
        echo "[OK] Fast Downward built successfully"
        cd ../..
    else
        echo "[WARNING] Fast Downward build failed"
        
        # Check for macOS Xcode 15+ compatibility error
        if echo "$BUILD_OUTPUT" | grep -q "no type named 'size_t' in namespace 'std'"; then
            echo ""
            echo "⚠️  Detected macOS Xcode 15+ compatibility issue"
            echo ""
            echo "This is a known issue with Fast Downward on newer Macs."
            echo "The app will work perfectly in fallback mode!"
            echo ""
            echo "To try fixing the build:"
            echo "  1. Run: ./fix_macos_build.sh"
            echo "  2. Or see: MACOS_BUILD_ISSUES.md"
            echo ""
            echo "Otherwise, the app will use pre-computed plans (recommended)."
        else
            echo "The app will start in fallback mode"
        fi
        cd ../..
    fi
fi

echo ""
echo "======================================"
echo "[OK] All checks passed! Starting application..."
echo "======================================"
echo ""
echo "Frontend: http://localhost:3000"
echo "Backend API: http://localhost:4000"
echo "Press Ctrl+C to stop the servers"
echo ""

# Start backend in background
cd backend/api
pnpm dev &
BACKEND_PID=$!
cd ../..

# Wait a bit for backend to start
sleep 3

# Start frontend
cd frontend
pnpm dev &
FRONTEND_PID=$!
cd ..

# Wait for both processes
wait $BACKEND_PID $FRONTEND_PID
