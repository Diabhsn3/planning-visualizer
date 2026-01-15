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
    echo [OK] Found !PYVER!
    set PYTHON_CMD=python
) else (
    echo [ERROR] Python not found. Please install Python 3.11 or later.
    pause
    exit /b
)

:: Step 2: Check Node.js and pnpm
echo.
echo Step 2: Checking Node.js and pnpm...
where node >nul 2>nul
if %errorlevel%==0 (
    for /f "tokens=*" %%i in ('node --version') do set NODEVER=%%i
    echo [OK] Found Node.js !NODEVER!
) else (
    echo [ERROR] Node.js not found. Please install Node.js 18 or later.
    pause
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

:: Check if backend dependencies need to be installed or updated
set BACKEND_NEEDS_INSTALL=0
if not exist backend\api\node_modules (
    set BACKEND_NEEDS_INSTALL=1
    echo [INFO] Backend node_modules not found
)

if !BACKEND_NEEDS_INSTALL!==1 (
    echo [INFO] Installing backend dependencies...
    pushd backend\api
    pnpm install
    popd
    echo [OK] Backend dependencies installed
) else (
    :: Double-check critical packages are installed
    if not exist backend\api\node_modules\@anthropic-ai\sdk (
        echo [INFO] Missing @anthropic-ai/sdk, reinstalling backend dependencies...
        pushd backend\api
        pnpm install
        popd
        echo [OK] Backend dependencies installed
    ) else if not exist backend\api\node_modules\@modelcontextprotocol\sdk (
        echo [INFO] Missing @modelcontextprotocol/sdk, reinstalling backend dependencies...
        pushd backend\api
        pnpm install
        popd
        echo [OK] Backend dependencies installed
    ) else (
        echo [OK] Backend dependencies already installed
    )
)

if not exist frontend\node_modules (
    echo [INFO] Installing frontend dependencies...
    pushd frontend
    pnpm install
    popd
) else (
    echo [OK] Frontend dependencies already installed
)

:: Step 4: Install MCP server dependencies (for LLM mode)
echo.
echo Step 4: Installing MCP server dependencies (for LLM mode)...
if exist mcp_server\requirements.txt (
    :: Check if MCP is installed (anthropic is now in Node.js, not Python)
    %PYTHON_CMD% -c "import mcp" >nul 2>nul
    if !errorlevel!==0 (
        echo [OK] MCP server dependencies already installed
    ) else (
        echo [INFO] Installing MCP server Python dependencies...
        %PYTHON_CMD% -m pip install -r mcp_server\requirements.txt --quiet
        if !errorlevel!==0 (
            echo [OK] MCP server dependencies installed
        ) else (
            echo [WARNING] Failed to install MCP server dependencies
            echo          LLM mode will not be available
            echo          Run: pip install -r mcp_server\requirements.txt
        )
    )
) else (
    echo [WARNING] MCP server requirements.txt not found
    echo          LLM mode will not be available
)

:: Step 5: Setup VS Build Tools
echo.
echo Step 5: Checking Visual Studio Build Tools...

set "VS_BUILDTOOLS_PATH=%ProgramFiles(x86)%\Microsoft Visual Studio\2022\BuildTools"
if exist "%VS_BUILDTOOLS_PATH%\VC\Auxiliary\Build\vcvarsall.bat" (
    call "%VS_BUILDTOOLS_PATH%\VC\Auxiliary\Build\vcvarsall.bat" x64 >nul 2>nul
)

where cl >nul 2>nul
if %errorlevel%==0 (
    echo [OK] Visual Studio Build Tools with C++ found
) else (
    echo [WARNING] Visual Studio Build Tools not found
    echo Fast Downward may not compile properly.
)

:: Step 6: Setup environment file
echo.
echo Step 6: Setting up environment...

:: Create .env file with Python command
echo PYTHON_CMD=%PYTHON_CMD%> backend\api\.env

:: Check for Anthropic API key
if defined ANTHROPIC_API_KEY (
    echo ANTHROPIC_API_KEY=%ANTHROPIC_API_KEY%>> backend\api\.env
    echo [OK] ANTHROPIC_API_KEY found in environment
) else if exist backend\api\.env.local (
    type backend\api\.env.local >> backend\api\.env
    echo [OK] Using API keys from .env.local
) else (
    echo [INFO] ANTHROPIC_API_KEY not set
    echo        LLM-based visualization will not be available
    echo        To enable: set ANTHROPIC_API_KEY=your_key
    echo        Or create backend\api\.env.local with your key
)

:: Step 7: Verify MCP architecture (no longer test main.py as it doesn't exist)
echo.
echo Step 7: Verifying MCP architecture...
if exist mcp_server\mcp_server.py (
    echo [OK] MCP Server (Python) found - provides tools
)
if exist backend\api\mcp-client.ts (
    echo [OK] MCP Client (Node.js) found - orchestrates tools
)
if exist backend\api\claude-service.ts (
    echo [OK] Claude Service (Node.js) found - calls Anthropic API
)

:: Step 8: Start backend and frontend
echo.
echo ======================================
echo [OK] All checks passed! Starting app...
echo ======================================
echo.
echo Frontend: http://localhost:3000
echo Backend API: http://localhost:4000
echo.
echo Visualization Modes:
echo   - Basic: Always available (hand-crafted renderers )
echo   - LLM:   Requires ANTHROPIC_API_KEY (AI-generated renderers via MCP)
echo.
echo MCP Architecture (Proper Separation):
echo   - MCP Client (Node.js): Connects to Python server, orchestrates tools
echo   - Claude Service (Node.js): Calls Anthropic API for code generation
echo   - MCP Server (Python): Pure tool provider (no Claude calls)
echo   - Model: claude-sonnet-4-20250514
echo.
echo Press Ctrl+C to stop the servers
echo.

:: Start backend
start "Backend" cmd /k "cd backend\api && pnpm dev"

:: Wait a moment for backend to start
timeout /t 3 /nobreak >nul

:: Start frontend
start "Frontend" cmd /k "cd frontend && pnpm dev"

echo.
echo Servers started in separate windows.
echo Close this window or press any key to exit setup...
pause >nul