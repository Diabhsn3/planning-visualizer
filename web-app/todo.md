# Planning Visualizer Web - TODO

## Backend Integration
- [x] Create API endpoint to run planner and generate states
- [x] Integrate with existing Python modules (planner_runner, state_generator, state_renderer)
- [x] Handle PDDL file uploads
- [x] Return rendered states JSON

## Canvas Rendering
- [x] Create base Canvas renderer component
- [x] Implement Blocks World canvas renderer
- [x] Implement Gripper domain canvas renderer
- [x] Support for rendering VisualObjects with positions
- [x] Support for rendering VisualRelations

## Frontend UI
- [x] Create main visualizer page
- [x] Timeline component with state navigation
- [x] Play/pause animation controls
- [x] Step forward/backward buttons
- [x] Display current action and step number
- [x] Domain selector
- [x] PDDL file upload interface

## Visual Styling
- [x] Color scheme for different domains
- [x] Smooth transitions between states
- [x] Responsive canvas sizing
- [x] Loading states
- [x] Error handling UI

## Testing
- [x] Test with blocks_world domain
- [x] Test with gripper domain
- [x] Test timeline navigation
- [x] Test animation playback
- [x] End-to-end integration test

## Bug Fixes
- [x] Fix blocks appearing under the table in canvas rendering (Y-coordinate issue)

## New Features
- [x] Add PDDL file upload UI (domain and problem files)
- [x] Backend API to handle file uploads (uploadAndGenerate mutation)
- [x] Integrate uploaded files with Python planning pipeline
- [x] Validate uploaded PDDL files
- [x] Display uploaded file names in UI

## Future Enhancements
- [ ] Integrate actual Fast Downward planner for uploaded files (currently uses predefined plans)
- [ ] Add support for remaining 5 domains from roadmap
- [ ] Export visualization as GIF/video
- [ ] Share visualizations via public links
- [ ] Real-time planner execution progress

## Fast Downward Integration
- [x] Update UI: domain selection + problem file upload only
- [x] Create Python script to run Fast Downward planner
- [x] Integrate planner execution with backend API
- [x] Handle planner output and errors
- [x] Test with custom uploaded problems

## UI Improvements
- [x] Add text input option for PDDL content (alongside file upload)
- [x] Add tabs to switch between file upload and text input modes
- [x] Fix file upload issues
- [ ] Validate PDDL syntax before submission

## Bug Fixes (Current)
- [x] Fix text input not working when users paste PDDL content
- [x] Debug tab switching between Upload File and Paste Text (replaced tabs with button toggle)
- [x] Ensure Solve Problem button works with pasted text

## Critical Bug
- [x] Fix text input still not working - test end-to-end flow (UI works, Python backend fails)
- [x] Debug why Solve Problem button doesn't work with pasted text (Python version mismatch)
- [x] Fix Python 3.11/3.13 module mismatch error (SRE module) - cleared PYTHONPATH
- [x] Clear PYTHONPATH to prevent Python 3.13 imports in Python 3.11

## JSON Parsing Fix
- [x] Suppress Python warnings that are breaking JSON output
- [x] Redirect warnings to stderr instead of stdout
- [x] Test end-to-end with pasted PDDL content

## Fast Downward Dynamic Integration
- [x] Check Fast Downward submodule status and build
- [x] Build Fast Downward planner if not already built
- [x] Update run_planner.py to use actual Fast Downward instead of fallback plans
- [x] Test dynamic planning with Blocks World problems
- [x] Test dynamic planning with Gripper problems
- [x] Handle planner errors and timeouts gracefully
- [ ] Update documentation with Fast Downward setup instructions
