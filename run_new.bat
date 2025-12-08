@echo off
setlocal enabledelayedexpansion

REM Planning Visualizer - Quick Start Script (New Structure)
REM This script sets up and runs both frontend and backend
REM Now with automatic build dependency checking and installation guidance!

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

REM Step 1: Check and Install Build Dependencies for Fast Downward
echo Step 1: Checking build dependencies for Fast Downward...
echo.

REM Check for CMake
where cmake >nul 2>&1
if !errorlevel! neq 0 (
    echo [INFO] CMake not found. Attempting to install via winget...
    
    REM Check if winget is available (Windows 10 1809+ / Windows 11)
    where winget >nul 2>&1
    if !errorlevel! equ 0 (
        echo Installing CMake via Windows Package Manager...
        winget install --id Kitware.CMake -e --silent --accept-package-agreements --accept-source-agreements
        
        REM Refresh PATH
        call refreshenv >nul 2>&1
        
        REM Check again
        where cmake >nul 2>&1
        if !errorlevel! equ 0 (
            echo [OK] CMake installed successfully
        ) else (
            echo [WARNING] CMake installation may require a system restart
            echo Please restart your terminal or computer after this script completes
        )
    ) else (
        echo [WARNING] winget not available. Please install CMake manually.
        echo Download from: https://cmake.org/download/
        echo.
    )
) else (
    for /f "tokens=*" %%i in ('cmake --version 2^>^&1 ^| findstr /R "version"') do set CMAKE_VERSION=%%i
    echo [OK] Found CMake !CMAKE_VERSION!
)

REM Check for Visual Studio Build Tools
echo.
echo Checking for Visual Studio Build Tools...

set VS_FOUND=0

REM Check for VS 2022
if exist "C:\Program Files\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvars64.bat" (
    set VS_FOUND=1
    set VS_VERSION=2022 BuildTools
)
if exist "C:\Program Files\Microsoft Visual Studio\2022\Community\VC\Auxiliary\Build\vcvars64.bat" (
    set VS_FOUND=1
    set VS_VERSION=2022 Community
)
if exist "C:\Program Files\Microsoft Visual Studio\2022\Professional\VC\Auxiliary\Build\vcvars64.bat" (
    set VS_FOUND=1
    set VS_VERSION=2022 Professional
)
if exist "C:\Program Files\Microsoft Visual Studio\2022\Enterprise\VC\Auxiliary\Build\vcvars64.bat" (
    set VS_FOUND=1
    set VS_VERSION=2022 Enterprise
)

REM Check for VS 2019
if !VS_FOUND! equ 0 (
    if exist "C:\Program Files (x86)\Microsoft Visual Studio\2019\BuildTools\VC\Auxiliary\Build\vcvars64.bat" (
        set VS_FOUND=1
        set VS_VERSION=2019 BuildTools
    )
    if exist "C:\Program Files (x86)\Microsoft Visual Studio\2019\Community\VC\Auxiliary\Build\vcvars64.bat" (
        set VS_FOUND=1
        set VS_VERSION=2019 Community
    )
)

REM Check for VS 2017
if !VS_FOUND! equ 0 (
    if exist "C:\Program Files (x86)\Microsoft Visual Studio\2017\BuildTools\VC\Auxiliary\Build\vcvars64.bat" (
        set VS_FOUND=1
        set VS_VERSION=2017 BuildTools
    )
    if exist "C:\Program Files (x86)\Microsoft Visual Studio\2017\Community\VC\Auxiliary\Build\vcvars64.bat" (
        set VS_FOUND=1
        set VS_VERSION=2017 Community
    )
)

if !VS_FOUND! equ 1 (
    echo [OK] Found Visual Studio !VS_VERSION!
) else (
    echo [WARNING] Visual Studio Build Tools not found
    echo.
    echo Fast Downward requires Visual Studio Build Tools with C++ support.
    echo The app will start in fallback mode if not installed.
    echo.
    
    REM Check if winget is available for automatic installation
    where winget >nul 2>&1
    if !errorlevel! equ 0 (
        echo Would you like to install Visual Studio Build Tools 2022 now?
        echo This will download and install approximately 2-3 GB of tools.
        echo.
        echo Press Y to install automatically, or N to skip and continue in fallback mode.
        choice /C YN /N /M "Install Build Tools? (Y/N): "
        
        if !errorlevel! equ 1 (
            echo.
            echo Installing Visual Studio Build Tools 2022...
            echo This may take 10-30 minutes depending on your internet speed.
            echo.
            
            REM Install Build Tools with C++ workload
            winget install --id Microsoft.VisualStudio.2022.BuildTools ^
                --override "--quiet --wait --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended" ^
                --accept-package-agreements --accept-source-agreements
            
            if !errorlevel! equ 0 (
                echo.
                echo [OK] Visual Studio Build Tools installed successfully
                echo [INFO] Please restart your terminal for changes to take effect
                echo.
                set VS_FOUND=1
            ) else (
                echo.
                echo [WARNING] Installation may have failed or requires manual completion
                echo Please check the Visual Studio Installer for status
                echo.
            )
        ) else (
            echo.
            echo Skipping Build Tools installation. App will run in fallback mode.
            echo.
        )
    ) else (
        echo To install Visual Studio Build Tools manually:
        echo 1. Download from: https://visualstudio.microsoft.com/downloads/
        echo 2. Scroll down to "All Downloads" ^> "Tools for Visual Studio"
        echo 3. Download "Build Tools for Visual Studio 2022"
        echo 4. Run the installer and select "Desktop development with C++"
        echo 5. Restart your computer after installation
        echo.
        echo Alternatively, install via command line:
        echo   winget install Microsoft.VisualStudio.2022.BuildTools --override "--quiet --add Microsoft.VisualStudio.Workload.VCTools"
        echo.
        echo Press any key to continue in fallback mode...
        pause >nul
    )
)

REM Step 2: Check Python
echo.
echo Step 2: Checking Python installation...
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
        echo Download from: https://www.python.org/downloads/windows/
        pause
        exit /b 1
    )
)

REM Step 3: Check Node.js and pnpm
echo.
echo Step 3: Checking Node.js and pnpm...
where node >nul 2>&1
if !errorlevel! neq 0 (
    echo [ERROR] Node.js not found. Please install Node.js 18 or later.
    echo Download from: https://nodejs.org/
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

REM Step 4: Install dependencies
echo.
echo Step 4: Installing dependencies...

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

REM Step 5: Check Fast Downward
echo.
echo Step 5: Checking Fast Downward planner...
if exist "planning-tools\downward\fast-downward.py" (
    if exist "planning-tools\downward\builds\release\bin\downward.exe" (
        echo [OK] Fast Downward already built
    ) else (
        if !VS_FOUND! equ 1 (
            echo [INFO] Fast Downward not built. Building now...
            echo This may take 5-10 minutes...
            cd planning-tools\downward
            
            REM Build using Python
            !PYTHON_CMD! build.py release 2^>^&1
            if !errorlevel! neq 0 (
                echo [WARNING] Fast Downward build failed
                echo The app will start in fallback mode
                echo.
                echo Common issues:
                echo - Build Tools not properly configured
                echo - Run this script from "Developer PowerShell for VS"
                echo - Or restart your computer after installing Build Tools
            ) else (
                echo [OK] Fast Downward built successfully
            )
            cd ..\..
        ) else (
            echo [INFO] Visual Studio Build Tools not available
            echo Skipping Fast Downward build. App will run in fallback mode.
        )
    )
) else (
    echo [INFO] Fast Downward not found. Initializing submodule...
    git submodule update --init --recursive
    
    if !VS_FOUND! equ 1 (
        echo [INFO] Building Fast Downward...
        cd planning-tools\downward
        !PYTHON_CMD! build.py release 2^>^&1
        if !errorlevel! neq 0 (
            echo [WARNING] Fast Downward build failed
            echo The app will start in fallback mode
        ) else (
            echo [OK] Fast Downward built successfully
        )
        cd ..\..
    ) else (
        echo [INFO] Visual Studio Build Tools not available
        echo Skipping Fast Downward build. App will run in fallback mode.
    )
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
