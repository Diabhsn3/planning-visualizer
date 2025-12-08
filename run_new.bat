@echo off
setlocal enabledelayedexpansion

echo ======================================
echo   Planning Visualizer - Quick Start
echo ======================================

:: Step 1: Check Python
echo.
echo Step 1: Checking Python installation...
where python >nul 2>nul
if %errorlevel%==0 (
    for /f "tokens=*" %%i in ('python --version') do set PYVER=%%i
    echo [OK] Found %PYVER%
    echo PYTHON_CMD=python > backend\api\.env
) else (
    echo [ERROR] Python not found. Please install Python 3.11 or later.
    exit /b
)

:: Step 2: Check Node.js and pnpm
echo.
echo Step 2: Checking Node.js and pnpm...
where node >nul 2>nul
if %errorlevel%==0 (
    for /f "tokens=*" %%i in ('node --version') do set NODEVER=%%i
    echo [OK] Found Node.js %NODEVER%
) else (
    echo [ERROR] Node.js not found. Please install Node.js 18 or later.
    exit /b
)

where pnpm >nul 2>nul
if %errorlevel%==0 (
    echo [OK] pnpm is available
) else (
    echo [INFO] Installing pnpm...
    npm install -g pnpm
)

:: Step 3: Install dependencies
echo.
echo Step 3: Installing dependencies...

if not exist backend\api\node_modules (
    echo [INFO] Installing backend dependencies...
    pushd backend\api
    pnpm install
    popd
) else (
    echo [OK] Backend dependencies already installed
)

if not exist frontend\node_modules (
    echo [INFO] Installing frontend dependencies...
    pushd frontend
    pnpm install
    popd
) else (
    echo [OK] Frontend dependencies already installed
)

:: Step 4: Setup VS Build Tools
echo.
echo Step 4: Checking Visual Studio Build Tools...

set "VS_BUILDTOOLS_PATH=%ProgramFiles(x86)%\Microsoft Visual Studio\2022\BuildTools"
if exist "%VS_BUILDTOOLS_PATH%\VC\Auxiliary\Build\vcvarsall.bat" (
    call "%VS_BUILDTOOLS_PATH%\VC\Auxiliary\Build\vcvarsall.bat" x64 >nul
)

where cl >nul 2>nul
if %errorlevel%==0 (
    echo [OK] Visual Studio Build Tools with C++ found
) else (
    echo [WARNING] Visual Studio Build Tools not found
    echo Fast Downward may not compile properly.
    pause
)

:: Step 5: Start backend and frontend
echo.
echo ======================================
echo [OK] All checks passed! Starting app...
echo ======================================

echo Frontend: http://localhost:3000
echo Backend API: http://localhost:4000
echo Press Ctrl+C to stop the servers
echo.

:: Start backend
start "Backend" cmd /k "cd backend\api && pnpm dev"

:: Start frontend
start "Frontend" cmd /k "cd frontend && pnpm dev"
