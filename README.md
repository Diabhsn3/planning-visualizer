# Planning Visualizer

Visualizing plans from a classical planner (**Fast Downward**) for several PDDL domains:
Blocks World, Logistics, Depot, Gripper, Hanoi, Rovers, Satellite.  [oai_citation:0‡README.md](sediment://file_00000000794c71fd9f75ec39ce23c1a2)

The project runs a PDDL planner, extracts the action sequence, and (next steps) will feed it
into a visualization pipeline.

---

## 1. Prerequisites

- Python 3.10+
- `git`
- C++ toolchain + CMake (needed to build Fast Downward)
  - On macOS: Xcode Command Line Tools are enough (`xcode-select --install`)

---

## 2. Clone and set up the repo

```bash
# Clone
git clone https://github.com/Diabhsn3/planning-visualizer.git
cd planning-visualizer

# Pull Fast Downward submodule
git submodule update --init --recursive


⸻

3. Create virtual environment & install Python deps

python3 -m venv venv
source venv/bin/activate    # On Windows: venv\Scripts\activate

pip install -r requirements.txt


⸻

4. Build Fast Downward

From the project root:

cd planning-tools/downward
./build.py release
cd ../..

This should create the planner binary under:

planning-tools/downward/builds/release/bin/downward


⸻

5. Smoke test: run example domains

There is a simple smoke-test script that runs the planner on multiple domains:

python tests/test1.py

You should see printed plans for:
	•	Blocks World
	•	Logistics
	•	Depot
	•	Gripper
	•	Hanoi
	•	Rovers
	•	Satellite

If this works, your environment is wired correctly.

⸻

6. Project structure

planning-visualizer/
├── domains/                   # PDDL domains + example problems
│   ├── blocks_world/
│   ├── logistics/
│   ├── depot/
│   ├── gripper/
│   ├── hanoi/
│   ├── rovers/
│   └── satellite/
├── planning-tools/
│   └── downward/              # Fast Downward (git submodule)
├── src/
│   └── planner_runner/
│       └── runner.py          # run_planner(domain_pddl, problem_pddl)
├── tests/
│   └── test1.py               # Simple script that calls run_planner()
├── requirements.txt
└── README.md


⸻

7. Using run_planner in your own code

Example usage:

from src.planner_runner.runner import run_planner

actions = run_planner(
    "domains/blocks_world/domain.pddl",
    "domains/blocks_world/p1.pddl",
)

print("PLAN:", actions)

actions is a list of grounded operator names returned by Fast Downward.

⸻

8. Common issues / troubleshooting

1. ModuleNotFoundError: No module named 'src'

Make sure you run Python from the project root:

cd planning-visualizer
source venv/bin/activate
python tests/test1.py

2. Submodule errors after clone

If Fast Downward did not appear:

git submodule update --init --recursive
cd planning-tools/downward
./build.py release

If that fails, delete the clone and restart:

cd ..
rm -rf planning-visualizer
git clone https://github.com/Diabhsn3/planning-visualizer.git
cd planning-visualizer
git submodule update --init --recursive


⸻


