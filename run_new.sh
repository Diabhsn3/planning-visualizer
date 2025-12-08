#!/bin/bash

# Planning Visualizer - Quick Start Script (New Structure)
# This script sets up and runs both frontend and backend

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

# Step 1: Check Python
echo "Step 1: Checking Python installation..."
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

# Step 2: Check Node.js and pnpm
echo ""
echo "Step 2: Checking Node.js and pnpm..."
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

# Step 3: Install dependencies
echo ""
echo "Step 3: Installing dependencies..."

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

# Step 4: Check Fast Downward
echo ""
echo "Step 4: Checking Fast Downward planner..."
if [ -f "planning-tools/downward/fast-downward.py" ]; then
    # Check if binary exists (more reliable than just checking directory)
    if [ -f "planning-tools/downward/builds/release/bin/downward" ]; then
        echo "[OK] Fast Downward already built"
    else
        echo "[INFO] Fast Downward not built. Building now..."
        echo "This may take a few minutes..."
        cd planning-tools/downward
        
        # Capture build output to check for specific errors
        BUILD_OUTPUT=$(./build.py 2>&1)
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
    BUILD_OUTPUT=$(./build.py 2>&1)
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
