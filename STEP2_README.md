# Step 2 - State Generator

This document describes the implementation of **Step 2: State Generator** for the Planning Visualizer project.

## Overview

The State Generator module parses PDDL domain and problem files, then generates intermediate states by applying a sequence of grounded actions. This is essential for visualizing the planning process step-by-step.

## Architecture

The implementation consists of three main components:

### 1. PDDL Parser (`src/state_generator/pddl_parser.py`)

Parses both domain and problem PDDL files to extract:

**From Domain File:**
- Domain name
- Action schemas with parameters, preconditions, and effects
- Predicate schemas

**From Problem File:**
- Problem name
- Objects and their types
- Initial state (set of grounded predicates)
- Goal conditions

**Key Classes:**
- `Predicate`: Represents a grounded or ungrounded predicate
- `Action`: Represents an action schema with preconditions and effects
- `PDDLParser`: Main parser class

### 2. State Generator (`src/state_generator/state_generator.py`)

Generates intermediate states by applying actions sequentially:

**Key Features:**
- Maintains current state as a set of predicates
- Parses grounded action strings (e.g., `"(pick-up a)"`)
- Grounds action schemas by binding variables to objects
- Checks preconditions before applying actions
- Applies effects to generate new states
- Tracks state history

**Key Methods:**
- `apply_action(grounded_action)`: Apply a single grounded action
- `apply_plan(plan)`: Apply a sequence of actions
- `generate_states_json(plan)`: Generate JSON representation of all states

### 3. Module Interface (`src/state_generator/__init__.py`)

Exports the main classes for easy importing.

## Usage

### Basic Usage

```python
from src.state_generator import StateGenerator

# Initialize with domain and problem files
sg = StateGenerator(
    "domains/blocks_world/domain.pddl",
    "domains/blocks_world/p1.pddl"
)

# Define a plan (sequence of grounded actions)
plan = [
    "(pick-up b)",
    "(stack b c)",
    "(pick-up a)",
    "(stack a b)"
]

# Generate all intermediate states
states = sg.apply_plan(plan)

# Convert to JSON format
states_json = sg.generate_states_json(plan)
```

### Integration with Planner Runner

```python
from src.planner_runner.runner import run_planner
from src.state_generator import StateGenerator

# Step 1: Get plan from Fast Downward
plan = run_planner(
    "domains/blocks_world/domain.pddl",
    "domains/blocks_world/p1.pddl"
)

# Step 2: Generate states
sg = StateGenerator(
    "domains/blocks_world/domain.pddl",
    "domains/blocks_world/p1.pddl"
)
states = sg.apply_plan(plan)
```

## Testing

Two test files are provided:

### 1. Standalone Test (No Fast Downward Required)

```bash
python tests/test_state_generator_standalone.py
```

This test uses predefined action sequences and does NOT require Fast Downward to be built. It's useful for:
- Testing the PDDL parser
- Testing state generation logic
- Quick iteration during development

### 2. Full Integration Test (Requires Fast Downward)

```bash
python tests/test_state_generator.py
```

This test integrates with Fast Downward to:
- Run the planner on multiple domains
- Generate states from the actual plans
- Verify end-to-end functionality

## Output Format

The state generator produces JSON output with the following structure:

```json
{
  "domain": "blocks-world",
  "problem": "bw-1",
  "objects": {
    "a": "block",
    "b": "block",
    "c": "block"
  },
  "plan": [
    "(pick-up b)",
    "(stack b c)",
    "(pick-up a)",
    "(stack a b)"
  ],
  "num_states": 5,
  "states": [
    {
      "ontable": [["a"], ["b"], ["c"]],
      "clear": [["a"], ["b"], ["c"]],
      "handempty": [[]]
    },
    {
      "clear": [["a"], ["c"]],
      "holding": [["b"]],
      "ontable": [["a"], ["c"]]
    },
    ...
  ]
}
```

Each state is represented as a dictionary where:
- **Keys** are predicate names
- **Values** are lists of parameter lists

For example:
- `"handempty": [[]]` - predicate with no parameters
- `"clear": [["a"], ["b"]]` - predicate with one parameter, multiple instances
- `"on": [["a", "b"], ["b", "c"]]` - predicate with two parameters

## Example: Blocks World

**Initial State:**
```
(ontable a)
(ontable b)
(ontable c)
(clear a)
(clear b)
(clear c)
(handempty)
```

**Goal:**
```
(on a b)
(on b c)
```

**Plan:**
1. `(pick-up b)` - Pick up block b from table
2. `(stack b c)` - Stack b on c
3. `(pick-up a)` - Pick up block a from table
4. `(stack a b)` - Stack a on b

**Final State:**
```
(ontable c)
(on b c)
(on a b)
(clear a)
(handempty)
```

The state generator produces 5 states total (initial + 4 intermediate states).

## Implementation Details

### Predicate Representation

Predicates are represented as `Predicate` objects with:
- `name`: Predicate name (e.g., "on", "clear")
- `params`: List of parameters (e.g., ["a", "b"])

Predicates are hashable and can be stored in sets for efficient state representation.

### Action Grounding

Actions are grounded by:
1. Parsing the grounded action string to extract action name and parameters
2. Looking up the action schema in the domain
3. Creating a variable binding (e.g., `{?x: "a", ?y: "b"}`)
4. Substituting variables in preconditions and effects

### Precondition Checking

Before applying an action:
1. Ground all preconditions using the variable binding
2. Check positive preconditions (must be in current state)
3. Check negative preconditions (must NOT be in current state)
4. If any check fails, the action is not applied

### Effect Application

After preconditions are satisfied:
1. Ground all effects using the variable binding
2. Add positive effects to the state
3. Remove negative effects from the state
4. Save the new state to history

## Supported PDDL Features

The parser currently supports:
- `:strips` requirement
- `:typing` requirement
- Typed objects and parameters
- Positive and negative preconditions
- Positive and negative effects
- Conjunctive preconditions and effects (`and`)
- Single predicates (no `and`)

**Not yet supported:**
- Conditional effects
- Quantifiers (forall, exists)
- Numeric fluents
- Durative actions
- Preferences and constraints

## File Structure

```
src/state_generator/
├── __init__.py           # Module interface
├── pddl_parser.py        # PDDL parsing logic
└── state_generator.py    # State generation logic

tests/
├── test_state_generator.py              # Full integration test
└── test_state_generator_standalone.py   # Standalone test

output/
├── blocks_world_states.json  # Generated states
└── gripper_states.json       # Generated states
```

## Next Steps

After completing Step 2, you can proceed to:

1. **Step 3: State Renderer** - Create visual representations of states
2. **Step 4: Complete State Renderer** - Add domain-specific rendering for all predicates

The JSON output from Step 2 serves as input for the visualization components.

## Troubleshooting

### Issue: "Action not found in domain"

**Cause:** The action name in the grounded action doesn't match any action in the domain.

**Solution:** Check that action names are spelled correctly and match the domain definition.

### Issue: "Preconditions not satisfied"

**Cause:** The action cannot be applied because its preconditions are not met in the current state.

**Solution:** 
- Verify the plan is correct
- Check the initial state
- Debug by printing the current state and preconditions

### Issue: "Parameter count mismatch"

**Cause:** The number of parameters in the grounded action doesn't match the action schema.

**Solution:** Ensure the grounded action has the correct number of parameters.

## Testing Checklist

- [x] PDDL parser correctly parses domain files
- [x] PDDL parser correctly parses problem files
- [x] State generator applies actions correctly
- [x] Preconditions are checked before applying actions
- [x] Effects are applied correctly
- [x] State history is tracked
- [x] JSON output is generated correctly
- [x] Goal state is achieved for test problems
- [x] Integration with planner runner works (requires Fast Downward)

## Credits

Implemented as part of the Planning Visualizer project for visualizing classical planning algorithms.
