# Python Modules Testing Guide

This directory contains test files for each Python module in the Planning Visualizer. You can run these tests independently in Visual Studio Code to verify that each component works correctly.

## Test Files

### 1. `test_planner.py` - Test Planner Module
Tests the `planner_runner` module which handles plan generation using Fast Downward or fallback mode.

**What it tests:**
- Blocks World domain planning
- Gripper domain planning
- Fast Downward integration or fallback mode
- Plan format and structure

**Run in VS Code:**
```bash
cd web-app/python_modules
python test_planner.py
```

**Expected output:**
- ✅ Success messages for each domain
- Plan length and actions list
- Planner type used (Fast Downward or Fallback)

---

### 2. `test_generator.py` - Test State Generator Module
Tests the `state_generator` module which generates intermediate states from plans.

**What it tests:**
- Blocks World state generation
- Gripper state generation
- Empty plan handling
- State structure and format

**Run in VS Code:**
```bash
cd web-app/python_modules
python test_generator.py
```

**Expected output:**
- ✅ Success messages for each test
- Number of states generated
- Initial and final state previews

---

### 3. `test_renderer.py` - Test State Renderer Module
Tests the `state_renderer` module which converts planning states to renderable data structures.

**What it tests:**
- Blocks World state rendering
- Gripper state rendering
- Invalid domain handling
- Complex state structures

**Run in VS Code:**
```bash
cd web-app/python_modules
python test_renderer.py
```

**Expected output:**
- ✅ Success messages for each test
- Render data structure keys
- Preview of rendered data

---

### 4. `test_all.py` - Comprehensive Integration Tests
Tests the complete pipeline: Planner → Generator → Renderer

**What it tests:**
- Full pipeline for Blocks World
- Full pipeline for Gripper
- Integration with manual sample data
- Data flow between modules

**Run in VS Code:**
```bash
cd web-app/python_modules
python test_all.py
```

**Expected output:**
- ✅ Success messages for each pipeline stage
- Confirmation that data flows correctly between modules
- Final summary of all tests

---

## Running Tests in Visual Studio Code

### Method 1: Using Terminal
1. Open VS Code
2. Open Terminal (View → Terminal or Ctrl+`)
3. Navigate to the python_modules directory:
   ```bash
   cd web-app/python_modules
   ```
4. Run any test file:
   ```bash
   python test_planner.py
   python test_generator.py
   python test_renderer.py
   python test_all.py
   ```

### Method 2: Using Run Button
1. Open any test file in VS Code
2. Click the "Run" button (▶️) in the top-right corner
3. Or press `Ctrl+F5` (Run Without Debugging)

### Method 3: Using Python Extension
1. Install the Python extension for VS Code (if not already installed)
2. Open any test file
3. Right-click in the editor → "Run Python File in Terminal"

---

## Interpreting Test Results

### Success Indicators
- ✅ Green checkmarks indicate passed tests
- Test summary shows `Passed: X, Failed: 0`
- Exit code 0 (success)

### Failure Indicators
- ❌ Red X marks indicate failed tests
- Error messages explain what went wrong
- Stack traces help identify the issue
- Exit code 1 (failure)

### Common Issues

**Issue: "Fast Downward not found"**
- Expected behavior in fallback mode
- Tests should still pass using pre-computed plans
- Not an error if fallback mode is working

**Issue: "Module not found"**
- Make sure you're in the `web-app/python_modules` directory
- Check that all required Python files exist

**Issue: "Python command not found"**
- Make sure Python 3 is installed
- Try using `python3` instead of `python`

---

## Test Coverage

Each test file focuses on a specific module:

| Test File | Module Tested | Test Count | Coverage |
|-----------|---------------|------------|----------|
| test_planner.py | planner_runner | 2 tests | Planner execution, fallback mode |
| test_generator.py | state_generator | 3 tests | State generation, edge cases |
| test_renderer.py | state_renderer | 4 tests | Rendering, error handling |
| test_all.py | Full pipeline | 3 tests | Integration, data flow |

**Total:** 12 individual tests covering the complete planning visualization pipeline.

---

## Debugging Tips

1. **Run tests individually** - Start with `test_planner.py`, then `test_generator.py`, then `test_renderer.py`
2. **Check error messages** - Read the full error output, not just the summary
3. **Use VS Code debugger** - Set breakpoints in test files and step through execution
4. **Check module imports** - Make sure all Python modules are in the correct location
5. **Verify Python version** - Use Python 3.7 or higher

---

## Adding New Tests

To add tests for new domains or features:

1. **Add to existing test files** - Add new test functions following the naming pattern `test_<feature>()`
2. **Update test lists** - Add your test function to the `tests` list in `main()`
3. **Follow the pattern** - Use the same structure as existing tests:
   ```python
   def test_new_feature():
       print("=" * 60)
       print("TEST: New Feature")
       print("=" * 60)
       
       # Test logic here
       
       if success:
           print("✅ SUCCESS")
           return True
       else:
           print("❌ FAILED")
           return False
   ```

---

## Continuous Integration

These test files can be integrated into CI/CD pipelines:

```bash
# Run all tests and exit with error code if any fail
python test_all.py && echo "All tests passed!" || echo "Tests failed!"
```

Use exit codes to determine pass/fail:
- Exit code 0 = All tests passed
- Exit code 1 = One or more tests failed
