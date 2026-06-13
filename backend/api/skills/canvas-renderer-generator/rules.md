# Visualization Rules & Best Practices

## ⭐ #1 GOAL — FAITHFUL READBACK (read this first; it overrides aesthetics)

The single most important property of a visualization is **faithful readback**: a viewer
who has never seen the planning problem — a human OR a vision model — must be able to look
at the rendered image ALONE and reconstruct the EXACT set of true ground predicates, with
the correct object identities as arguments. Beauty, decoration, and "interesting" layout
are strictly secondary.

- Draw every true relation so unambiguously that a viewer can name it and its arguments
  without guessing.
- Never encode two different relations in visually similar ways, and never encode a relation
  in a way that could be mistaken for decoration or for a different relation.
- If a relation is hard to draw unambiguously, draw it MORE explicitly (nest it, box it,
  label it) — never more subtly. A careful reader OMITS anything ambiguous, so ambiguity
  silently destroys correctness.

### Containment beats connector lines (the most important drawing rule)

When a relation means **located-in / at / on / holding / loaded / inside** — one object is
physically *at* or *within* another — draw the contained object **PHYSICALLY INSIDE**, or
directly stacked ON, its container: adjacent and clearly bounded. Do **NOT** represent such
a relation with a line drawn between two distant objects.

> Why this matters: a line across the canvas reads as "near" or "connected", and on its way
> it often passes over OTHER containers. Viewers then attribute the object to the wrong one.
> This is exactly how an aircraft that is `at city2` gets misread as `at city4` — the line
> from the aircraft to city2 happens to cross city4. Drawing the aircraft *inside the city2
> box* removes all doubt.

- **FORBIDDEN** for any semantic relation: faint, low-alpha (`globalAlpha` < 0.85), dashed,
  or dotted connector lines. They read as decoration and get dropped by viewers.
- A line is acceptable **only** for a genuine graph edge between peers (e.g. `connected`,
  `road`, `link`, `adjacent`) that has no containment meaning — and then it must be SOLID,
  fully opaque, ≥ 2px thick, ideally with an arrowhead or a short label naming the relation.
- This rule is **conditional on meaning**: stacking (`on ?x ?y`, as in blocks/hanoi) stays a
  physical stack; a real connectivity graph stays a graph. Do not force the wrong metaphor.

### No floating objects; no decorative pseudo-locations

Every object must sit inside a clearly-bounded region that encodes its location/state. Never
leave an object floating on a decorative strip (a "road", "runway", "water", or empty band)
where its location is implied only by proximity — proximity is not legible and gets misread.

- If an object has a known location (via an `at`/`in`/`on` relation), draw it inside that
  location's bounded region.
- If an object has NO known location in the current state, place it in a single, explicitly
  **labeled "Unplaced" holding area**, drawn in a visually distinct style (e.g. dashed gray
  border, muted fill) and clearly separated from real location regions so it is never
  mistaken for a real location.

### Labels stay attached (secondary, but required)

Draw each object's label legibly **on or directly beside its glyph**, using the object's
`label` (fall back to its `id`). Combined with correct containment, label + position make
identity unambiguous — that matters far more than making the label pretty.

## Mandatory Rules

1. **Pure Canvas Only:** Use ONLY standard Canvas 2D API methods (`fillRect`, `arc`, `stroke`, `fillText`, `beginPath`, `moveTo`, `lineTo`, `closePath`, `createLinearGradient`, etc.). NEVER use `new Image()`, `drawImage()`, or any external assets.

2. **No Imports:** Do NOT include any `import` statements. Do NOT reference any external libraries. The interfaces (`VisualObject`, `VisualRelation`, `RenderedState`) should be declared inline in your output.

3. **No Async:** All functions must be synchronous. No `async`, no `await`, no Promises.

4. **Dynamic Layout:** Calculate positions dynamically based on the number of objects. Assume a canvas size of 800x600 pixels. Objects should be evenly distributed and well-spaced.

5. **No Overlapping:** If multiple objects are at the same logical location, display them alongside or below each other using index-based offsets. NEVER draw objects on top of each other.

6. **Container Sizing:** Container objects (e.g., rooms containing balls, depots containing trucks) MUST dynamically adjust their size based on the number of contained objects. Larger when more objects, smaller when fewer.

7. **Contents Inside Containers:** Objects contained within a container MUST be drawn INSIDE the container's visual boundary, not around or outside it.

## Visual Quality Guidelines

8. **Colors:** Use a distinct, pleasing color palette. Different object types should have clearly different colors. Use shadows or gradients for depth when appropriate.

9. **Labels:** All objects should have readable labels. Use appropriate font sizes (10-16px). Position labels so they don't overlap with other elements.

10. **Relationships:** Make relationships visually clear. For stacking: draw objects on top of each other. For containment: draw objects inside containers. For connections: use lines or arrows.

11. **State Transitions:** The visualization should make it easy to see what changed between states. Use consistent positioning so objects don't jump around unnecessarily.

12. **Decoration must not look semantic:** Backgrounds and scenery (roads, runways, water, grids, clouds, gradients) must be subtle, low-contrast, and obviously non-semantic. A decorative element must NEVER be confusable with a location region or a relation connector. In particular, never draw a band/lane/strip/path that an object then "sits on" as if it were that object's location. Keep all background work inside `renderDomainNameBackground`; keep semantic regions (location boxes, containers) in the main render function with solid borders and labels so they read as distinct from decoration.

13. **Tile, don't overlap; resize containers; keep positions stable:** Within any region or container, lay contents on a tidy grid with consistent gaps; never overlap glyphs. If contents exceed the container's current size, ENLARGE the container (and its parent, if nested) so everything fits — clipping or overlap is never acceptable. Keep each object in the same screen region across consecutive states so the only thing that visibly changes is what the action changed. OPTIONAL: if `state.metadata?.action` is present you may highlight the object(s) named in it (e.g. a brighter outline), but highlighting must never obscure an object's label or its containment.

14. **Legend decodes relation ENCODINGS, not just glyphs:** If you export a legend, it must explain (a) every object-type glyph AND (b) how each relation TYPE is encoded — including containment and nesting, not only line styles. For a containment/transport domain include entries like "X inside Y's box = X is `at` Y", "P nested inside vehicle V = P is `in` V", and "dashed gray area = Unplaced (no location)". Never rely on a faint line style as the sole legend entry for a semantic relation. Prefer exporting a legend (not `undefined`) whenever any relation is encoded by containment or nesting. **Keep the legend COMPACT and unobtrusive:** at most ~6 entries, grouped by category, in a small corner — it must NEVER cover, crowd, or dominate the objects (a legend bigger than the scene makes the visualization unreadable). Do NOT add a separate entry for every property/state predicate (e.g. `allergic`, `gluten-free`, `served`, `waiting`, `not-yet-made`); show those as small on-object BADGES and cover them with ONE grouped line like "badges = object flags". If the icons are self-explanatory, omit the legend entirely.

15. **Draw recognizable ICONS, not generic boxes/dots:** Each object TYPE should look like what it represents, drawn with pure Canvas paths (no images). An aircraft should read as an aircraft, a person as a person, a truck as a truck, a ship as a ship. Choose the silhouette from the object's `type`, and keep a labeled box/disc as the FALLBACK only when no icon fits. A container's body can double as the region that holds its contents (e.g. an aircraft fuselage as the cabin where passengers nest, a truck bed for packages). Recognizability and containment are BOTH required — never trade one for the other (an accurate but unreadable box-and-dot diagram is not the goal). See `example-transport.ts` for `drawPlane` / `drawPerson` patterns.

## Common Mistakes to Avoid

- Do NOT use `ctx.drawImage()` — there are no images available
- Do NOT use `document.createElement()` — there is no DOM access
- Do NOT use `requestAnimationFrame()` — rendering is synchronous
- Do NOT hardcode positions for specific numbers of objects — always calculate dynamically
- Do NOT forget to set `ctx.textAlign` and `ctx.textBaseline` before `fillText()`
- Do NOT forget to call `ctx.beginPath()` before drawing new shapes
- Do NOT use TypeScript `enum` — use string literals or constants instead
- Do NOT use optional chaining on Canvas API methods — they always exist
- Do NOT draw `at` / `in` / `on` / `holding` relations as connector lines — draw them as physical containment/nesting (see the worked pattern below)
- Do NOT use `globalAlpha` < 0.85, dashed, or dotted strokes for any relation that carries meaning

## Worked Pattern: Locations & Transport (`at` / `in` / `on`)

This is the single most common failure case (logistics, ferry, zenotravel, gripper, depot, …).
Follow it whenever the domain has *locations* plus things that are `at` a location and possibly
`in` a vehicle/container:

1. Draw each **LOCATION** as a large, labeled, solid-bordered box. Show the location's label
   on the box. Size each box to fit its contents (see rule 13); arrange the location boxes on a grid.
2. An object that is `at` a location (a vehicle, a person, a package) is drawn **INSIDE that
   location's box** — never on a line to it, never floating beside it.
3. An object that is `in` a vehicle/container (e.g. a person `in` an aircraft, a package `in` a
   truck) is drawn **nested INSIDE that vehicle's glyph**. The vehicle glyph is itself drawn
   inside the location box when the vehicle is `at` a location. The result is visibly nested:
   **location box ⊃ vehicle glyph ⊃ person glyph**.
4. **Tile** the contents in a grid inside their container with no overlap; if they don't fit,
   **grow** the container (do not overlap or clip). Each contained glyph shows its own label.
5. An object that is neither `at` any location nor `in` anything goes to the labeled **"Unplaced"**
   area (dashed gray border, clearly separate from real locations).

Reading rule this produces: "the `p1` glyph is drawn inside the `a1` glyph, which is inside the
`city2` box" reads back unambiguously as `(in p1 a1)` and `(at a1 city2)`. See `example-transport.ts`
for a complete reference renderer.
