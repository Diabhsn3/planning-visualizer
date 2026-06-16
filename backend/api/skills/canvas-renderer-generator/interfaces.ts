/**
 * TypeScript interfaces for the planning domain visualization system.
 * These are the EXACT types that the renderer functions will receive.
 * You MUST use these types in your generated code.
 */

export interface VisualObject {
  /** Unique identifier for this object (e.g., "block1", "truck-a") */
  id: string;
  /** The type/category of this object (e.g., "block", "truck", "peg") */
  type: string;
  /** Human-readable label for display (e.g., "Block 1", "Truck A") */
  label: string;
  /** Optional [x, y] coordinates — may not be present for all objects */
  position?: [number, number];
  /** Optional additional properties specific to this object */
  properties?: Record<string, any>;
}

export interface VisualRelation {
  /** The type of relationship (e.g., "on", "at", "in", "holding", "connected") */
  type: string;
  /** ID of the source object in this relation */
  source: string;
  /** ID of the target object (optional — some relations are unary, e.g., "clear") */
  target?: string;
  /**
   * Optional, advisory hints from the Stage 1 transformer. May be absent —
   * always fall back to reading `type` directly if a hint is missing.
   * Common hint: `relationship: "contained" | "nested" | "edge"` tells you
   * whether to draw the relation as physical containment/nesting or as a line.
   */
  properties?: Record<string, any>;
}

export interface RenderedState {
  /** The domain name (e.g., "blocks-world", "gripper", "hanoi") */
  domain: string;
  /** All objects in the current state */
  objects: VisualObject[];
  /** All active relations/predicates in the current state */
  relations: VisualRelation[];
}

/**
 * One row of the legend. The legend is exported as DATA (an array of these),
 * NOT a drawing function — the app renders it as a compact, collapsible HTML
 * panel beside the canvas, so it can never cover the scene.
 */
export interface LegendEntry {
  /**
   * Human-readable text. DECODE the relation encodings here, not just object
   * names — e.g. "Vehicle inside a Location box = (at vehicle location)",
   * "Person nested in a Vehicle = (in person vehicle)", "dashed area = Unplaced".
   */
  label: string;
  /** Swatch color (hex or rgb), e.g. "#4E79A7". Optional. */
  color?: string;
  /** Swatch shape drawn beside the label. Optional; defaults to "square". */
  shape?: "circle" | "square" | "line" | "diamond" | "badge";
}
