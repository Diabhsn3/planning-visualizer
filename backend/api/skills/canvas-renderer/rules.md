# Visualization Rules & Best Practices

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

## Common Mistakes to Avoid

- Do NOT use `ctx.drawImage()` — there are no images available
- Do NOT use `document.createElement()` — there is no DOM access
- Do NOT use `requestAnimationFrame()` — rendering is synchronous
- Do NOT hardcode positions for specific numbers of objects — always calculate dynamically
- Do NOT forget to set `ctx.textAlign` and `ctx.textBaseline` before `fillText()`
- Do NOT forget to call `ctx.beginPath()` before drawing new shapes
- Do NOT use TypeScript `enum` — use string literals or constants instead
- Do NOT use optional chaining on Canvas API methods — they always exist
