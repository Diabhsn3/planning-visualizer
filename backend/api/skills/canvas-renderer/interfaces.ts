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
}

export interface RenderedState {
  /** The domain name (e.g., "blocks-world", "gripper", "hanoi") */
  domain: string;
  /** All objects in the current state */
  objects: VisualObject[];
  /** All active relations/predicates in the current state */
  relations: VisualRelation[];
}
