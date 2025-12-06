#!/bin/bash

# Planning Visualizer - Local Setup Script
# This script automates the setup process for running the Planning Visualizer locally

set -e  # Exit on error

echo "======================================"
echo "Planning Visualizer - Local Setup"
echo "======================================"
echo ""

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_info() {
    echo -e "ℹ $1"
}

# Step 1: Check Python installation
echo "Step 1: Checking Python installation..."
PYTHON_CMD=""

for cmd in python3 python python3.12 python3.11 python3.10; do
    if command -v $cmd &> /dev/null; then
        VERSION=$($cmd --version 2>&1)
        print_success "Found: $cmd ($VERSION)"
        PYTHON_CMD=$cmd
        break
    fi
done

if [ -z "$PYTHON_CMD" ]; then
    print_error "Python not found! Please install Python 3.10 or higher."
    exit 1
fi

# Step 2: Check Python version
echo ""
echo "Step 2: Verifying Python version..."
PYTHON_VERSION=$($PYTHON_CMD -c 'import sys; print(".".join(map(str, sys.version_info[:2])))')
PYTHON_MAJOR=$($PYTHON_CMD -c 'import sys; print(sys.version_info[0])')
PYTHON_MINOR=$($PYTHON_CMD -c 'import sys; print(sys.version_info[1])')

if [ "$PYTHON_MAJOR" -eq 3 ] && [ "$PYTHON_MINOR" -ge 10 ]; then
    print_success "Python version $PYTHON_VERSION is compatible"
else
    print_error "Python 3.10 or higher required (found $PYTHON_VERSION)"
    exit 1
fi

# Step 3: Create .env file
echo ""
echo "Step 3: Creating .env configuration..."
cd web-app

if [ -f ".env" ]; then
    print_warning ".env file already exists. Backing up to .env.backup"
    cp .env .env.backup
fi

echo "PYTHON_CMD=$PYTHON_CMD" > .env
print_success "Created .env file with PYTHON_CMD=$PYTHON_CMD"

cd ..

# Step 4: Check Node.js and pnpm
echo ""
echo "Step 4: Checking Node.js and pnpm..."

if ! command -v node &> /dev/null; then
    print_error "Node.js not found! Please install Node.js 18 or higher."
    exit 1
fi

NODE_VERSION=$(node --version)
print_success "Found Node.js $NODE_VERSION"

if ! command -v pnpm &> /dev/null; then
    print_warning "pnpm not found. Installing pnpm..."
    npm install -g pnpm
    print_success "pnpm installed"
else
    PNPM_VERSION=$(pnpm --version)
    print_success "Found pnpm $PNPM_VERSION"
fi

# Step 5: Check Fast Downward submodule
echo ""
echo "Step 5: Checking Fast Downward..."

if [ ! -d "planning-tools/downward" ] || [ ! "$(ls -A planning-tools/downward)" ]; then
    print_warning "Fast Downward not found. Initializing submodule..."
    git submodule update --init --recursive
    print_success "Fast Downward submodule initialized"
else
    print_success "Fast Downward submodule exists"
fi

# Step 6: Build Fast Downward
echo ""
echo "Step 6: Building Fast Downward..."

if [ ! -f "planning-tools/downward/fast-downward.py" ]; then
    print_error "Fast Downward source not found in planning-tools/downward/"
    print_info "Please ensure the submodule is properly initialized"
    exit 1
fi

cd planning-tools/downward

if [ -f "fast-downward.py" ]; then
    if [ ! -d "builds/release" ]; then
        print_info "Building Fast Downward (this may take 5-10 minutes)..."
        ./build.py
        print_success "Fast Downward built successfully"
    else
        print_success "Fast Downward already built"
    fi
else
    print_error "Fast Downward build script not found"
    exit 1
fi

cd ../..

# Step 7: Install Node.js dependencies
echo ""
echo "Step 7: Installing Node.js dependencies..."
cd web-app
pnpm install
print_success "Dependencies installed"
cd ..

# Step 8: Final summary
echo ""
echo "======================================"
echo "Setup Complete!"
echo "======================================"
echo ""
print_success "Python: $PYTHON_CMD ($PYTHON_VERSION)"
print_success "Node.js: $NODE_VERSION"
print_success "Fast Downward: Built"
print_success ".env file: Created"
echo ""
echo "To start the development server:"
echo "  cd web-app"
echo "  pnpm dev"
echo ""
echo "The application will be available at http://localhost:3000"
echo ""
print_info "Click 'Show System Status' in the app to verify everything is working"
echo ""
