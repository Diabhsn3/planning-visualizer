# Planning Domains

This directory contains PDDL domain and problem files for various classical planning domains.

## Implemented Domains

### ✅ Blocks World
**Status:** Fully implemented with renderer  
**Files:** `blocks_world/domain.pddl`, `blocks_world/p1.pddl`  
**Renderer:** `state_renderer/blocks_world_renderer.py`  
**Description:** Classic block stacking problem with pick-up, put-down, stack, and unstack actions.

### ✅ Gripper
**Status:** Fully implemented with renderer  
**Files:** `gripper/domain.pddl`, `gripper/p1.pddl`  
**Renderer:** `state_renderer/gripper_renderer.py`  
**Description:** Robot with grippers moving balls between rooms.

---

## TODO: Domains Ready for Implementation

The following domains have PDDL files and renderer templates prepared. To activate them:

### 🔨 Depot
**Status:** PDDL files ready, renderer template created  
**Files:** `depot/domain.pddl`, `depot/p1.pddl`  
**Renderer Template:** `state_renderer/depot_renderer.py`  
**Description:** Trucks and hoists transporting crates between depots and distributors.

**Implementation Steps:**
1. Implement `parse_state()` in `depot_renderer.py`
2. Implement `render_state()` in `depot_renderer.py`
3. Uncomment import in `state_renderer/__init__.py`
4. Add to `_renderers` registry
5. Add to `DOMAIN_CONFIGS` in `backend/api/visualizer.ts`
6. Test with `depot/p1.pddl`

### 🔨 Hanoi (Tower of Hanoi)
**Status:** PDDL files ready, renderer template created  
**Files:** `hanoi/domain.pddl`, `hanoi/p1.pddl`  
**Renderer Template:** `state_renderer/hanoi_renderer.py`  
**Description:** Classic Tower of Hanoi puzzle with disks and pegs.

**Implementation Steps:**
1. Implement `parse_state()` in `hanoi_renderer.py`
2. Implement `render_state()` in `hanoi_renderer.py`
3. Uncomment import in `state_renderer/__init__.py`
4. Add to `_renderers` registry
5. Add to `DOMAIN_CONFIGS` in `backend/api/visualizer.ts`
6. Test with `hanoi/p1.pddl`

### 🔨 Logistics
**Status:** PDDL files ready, renderer template created  
**Files:** `logistics/domain.pddl`, `logistics/p1.pddl`  
**Renderer Template:** `state_renderer/logistics_renderer.py`  
**Description:** Trucks and airplanes delivering packages between cities.

**Implementation Steps:**
1. Implement `parse_state()` in `logistics_renderer.py`
2. Implement `render_state()` in `logistics_renderer.py`
3. Uncomment import in `state_renderer/__init__.py`
4. Add to `_renderers` registry
5. Add to `DOMAIN_CONFIGS` in `backend/api/visualizer.ts`
6. Test with `logistics/p1.pddl`

### 🔨 Rovers
**Status:** PDDL files ready, renderer template created  
**Files:** `rovers/domain.pddl`, `rovers/p1.pddl`  
**Renderer Template:** `state_renderer/rovers_renderer.py`  
**Description:** Planetary rovers navigating waypoints and collecting samples.

**Implementation Steps:**
1. Implement `parse_state()` in `rovers_renderer.py`
2. Implement `render_state()` in `rovers_renderer.py`
3. Uncomment import in `state_renderer/__init__.py`
4. Add to `_renderers` registry
5. Add to `DOMAIN_CONFIGS` in `backend/api/visualizer.ts`
6. Test with `rovers/p1.pddl`

### 🔨 Satellite
**Status:** PDDL files ready, renderer template created  
**Files:** `satellite/domain.pddl`, `satellite/p1.pddl`  
**Renderer Template:** `state_renderer/satellite_renderer.py`  
**Description:** Satellites with instruments observing celestial targets.

**Implementation Steps:**
1. Implement `parse_state()` in `satellite_renderer.py`
2. Implement `render_state()` in `satellite_renderer.py`
3. Uncomment import in `state_renderer/__init__.py`
4. Add to `_renderers` registry
5. Add to `DOMAIN_CONFIGS` in `backend/api/visualizer.ts`
6. Test with `satellite/p1.pddl`

---

## Adding a New Domain

To add a completely new domain:

1. **Create domain folder** with PDDL files:
   ```
   domains/your_domain/
   ├── domain.pddl    # Domain definition
   └── p1.pddl        # Example problem
   ```

2. **Create renderer** in `state_renderer/`:
   ```python
   from .base_renderer import BaseRenderer, RenderedState
   
   class YourDomainRenderer(BaseRenderer):
       def parse_state(self, state_str: str) -> Dict[str, Any]:
           # Parse PDDL state
           pass
       
       def render_state(self, state_data: Dict[str, Any], state_index: int) -> RenderedState:
           # Create visual representation
           pass
   ```

3. **Register renderer** in `state_renderer/__init__.py`:
   ```python
   from .your_domain_renderer import YourDomainRenderer
   
   _renderers = {
       'your-domain': YourDomainRenderer,
   }
   ```

4. **Add to API config** in `backend/api/visualizer.ts`:
   ```typescript
   const DOMAIN_CONFIGS = {
     "your-domain": {
       name: "Your Domain",
       domainFile: "domains/your_domain/domain.pddl",
       problemFile: "domains/your_domain/p1.pddl",
     },
   };
   ```

5. **Test** with Fast Downward and verify visualization.

---

## Renderer Design Guidelines

### State Parsing
- Extract all relevant objects and their properties
- Parse predicates to determine relationships
- Handle different problem sizes gracefully

### Visual Representation
- Use distinct colors for different object types
- Ensure layout scales with problem size
- Make state changes visually obvious
- Include labels for clarity

### Reference Implementations
- **Simple stacking:** See `blocks_world_renderer.py`
- **Multi-room layout:** See `gripper_renderer.py`
- **Color schemes:** Check existing renderers for consistency

---

## Testing

Test your renderer with:
```bash
cd backend/planner
python3 run_planner.py --domain your-domain --problem domains/your_domain/p1.pddl
```

Or use the web interface:
1. Select your domain from dropdown
2. Click "Generate States"
3. Verify visualization renders correctly
4. Check that state transitions are clear
