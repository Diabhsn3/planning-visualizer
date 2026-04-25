# Basic Flow Pipeline: Component Input & Output Examples

This document traces the data flow through the **Basic Domain** pipeline (using the built-in `blocks-world` domain as an example). It shows exactly what data enters and exits each component in the system.

---

## 1. User Input (Frontend)

The user selects a built-in domain and problem from the Configure menu.

**Input:** User clicks "Blocks World" and "Problem 1".
**Output (API Request):**
```json
{
  "domainName": "blocks-world",
  "problemName": "p1.pddl",
  "strategyId": "astar"
}
```

---

## 2. Fast Downward Planner (Backend)

The backend reads the corresponding built-in PDDL files and passes them to the Fast Downward planner subprocess.

**Input (domain.pddl snippet):**
```lisp
(define (domain blocks-world)
  (:requirements :strips :typing)
  (:types block)
  (:predicates
    (on ?x - block ?y - block)
    (ontable ?x - block)
    (clear ?x - block)
    (handempty)
    (holding ?x - block)
  )
  ;; ... actions ...
)
```

**Input (p1.pddl snippet):**
```lisp
(define (problem bw-1)
  (:domain blocks-world)
  (:objects a b c - block)
  (:init
    (ontable a) (ontable b) (ontable c)
    (clear a) (clear b) (clear c)
    (handempty)
  )
  (:goal (and (on a b) (on b c)))
)
```

**Output (SAS Plan File):**
A sequence of grounded actions that solve the problem.
```text
(pick-up b)
(stack b c)
(pick-up a)
(stack a b)
; cost = 4
```

---

## 3. State Generator (Python)

The `StateGenerator` parses the initial state from the problem file, then applies the plan's actions one by one to simulate the world state at each step.

**Input:** The initial state predicates + the action sequence `["(pick-up b)", "(stack b c)", ...]`.

**Output (Raw State Objects JSON):**
An array of states. Each state is a dictionary grouping predicates by name.

*State 0 (Initial):*
```json
{
  "ontable": [["a"], ["b"], ["c"]],
  "clear": [["a"], ["b"], ["c"]],
  "handempty": [[]]
}
```

*State 1 (After `pick-up b`):*
```json
{
  "ontable": [["a"], ["c"]],
  "clear": [["a"], ["c"]],
  "holding": [["b"]]
}
```

---

## 4. Basic State Renderer (Python)

For built-in domains, a hand-coded Python class (e.g., `BlocksWorldRenderer`) transforms the raw predicate dictionaries into a structured `RenderedState` with visual objects and relations.

**Input:** The raw state dictionary (State 1 above).

**Output (RenderedState JSON):**
```json
{
  "domain": "blocks-world",
  "objects": [
    {
      "id": "a",
      "type": "block",
      "label": "A",
      "position": [50, 440],
      "properties": { "color": "#FF6B6B", "width": 60, "height": 60, "clear": true, "z_index": 0 }
    },
    {
      "id": "c",
      "type": "block",
      "label": "C",
      "position": [210, 440],
      "properties": { "color": "#45B7D1", "width": 60, "height": 60, "clear": true, "z_index": 0 }
    },
    {
      "id": "b",
      "type": "block",
      "label": "B",
      "position": [130, 210],
      "properties": { "color": "#4ECDC4", "width": 60, "height": 60, "held": true, "z_index": 100 }
    },
    {
      "id": "gripper",
      "type": "gripper",
      "label": "Hand",
      "position": [130, 200],
      "properties": { "empty": false, "holding": "b" }
    }
  ],
  "relations": [
    { "type": "ontable", "source": "a", "target": "table", "properties": { "relationship": "supported" } },
    { "type": "holding", "source": "gripper", "target": "b", "properties": { "relationship": "grasped" } }
  ]
}
```

---

## 5. StateCanvas (React Frontend)

The frontend receives the array of `RenderedState` objects. Because this is a built-in domain, `StateCanvas.tsx` routes the data to the hand-coded `renderBlocksWorld` TypeScript function.

**Input:** The `RenderedState` JSON object (shown above).

**Output (Canvas Drawing Commands):**
The function executes standard HTML5 Canvas API calls to draw the frame.
```typescript
// Snippet from renderBlocksWorld in StateCanvas.tsx
ctx.fillStyle = props.color; // e.g., "#4ECDC4" for block B
ctx.fillRect(x, y, width, height);

if (heldIds.has(obj.id)) {
  ctx.strokeStyle = "#ffd54f";
  ctx.lineWidth = 3;
  ctx.setLineDash([4, 4]);
  ctx.strokeRect(x - 3, y - 3, width + 6, height + 6);
}
```

**Final Result:** The user sees the animated step-by-step visualization on the screen.
