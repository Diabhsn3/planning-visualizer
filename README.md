# Planning Visualizer

Visualizing plans from a classical planner (Fast Downward) for several PDDL domains
(Blocks World, Logistics, Depot, Gripper, Hanoi, Rovers, Satellite).

## Prerequisites

- Python 3.10+  
- `git`  
- C++ toolchain + CMake (needed to build Fast Downward)

## Getting started

```bash
git clone https://github.com/Diabhsn3/planning-visualizer.git
cd planning-visualizer

git submodule update --init --recursive

python3 -m venv venv
source venv/bin/activate      # Windows: venv\Scripts\activate

pip install -r requirements.txt

cd planning-tools/downward
./build.py release
cd ../..

python tests/test1.py
