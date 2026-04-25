# PDDL Domain Interpreter — Rules & Best Practices

## Mandatory Rules

### Code Structure
1. **No imports.** Do NOT include any `import` statements. All interfaces must be declared inline at the top of the file. Copy them verbatim from `interfaces.ts`.
2. **No async.** The transformer function must be fully synchronous. No `async`, no `await`, no Promises, no `setTimeout`.
3. **No side effects.** The function must be pure — no global variables, no mutation of input, no `console.log` in the final output.
4. **No TypeScript enums.** Use string literal types or plain constants instead. Enums do not transpile cleanly in this environment.
5. **Single export.** Export exactly one function: `export function transformDomainName(raw: RawState): RenderedState`. The name must be `transform` + CamelCase domain name.

### Position Requirements
6. **Every object must have a position.** The `position: [x, y]` field is REQUIRED on every `VisualObject`. The Canvas renderer will not draw objects without it.
7. **Canvas coordinate system.** Positions are in pixels. The canvas is **800 × 600** pixels. Origin (0, 0) is at the **top-left**. Y increases downward.
8. **No overlapping.** Two objects must never have the exact same `[x, y]` position. Use index-based offsets to separate objects at the same logical location.
9. **Stable positions.** The same object should appear in roughly the same screen region across different states. Use the object's ID or its index in a sorted list to determine its base position — do NOT use `Math.random()`.
10. **Keep objects in bounds.** All positions must be within the canvas: `x` between 20 and 780, `y` between 20 and 580.

### Color Requirements
11. **Every object must have a color.** The `properties.color` field is REQUIRED on every `VisualObject`. Use a hex color string (e.g., `"#FF6B6B"`).
12. **Distinct colors per type.** Different object types should use clearly different colors. Use a predefined color palette — do NOT use `Math.random()` for colors.
13. **Consistent colors.** The same object should have the same color in every state. Derive colors from the object's ID or type, not from its current state.

### Label Requirements
14. **Human-readable labels.** Replace the raw PDDL ID with a human-readable label. Examples:
    - `"block1"` → `"Block 1"` or `"Block A"` (if single-letter IDs)
    - `"truck-a"` → `"Truck A"`
    - `"depot0"` → `"Depot 0"`
    - `"rooma"` → `"Room A"`
    Keep labels short (≤ 12 characters). The Canvas renderer will display them inside or below the object.

## Layout Best Practices

### Choosing a Layout Strategy
Read the PDDL domain carefully and choose the layout that matches the domain's natural visual metaphor:

| Domain Pattern | Natural Layout | Example |
|---------------|---------------|---------|
| Objects stacking on each other (`on ?x ?y`) | Vertical stacks | Blocks World, Hanoi |
| Objects in locations/rooms (`at ?x ?loc`) | Rooms as boxes, objects inside | Gripper, Logistics |
| Objects connected by edges (`connected ?a ?b`) | Graph/network layout | Rovers, Satellite |
| Objects on pegs/posts (`on ?disk ?peg`) | Pegs with disks | Hanoi |
| Objects in containers (`in ?x ?container`) | Containers with contents | Depot |

### Spatial Layout Tips
- **Stacking domains:** Place the "ground" or "table" at the bottom (y ≈ 520). Stack objects upward (decreasing y). Spread stacks horizontally.
- **Room/location domains:** Divide the canvas into regions, one per location. Place objects inside their current location's region.
- **Graph domains:** Arrange nodes in a grid or circle. Draw objects at their current node's position.
- **Container domains:** Draw containers as large rectangles. Place contained objects inside.

### Dynamic Layout
- **Never hardcode positions for a specific number of objects.** Calculate positions based on `raw.objects.length` or the count of objects of each type.
- **Distribute objects evenly.** Use `(canvasWidth / (count + 1)) * index` patterns for horizontal distribution.
- **Leave margins.** Keep at least 40px from canvas edges for labels.

## Relation Handling

15. **Preserve all relations.** Copy all relations from `raw.relations` to the output. Do not drop any.
16. **Enrich relations where useful.** You may add `properties` to relations to help the Canvas renderer (e.g., `{ relationship: "stacked" }`, `{ relationship: "contained" }`).
17. **Nullary predicates.** Relations with `source: "global"` represent nullary predicates (e.g., `handempty`). Preserve them as-is.
18. **Infer implicit relations.** If you can infer additional useful relations from the state (e.g., "this object is on the ground because no 'on' relation points to it"), add them.

## Common Mistakes to Avoid

- **Do NOT** use `Math.random()` — positions and colors must be deterministic
- **Do NOT** hardcode positions like `[100, 200]` for specific objects — calculate from index
- **Do NOT** forget to handle the case where `raw.objects` is empty
- **Do NOT** assume a specific number of objects — the function must work for any valid state with any number of objects
- **Do NOT** hardcode object names — always iterate over `raw.objects` and `raw.relations` dynamically
- **Do NOT** use `Array.prototype.sort()` without a comparator — it sorts lexicographically by default and may be inconsistent
- **Do NOT** use `Object.keys()` on `raw.relations` — it's an array, not an object
- **Do NOT** return objects without a `position` field — this will break the Canvas renderer
- **Do NOT** return objects without a `properties.color` field — this will break the Canvas renderer

## Validation Checklist

Before returning your code, verify mentally that:

- [ ] The function compiles without TypeScript errors
- [ ] Every object in the output has `position: [x, y]`
- [ ] Every object has `properties.color`
- [ ] No two objects have the exact same position
- [ ] All positions are within [20–780, 20–580]
- [ ] Labels are human-readable (not just raw PDDL IDs)
- [ ] All input relations are preserved in the output
- [ ] The function handles 1 object, 3 objects, and 10 objects correctly
- [ ] No `import` statements in the output
- [ ] No `Math.random()` calls
