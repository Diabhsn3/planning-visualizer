@echo off
setlocal enabledelayedexpansion

REM Planning Visualizer - Quick Start Script (New Structure)
REM This script sets up and runs both frontend and backend

echo ======================================
echo   Planning Visualizer - Quick Start   
echo ======================================
echo.

REM Check if path contains spaces
set "current_path=%CD%"
echo !current_path! | findstr /C:" " >nul
if !errorlevel! equ 0 (
    echo [ERROR] Directory path contains spaces!
    echo.
    echo Fast Downward cannot be built in paths with spaces.
    echo Please move the project to a path without spaces.
    echo.
    echo Example:
    echo   Current:  C:\Users\Name\Documents\final project\planning-visualizer
    echo   Move to:  C:\planning-visualizer
    echo.
    pause
    exit /b 1
)

REM Step 1: Check Python
echo Step 1: Checking Python installation...
where python >nul 2>&1
if !errorlevel! equ 0 (
    for /f "tokens=*" %%i in ('python --version 2^>^&1') do set PYTHON_VERSION=%%i
    echo [OK] Found !PYTHON_VERSION!
    echo PYTHON_CMD=python > backend\api\.env
    set PYTHON_CMD=python
) else (
    where python3 >nul 2>&1
    if !errorlevel! equ 0 (
        for /f "tokens=*" %%i in ('python3 --version 2^>^&1') do set PYTHON_VERSION=%%i
        echo [OK] Found !PYTHON_VERSION!
        echo PYTHON_CMD=python3 > backend\api\.env
        set PYTHON_CMD=python3
    ) else (
        echo [ERROR] Python not found. Please install Python 3.11 or later.
        pause
        exit /b 1
    )
)

REM Step 2: Check Node.js and pnpm
echo.
echo Step 2: Checking Node.js and pnpm...
where node >nul 2>&1
if !errorlevel! neq 0 (
    echo [ERROR] Node.js not found. Please install Node.js 18 or later.
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
echo [OK] Found Node.js !NODE_VERSION!

where pnpm >nul 2>&1
if !errorlevel! neq 0 (
    echo [INFO] Installing pnpm...
    npm install -g pnpm
)
echo [OK] pnpm is available

REM Step 3: Install dependencies
echo.
echo Step 3: Installing dependencies...

REM Install backend dependencies
if not exist "backend\api\node_modules" (
    echo [INFO] Installing backend dependencies...
    cd backend\api
    pnpm install
    if !errorlevel! neq 0 (
        echo [ERROR] Failed to install backend dependencies
        cd ..\..
        pause
        exit /b 1
    )
    cd ..\..
    echo [OK] Backend dependencies installed
) else (
    echo [OK] Backend dependencies already installed
)

REM Install frontend dependencies
if not exist "frontend\node_modules" (
    echo [INFO] Installing frontend dependencies...
    cd frontend
    pnpm install
    if !errorlevel! neq 0 (
        echo [ERROR] Failed to install frontend dependencies
        cd ..
        pause
        exit /b 1
    )
    cd ..
    echo [OK] Frontend dependencies installed
) else (
    echo [OK] Frontend dependencies already installed
)

REM Step 4: Check Visual Studio Build Tools (for Fast Downward)
echo.
echo Step 4: Checking Visual Studio Build Tools...
where nmake >nul 2>&1
if !errorlevel! neq 0 (
    echo [WARNING] Visual Studio Build Tools not found
    echo.
    echo Fast Downward requires Visual Studio Build Tools with C++ support.
    echo The app will start in fallback mode ^(limited functionality^).
    echo.
    echo To install Visual Studio Build Tools:
    echo 1. Download from: https://visualstudio.microsoft.com/downloads/
    echo 2. Select "Build Tools for Visual Studio 2022"
    echo 3. Install "Desktop development with C++" workload
    echo 4. Restart your computer after installation
    echo.
    echo Press any key to continue in fallback mode...
    pause >nul
) else (
    echo [OK] Visual Studio Build Tools found
)

REM Step 5: Check Fast Downward
echo.
echo Step 5: Checking Fast Downward planner...
if exist "planning-tools\downward\fast-downward.py" (
    if exist "planning-tools\downward\builds\release" (
        echo [OK] Fast Downward already built
    ) else (
        echo [INFO] Fast Downward not built. Building now...
        echo This may take a few minutes...
        cd planning-tools\downward
        python build.py 2^>^&1
        if !errorlevel! neq 0 (
            echo [WARNING] Fast Downward build failed
            echo The app will start in fallback mode ^(limited functionality^)
            echo See SETUP_WINDOWS.md for troubleshooting
        ) else (
            echo [OK] Fast Downward built successfully
        )
        cd ..\..
    )
) else (
    echo [INFO] Fast Downward not found. Initializing submodule...
    git submodule update --init --recursive
    echo [INFO] Building Fast Downward...
    cd planning-tools\downward
    python build.py 2^>^&1
    if !errorlevel! neq 0 (
        echo [WARNING] Fast Downward build failed
        echo The app will start in fallback mode
    ) else (
        echo [OK] Fast Downward built successfully
    )
    cd ..\..
)

echo.
echo ======================================
echo [OK] All checks passed! Starting application...
echo ======================================
echo.
echo The application will open at: http://localhost:3000
echo Press Ctrl+C to stop the servers
echo.

REM Start backend in background
echo Starting backend server...
cd backend\api
start /B pnpm dev
cd ..\..

REM Wait a bit for backend to start
timeout /t 3 /nobreak >nul

REM Start frontend
echo Starting frontend server...
cd frontend
pnpm dev
cd ..
