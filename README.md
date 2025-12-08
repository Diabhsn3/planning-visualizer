# Planning Visualizer - Monorepo

An interactive web application for visualizing classical planning problems and solutions with domain-specific renderers and real-time animations.

![Planning Visualizer](https://img.shields.io/badge/React-19-blue) ![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue) ![Python](https://img.shields.io/badge/Python-3.11+-green) ![Monorepo](https://img.shields.io/badge/Monorepo-pnpm-orange)

**Supported Domains:** Blocks World • Gripper

---

## ✨ Features

- 🎨 **Interactive Visualization** - Watch planning solutions unfold with smooth animations
- 📝 **Custom Problems** - Upload PDDL files or paste problem definitions directly
- ⚡ **Real-time Controls** - Play, pause, adjust speed, and navigate through plan steps
- 🎯 **Domain-Specific Rendering** - Tailored visualizations for each planning domain
- 🔄 **Fallback Mode** - Works without Fast Downward using pre-computed examples
- 🚀 **Modern Stack** - React 19, TypeScript, Tailwind CSS, Node.js, Python
- 📦 **Monorepo Structure** - Organized packages with shared types for type safety

---

## 🚀 Quick Start

### Prerequisites

Before running the application, ensure you have:

| Requirement | Version | Installation |
|------------|---------|--------------|
| **Python** | 3.11+ | [python.org](https://www.python.org/downloads/) |
| **Node.js** | 18+ | [nodejs.org](https://nodejs.org/) |
| **pnpm** | Latest | `npm install -g pnpm` |
| **Git** | Latest | [git-scm.com](https://git-scm.com/) |

### Installation

```bash
# Clone the repository
git clone https://github.com/Diabhsn3/planning-visualizer.git
cd planning-visualizer
git checkout Monorepo-separation

# Install all dependencies (frontend, backend, types)
pnpm install

# Initialize Fast Downward (optional)
git submodule update --init --recursive
```

### Running the Application

```bash
# Run both frontend and backend simultaneously
pnpm dev

# Or run individually:
pnpm dev:frontend  # Frontend only (http://localhost:3000)
pnpm dev:backend   # Backend only (http://localhost:4000)
```

**🌐 Access the app at:** http://localhost:3000

> **Note:** If Fast Downward build fails (common on macOS with Xcode 15+), the app runs in **fallback mode** with pre-defined example problems.

---

## 📁 Monorepo Structure

```
planning-visualizer/
│
├── 📁 packages/
│   ├── 📁 frontend/                  # React Frontend (Port 3000)
│   │   ├── src/
│   │   │   ├── pages/               # Page components
│   │   │   ├── components/          # Reusable UI components
│   │   │   ├── lib/                 # tRPC client & utilities
│   │   │   └── main.tsx             # Application entry point
│   │   ├── vite.config.ts
│   │   └── package.json
│   │
│   ├── 📁 backend/                   # Backend Services
│   │   ├── api/                     # Node.js/Express API (Port 4000)
│   │   │   ├── _core/               # Core server setup
│   │   │   ├── visualizer.ts        # Main API endpoints
│   │   │   ├── routers.ts           # tRPC route definitions
│   │   │   └── package.json
│   │   └── planner/                 # Python Planning Engine
│   │       ├── visualizer_api.py    # Main Python API
│   │       ├── domains/             # PDDL domain definitions
│   │       ├── state_generator/     # State generation logic
│   │       └── state_renderer/      # Domain-specific renderers
│   │
│   └── 📁 types/                     # Shared TypeScript Types
│       ├── src/
│       │   └── index.ts             # Re-exports AppRouter type
│       ├── package.json
│       └── tsconfig.json
│
├── 📁 planning-tools/                # Fast Downward Planner (Submodule)
│   └── downward/
│
├── pnpm-workspace.yaml               # Workspace configuration
├── package.json                      # Root package.json with scripts
└── README.md                         # This file
```

---

## 📦 Package Overview

### Frontend Package (`packages/frontend`)

React-based web interface with TypeScript and Tailwind CSS.

**Key Dependencies:**
- React 19
- tRPC Client
- Vite
- Tailwind CSS 4
- Framer Motion

**Scripts:**
```bash
pnpm dev:frontend   # Start development server
pnpm build:frontend # Build for production
```

### Backend Package (`packages/backend`)

Node.js API server with Python planning engine.

**Key Dependencies:**
- Express
- tRPC Server
- Python 3.11+
- Fast Downward (optional)

**Scripts:**
```bash
pnpm dev:backend    # Start development server
pnpm build:backend  # Build for production
```

### Types Package (`packages/types`)

Shared TypeScript types for type-safe communication between frontend and backend.

**Purpose:**
- Exports `AppRouter` type from backend
- Ensures type safety across API boundaries
- Automatically linked via pnpm workspace

**Scripts:**
```bash
pnpm build:types    # Build type definitions
```

---

## 🎮 Usage

### 1. Select a Domain
Choose from available planning domains:
- **Blocks World** - Classic block stacking problem
- **Gripper** - Robot with grippers moving balls between rooms

### 2. Provide a Problem
Two options:
- **Upload File** - Upload a `.pddl` problem file
- **Paste Text** - Paste PDDL problem definition directly

### 3. Generate Visualization
Click **"Generate States"** to:
- Run the planner (Fast Downward or fallback)
- Generate intermediate states
- Render domain-specific visualization

### 4. Control Animation
- ▶️ **Play/Pause** - Control animation playback
- ⏮️ **Previous/Next** - Step through states manually
- 🎚️ **Speed Control** - Adjust animation speed
- 📍 **Timeline** - Jump to any state directly

---

## 🛠️ Development

### Adding Dependencies

**Frontend:**
```bash
pnpm --filter frontend add <package-name>
```

**Backend:**
```bash
pnpm --filter backend add <package-name>
```

**Types:**
```bash
pnpm --filter types add -D <package-name>
```

### Building

```bash
# Build all packages
pnpm build

# Build specific package
pnpm build:types
pnpm build:frontend
pnpm build:backend
```

### Type Safety

The monorepo ensures type safety between frontend and backend:

1. Backend exports `AppRouter` type in `packages/backend/api/routers.ts`
2. Types package re-exports it in `packages/types/src/index.ts`
3. Frontend imports it from `@planning-visualizer/types`

Any API changes in the backend automatically propagate to the frontend via TypeScript!

---

## 🔧 Troubleshooting

### ⚠️ Fast Downward Build Fails

**Most Common Issue:** Directory path contains spaces

Fast Downward C++ build fails if the project path contains spaces (e.g., `"final project"`, `"My Documents"`).

**Solution:**
```bash
# Move to a path without spaces
mv "~/Documents/final project/planning-visualizer" ~/planning-visualizer
cd ~/planning-visualizer
pnpm install
pnpm dev
```

---

### ⚠️ Port Already in Use

If ports 3000 or 4000 are occupied:

**Mac/Linux:**
```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill

# Kill process on port 4000
lsof -ti:4000 | xargs kill
```

**Windows:**
```cmd
# Find process using port 3000
netstat -ano | findstr :3000

# Kill the process (replace <PID> with actual process ID)
taskkill /PID <PID> /F
```

---

### ⚠️ Type Errors After API Changes

If you see TypeScript errors after changing the backend API:

```bash
# Rebuild types package
pnpm build:types

# Restart frontend dev server
pnpm dev:frontend
```

---

### ⚠️ Workspace Dependencies Not Found

If you see errors about `@planning-visualizer/types` not found:

```bash
# Reinstall all dependencies
pnpm install

# Build types package
pnpm build:types
```

---

## 💻 Technology Stack

### Frontend
- **React 19** - UI framework
- **TypeScript** - Type safety
- **Tailwind CSS 4** - Styling
- **tRPC** - Type-safe API client
- **Vite** - Build tool
- **Framer Motion** - Animations

### Backend API
- **Node.js** - Runtime
- **Express** - Web framework
- **tRPC** - Type-safe API server
- **TypeScript** - Type safety

### Planning Engine
- **Python 3.11+** - Core language
- **Fast Downward** - Classical planner
- **Custom PDDL Parsers** - Problem parsing
- **Domain Renderers** - Visualization logic

### Monorepo
- **pnpm Workspaces** - Package management
- **Shared Types** - Type safety across packages

---

## 🤝 Contributing

Contributions are welcome! To add a new planning domain:

1. Add PDDL files to `packages/backend/planner/domains/new_domain/`
2. Create renderer in `packages/backend/planner/state_renderer/new_domain_renderer.py`
3. Add domain config in `packages/backend/api/visualizer.ts`
4. Update types if needed in `packages/types/src/index.ts`

---

## 📄 License

MIT License - See [LICENSE](LICENSE) for details

---

## 🙏 Acknowledgments

- [Fast Downward](https://www.fast-downward.org/) - Classical planning system
- [PDDL](https://planning.wiki/) - Planning Domain Definition Language
- React, TypeScript, and Python communities

---

## 📞 Support

- **Issues:** [GitHub Issues](https://github.com/Diabhsn3/planning-visualizer/issues)
- **Discussions:** [GitHub Discussions](https://github.com/Diabhsn3/planning-visualizer/discussions)

---

<div align="center">

**Built with ❤️ for the planning community**

[⭐ Star this repo](https://github.com/Diabhsn3/planning-visualizer) • [🐛 Report Bug](https://github.com/Diabhsn3/planning-visualizer/issues) • [✨ Request Feature](https://github.com/Diabhsn3/planning-visualizer/issues)

</div>
