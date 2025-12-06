# Planning Visualizer Web Application

This is the web-based interactive visualizer for the Planning Visualizer project. It provides a user-friendly interface to visualize classical planning algorithms with domain-specific renderers.

## Features

- **Interactive Visualization**: HTML5 Canvas-based rendering of planning states
- **Timeline Navigation**: Play/pause controls, step-by-step navigation, and speed control
- **Domain Support**: Blocks World and Gripper domains with custom renderers
- **Custom Problem Upload**: Upload your own PDDL problem files for any supported domain
- **Planner Integration**: Automatically runs Fast Downward planner (or uses fallback plans)

## Technology Stack

- **Frontend**: React 19 + TypeScript + Tailwind CSS 4
- **Backend**: Node.js + Express + tRPC
- **Database**: MySQL (via Drizzle ORM)
- **Planning**: Python integration with state generator and renderer modules

## Setup

### Prerequisites

- Node.js 22+
- pnpm
- Python 3.11
- MySQL database (optional, for user features)

### Installation

```bash
# Install dependencies
pnpm install

# Set up environment variables (copy from .env.example if provided)
# DATABASE_URL, JWT_SECRET, etc.

# Push database schema
pnpm db:push

# Start development server
pnpm dev
```

The application will be available at `http://localhost:3000`

## Project Structure

```
web-app/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/    # React components (Canvas, UI)
│   │   ├── pages/         # Page components
│   │   └── lib/           # tRPC client
├── server/                # Node.js backend
│   ├── visualizer.ts      # Visualizer API router
│   ├── routers.ts         # Main tRPC router
│   └── db.ts              # Database queries
├── python_modules/        # Python integration
│   ├── state_generator/   # PDDL parser & state generation
│   ├── state_renderer/    # Domain-specific renderers
│   ├── domains/           # PDDL domain files
│   ├── visualizer_api.py  # Main Python API
│   └── run_planner.py     # Fast Downward integration
└── drizzle/               # Database schema
```

## Usage

### Using Pre-built Examples

1. Select a domain from the dropdown (Blocks World or Gripper)
2. Click "Generate States" to visualize the example problem
3. Use the timeline controls to navigate through the plan execution

### Uploading Custom Problems

1. Select a domain from the dropdown
2. Check "Upload custom problem file"
3. Choose your PDDL problem file (must match the selected domain)
4. Click "Solve Problem"
5. The system will run the planner and visualize the solution

## Planner Integration

The system integrates with Fast Downward planner:

- **With Fast Downward**: Automatically solves uploaded problems using A* + LM-cut heuristic
- **Without Fast Downward**: Falls back to predefined plans for testing

To enable Fast Downward:
1. Clone Fast Downward to `../planning-tools/downward/`
2. Build Fast Downward following its documentation
3. The system will automatically detect and use it

## API Endpoints

The backend exposes tRPC procedures:

- `visualizer.listDomains` - Get available domains
- `visualizer.generateStates` - Generate states for pre-built examples
- `visualizer.uploadAndGenerate` - Upload problem and solve with planner

## Development

```bash
# Run development server with hot reload
pnpm dev

# Type checking
pnpm check

# Run tests
pnpm test

# Build for production
pnpm build

# Start production server
pnpm start
```

## Contributing

This web application is part of the larger Planning Visualizer project. See the main repository README for contribution guidelines.

## License

MIT
