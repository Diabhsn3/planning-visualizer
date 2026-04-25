# Custom Flow Pipeline: Component Input & Output Examples

This document traces the data flow through the **Custom Domain** pipeline (using a hypothetical user-uploaded domain). It shows exactly what data enters and exits each component, highlighting the two-stage LLM generation process.

---

## 1. User Input (Frontend)

The user selects "Custom" in the Configure menu and uploads their own PDDL files.

**Input:** User uploads `my-domain.pddl` and `my-problem.pddl`.
**Output (API Request):**
```json
{
  "domainName": "custom",
  "domainContent": "(define (domain my-domain) ...)",
  "problemContent": "(define (problem my-problem) ...)",
  "strategyId": "astar"
}
```

---

## 2. Fast Downward Planner (Backend)

The backend saves the uploaded content to temporary files. It parses the actual domain name from the domain file and patches the problem file to match, then runs Fast Downward.

**Input (my-domain.pddl snippet):**
```lisp
(define (domain my-domain)
  (:requirements :typing)
  (:types location vehicle)
  (:predicates
    (at ?v - vehicle ?l - location)
    (connected ?l1 - location ?l2 - location)
  )
  (:action drive
    :parameters (?v - vehicle ?from - location ?to - location)
    :precondition (and (at ?v ?from) (connected ?from ?to))
    :effect (and (not (at ?v ?from)) (at ?v ?to))
  )
)
```

**Output (SAS Plan File):**
```text
(drive car1 locA locB)
(drive car1 locB locC)
; cost = 2
```

---

## 3. State Generator (Python)

The `StateGenerator` parses the initial state and applies the plan's actions.

**Input:** The initial state predicates + the action sequence.

**Output (Raw State Objects JSON):**
Because there is no hand-coded renderer for `my-domain`, the Python backend uses a `DefaultRenderer` that simply dumps the raw predicates into a generic JSON structure.

*State 1 (After `drive car1 locA locB`):*
```json
{
  "domain": "my-domain",
  "objects": [
    { "id": "car1", "type": "vehicle", "label": "car1", "properties": { "status": "unknown" } },
    { "id": "locA", "type": "location", "label": "locA", "properties": { "status": "unknown" } },
    { "id": "locB", "type": "location", "label": "locB", "properties": { "status": "unknown" } }
  ],
  "relations": [
    { "type": "at", "source": "car1", "target": "locB" },
    { "type": "connected", "source": "locA", "target": "locB" }
  ],
  "metadata": { "step": 1, "action": "(drive car1 locA locB)" }
}
```

---

## 4. LLM Pipeline Stage 1: State Transformer (Claude/Gemini)

The backend sends the raw PDDL domain text and a few sample raw states to the LLM (via `llm-domain-interpreter.ts`). The LLM generates a TypeScript function that maps raw predicates to visual objects with coordinates and colors.

**Input:**
- `domainPddl`: The full text of `my-domain.pddl`
- `sampleStates`: The raw JSON output from Step 3

**Output (Generated TypeScript Code):**
The LLM writes a file (e.g., `my-domain_claude_transformer.ts`) containing:
```typescript
export function transformMyDomain(raw: RawState): RenderedState {
  const vehicles = raw.objects.filter(o => o.type === "vehicle");
  const locations = raw.objects.filter(o => o.type === "location");
  
  // 1. Map locations to fixed coordinates
  const locPositions: Record<string, [number, number]> = {
    "locA": [100, 300],
    "locB": [400, 300],
    "locC": [700, 300]
  };

  // 2. Find where vehicles are
  const vehicleAt: Record<string, string> = {};
  for (const rel of raw.relations) {
    if (rel.type === "at" && rel.target) {
      vehicleAt[rel.source] = rel.target;
    }
  }

  // 3. Build enriched visual objects
  const visualObjects: VisualObject[] = [];
  
  for (const loc of locations) {
    visualObjects.push({
      id: loc.id, type: "location", label: loc.label.toUpperCase(),
      position: locPositions[loc.id] || [0, 0],
      properties: { color: "#4CAF50", radius: 40 }
    });
  }

  for (const v of vehicles) {
    const locId = vehicleAt[v.id];
    const basePos = locPositions[locId] || [0, 0];
    visualObjects.push({
      id: v.id, type: "vehicle", label: v.label,
      position: [basePos[0], basePos[1] - 50], // Hover above location
      properties: { color: "#F44336", width: 60, height: 30 }
    });
  }

  return { domain: raw.domain, objects: visualObjects, relations: raw.relations };
}
```

---

## 5. LLM Pipeline Stage 2: Canvas Renderer (Claude/Gemini)

The backend transpiles the transformer, runs it on all states, and sends the *transformed* states to the LLM (via `llm-renderer.ts`) to generate the actual Canvas drawing code.

**Input:**
- `domainPddl`: The full text of `my-domain.pddl`
- `transformedStates`: The output of the transformer from Stage 1

**Output (Generated TypeScript Code):**
The LLM writes a file (e.g., `my-domain_claude_renderer.ts`) containing:
```typescript
export function renderMyDomain(ctx: CanvasRenderingContext2D, state: RenderedState) {
  const locations = state.objects.filter(o => o.type === "location");
  const vehicles = state.objects.filter(o => o.type === "vehicle");

  // Draw connections (roads)
  ctx.strokeStyle = "#999";
  ctx.lineWidth = 4;
  for (const rel of state.relations) {
    if (rel.type === "connected") {
      const src = locations.find(l => l.id === rel.source);
      const tgt = locations.find(l => l.id === rel.target);
      if (src?.position && tgt?.position) {
        ctx.beginPath();
        ctx.moveTo(src.position[0], src.position[1]);
        ctx.lineTo(tgt.position[0], tgt.position[1]);
        ctx.stroke();
      }
    }
  }

  // Draw locations (circles)
  for (const loc of locations) {
    const [x, y] = loc.position!;
    ctx.fillStyle = loc.properties?.color || "#ccc";
    ctx.beginPath();
    ctx.arc(x, y, loc.properties?.radius || 40, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.fillStyle = "#fff";
    ctx.font = "bold 16px Arial";
    ctx.textAlign = "center";
    ctx.fillText(loc.label, x, y);
  }

  // Draw vehicles (rectangles)
  for (const v of vehicles) {
    const [x, y] = v.position!;
    const w = v.properties?.width || 60;
    const h = v.properties?.height || 30;
    
    ctx.fillStyle = v.properties?.color || "#f00";
    ctx.fillRect(x - w/2, y - h/2, w, h);
    
    ctx.fillStyle = "#fff";
    ctx.font = "12px Arial";
    ctx.fillText(v.label, x, y);
  }
}
```

---

## 6. StateCanvas (React Frontend)

The backend transpiles the generated renderer to JavaScript and sends it to the frontend along with the transformed states.

**Input:**
- The array of `RenderedState` objects (from Stage 1)
- The transpiled JavaScript string of `renderMyDomain` (from Stage 2)

**Output (Canvas Drawing Commands):**
The frontend uses `new Function()` to evaluate the generated JavaScript string, creating a callable renderer function in the browser. It then passes the Canvas context and the current state to this function.

**Final Result:** The user sees a custom-tailored, animated visualization of their uploaded domain, generated entirely on-the-fly.
