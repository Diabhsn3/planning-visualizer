@echo off
REM Planning Visualizer - Easy Run Script for Windows
REM This script handles all setup and starts the web application

echo ======================================
echo   Planning Visualizer - Quick Start
echo ======================================
echo.

REM Change to web-app directory
cd /d "%~dp0web-app"

REM Step 1: Check Python
echo Step 1: Checking Python installation...
where python >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    for /f "tokens=2" %%i in ('python --version 2^>^&1') do set PYTHON_VERSION=%%i
    echo [OK] Found Python !PYTHON_VERSION!
    set PYTHON_CMD=python
) else (
    where python3 >nul 2>nul
    if %ERRORLEVEL% EQU 0 (
        for /f "tokens=2" %%i in ('python3 --version 2^>^&1') do set PYTHON_VERSION=%%i
        echo [OK] Found Python !PYTHON_VERSION!
        set PYTHON_CMD=python3
    ) else (
        echo [ERROR] Python not found. Please install Python 3.11 or higher.
        pause
        exit /b 1
    )
)

REM Step 2: Check Node.js and pnpm
echo.
echo Step 2: Checking Node.js and pnpm...
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js not found. Please install Node.js 18 or higher.
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
echo [OK] Found Node.js %NODE_VERSION%

where pnpm >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [INFO] pnpm not found. Installing pnpm...
    call npm install -g pnpm
)
echo [OK] pnpm is available

REM Step 3: Install dependencies
echo.
echo Step 3: Installing dependencies...
if not exist "node_modules" (
    echo Installing Node.js packages...
    call pnpm install
    echo [OK] Dependencies installed
) else (
    echo [OK] Dependencies already installed
)

REM Step 4: Check .env file
echo.
echo Step 4: Checking environment configuration...
if not exist ".env" (
    echo [INFO] Creating .env file...
    echo PYTHON_CMD=%PYTHON_CMD%> .env
    echo [OK] Created .env with PYTHON_CMD=%PYTHON_CMD%
) else (
    findstr /C:"PYTHON_CMD" .env >nul
    if %ERRORLEVEL% NEQ 0 (
        echo PYTHON_CMD=%PYTHON_CMD%>> .env
        echo [OK] Added PYTHON_CMD to .env
    ) else (
        echo [OK] .env file configured
    )
)

REM Step 5: Check Fast Downward
echo.
echo Step 5: Checking Fast Downward planner...
set DOWNWARD_PATH=..\planning-tools\downward
if exist "%DOWNWARD_PATH%\fast-downward.py" (
    if exist "%DOWNWARD_PATH%\builds\release\bin\downward.exe" (
        echo [OK] Fast Downward is built and ready
    ) else (
        echo [INFO] Fast Downward not built. Building now...
        echo This may take a few minutes...
        cd /d "%DOWNWARD_PATH%"
        python build.py
        cd /d "%~dp0web-app"
        echo [OK] Fast Downward built successfully
    )
) else (
    echo [INFO] Fast Downward not found. The app will use fallback mode.
    echo To enable Fast Downward, run: git submodule update --init --recursive
)

REM Step 6: Start the application
echo.
echo ======================================
echo [OK] All checks passed! Starting application...
echo ======================================
echo.
echo The application will open at: http://localhost:3000
echo Press Ctrl+C to stop the server
echo.

REM Start the dev server
call pnpm run dev
