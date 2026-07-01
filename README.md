# Planning Visualizer

A modern web application for visualizing classical planning problems and solutions. It integrates the Fast Downward planning system with an **LLM-powered dynamic rendering engine**, allowing users to explore how different search strategies solve PDDL problems step-by-step, and automatically generating visualizers for entirely new custom domains.

![React](https://img.shields.io/badge/React-19-blue) ![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue) ![Python](https://img.shields.io/badge/Python-3.11+-green) ![Fast Downward](https://img.shields.io/badge/Fast%20Downward-Integrated-orange) ![LLM](https://img.shields.io/badge/LLM-Claude%20%7C%20Gemini-purple)

---

## Features

The Planning Visualizer provides an interactive environment for understanding automated planning. Users can select a built-in planning domain or upload their own, choose a search strategy, and watch the planner solve it with a visual, step-by-step animation.

**Core Capabilities:**
- **LLM-Powered Custom Domains**: Upload any valid PDDL domain and problem. The system uses Claude or Gemini to automatically generate a domain-generic state transformer and a Canvas renderer on the fly.
- **Saved Domain Library**: Once an LLM generates a visualizer for a custom domain, it can be saved to the library. Future problems for that domain are visualized instantly without requiring new LLM calls.
- **Interactive Canvas Visualization**: Domain-specific renderers draw each state on an HTML5 canvas. Users can zoom (10%–500%) with the mouse wheel and pan by clicking and dragging.
- **Search Strategy Selection**: Choose from 10+ Fast Downward search strategies, ranging from optimal (A* + LM-cut) to fast satisficing (Lazy Greedy + FF). The UI displays each strategy's speed, optimality, and a recommendation for when to use it.
- **Playback Controls**: Play, pause, step forward/backward, and adjust animation speed. A timeline slider allows jumping to any state in the plan.
- **Real-time Feedback**: The UI shows elapsed time during planning, warns users when a slow strategy is selected, and suggests faster alternatives if a timeout occurs.

---

## How It Works

The application follows a layered architecture, with a special two-stage pipeline for custom domains:

1. **Planning Engine (Python)**: The backend receives the PDDL files and runs Fast Downward. If a plan is found, the `StateGenerator` applies the actions to create a sequence of logical states (sets of true predicates).
2. **Raw State Generation**: For custom domains, a `DefaultRenderer` converts the logical states into a generic JSON format containing objects and relations.
3. **Stage 1 - Transformer Generation (LLM)**: The backend sends the PDDL domain to an LLM (Claude or Gemini). The LLM generates a TypeScript function that transforms the generic raw states into enriched states with spatial coordinates, colors, and dimensions.
4. **Stage 2 - Renderer Generation (LLM)**: The backend sends the PDDL domain and the generated transformer code to the LLM. The LLM generates Canvas API drawing functions for the objects.
5. **Client-Side Execution (React)**: The frontend compiles the generated TypeScript code at runtime. As the user plays the animation, the `StateCanvas` component applies the transformer and renderer to draw each state dynamically.

---

## Supported Domains

### Built-in Domains
The visualizer includes hardcoded Python renderers for several classic planning domains for instant, guaranteed visualization:

| Domain | Status | Description |
|---|:---:|---|
| **Blocks World** | ✅ Implemented | Stack and unstack blocks on a table. Supports unlimited blocks with cycling colors. |
| **Gripper** | ✅ Implemented | A robot with two grippers moves balls between rooms. Supports up to 8 balls and 4 rooms. |
| **Depot** | ✅ Implemented | Transport crates between depots using trucks and hoists. |
| **Hanoi** | ✅ Implemented | The classic Tower of Hanoi puzzle. |
| **Rovers** | ✅ Implemented | Navigate rovers on a planet to collect samples and data. |

### Custom Domains
Any valid PDDL domain can be uploaded. The LLM pipeline will attempt to generate a visualizer for it. You can choose between **Claude Sonnet 5** and **Gemini 2.5 Pro** as the generation engine.

---

## Search Strategies

The application provides a curated whitelist of Fast Downward search strategies. Users select a strategy by its name, and the backend maps it to the correct command-line arguments.

### Optimal Strategies (Guaranteed Shortest Plan)
| Strategy | Speed | When to Use |
|---|:---:|---|
| A* + LM-cut | 🔴 Slow | When you need the absolute shortest plan and can wait. |
| A* Blind | 🔴 Slow | For very small problems only (breadth-first behavior). |
| A* + h^max | 🔴 Slow | An alternative when LM-cut fails or is too slow. |

### Satisficing Strategies (Fast, Good Plans)
| Strategy | Speed | When to Use |
|---|:---:|---|
| **Lazy Greedy + FF** | 🟢 Fast | **Recommended default.** Best for quick results. |
| Greedy Best-First + FF | 🟢 Fast | General-purpose fast planning. |
| Greedy + h^add | 🟢 Fast | Alternative when FF doesn't work well for a domain. |
| LAMA-first | 🟡 Medium | Good balance of speed and plan quality. |
| Greedy + CEA | 🟡 Medium | Useful for domains with many actions. |

---

## Getting Started

### Prerequisites
| Software | Version | Notes |
|---|---|---|
| **Node.js** | 18 or later | [Download](https://nodejs.org/) |
| **Python** | 3.11 or later | [Download](https://www.python.org/downloads/) |
| **pnpm** | Latest | Install with `npm install -g pnpm` |
| **Git** | Latest | [Download](https://git-scm.com/) |
| **C++ Compiler** | (Optional) | Required to build Fast Downward. GCC on Linux, Xcode on macOS, or Visual Studio Build Tools on Windows. |

### API Keys
To use the custom domain generation feature, you must provide API keys for the LLM providers. Create a `.env` file in `backend/api/`:
```bash
ANTHROPIC_API_KEY=your_claude_key_here
GEMINI_API_KEY=your_gemini_key_here
```

### Installation
1. **Clone the repository:**
   ```bash
   git clone https://github.com/Diabhsn3/planning-visualizer.git
   cd planning-visualizer
   ```
2. **Initialize the Fast Downward submodule:**
   ```bash
   git submodule update --init --recursive
   ```
3. **Run the setup script (Recommended):**
   The provided script checks dependencies, installs packages, builds Fast Downward, and starts the servers.
   ```bash
   # On macOS/Linux
   ./run_new.sh
   # On Windows
   run_new.bat
   ```
   The application will be available at **http://localhost:3000**.

---

## Configuration

### Planner Timeout
The default timeout for the Fast Downward planner is **30 minutes (1800 seconds)**. This can be changed via an environment variable:
```bash
export PLANNER_TIMEOUT=3600
```

### Python Command
If your Python executable is not `python3`, add it to your `backend/api/.env` file:
```bash
PYTHON_CMD=python
```

---

## Troubleshooting

### "Port already in use"
Kill the process using the port:
```bash
# macOS/Linux
lsof -ti:3000 | xargs kill -9
lsof -ti:4000 | xargs kill -9
```

### "Fast Downward build failed on macOS"
This is a known issue with Xcode 15+. The application will still work using pre-computed example data. For custom problems, consider using a Linux environment or Docker.

### "Planner timed out"
Large problems with optimal strategies (A* + LM-cut) can take a very long time. Try:
1. Selecting a **satisficing strategy** like "Lazy Greedy + FF".
2. Reducing the problem size.

---

## Technology Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 19, TypeScript 5.7, Tailwind CSS 4, Vite 6, tRPC 11, Radix UI |
| **Backend API** | Node.js, Express 4, tRPC 11, TypeScript 5.9, Zod 4 |
| **Planning Engine** | Python 3.11+, Fast Downward |
| **LLM Integration** | Anthropic SDK (Claude Sonnet 5), Google Gen AI SDK (Gemini 2.5 Pro) |

---

## Acknowledgments
- [Fast Downward](https://www.fast-downward.org/) – The classical planning system powering this application.
- [PDDL](https://planning.wiki/) – The Planning Domain Definition Language.
