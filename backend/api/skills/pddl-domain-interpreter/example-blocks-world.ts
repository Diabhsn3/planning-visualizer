/**
 * EXAMPLE: Complete working transformer for the Blocks World domain.
 *
 * This file demonstrates exactly what the pddl-domain-interpreter skill should produce.
 * Study it carefully as a template for generating transformers for new domains.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * DOMAIN ANALYSIS (blocks-world)
 * ─────────────────────────────────────────────────────────────────────────────
 * PDDL domain file says:
 *   (:types block)
 *   (:predicates
 *     (on ?x - block ?y - block)     ; block x is directly on top of block y
 *     (ontable ?x - block)           ; block x is on the table
 *     (clear ?x - block)             ; nothing is on top of block x
 *     (handempty)                    ; the robot arm is not holding anything
 *     (holding ?x - block)           ; the robot arm is holding block x
 *   )
 *
 * VISUAL METAPHOR: Vertical stacks of colored blocks on a table.
 *   - Blocks form stacks (on top of each other or on the table)
 *   - The robot arm (gripper) floats above, holding a block or empty
 *   - Layout: stacks spread horizontally, table at the bottom
 *
 * SAMPLE RAW INPUT (from DefaultRenderer, step 0):
 * {
 *   "domain": "blocks-world",
 *   "objects": [
 *     { "id": "a", "type": "block", "label": "a", "properties": { "status": "unknown" } },
 *     { "id": "b", "type": "block", "label": "b", "properties": { "status": "unknown" } },
 *     { "id": "c", "type": "block", "label": "c", "properties": { "status": "unknown" } }
 *   ],
 *   "relations": [
 *     { "type": "on",       "source": "a", "target": "b" },
 *     { "type": "ontable",  "source": "b" },
 *     { "type": "ontable",  "source": "c" },
 *     { "type": "clear",    "source": "a" },
 *     { "type": "clear",    "source": "c" },
 *     { "type": "handempty","source": "global", "properties": { "value": true } }
 *   ],
 *   "metadata": { "step": 0 }
 * }
 *
 * SAMPLE RAW INPUT (step 1, after pick-up a):
 * {
 *   "domain": "blocks-world",
 *   "objects": [
 *     { "id": "a", "type": "block", "label": "a", "properties": { "status": "unknown" } },
 *     { "id": "b", "type": "block", "label": "b", "properties": { "status": "unknown" } },
 *     { "id": "c", "type": "block", "label": "c", "properties": { "status": "unknown" } }
 *   ],
 *   "relations": [
 *     { "type": "holding",  "source": "a" },
 *     { "type": "ontable",  "source": "b" },
 *     { "type": "ontable",  "source": "c" },
 *     { "type": "clear",    "source": "b" },
 *     { "type": "clear",    "source": "c" }
 *   ],
 *   "metadata": { "step": 1, "action": "(pick-up a)" }
 * }
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * KEY PATTERNS TO FOLLOW:
 * 1. Declare all interfaces inline (copy from interfaces.ts) — no imports
 * 2. Build relationship maps from raw.relations before computing positions
 * 3. Compute stacks/groups from the relationship maps
 * 4. Assign positions based on stack index and height within stack
 * 5. Derive colors from object ID (stable across states, no Math.random)
 * 6. Add virtual objects (table, gripper) that aren't in the PDDL but help visualization
 * 7. Export exactly one function: transformDomainName(raw: RawState): RenderedState
 */

// ─── Inline interface declarations (copy from interfaces.ts) ─────────────────

interface RawRelation {
  type: string;
  source: string;
  target?: string;
  properties?: Record<string, any>;
}

interface RawObject {
  id: string;
  type: string;
  label: string;
  properties?: Record<string, any>;
}

interface RawState {
  domain: string;
  objects: RawObject[];
  relations: RawRelation[];
  metadata?: Record<string, any>;
}

interface VisualObject {
  id: string;
  type: string;
  label: string;
  position: [number, number];
  properties: {
    color: string;
    [key: string]: any;
  };
}

interface VisualRelation {
  type: string;
  source: string;
  target?: string;
  properties?: Record<string, any>;
}

interface RenderedState {
  domain: string;
  objects: VisualObject[];
  relations: VisualRelation[];
  metadata?: Record<string, any>;
}

// ─── Color palette (stable, derived from object ID) ──────────────────────────

const BLOCK_COLORS = [
  "#FF6B6B", // red
  "#4ECDC4", // teal
  "#45B7D1", // blue
  "#FFA07A", // salmon
  "#98D8C8", // mint
  "#F7DC6F", // yellow
  "#BB8FCE", // purple
  "#85C1E2", // sky blue
  "#F39C12", // orange
  "#2ECC71", // green
  "#E74C3C", // dark red
  "#9B59B6", // violet
];

/**
 * Derive a stable color from an object's ID.
 * Single-letter IDs (a, b, c) map to their alphabet index.
 * Multi-character IDs use a hash of the character codes.
 */
function getBlockColor(id: string): string {
  const lower = id.toLowerCase();
  let index: number;
  if (lower.length === 1 && lower >= "a" && lower <= "z") {
    index = lower.charCodeAt(0) - 97; // 'a' = 0, 'b' = 1, ...
  } else {
    index = lower.split("").reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  }
  return BLOCK_COLORS[index % BLOCK_COLORS.length];
}

/**
 * Make a label human-readable.
 * Single letters → uppercase ("a" → "A")
 * "block1" → "Block 1"
 * "blockA" → "Block A"
 */
function makeLabel(id: string): string {
  if (id.length === 1) return id.toUpperCase();
  const match = id.match(/^([a-zA-Z_-]+?)[\s_-]?(\d+|[A-Z])$/);
  if (match) {
    const prefix = match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase();
    return `${prefix} ${match[2]}`;
  }
  return id.charAt(0).toUpperCase() + id.slice(1);
}

// ─── Canvas layout constants ──────────────────────────────────────────────────

const CANVAS_WIDTH  = 800;
const CANVAS_HEIGHT = 600;
const BLOCK_SIZE    = 60;  // pixels per block (width and height)
const TABLE_Y       = 520; // y-coordinate of the table surface
const GRIPPER_Y     = 60;  // y-coordinate of the gripper when holding a block

// ─── Main transformer function ────────────────────────────────────────────────

export function transformBlocksWorld(raw: RawState): RenderedState {
  const blocks = raw.objects.filter((o) => o.type === "block");

  // ── Step 1: Build relationship maps from raw.relations ──────────────────────

  // on[above] = below  (block 'above' is directly on block 'below')
  const on: Record<string, string> = {};
  // ontable: set of blocks resting on the table
  const ontable = new Set<string>();
  // clear: set of blocks with nothing on top
  const clear = new Set<string>();
  // holding: which block the arm is holding (null if none)
  let holdingBlock: string | null = null;
  // handempty: whether the arm is free
  let handEmpty = false;

  for (const rel of raw.relations) {
    if (rel.type === "on" && rel.target) {
      on[rel.source] = rel.target;
    } else if (rel.type === "ontable") {
      ontable.add(rel.source);
    } else if (rel.type === "clear") {
      clear.add(rel.source);
    } else if (rel.type === "holding") {
      holdingBlock = rel.source;
    } else if (rel.type === "handempty") {
      handEmpty = true;
    }
  }

  // ── Step 2: Build stacks (bottom-to-top lists) ───────────────────────────────

  // Find which block is on top of each block (reverse of 'on')
  const onTopOf: Record<string, string> = {}; // onTopOf[below] = above
  for (const [above, below] of Object.entries(on)) {
    onTopOf[below] = above;
  }

  // Build stacks starting from table blocks, sorted by ID for stability
  const tableBlocks = Array.from(ontable).sort();
  const stacks: string[][] = [];

  for (const bottom of tableBlocks) {
    const stack: string[] = [bottom];
    let current = bottom;
    while (onTopOf[current]) {
      current = onTopOf[current];
      stack.push(current);
    }
    stacks.push(stack); // stack[0] = bottom, stack[last] = top
  }

  // ── Step 3: Assign horizontal positions to stacks ───────────────────────────

  // Distribute stacks evenly across the canvas width
  // Reserve space for the gripper on the right if it's holding something
  const numStacks = stacks.length;
  const usableWidth = CANVAS_WIDTH - 80; // 40px margin each side
  const stackSpacing = numStacks > 0 ? usableWidth / (numStacks + 1) : usableWidth / 2;

  // Map: block ID → [x, y] position
  const positions: Record<string, [number, number]> = {};

  stacks.forEach((stack, stackIndex) => {
    const stackX = 40 + stackSpacing * (stackIndex + 1);
    stack.forEach((blockId, heightIndex) => {
      // heightIndex 0 = bottom block (sits on table), higher = further up
      const x = stackX;
      const y = TABLE_Y - BLOCK_SIZE / 2 - heightIndex * BLOCK_SIZE;
      positions[blockId] = [x, y];
    });
  });

  // ── Step 4: Position the held block (if any) ─────────────────────────────────

  if (holdingBlock) {
    // Place the held block above center, near the gripper
    const gripperX = CANVAS_WIDTH / 2;
    positions[holdingBlock] = [gripperX, GRIPPER_Y + BLOCK_SIZE];
  }

  // ── Step 5: Fallback positions for any block not yet positioned ───────────────
  // (e.g., if the raw state has inconsistencies)

  const allBlockIds = blocks.map((b) => b.id).sort();
  allBlockIds.forEach((id, i) => {
    if (!positions[id]) {
      positions[id] = [40 + (i + 1) * (CANVAS_WIDTH / (allBlockIds.length + 1)), TABLE_Y - BLOCK_SIZE / 2];
    }
  });

  // ── Step 6: Build enriched VisualObject list ─────────────────────────────────

  const visualObjects: VisualObject[] = [];

  // Blocks
  for (const block of blocks) {
    const isHeld = block.id === holdingBlock;
    const isClear = clear.has(block.id);
    visualObjects.push({
      id: block.id,
      type: "block",
      label: makeLabel(block.id),
      position: positions[block.id],
      properties: {
        color: getBlockColor(block.id),
        width: BLOCK_SIZE,
        height: BLOCK_SIZE,
        clear: isClear,
        held: isHeld,
        zIndex: isHeld ? 10 : 1,
        status: isHeld ? "held" : isClear ? "clear" : "stacked",
      },
    });
  }

  // Table (virtual object — not in PDDL, but needed for the Canvas renderer)
  visualObjects.push({
    id: "__table__",
    type: "surface",
    label: "Table",
    position: [CANVAS_WIDTH / 2, TABLE_Y + 10],
    properties: {
      color: "#8B4513",
      width: CANVAS_WIDTH - 40,
      height: 20,
      zIndex: 0,
    },
  });

  // Gripper (virtual object — represents the robot arm)
  const gripperX = holdingBlock ? CANVAS_WIDTH / 2 : CANVAS_WIDTH - 60;
  visualObjects.push({
    id: "__gripper__",
    type: "gripper",
    label: handEmpty ? "Hand (empty)" : `Hand (holding ${holdingBlock})`,
    position: [gripperX, GRIPPER_Y],
    properties: {
      color: "#607D8B",
      empty: handEmpty,
      holding: holdingBlock,
      zIndex: 20,
    },
  });

  // ── Step 7: Build enriched VisualRelation list ───────────────────────────────

  const visualRelations: VisualRelation[] = raw.relations.map((rel) => ({
    type: rel.type,
    source: rel.source,
    target: rel.target,
    properties: rel.properties,
  }));

  // ── Step 8: Return the enriched RenderedState ────────────────────────────────

  return {
    domain: raw.domain,
    objects: visualObjects,
    relations: visualRelations,
    metadata: raw.metadata,
  };
}
