# Planning Visualizer Web Application

An interactive web-based visualizer for classical planning problems using PDDL (Planning Domain Definition Language). This application integrates PDDL planning with HTML5 Canvas visualization to provide real-time, domain-specific visual representations of planning states and solutions.

## Features

### Core Functionality
- **Domain Selection**: Choose from predefined planning domains (Blocks World, Gripper)
- **Dual Input Modes**: 
  - Upload PDDL problem files (.pddl)
  - Paste PDDL problem text directly
- **Automatic Planning**: Integrates with Fast Downward planner (with fallback to predefined plans)
- **Interactive Visualization**: HTML5 Canvas rendering with domain-specific visual representations
- **Timeline Navigation**: 
  - Play/Pause controls
  - Manual state navigation via slider
  - Adjustable animation speed (100ms - 2000ms)
- **Plan Step Highlighting**: Visual synchronization between states and plan actions

### Supported Domains
1. **Blocks World**: Classic block stacking problem with colored blocks, table, and gripper
2. **Gripper**: Robot gripper problem with rooms, balls, and grippers

## Technology Stack

### Frontend
- **React 19** with TypeScript
- **Tailwind CSS 4** for styling
- **HTML5 Canvas** for visualization rendering
- **Vite** for build tooling
- **tRPC** for type-safe API communication

### Backend
- **Node.js** with Express
- **TypeScript**
- **tRPC 11** for API layer
- **Multer** for file uploads

### Planning & Visualization
- **Python 3.11** for PDDL processing
- **Fast Downward** planner (optional)
- Custom PDDL parser and state generator
- Domain-specific renderers for visual output

## Project Structure

```
web-app/
├── client/                    # Frontend React application
│   ├── src/
│   │   ├── components/       # React components
│   │   │   └── StateCanvas.tsx   # HTML5 Canvas visualization
│   │   ├── pages/
│   │   │   └── Visualizer.tsx    # Main visualizer page
│   │   ├── lib/
│   │   │   └── trpc.ts       # tRPC client configuration
│   │   └── main.tsx          # Application entry point
│   └── index.html
├── server/                    # Backend Node.js application
│   ├── routers.ts            # tRPC API routes
│   ├── visualizer.ts         # Visualizer-specific API logic
│   └── uploads/              # Temporary storage for uploaded files
├── python_modules/           # Python integration layer
│   ├── visualizer_api.py     # Main Python API script
│   ├── state_generator/      # PDDL parsing and state generation
│   └── state_renderer/       # Domain-specific rendering logic
├── domains/                   # PDDL domain definitions
│   ├── blocks-world/
│   └── gripper/
└── package.json
```

## Installation & Setup

### Prerequisites
- **Node.js** 18+ and pnpm
- **Python** 3.11+
- **Git** for cloning the repository

### Step 1: Clone the Repository
```bash
git clone https://github.com/Diabhsn3/planning-visualizer.git
cd planning-visualizer/web-app
```

### Step 2: Install Node.js Dependencies
```bash
pnpm install
```

### Step 3: Install Python Dependencies
```bash
# From the repository root
cd ..
pip3 install -r requirements.txt
```

### Step 4: Start the Development Server
```bash
cd web-app
pnpm dev
```

The application will be available at `http://localhost:3000`

## Usage Guide

### Basic Workflow

1. **Select a Domain**
   - Choose from the dropdown: "Blocks World" or "Gripper"

2. **Provide a Problem**
   - **Option A - Upload File**: Click "Upload File" and select a `.pddl` problem file
   - **Option B - Paste Text**: Click "Paste Text" and paste your PDDL problem definition
   - **Quick Start**: Click "Load Example" to load a sample problem

3. **Solve & Visualize**
   - Click "Solve Problem" to run the planner
   - The system will generate states and display the visualization

4. **Navigate the Solution**
   - Use the **Play** button to animate the solution
   - Drag the **timeline slider** to jump to specific states
   - Adjust **speed** to control animation timing
   - View **plan steps** to see the action sequence

### Example PDDL Problem (Blocks World)

```lisp
(define (problem bw-example-1)
  (:domain blocks-world)
  
  (:objects
    a b c - block
  )
  
  (:init
    (ontable a)
    (ontable b)
    (on c a)
    (clear c)
    (clear b)
    (handempty)
  )
  
  (:goal
    (and
      (ontable a)
      (on b a)
      (on c b)
      (clear c)
    )
  )
)
```

## Architecture Overview

### Data Flow

1. **User Input** → Frontend (React)
2. **tRPC API Call** → Backend (Node.js)
3. **Python Script Execution** → Planning & State Generation
4. **JSON Response** → Backend → Frontend
5. **Canvas Rendering** → Visual Display

### Key Components

#### Frontend: `StateCanvas.tsx`
- Renders planning states using HTML5 Canvas
- Handles domain-specific rendering logic
- Manages animation timing and state transitions

#### Backend: `server/visualizer.ts`
- Handles file uploads and text input
- Executes Python scripts with proper environment setup
- Parses JSON output from Python modules

#### Python: `visualizer_api.py`
- Integrates planner, state generator, and renderer
- Outputs structured JSON with states and plan
- Handles PDDL parsing and domain-specific rendering

### Environment Configuration

The backend clears `PYTHONPATH` when executing Python scripts to avoid version conflicts:

```typescript
const pythonEnv = {
  ...process.env,
  PYTHONPATH: '', // Clear to avoid Python 3.13 library conflicts
};
```

Python warnings are redirected to stderr to prevent JSON parsing errors:

```python
print("Warning message", file=sys.stderr)
```

## Troubleshooting

### Common Issues

**Problem**: "Unexpected token 'W', 'Warning: P'... is not valid JSON"
- **Cause**: Python warnings printing to stdout instead of stderr
- **Solution**: Ensure all warning/debug prints use `file=sys.stderr`

**Problem**: Blocks rendering below the table
- **Cause**: Y-coordinate calculation in Python renderer
- **Solution**: Fixed in `blocks_world_renderer.py` (line 48-50)

**Problem**: "No module named 'state_generator'"
- **Cause**: Python path not set correctly
- **Solution**: Ensure `PYTHONPATH` includes repository root or use absolute imports

**Problem**: File upload not working
- **Cause**: Missing multer middleware or incorrect file path
- **Solution**: Check `server/visualizer.ts` for upload configuration

## Development Notes

### Adding New Domains

1. Create domain definition in `domains/<domain-name>/domain.pddl`
2. Implement renderer in `python_modules/state_renderer/<domain>_renderer.py`
3. Add domain to frontend dropdown in `client/src/pages/Visualizer.tsx`
4. Update `visualizer_api.py` to handle the new domain

### Testing

Run the development server and test with example problems:

```bash
pnpm dev
```

Navigate to `http://localhost:3000` and use the "Load Example" button.

## Future Enhancements

- [ ] Install and integrate Fast Downward planner for dynamic problem solving
- [ ] Add PDDL syntax validation with real-time error feedback
- [ ] Implement renderers for remaining 5 domains
- [ ] Add export functionality (GIF/video, shareable links)
- [ ] Support for custom domain uploads
- [ ] Plan quality metrics and statistics
- [ ] Multi-step undo/redo for state navigation

## Contributing

This project is part of a capstone project for visualizing plans of domain-independent planners using LLMs.

## License

[Add license information]

## Acknowledgments

- Fast Downward planning system
- PDDL community for domain definitions
- React and TypeScript communities
