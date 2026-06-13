---
name: pddl-domain-interpreter
description: Generates a TypeScript state transformer function for any PDDL planning domain. Given the PDDL domain file and 2–3 sample raw states from one example problem, produces a single TypeScript function that enriches each raw state with proper object types, labels, spatial layout, colors, and properties — ready for the Canvas renderer to draw.
---

# PDDL Domain Interpreter Skill

You are an expert in automated planning (PDDL), TypeScript, and data visualization. Your job is to analyze a PDDL domain and generate a TypeScript function that transforms raw planning states into rich, visually meaningful data structures.

## Background

When a user uploads a **custom PDDL domain**, the system runs a planner (Fast Downward) to solve their problem and produces a sequence of states. Each state is initially processed by a generic `DefaultRenderer` in Python, which outputs a flat list of objects and predicates — but with no spatial layout, no colors, and minimal semantic enrichment.

Your job is to write a TypeScript function that takes one of these raw states and transforms it into a fully enriched `RenderedState` — one that a Canvas renderer can draw meaningfully.

## Reference Files

This skill includes reference files you MUST read before generating code:

1. **`interfaces.ts`** — The exact TypeScript interfaces (`RawState`, `RenderedState`, `VisualObject`, `VisualRelation`) that define the input and output types. You MUST use these exact types.
2. **`example-blocks-world.ts`** — A complete transformer for the Blocks World domain (a STACKING domain). Study it as the template for stacking / `on` layouts.
3. **`example-transport.ts`** — A complete transformer for a locations + nested-containment domain (vehicles `at` locations, passengers `in` vehicles). Study it as the template for ANY domain with `at` / `in` / `on` location relations — the most common case. It shows how to position contained objects INSIDE their container, set `containerId`/`relationship`, and route locationless objects to an "Unplaced" region.
4. **`rules.md`** — Rules, constraints, and best practices for the generated transformer function. Read the **"#1 GOAL — LAY OUT FOR FAITHFUL READBACK"** section FIRST.

## What You Receive

The user will provide:

1. **The PDDL domain file** — the full text of `domain.pddl`. This tells you:
   - The domain name (`:domain name`)
   - All object types (`:types`)
   - All predicates and their arities (`:predicates`)
   - All actions and their effects (`:action`)

2. **2–3 sample raw states** from ONE example problem — these help you understand the data format and structure. The raw states produced by the Python `DefaultRenderer` follow this format:
   ```json
   {
     "domain": "my-domain",
     "objects": [
       { "id": "<pddl-object-name>", "type": "<pddl-type>", "label": "<pddl-object-name>", "properties": { "status": "unknown" } }
     ],
     "relations": [
       { "type": "<predicate-name>", "source": "<arg1>", "target": "<arg2>" },
       { "type": "<unary-predicate>", "source": "<arg1>" },
       { "type": "<nullary-predicate>", "source": "global", "properties": { "value": true } }
     ],
     "metadata": { "step": 0, "action": "(action-name args)" }
   }
   ```
   - Each PDDL object becomes an entry in `objects` with its PDDL type.
   - Each true predicate in the state becomes a `relation`. Binary predicates have `source` and `target`. Unary predicates have only `source`. Nullary predicates have `source: "global"`.

   **CRITICAL**: The sample states are from a SINGLE small example problem. The actual problems your code will process may have MORE or FEWER objects, DIFFERENT object names, and DIFFERENT numbers of relations. Your code MUST handle ANY valid problem in this domain — never hardcode object names, counts, or positions based on the samples.

## What You Must Output

A **single TypeScript function** with this exact signature:

```typescript
export function transformDomainName(raw: RawState): RenderedState
```

Where `DomainName` is the CamelCase version of the domain name (e.g., `blocks-world` → `BlocksWorld`, `ferry` → `Ferry`, `logistics-strips` → `LogisticsStrips`).

This function must:

1. **Parse the raw state** — read `raw.objects` and `raw.relations`
2. **Enrich each object** — add meaningful `type`, `label`, `position: [x, y]`, `properties` (color, size, status flags, etc.)
3. **Enrich each relation** — keep all relations, add any that can be inferred
4. **Compute spatial layout** — assign `[x, y]` positions to every object so the Canvas renderer can draw them without doing layout itself
5. **Return a complete `RenderedState`** — with the same `domain`, enriched `objects`, enriched `relations`, and the original `metadata`

## IMPORTANT RULES

1. **Do not use the code execution tool.** (This stops the "testing" loops that cost money).
2. **Do not explain anything.**
3. **Output ONLY the code in a single block.**

## Workflow

Follow these steps exactly:

1. **Read all reference files** in this skill folder to understand the interfaces, example, and rules.

2. **Analyze the PDDL domain file** provided by the user:
   - What are the object types? What do they represent in the real world?
   - What are the predicates? Which ones describe spatial relationships (on, at, in, connected)? Which describe state (clear, holding, empty)?
   - What do the actions do? What changes between states?

3. **Study the sample states** to understand the data format:
   - What do the `objects` entries look like? (id, type, label, properties)
   - What do the `relations` entries look like? (type, source, target)
   - How do the predicates from the PDDL domain map to relations?
   - Remember: the samples are from ONE problem — your code must handle any problem size

4. **Design the layout strategy** before coding:
   - What is the natural visual metaphor for this domain? (blocks stacking, robots in rooms, trucks at depots, pegs with disks, etc.)
   - How should objects be positioned relative to each other?
   - What colors should each object type use?
   - What properties should each object carry (color, size, status flags)?

5. **Generate the transformer function** following the output contract.

6. **Do NOT use the code execution tool** — just verify mentally that:
   - All objects will have `position: [x, y]`
   - All objects will have meaningful `label` and `type`
   - No two objects will have the same position
   - The output will be valid JSON-serializable data

7. **Return ONLY the raw TypeScript code** — no markdown fences, no explanations, no commentary.

## Output Contract

### Function Signature
```typescript
export function transformDomainName(raw: RawState): RenderedState
```

### Requirements
- Declare `RawState`, `RenderedState`, `VisualObject`, `VisualRelation` interfaces **inline** at the top of the file (copy from `interfaces.ts`)
- The function must be **pure** — no side effects, no global state, no randomness
- The function must handle **any valid state** for this domain, not just the sample states
- All objects must receive a `position: [x, y]` — the Canvas renderer depends on this
- Use a **canvas coordinate system**: assume 800×600 pixels, origin at top-left
- Object positions should be **stable across states** — same object should appear in roughly the same area across different steps (use the object's ID or type to determine its base position)
- **No `import` statements** — all code must be self-contained
- **No async** — the function must be synchronous

## Quality Criteria

Before returning your code, verify:
- [ ] All object types from the domain are handled (not just those in the sample)
- [ ] Every object in the output has `position: [x, y]`
- [ ] Every object has a meaningful `label` (not just the raw ID)
- [ ] Every object has a `properties.color` field
- [ ] Spatial layout reflects the domain's natural visual metaphor
- [ ] The layout adapts dynamically to any number of objects (no hardcoded positions)
- [ ] Relations are preserved and enriched where possible
- [ ] Code compiles and runs without errors
- [ ] No `import` statements, no external libraries

Take your time. A high-quality transformer makes the Canvas renderer's job much easier. The function MUST be fully generic — it must work for any valid problem in this domain, not just a specific set of objects.
