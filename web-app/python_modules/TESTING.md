# Python Modules Testing Guide

Simple test files to verify that the Planning Visualizer works correctly for each domain.

## Quick Start

Run tests from the `web-app/python_modules` directory:

```bash
cd web-app/python_modules

# Test individual domains
python test_blocksworld.py
python test_gripper.py

# Test all domains at once
python test_domains.py
```

---

## Test Files

### `test_blocksworld.py` - Blocks World Domain Test
Tests the complete visualizer pipeline for the Blocks World domain using the built-in example problem.

**What it does:**
- Runs the planner (or uses fallback plan)
- Generates intermediate states
- Renders states for visualization
- Shows the complete plan and output

**Run:**
```bash
python test_blocksworld.py
```

**Expected output:**
```
======================================================================
BLOCKS WORLD DOMAIN TEST
======================================================================

Running visualizer for Blocks World domain...
This uses the built-in example problem.

✅ SUCCESS!

Domain: blocksworld
Planner used: fallback
Plan length: 8 actions
Number of states: 9

📋 Plan:
   1. unstack d c
   2. put-down d
   3. unstack c b
   4. stack c d
   5. pick-up b
   6. stack b c
   7. pick-up a
   8. stack a b

🎨 Rendered states:
   Initial state: {...}
   Final state: {...}

✅ All steps completed successfully!
The visualizer is working correctly for Blocks World domain.
```

---

### `test_gripper.py` - Gripper Domain Test
Tests the complete visualizer pipeline for the Gripper domain using the built-in example problem.

**What it does:**
- Runs the planner (or uses fallback plan)
- Generates intermediate states
- Renders states for visualization
- Shows the complete plan and output

**Run:**
```bash
python test_gripper.py
```

**Expected output:**
```
======================================================================
GRIPPER DOMAIN TEST
======================================================================

Running visualizer for Gripper domain...
This uses the built-in example problem.

✅ SUCCESS!

Domain: gripper
Planner used: fallback
Plan length: 5 actions
Number of states: 6

📋 Plan:
   1. (pick ball1 rooma left)
   2. (pick ball2 rooma right)
   3. (move rooma roomb)
   4. (drop ball1 roomb left)
   5. (drop ball2 roomb right)

🎨 Rendered states:
   Initial state: {...}
   Final state: {...}

✅ All steps completed successfully!
The visualizer is working correctly for Gripper domain.
```

---

### `test_domains.py` - All Domains Test
Runs tests for all available domains and provides a summary.

**What it does:**
- Tests Blocks World domain
- Tests Gripper domain
- Shows summary of results

**Run:**
```bash
python test_domains.py
```

**Expected output:**
```
======================================================================
PLANNING VISUALIZER - DOMAIN TESTS
======================================================================

Testing all available domains with example problems...

======================================================================
BLOCKSWORLD DOMAIN TEST
======================================================================
...
✅ blocksworld test passed!

======================================================================
GRIPPER DOMAIN TEST
======================================================================
...
✅ gripper test passed!

======================================================================
TEST SUMMARY
======================================================================
blocksworld     ✅ PASSED
gripper         ✅ PASSED

Total: 2 domains
✅ Passed: 2
❌ Failed: 0

🎉 All domain tests passed!
The Planning Visualizer is working correctly!
```

---

## Running Tests in Visual Studio Code

### Method 1: Terminal
1. Open VS Code
2. Open Terminal (View → Terminal or Ctrl+`)
3. Navigate to python_modules:
   ```bash
   cd web-app/python_modules
   ```
4. Run any test:
   ```bash
   python test_blocksworld.py
   python test_gripper.py
   python test_domains.py
   ```

### Method 2: Run Button
1. Open any test file in VS Code
2. Click the "Run" button (▶️) in the top-right corner
3. Or press `Ctrl+F5` (Run Without Debugging)

### Method 3: Right-click Menu
1. Open any test file in VS Code
2. Right-click in the editor
3. Select "Run Python File in Terminal"

---

## Understanding the Output

### Success Indicators
- ✅ Green checkmarks indicate success
- Shows domain name, plan length, and number of states
- Displays the complete plan
- Shows preview of initial and final states

### Failure Indicators
- ❌ Red X marks indicate failure
- Error message explains what went wrong
- Stack trace helps identify the issue

### What Each Test Validates
Each test verifies the complete pipeline:
1. **Planner** - Generates a plan (or uses fallback)
2. **State Generator** - Creates intermediate states from the plan
3. **State Renderer** - Converts states to renderable format

If all tests pass, the entire Planning Visualizer is working correctly!

---

## Troubleshooting

### "No module named 'visualizer_api'"
**Solution:** Make sure you're running the test from the `web-app/python_modules` directory:
```bash
cd web-app/python_modules
python test_domains.py
```

### "Python command not found"
**Solution:** Make sure Python 3 is installed. Try using `python3` instead:
```bash
python3 test_domains.py
```

### Tests pass but web app doesn't work
**Solution:** The tests verify the Python backend. If tests pass but the web app fails, check:
1. Is the web server running? (`pnpm dev` in `web-app` directory)
2. Check browser console for JavaScript errors
3. Check server logs for API errors

---

## Adding Tests for New Domains

When you add a new domain to the visualizer, create a test file:

1. Copy an existing test file:
   ```bash
   cp test_gripper.py test_newdomain.py
   ```

2. Edit the file and change the domain name:
   ```python
   result = visualize_plan_fallback("newdomain")
   ```

3. Add the new domain to `test_domains.py`:
   ```python
   domains = ["blocksworld", "gripper", "newdomain"]
   ```

4. Run the test:
   ```bash
   python test_newdomain.py
   ```

---

## What These Tests Don't Cover

These simple tests verify the core functionality but don't test:
- Custom PDDL file uploads
- Error handling for invalid inputs
- Performance with large problems
- UI/frontend components

For comprehensive testing, use the web application and try different scenarios manually.

---

## Summary

**Three simple test files:**
- `test_blocksworld.py` - Test Blocks World domain
- `test_gripper.py` - Test Gripper domain  
- `test_domains.py` - Test all domains at once

**One command to test everything:**
```bash
cd web-app/python_modules && python test_domains.py
```

If this passes, your Planning Visualizer is working correctly! 🎉
