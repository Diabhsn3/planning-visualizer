#!/bin/bash

# Planning Visualizer - Easy Run Script for Mac/Linux
# This script handles all setup and starts the web application

set -e  # Exit on error

echo "======================================"
echo "  Planning Visualizer - Quick Start"
echo "======================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check for spaces in directory path
CURRENT_DIR="$(cd "$(dirname "$0")" && pwd)"
# if [[ "$CURRENT_DIR" == *" "* ]]; then
#     echo -e "${RED}✗ ERROR: Directory path contains spaces${NC}"
#     echo ""
#     echo "Current path: $CURRENT_DIR"
#     echo ""
#     echo "Fast Downward cannot be built in directories with spaces in the path."
#     echo "Please move the project to a path without spaces, for example:"
#     echo "  ~/planning-visualizer"
#     echo "  ~/projects/planning-visualizer"
#     echo "  ~/Documents/planning-visualizer (no spaces in any parent folder)"
#     echo ""
#     exit 1
# fi

# Change to web-app directory
cd "$(dirname "$0")/web-app"

# Step 1: Check Python
echo "Step 1: Checking Python installation..."
if command -v python3 &> /dev/null; then
    PYTHON_VERSION=$(python3 --version 2>&1 | awk '{print $2}')
    echo -e "${GREEN}✓${NC} Found Python $PYTHON_VERSION"
    PYTHON_CMD="python3"
elif command -v python &> /dev/null; then
    PYTHON_VERSION=$(python --version 2>&1 | awk '{print $2}')
    echo -e "${GREEN}✓${NC} Found Python $PYTHON_VERSION"
    PYTHON_CMD="python"
else
    echo -e "${RED}✗${NC} Python not found. Please install Python 3.11 or higher."
    exit 1
fi

# Step 2: Check Node.js and pnpm
echo ""
echo "Step 2: Checking Node.js and pnpm..."
if ! command -v node &> /dev/null; then
    echo -e "${RED}✗${NC} Node.js not found. Please install Node.js 18 or higher."
    exit 1
fi
NODE_VERSION=$(node --version)
echo -e "${GREEN}✓${NC} Found Node.js $NODE_VERSION"

if ! command -v pnpm &> /dev/null; then
    echo -e "${YELLOW}!${NC} pnpm not found. Installing pnpm..."
    npm install -g pnpm
fi
echo -e "${GREEN}✓${NC} pnpm is available"

# Step 3: Install dependencies
echo ""
echo "Step 3: Installing dependencies..."
if [ ! -d "node_modules" ]; then
    echo "Installing Node.js packages..."
    pnpm install
    echo -e "${GREEN}✓${NC} Dependencies installed"
else
    echo -e "${GREEN}✓${NC} Dependencies already installed"
fi

# Step 4: Check .env file
echo ""
echo "Step 4: Checking environment configuration..."
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}!${NC} Creating .env file..."
    echo "PYTHON_CMD=$PYTHON_CMD" > .env
    echo -e "${GREEN}✓${NC} Created .env with PYTHON_CMD=$PYTHON_CMD"
else
    if ! grep -q "PYTHON_CMD" .env; then
        echo "PYTHON_CMD=$PYTHON_CMD" >> .env
        echo -e "${GREEN}✓${NC} Added PYTHON_CMD to .env"
    else
        echo -e "${GREEN}✓${NC} .env file configured"
    fi
fi

# Step 5: Check Fast Downward
echo ""
echo "Step 5: Checking Fast Downward planner..."
DOWNWARD_PATH="../planning-tools/downward"
if [ -f "$DOWNWARD_PATH/fast-downward.py" ]; then
    if [ -f "$DOWNWARD_PATH/builds/release/bin/downward" ]; then
        echo -e "${GREEN}✓${NC} Fast Downward is built and ready"
    else
        echo -e "${YELLOW}!${NC} Fast Downward not built. Building now..."
        echo "This may take a few minutes..."
        cd "$DOWNWARD_PATH"
        if ./build.py; then
            echo -e "${GREEN}✓${NC} Fast Downward built successfully"
        else
            echo -e "${YELLOW}!${NC} Fast Downward build failed"
            echo ""
            echo "This is a known issue with newer macOS versions."
            echo "The app will run in fallback mode (limited functionality)."
            echo ""
            echo "See SETUP_MAC.md troubleshooting section for solutions."
        fi
        cd - > /dev/null
    fi
else
    echo -e "${YELLOW}!${NC} Fast Downward not found. The app will use fallback mode."
    echo "To enable Fast Downward, run: git submodule update --init --recursive"
fi

# Step 6: Start the application
echo ""
echo "======================================"
echo -e "${GREEN}✓${NC} All checks passed! Starting application..."
echo "======================================"
echo ""
echo "The application will open at: http://localhost:3000"
echo "Press Ctrl+C to stop the server"
echo ""

# Start the dev server
pnpm run dev
