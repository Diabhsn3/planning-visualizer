/**
 * TypeScript interfaces for the PDDL Domain Interpreter skill.
 *
 * INPUT:  RawState  — produced by the Python DefaultRenderer for any unknown domain.
 * OUTPUT: RenderedState — enriched state ready for the Canvas renderer to draw.
 *
 * These are the EXACT types your transformer function must accept and return.
 * Declare them inline at the top of your generated file (no imports).
 */

// ============================================================
// INPUT TYPE — what the DefaultRenderer produces
// ============================================================

/**
 * A raw relation/predicate from the DefaultRenderer.
 * Represents one active PDDL predicate in the current state.
 */
export interface RawRelation {
  /** The predicate name exactly as it appears in the PDDL domain (e.g., "on", "at", "clear") */
  type: string;
  /**
   * The first argument of the predicate (source object ID).
   * For nullary predicates (e.g., handempty), this is the string "global".
   */
  source: string;
  /** The second argument of the predicate (target object ID). Absent for unary predicates. */
  target?: string;
  /** Extra data. For nullary predicates: { value: true }. May be absent. */
  properties?: Record<string, any>;
}

/**
 * A raw object from the DefaultRenderer.
 * Has minimal information — just the object ID, its PDDL type, and a placeholder label.
 */
export interface RawObject {
  /** The object's unique identifier as declared in the PDDL problem file (e.g., "block1", "truck-a") */
  id: string;
  /** The PDDL type of this object (e.g., "block", "truck", "room", "peg") */
  type: string;
  /** Initially the same as `id` — your transformer should replace this with a human-readable label */
  label: string;
  /** Always { status: "unknown" } from the DefaultRenderer — your transformer should enrich this */
  properties?: Record<string, any>;
}

/**
 * The raw state produced by the Python DefaultRenderer.
 * This is the INPUT to your transformer function.
 */
export interface RawState {
  /** The domain name (e.g., "blocks-world", "ferry", "logistics") */
  domain: string;
  /** All objects declared in the PDDL problem, with minimal information */
  objects: RawObject[];
  /** All active predicates in the current state */
  relations: RawRelation[];
  /** Step number and action that led to this state */
  metadata?: {
    step?: number;
    action?: string;
    [key: string]: any;
  };
}

// ============================================================
// OUTPUT TYPES — what the Canvas renderer expects
// ============================================================

/**
 * An enriched visual object ready for Canvas rendering.
 */
export interface VisualObject {
  /** Unique identifier — same as the PDDL object ID */
  id: string;
  /** Human-readable type for the Canvas renderer (e.g., "block", "truck", "room") */
  type: string;
  /** Human-readable display label (e.g., "Block A", "Truck 1", "Room B") */
  label: string;
  /**
   * Canvas coordinates [x, y] in pixels (origin at top-left, canvas is 800×600).
   * REQUIRED — the Canvas renderer will not draw objects without a position.
   * Positions must be stable across states (same object → same area).
   */
  position: [number, number];
  /**
   * Visual properties for the Canvas renderer.
   * REQUIRED fields:
   *   - color: string  — hex or CSS color for this object
   * RECOMMENDED fields (add as relevant to your domain):
   *   - width: number, height: number  — object dimensions in pixels
   *   - size: number  — for circular objects
   *   - status: string  — human-readable status (e.g., "clear", "held", "empty")
   *   - zIndex: number  — drawing order (higher = drawn on top)
   *   - [any domain-specific flags]
   */
  properties: {
    color: string;
    [key: string]: any;
  };
}

/**
 * An enriched visual relation ready for Canvas rendering.
 */
export interface VisualRelation {
  /** The predicate/relation type (e.g., "on", "at", "holding", "connected") */
  type: string;
  /** Source object ID */
  source: string;
  /** Target object ID (absent for unary relations) */
  target?: string;
  /** Additional properties (e.g., { value: true } for nullary predicates) */
  properties?: Record<string, any>;
}

/**
 * The enriched state returned by your transformer function.
 * This is the OUTPUT of your transformer and the INPUT to the Canvas renderer.
 */
export interface RenderedState {
  /** The domain name — same as the input */
  domain: string;
  /** All objects, now enriched with positions, colors, and meaningful labels */
  objects: VisualObject[];
  /** All active relations, preserved from the raw state */
  relations: VisualRelation[];
  /** Step metadata — pass through unchanged from the raw state */
  metadata?: Record<string, any>;
}
