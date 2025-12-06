# Planning Visualizer Web Application

An interactive web-based visualizer for classical planning problems using PDDL (Planning Domain Definition Language). This application integrates the **Fast Downward planner** with HTML5 Canvas visualization to provide real-time, domain-specific visual representations of planning states and solutions.

## Features

### Core Functionality
- **Domain Selection**: Choose from predefined planning domains (Blocks World, Gripper)
- **Dual Input Modes**: 
  - Upload PDDL problem files (.pddl)
  - Paste PDDL problem text directly
- **Dynamic Planning**: Integrates with **Fast Downward planner** (A* + LM-cut heuristic) for optimal problem solving
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
- **Fast Downward** planner with A* + LM-cut heuristic
- Custom PDDL parser and state generator
- Domain-specific renderers for visual output

## Installation & Setup

### Prerequisites
- **Node.js** 18+ and pnpm
- **Python** 3.11+
- **Git** for cloning the repository
- **CMake** and **g++** for building Fast Downward

### Step 1: Clone the Repository
```bash
git clone https://github.com/Diabhsn3/planning-visualizer.git
cd planning-visualizer
```

### Step 2: Build Fast Downward Planner
```bash
# Initialize and clone the Fast Downward submodule
git submodule update --init --recursive

# Install build dependencies (Ubuntu/Debian)
sudo apt-get install -y cmake g++ make

# Build Fast Downward
cd planning-tools/downward
./build.py

# Return to repository root
cd ../..
```

### Step 3: Install Python Dependencies
```bash
pip3 install -r requirements.txt
```

### Step 4: Install Node.js Dependencies
```bash
cd web-app
pnpm install
```

### Step 5: Start the Development Server
```bash
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
   - Click "Solve Problem" to run Fast Downward planner
   - The system will generate an optimal plan and display the visualization

4. **Navigate the Solution**
   - Use the **Play** button to animate the solution
   - Drag the **timeline slider** to jump to specific states
   - Adjust **speed** to control animation timing
   - View **plan steps** to see the action sequence

### Example PDDL Problem (Blocks World)

```lisp
(define (problem bw-3blocks)
  (:domain blocks-world)
  
  (:objects
    a b c - block
  )
  
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

**Fast Downward will find the optimal 4-step plan:**
1. (pick-up b)
2. (stack b a)
3. (pick-up c)
4. (stack c b)

## Architecture Overview

### Data Flow

1. **User Input** → Frontend (React)
2. **tRPC API Call** → Backend (Node.js)
3. **Fast Downward Execution** → Python Integration Layer
4. **State Generation & Rendering** → JSON Response
5. **Canvas Visualization** → Interactive Display

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
- Integrates Fast Downward planner, state generator, and renderer
- Outputs structured JSON with states and optimal plan
- Handles PDDL parsing and domain-specific rendering

#### Python: `run_planner.py`
- Executes Fast Downward with A* + LM-cut heuristic
- Handles planner timeouts and errors gracefully
- Falls back to predefined plans if Fast Downward is unavailable

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

## Fast Downward Integration

### How It Works

1. User submits a PDDL problem (via file upload or text input)
2. Backend saves the problem to a temporary file
3. `run_planner.py` executes Fast Downward:
   ```bash
   python3.11 fast-downward.py \
     --plan-file output.plan \
     domain.pddl \
     problem.pddl \
     --search "astar(lmcut())"
   ```
4. Fast Downward generates an optimal plan
5. State generator creates intermediate states
6. State renderer converts states to visual JSON format
7. Frontend displays the visualization with animation

### Planner Configuration

- **Search Algorithm**: A* (optimal)
- **Heuristic**: LM-cut (landmark-cut)
- **Timeout**: 60 seconds
- **Fallback**: Predefined plans if Fast Downward fails

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

**Problem**: Fast Downward not found
- **Cause**: Submodule not initialized or planner not built
- **Solution**: Run `git submodule update --init --recursive` and `./build.py` in `planning-tools/downward`

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

- [ ] Add PDDL syntax validation with real-time error feedback
- [ ] Implement renderers for remaining 5 domains
- [ ] Add export functionality (GIF/video, shareable links)
- [ ] Support for custom domain uploads
- [ ] Plan quality metrics and statistics
- [ ] Multi-step undo/redo for state navigation
- [ ] Planner configuration options (different heuristics, search algorithms)

## Performance Notes

- Fast Downward typically solves simple problems (2-3 blocks) in < 1 second
- More complex problems may take 5-30 seconds depending on search space
- Timeout is set to 60 seconds to prevent hanging
- State generation and rendering add < 1 second overhead

## Contributing

This project is part of a capstone project for visualizing plans of domain-independent planners using LLMs.

## License

[Add license information]

## Acknowledgments

- **Fast Downward** planning system (https://www.fast-downward.org/)
- PDDL community for domain definitions
- React and TypeScript communities
