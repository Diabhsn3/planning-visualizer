# Planning Visualizer

Visualize classical planning algorithms with domain-specific renderers. Solve PDDL problems using Fast Downward and see animated step-by-step visualizations.

![Planning Visualizer Demo](https://img.shields.io/badge/Status-Active-success)
![Fast Downward](https://img.shields.io/badge/Planner-Fast%20Downward-blue)
![License](https://img.shields.io/badge/License-MIT-green)

---

## Features

✅ **Fast Downward Integration** - Dynamic problem solving with A* search and LM-cut heuristic  
✅ **Interactive Visualization** - HTML5 Canvas rendering with animation controls  
✅ **Multiple Domains** - Blocks World and Gripper domains supported  
✅ **Dual Input Modes** - Paste PDDL text or upload .pddl files  
✅ **Stable Positioning** - Blocks maintain fixed positions during animation  
✅ **System Diagnostics** - Built-in status checker for troubleshooting  

---

## Quick Start

### Choose Your Platform

- **[macOS Setup Guide](SETUP_MAC.md)** - Complete instructions for Mac users
- **[Windows Setup Guide](SETUP_WINDOWS.md)** - Complete instructions for Windows users

### Quick Install (macOS)

```bash
# Clone repository
git clone https://github.com/Diabhsn3/planning-visualizer.git
cd planning-visualizer

# Build Fast Downward
git submodule update --init --recursive
cd planning-tools/downward && ./build.py && cd ../..

# Set up web app
cd web-app
echo "PYTHON_CMD=python3" > .env
pnpm install
pnpm dev
```

Open http://localhost:3000

### Quick Install (Windows)

```cmd
REM Clone repository
git clone https://github.com/Diabhsn3/planning-visualizer.git
cd planning-visualizer

REM Build Fast Downward
git submodule update --init --recursive
cd planning-tools\downward
python build.py
cd ..\..

REM Set up web app
cd web-app
echo PYTHON_CMD=python > .env
pnpm install
pnpm dev
```

Open http://localhost:3000

---

## Usage

### Using Default Problems

1. Select a domain (Blocks World or Gripper)
2. Click **"Generate States"**
3. Watch the animated visualization

### Using Custom Problems

1. Check **"Use custom problem"**
2. Choose **"Paste Text"** or **"Upload File"**
3. Enter or upload your PDDL problem
4. Click **"Solve Problem"**

### Example PDDL Problem

```pddl
(define (problem bw-3blocks)
  (:domain blocks-world)
  (:objects a b c - block)
  (:init
    (ontable a)
    (ontable b)
    (ontable c)
    (clear a)
    (clear b)
    (clear c)
    (handempty)
  )
  (:goal
    (and
      (on c b)
      (on b a)
    )
  )
)
```

---

## Architecture

```
planning-visualizer/
├── planning-tools/
│   └── downward/              # Fast Downward planner (git submodule)
└── web-app/
    ├── client/                # React frontend
    │   └── src/
    │       ├── pages/         # Visualizer UI
    │       └── components/    # Canvas rendering
    ├── server/                # Express backend
    │   └── visualizer.ts      # API endpoints
    └── python_modules/        # Python integration
        ├── visualizer_api.py  # Main API
        ├── run_planner.py     # Fast Downward wrapper
        └── state_renderer/    # Domain-specific renderers
            ├── blocks_world_renderer.py
            └── gripper_renderer.py
```

---

## How It Works

1. **User Input** → PDDL problem (text or file)
2. **Fast Downward** → Solves problem, generates optimal plan
3. **State Generator** → Creates intermediate states for each action
4. **Domain Renderer** → Converts states to visual objects with positions
5. **Canvas Visualization** → Renders and animates the plan execution

---

## Supported Domains

### Blocks World
Classic block stacking problem with:
- Vertical stacking layout
- Fixed block positions (no shifting)
- Color-coded blocks
- Gripper visualization

### Gripper
Robot gripper domain with:
- Multiple rooms
- Ball transportation
- Left/right gripper states

---

## System Requirements

### macOS
- macOS 10.15 (Catalina) or later
- Python 3.11+
- Node.js 18+
- CMake 3.20+

### Windows
- Windows 10 or 11
- Python 3.11+
- Node.js 18+
- Visual Studio Build Tools 2022
- CMake 3.20+

---

## Troubleshooting

### Fast Downward Not Found

Click **"Show System Status"** to see detailed diagnostics.

**Common fixes**:
- Rebuild Fast Downward: `cd planning-tools/downward && ./build.py`
- Check Python command in `.env` file
- Verify CMake is installed

### Yellow "Fallback" Badge

This means Fast Downward isn't available. The system is using a predefined plan that may not match your problem.

**Solution**: Build Fast Downward (see setup guides)

### Blocks Shifting During Animation

This was fixed in v1.2. Pull the latest changes:
```bash
git pull origin main
```

---

## Development

### Project Structure

- **Frontend**: React 19 + Tailwind 4 + Wouter routing
- **Backend**: Express 4 + TypeScript
- **Planner**: Fast Downward (C++)
- **State Generation**: Python 3.11+
- **Rendering**: HTML5 Canvas

### Adding New Domains

1. Create domain PDDL file in `python_modules/domains/your_domain/`
2. Create renderer in `python_modules/state_renderer/your_domain_renderer.py`
3. Extend `BaseStateRenderer` class
4. Register domain in `visualizer_api.py`

---

## Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

---

## License

MIT License - see LICENSE file for details

---

## Acknowledgments

- **Fast Downward** - AI Planning System by University of Basel
- **PDDL** - Planning Domain Definition Language
- **React** - UI Framework
- **Tailwind CSS** - Styling

---

## Support

- **Setup Issues**: See platform-specific guides (SETUP_MAC.md, SETUP_WINDOWS.md)
- **Troubleshooting**: See TROUBLESHOOTING.md
- **Bug Reports**: Open an issue on GitHub
- **Feature Requests**: Open an issue with [Feature Request] tag

---

**Last Updated**: December 2024  
**Version**: 1.2.0
