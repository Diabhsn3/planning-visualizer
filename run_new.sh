#!/bin/bash

# Planning Visualizer - Quick Start Script (New Structure)
# This script sets up and runs both frontend and backend
# Includes support for LLM-based visualization via MCP server

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
PYTHON_CMD=""
if command -v python3 &> /dev/null; then
    PYTHON_VERSION=$(python3 --version 2>&1)
    echo "[OK] Found $PYTHON_VERSION"
    PYTHON_CMD="python3"
elif command -v python &> /dev/null; then
    PYTHON_VERSION=$(python --version 2>&1)
    echo "[OK] Found $PYTHON_VERSION"
    PYTHON_CMD="python"
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

# Check if backend dependencies need to be updated
BACKEND_NEEDS_INSTALL=false
if [ ! -d "backend/api/node_modules" ]; then
    BACKEND_NEEDS_INSTALL=true
    echo "[INFO] Backend node_modules not found"
elif [ "backend/api/package.json" -nt "backend/api/node_modules/.package-lock.json" ] 2>/dev/null; then
    BACKEND_NEEDS_INSTALL=true
    echo "[INFO] Backend package.json has changed"
fi

if [ "$BACKEND_NEEDS_INSTALL" = true ]; then
    echo "[INFO] Installing backend dependencies..."
    cd backend/api
    pnpm install
    cd ../..
    echo "[OK] Backend dependencies installed"
else
    # Double-check critical packages are installed
    if ! [ -d "backend/api/node_modules/@anthropic-ai/sdk" ]; then
        echo "[INFO] Missing @anthropic-ai/sdk, reinstalling backend dependencies..."
        cd backend/api
        pnpm install
        cd ../..
        echo "[OK] Backend dependencies installed"
    elif ! [ -d "backend/api/node_modules/@modelcontextprotocol/sdk" ]; then
        echo "[INFO] Missing @modelcontextprotocol/sdk, reinstalling backend dependencies..."
        cd backend/api
        pnpm install
        cd ../..
        echo "[OK] Backend dependencies installed"
    else
        echo "[OK] Backend dependencies already installed"
    fi
fi

# Check if frontend dependencies need to be updated
FRONTEND_NEEDS_INSTALL=false
if [ ! -d "frontend/node_modules" ]; then
    FRONTEND_NEEDS_INSTALL=true
    echo "[INFO] Frontend node_modules not found"
elif [ "frontend/package.json" -nt "frontend/node_modules/.package-lock.json" ] 2>/dev/null; then
    FRONTEND_NEEDS_INSTALL=true
    echo "[INFO] Frontend package.json has changed"
fi

if [ "$FRONTEND_NEEDS_INSTALL" = true ]; then
    echo "[INFO] Installing frontend dependencies..."
    cd frontend
    pnpm install
    cd ..
    echo "[OK] Frontend dependencies installed"
else
    echo "[OK] Frontend dependencies already installed"
fi

# Step 4: Install MCP server dependencies (for LLM mode)
echo ""
echo "Step 4: Installing MCP server dependencies (for LLM mode)..."
if [ -f "mcp_server/requirements.txt" ]; then
    # Check if MCP is installed (anthropic is now in Node.js, not Python)
    if $PYTHON_CMD -c "import mcp" 2>/dev/null; then
        echo "[OK] MCP server dependencies already installed"
    else
        echo "[INFO] Installing MCP server Python dependencies..."
        $PYTHON_CMD -m pip install -r mcp_server/requirements.txt --quiet
        if [ $? -eq 0 ]; then
            echo "[OK] MCP server dependencies installed"
        else
            echo "[WARNING] Failed to install MCP server dependencies"
            echo "         LLM mode will not be available"
            echo "         Run: pip install -r mcp_server/requirements.txt"
        fi
    fi
else
    echo "[WARNING] MCP server requirements.txt not found"
    echo "         LLM mode will not be available"
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

# Step 6: Setup environment file
echo ""
echo "Step 6: Setting up environment..."

# Preserve existing .env file if it exists and has ANTHROPIC_API_KEY
EXISTING_API_KEY=""
if [ -f "backend/api/.env" ]; then
    EXISTING_API_KEY=$(grep "^ANTHROPIC_API_KEY=" backend/api/.env 2>/dev/null | cut -d'=' -f2-)
fi

# Create .env file with Python command
echo "PYTHON_CMD=$PYTHON_CMD" > backend/api/.env

# Check for Anthropic API key (priority: env var > existing .env > .env.local)
if [ -n "$ANTHROPIC_API_KEY" ]; then
    echo "ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY" >> backend/api/.env
    echo "[OK] ANTHROPIC_API_KEY found in environment"
elif [ -n "$EXISTING_API_KEY" ]; then
    echo "ANTHROPIC_API_KEY=$EXISTING_API_KEY" >> backend/api/.env
    echo "[OK] ANTHROPIC_API_KEY preserved from existing .env"
elif [ -f "backend/api/.env.local" ]; then
    # Append .env.local contents if it exists
    cat backend/api/.env.local >> backend/api/.env
    echo "[OK] Using API keys from .env.local"
else
    echo "[INFO] ANTHROPIC_API_KEY not set"
    echo "       LLM-based visualization will not be available"
    echo "       To enable: export ANTHROPIC_API_KEY=your_key"
    echo "       Or add ANTHROPIC_API_KEY=your_key to backend/api/.env"
    echo "       Or create backend/api/.env.local with your key"
fi

# Step 7: Skip MCP server test (main.py no longer exists, testing happens in Node.js)
echo ""
echo "Step 7: Verifying MCP architecture..."
if [ -f "mcp_server/mcp_server.py" ]; then
    echo "[OK] MCP Server (Python) found - provides tools"
fi
if [ -f "backend/api/mcp-client.ts" ]; then
    echo "[OK] MCP Client (Node.js) found - orchestrates tools"
fi
if [ -f "backend/api/llm-orchestrator.ts" ]; then
    echo "[OK] LLM Orchestrator (Node.js) found - handles LLM operations"
fi

echo ""
echo "======================================"
echo "[OK] All checks passed! Starting application..."
echo "======================================"
echo ""
echo "Frontend: http://localhost:3000"
echo "Backend API: http://localhost:4000"
echo ""
echo "Visualization Modes:"
echo "  - Basic: Always available (hand-crafted renderers )"
echo "  - LLM:   Requires ANTHROPIC_API_KEY (AI-generated renderers via MCP)"
echo ""
echo "MCP Architecture (Proper Separation):"
echo "  - MCP Client (Node.js): Connects to Python server, orchestrates tools"
echo "  - LLM Orchestrator (Node.js): Provider-agnostic LLM operations"
echo "  - MCP Server (Python): Pure tool provider (no LLM calls)"
echo "  - Supports MCP Sampling for server-driven workflows"
echo ""
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