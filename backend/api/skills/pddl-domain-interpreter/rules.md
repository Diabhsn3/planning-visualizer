# PDDL Domain Interpreter — Rules & Best Practices

## ⭐ #1 GOAL — LAY OUT FOR FAITHFUL READBACK (read this first)

The renderer you feed can only be as legible as the positions you assign. Your #1 job is to
lay objects out so that a viewer of the FINAL IMAGE — a human OR a vision model — can
reconstruct the EXACT set of true predicates, with the correct object identities. Aesthetics
are strictly secondary.

### Containment, not connector lines

When a relation means **located-in / at / on / holding / loaded / inside**, the contained
object must end up DRAWN INSIDE its container in the final image. You make that possible by:

- **Positioning the contained object's `[x, y]` *inside its container's region*** — near the
  container, offset so multiple contents tile without overlap — NOT at some far-away spot that
  the renderer would have to connect with a line.
- **Tagging the relation** with `properties.relationship`:
  `"contained"` (object `at`/`on` a place), `"nested"` (object `in` a vehicle/container), or
  `"edge"` (a genuine peer graph link such as `connected`/`road`/`adjacent`). This advisory hint
  tells the renderer to draw containment instead of a line. (Advisory only — the renderer also
  reads the relation `type`.)
- **Setting `properties.containerId`** on the contained object to its container's id, so the
  renderer can nest it and grow the container to fit.

A line drawn across the canvas between two distant glyphs reads as "near"/"connected" and often
crosses unrelated containers, causing misattribution (an aircraft `at city2` gets read as `at
city4`). Place the object *inside* city2 instead.

### Every object has a home; nothing floats

Give every object a position inside a real region. An object with NO `at`/`in`/`on` relation in
the current state must be sent to a dedicated **"Unplaced" holding area** (a reserved region of
the canvas you treat as a labeled zone) — never parked on empty or decorative space. Do NOT
invent virtual "band"/"lane"/"road"/"strip" objects to park items on; every position must
correspond to a real location region, a real container, or the "Unplaced" area.

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

### Worked Layout: Locations & Transport (`at` / `in` / `on`)

The most common domain class — and the one most often laid out wrong (logistics, ferry,
zenotravel, gripper, depot, …). When the domain has *locations* plus things that are `at` a
location and possibly `in` a vehicle/container, compute positions like this:

1. **Locations** become a grid of large regions. Compute a base `[x, y]` (and a width/height in
   `properties`) for each location so the renderer can draw it as a labeled box.
2. **An object `at` a location** gets a position *inside that location's region*, offset by its
   index among that location's contents so multiple contents tile without overlap. Set its
   `properties.containerId` to the location's id.
3. **An object `in` a vehicle/container** gets a position *at/inside the vehicle's position*
   (nested). Set `properties.containerId` to the vehicle's id. If the vehicle is `at` a location,
   the vehicle is already inside that location's region, so the nested object lands inside the
   location too — giving **location ⊃ vehicle ⊃ passenger**.
4. **Tag each such relation** with `properties.relationship` = `"contained"` (`at`/`on`) or
   `"nested"` (`in`).
5. **Unplaced objects** (no `at`/`in` in this state) get a position inside a reserved "Unplaced"
   band; tag/track them so the renderer draws a distinct holding area.
6. **Keep the raw PDDL `type`** on each VisualObject (e.g. `type: o.type`, with the role in
   `properties.role`) so the renderer can pick a recognizable ICON per type (plane, truck, ship,
   person…). **Size vehicle/container boxes generously** (width/height in `properties`) so a
   recognizable icon plus its contents fit without overlap.

This makes the final image read as: `p1` inside `a1` inside the `city2` box ⇒ `(in p1 a1)` and
`(at a1 city2)`. See `example-transport.ts` for a complete reference transformer.

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
- **Do NOT** position objects related by `at`/`in`/`on` far apart and expect a line to connect them — place the contained object INSIDE its container's region
- **Do NOT** leave any object floating in empty/decorative space — route locationless objects to a single "Unplaced" region
- **Do NOT** return `undefined`/`null` or throw — ALWAYS return a complete `RenderedState` with every object positioned, on EVERY code path. A missing `return` on some branch blanks or crashes the renderer.

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
- [ ] Objects related by `at`/`in`/`on` are positioned INSIDE their container's region (not far apart)
- [ ] `properties.containerId` is set on every contained object; `properties.relationship` is set on every containment/nesting relation
- [ ] Objects with no location land in a single reserved "Unplaced" region — none float in empty space
