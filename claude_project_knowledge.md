# Planning Visualizer: Comprehensive Project Knowledge Base

This document captures the complete history, architecture, abandoned approaches, and current state of the **Planning Visualizer** capstone project. It serves as the ultimate source of truth for the project's evolution and technical details.

## 1. The Core Idea & Academic Context

**The Problem:** Automated planners (like Fast Downward) output sequences of actions in formal, symbolic PDDL (e.g., `(drive car1 locA locB)`). This text-based output is non-intuitive and difficult to read, debug, and interpret, especially for non-experts and students.

**The Solution:** A web-based educational and research tool that takes PDDL domain and problem files, runs them through a planner, simulates the resulting state transitions step-by-step, and renders those states as an interactive, animated 2D canvas visualization.

**Target Audience:** University students in AI planning courses, researchers, and CS educators.

**The Ultimate Goal:** To support *any* arbitrary custom domain uploaded by a user, automatically generating a visual representation on-the-fly without requiring hand-coded rendering logic.

## 2. Project Evolution & Timeline

The project has evolved significantly since its inception in late 2025, moving from a basic visualizer to a complex, LLM-orchestrated system.

### Phase 1: The Foundation (Nov - Dec 2025)
*   **Initial Setup:** Created the React frontend and Python backend skeleton.
*   **Fast Downward Integration:** Added Fast Downward as a git submodule and built the Python wrapper (`run_planner.py`) to execute it.
*   **State Generation:** Built the Python `state_generator.py` to parse PDDL plans and simulate state transitions.
*   **Basic Renderers:** Hand-coded Python renderers and TypeScript Canvas logic for classic domains (Blocks World, Gripper, Depot, Hanoi, Rovers, Satellite, Logistics).
*   **Result:** A working visualizer for 7 built-in domains.

### Phase 2: The MCP Experiment (Jan 2026) - *Abandoned Approach*
*   **The Idea:** We attempted to use the Model Context Protocol (MCP) to let an LLM autonomously discover tools and generate renderers.
*   **The Implementation:** Built an `mcp_server.py` with tools like `get_generation_context`, `validate_renderer`, and various guideline tools (spatial relationships, collision avoidance).
*   **The Struggle:** The LLM orchestrator (`llm-orchestrator.ts`) struggled with the multi-step agentic loop. It was slow, prone to infinite loops, and often failed to generate valid TypeScript code. We tried integrating Ollama and HuggingFace for local/open-source models, but performance and quality were insufficient.
*   **The Pivot:** We realized the MCP approach was too complex and unreliable for generating deterministic Canvas code. We needed a more structured, pipeline-based approach.

### Phase 3: The V2 Architecture & Claude Skills (April 2026) - *Current Approach*
*   **The Pivot to V2:** We created the `V2` branch to completely overhaul the LLM integration.
*   **The Two-Stage Pipeline:** Instead of an autonomous agent, we split the problem into two deterministic stages:
    1.  **State Transformer:** Maps raw PDDL predicates to visual objects with coordinates.
    2.  **Canvas Renderer:** Generates the actual Canvas drawing code based on the transformed objects.
*   **Claude Skills API:** We adopted Anthropic's formal Skills API. We created strict `SKILL.md` definitions and `rules.md` for both stages, providing the LLM with exact interfaces and examples (e.g., `example-hanoi.ts`).
*   **Dynamic Execution:** We moved TypeScript transpilation to the backend (using the TS compiler API) and built a secure frontend execution engine to run the generated JavaScript on the fly.
*   **UI/UX Overhaul:** Applied a "Retro-Futuristic / Industrial-Utilitarian" design system (JetBrains Mono, IBM Plex Sans, dark mode with green accents). Redesigned the Configure menu to seamlessly toggle between Basic and Custom domains.

## 3. Current System Architecture (V2)

The project is a monorepo containing a React frontend and a Node.js/Python backend.

### Tech Stack
*   **Frontend:** React 19, TypeScript 5.7, Vite 6, Tailwind CSS 4, Radix UI, HTML5 Canvas.
*   **Backend API:** Node.js, Express, tRPC 11, Zod.
*   **Planning Engine:** Python 3.11+, Fast Downward (C++).
*   **LLM Integration:** Anthropic Claude (via Skills API) and Google Gemini (via Context Caching).

### The Two Pipelines

#### A. The Basic Flow (Built-in Domains)
For the 7 well-known domains, the system uses hand-coded logic.
1.  **Planner:** Fast Downward generates a plan from built-in PDDL files.
2.  **State Generator (Python):** Simulates the plan, generating raw predicate dictionaries.
3.  **State Renderer (Python):** A domain-specific Python class transforms predicates into positioned visual objects.
4.  **Canvas Renderer (TypeScript):** A hand-coded frontend function draws these objects on the Canvas.

#### B. The Custom Flow (LLM-Powered)
For user-uploaded custom domains, the system uses LLMs to generate rendering logic on-the-fly.
1.  **Planner:** Fast Downward generates a plan from uploaded PDDL files (with automatic domain name patching to prevent mismatches).
2.  **State Generator (Python):** Uses a `DefaultRenderer` that outputs generic JSON containing only raw predicates (no positions or colors).
3.  **LLM Stage 1 (State Transformer):** Claude/Gemini reads the PDDL domain and raw states, and generates a TypeScript function that maps predicates to visual objects with calculated coordinates and colors.
4.  **LLM Stage 2 (Canvas Renderer):** Claude/Gemini reads the transformed states and generates the actual TypeScript Canvas drawing code.
5.  **Dynamic Execution:** The frontend evaluates the generated JavaScript and renders the custom visualization.

## 4. Key Design Principles & Preferences

When working on this project, adhere to the following established preferences:

*   **Generalizable Instructions:** Focus on principles that apply across multiple domains rather than hardcoding constraints for a single domain.
*   **LLM Object Placement:** When LLMs generate visualization code, objects at the same logical location should be displayed alongside or below each other, not overlaying. Container objects should dynamically resize based on their contents.
*   **Clear Error Handling:** Never use fallback visualizations (like predefined plans) when an error occurs. Always show a clear, proper error message to the user.
*   **Custom Uploads:** Always provide both file upload and direct text input options for PDDL files.
*   **Legend Consistency:** Domain legends must be consistent across all states and include visual representations of all object types in that domain.
*   **Renderer Exports:** LLM-generated renderers must export three specific functions: `render[DomainName]`, `render[DomainName]Background`, and `render[DomainName]Legend`.
*   **API Preference:** Prioritize Anthropic Claude over OpenAI for LLM interactions.
*   **Local Testing:** Always test changes locally before deploying to the server (`132.73.84.70`).

## 5. Presentations & Deliverables

Throughout the project, we have prepared several academic deliverables:
*   **Submission Document:** A comprehensive Hebrew/English document detailing the testing plan (Unit, Integration, E2E), the user pilot study design (tasks, SUS questionnaires, metrics), and the project timeline.
*   **Presentations:** Slide decks (e.g., `Group6_Project7_Visualizing_Plans_of_Domain-Independent_Planners_using_LLMs.pptx`) explaining the core problem, the architecture, and the LLM pipeline to academic advisors.
*   **Pipeline Visualizations:** Detailed diagrams (Mermaid/Matplotlib) illustrating the data flow through both the Basic and Custom pipelines.

## 6. Current Status & Next Steps

The system is currently fully functional on the `V2` branch. The Basic flow works perfectly, and the Custom flow successfully accepts user PDDL, runs Fast Downward, triggers the two-stage Claude/Gemini pipeline, and renders the result dynamically.

**Immediate Next Steps / Future Work:**
1.  **Pilot Testing:** Conduct the planned user testing with real users to evaluate the UX and the quality of the LLM-generated visualizations for unseen domains.
2.  **Prompt Refinement:** Continuously improve the Claude Skill definitions (`SKILL.md`, `rules.md`) to ensure the LLM consistently generates high-quality, bug-free layout math and canvas drawing code.
3.  **Performance Optimization:** Optimize the transpilation and dynamic execution of the generated code on the frontend.
