# Planning Visualizer

A modular framework that executes the **Fast Downward** classical planner on multiple PDDL domains and extracts grounded action sequences. This output will later feed into a visualization pipeline.

Supported example domains: **Blocks World, Logistics, Depot, Gripper, Hanoi, Rovers, Satellite.**

---

## 1. Prerequisites

- Python 3.10+
- Git
- CMake + C++ toolchain  
  - macOS: install Xcode CLI tools:  
    ```bash
    xcode-select --install
    ```

---

## 2. Clone and Set Up the Repository

```bash
git clone https://github.com/Diabhsn3/planning-visualizer.git
cd planning-visualizer

git submodule update --init --recursive
```

---

## 3. Create Virtual Environment & Install Dependencies

```bash
python3 -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate

pip install -r requirements.txt
```

---

## 4. Build Fast Downward

```bash
cd planning-tools/downward
./build.py release
cd ../..
```

The resulting binary will appear at:

```
planning-tools/downward/builds/release/bin/downward
```

---

## 5. Smoke Test

Run the multi‑domain test script:

```bash
python tests/test1.py
```

Expected output: a plan for each domain listed above.

---

## 6. Project Structure

```
planning-visualizer/
├── domains/                  
│   ├── blocks_world/
│   ├── logistics/
│   ├── depot/
│   ├── gripper/
│   ├── hanoi/
│   ├── rovers/
│   └── satellite/
├── planning-tools/
│   └── downward/
├── src/
│   └── planner_runner/
│       └── runner.py
├── tests/
│   └── test1.py
├── requirements.txt
└── README.md
```

---

## 7. Using `run_planner`

```python
from src.planner_runner.runner import run_planner

actions = run_planner(
    "domains/blocks_world/domain.pddl",
    "domains/blocks_world/p1.pddl",
)

print(actions)
```

`actions` is a list of grounded operator names returned by Fast Downward.

---

## 8. Troubleshooting

### Issue: `ModuleNotFoundError: No module named 'src'`
Run Python from the repository root:

```bash
cd planning-visualizer
source venv/bin/activate
python tests/test1.py
```

### Issue: Submodule Missing or Empty

```bash
git submodule update --init --recursive
cd planning-tools/downward
./build.py release
```

If needed, reclone:

```bash
cd ..
rm -rf planning-visualizer
git clone https://github.com/Diabhsn3/planning-visualizer.git
cd planning-visualizer
git submodule update --init --recursive
```

---
