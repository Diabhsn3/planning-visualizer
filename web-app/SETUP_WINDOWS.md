# Planning Visualizer - Windows Setup Guide

Complete step-by-step guide to run the Planning Visualizer on Windows.

---

## Prerequisites

Before starting, ensure you have:
- **Windows 10** or **Windows 11**
- **Administrator access** to install software
- **Internet connection** for downloading dependencies

---

## Step 1: Install Required Tools

### Install Git for Windows

1. Download from: https://git-scm.com/download/win
2. Run the installer
3. Use default settings (recommended)
4. **Important**: Select "Git from the command line and also from 3rd-party software"

### Install Python 3

1. Download Python 3.12 from: https://www.python.org/downloads/
2. Run the installer
3. **CRITICAL**: Check "Add Python to PATH" before clicking Install
4. Click "Install Now"

Verify installation (open Command Prompt):
```cmd
python --version
```
Should show `Python 3.12.x`

### Install Node.js

1. Download LTS version from: https://nodejs.org/
2. Run the installer
3. Use default settings
4. Restart your computer after installation

Verify installation (open Command Prompt):
```cmd
node --version
npm --version
```

### Install pnpm

Open Command Prompt as Administrator:
```cmd
npm install -g pnpm
```

Verify:
```cmd
pnpm --version
```

### Install Visual Studio Build Tools (for Fast Downward)

Fast Downward requires C++ compilation tools.

**Option A: Visual Studio 2022 Community (Recommended)**
1. Download from: https://visualstudio.microsoft.com/downloads/
2. Run installer
3. Select "Desktop development with C++"
4. Click Install (this may take 30+ minutes)

**Option B: Build Tools Only (Smaller download)**
1. Download "Build Tools for Visual Studio 2022"
2. Select "C++ build tools"
3. Install

### Install CMake

1. Download from: https://cmake.org/download/
2. Choose "Windows x64 Installer"
3. During installation, select "Add CMake to system PATH for all users"

Verify (restart Command Prompt first):
```cmd
cmake --version
```

---

## Step 2: Clone the Repository

Open Command Prompt or PowerShell:

```cmd
cd %USERPROFILE%\Desktop
git clone https://github.com/Diabhsn3/planning-visualizer.git
cd planning-visualizer
```

---

## Step 3: Build Fast Downward Planner

```cmd
REM Initialize git submodules
git submodule update --init --recursive

REM Build Fast Downward
cd planning-tools\downward
python build.py

REM Verify the build
dir builds\release\bin\downward.exe

REM Return to project root
cd ..\..
```

**Expected output**: You should see compilation messages and "Build completed successfully".

**Note**: This step may take 10-20 minutes on the first build.

---

## Step 4: Set Up the Web Application

```cmd
cd web-app

REM Create environment configuration
echo PYTHON_CMD=python > .env

REM Install dependencies
pnpm install
```

**Note**: If you get an error about execution policies with PowerShell, run:
```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

---

## Step 5: Start the Development Server

```cmd
pnpm dev
```

**Expected output**:
```
Server running on http://localhost:3000/
```

---

## Step 6: Open the Application

Open your web browser and navigate to:
```
http://localhost:3000
```

You should see the Planning Visualizer interface!

---

## Testing the Installation

1. **Select a domain**: Choose "Blocks World" from the dropdown
2. **Click "Generate States"**: This uses the default problem
3. **Verify**: You should see:
   - Green badge "✓ Fast Downward (A* + LM-cut)"
   - Animated visualization with blocks
   - Timeline controls

If you see a yellow "⚠ Fallback" badge, Fast Downward wasn't built correctly. Go back to Step 3.

---

## Troubleshooting

### Problem: `python: command not found`

**Solution**: Python wasn't added to PATH during installation.

1. Uninstall Python
2. Reinstall and **CHECK** "Add Python to PATH"
3. Restart Command Prompt

Or manually add to PATH:
1. Search "Environment Variables" in Windows
2. Edit "Path" variable
3. Add: `C:\Users\YourUsername\AppData\Local\Programs\Python\Python312`
4. Restart Command Prompt

### Problem: `pnpm: command not found`

**Solution**: Install pnpm globally:
```cmd
npm install -g pnpm
```

If that fails, restart your computer and try again.

### Problem: Fast Downward build fails with "compiler not found"

**Solution**: Install Visual Studio Build Tools (see Step 1).

Make sure you selected "Desktop development with C++" during installation.

### Problem: CMake not found during build

**Solution**: 
1. Reinstall CMake and select "Add to PATH"
2. Restart Command Prompt
3. Verify: `cmake --version`

### Problem: Port 3000 already in use

**Solution**: Find and kill the process:
```cmd
netstat -ano | findstr :3000
taskkill /PID <PID_NUMBER> /F
```

Then restart the server:
```cmd
pnpm dev
```

### Problem: "Module not found" errors

**Solution**: Reinstall dependencies:
```cmd
rmdir /s /q node_modules
pnpm install
```

### Problem: Permission denied errors

**Solution**: Run Command Prompt as Administrator:
1. Search "cmd" in Start Menu
2. Right-click "Command Prompt"
3. Select "Run as administrator"

---

## System Status Check

Click **"Show System Status"** in the web interface to see:
- Python version and command
- Fast Downward availability
- Specific error messages if something is wrong

---

## Stopping the Server

Press `Ctrl + C` in the Command Prompt where the server is running.

---

## Using PowerShell Instead of Command Prompt

All commands work in PowerShell, but you may need to:

1. Allow script execution:
```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

2. Use forward slashes or escape backslashes in paths

---

## Next Steps

- Try custom PDDL problems by clicking "Use custom problem"
- Explore the Gripper domain
- Read the main README for feature documentation

---

## Getting Help

If you encounter issues not covered here:
1. Check `TROUBLESHOOTING.md` for detailed diagnostics
2. Verify all prerequisites are installed correctly
3. Make sure you're in the correct directory (`web-app\`)
4. Check the browser console for JavaScript errors (F12 → Console)
5. Try running Command Prompt as Administrator

---

**Common Windows-Specific Issues**:
- **Antivirus blocking**: Temporarily disable antivirus during installation
- **Long path names**: Windows has a 260-character path limit. Clone to `C:\planning-visualizer` instead of Desktop
- **Firewall**: Allow Node.js through Windows Firewall when prompted

---

**Last Updated**: December 2024
