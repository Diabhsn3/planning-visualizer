/**
 * EXAMPLE: Complete working transformer for a LOCATIONS + NESTED-CONTAINMENT
 * domain (the "transport" family: logistics, ferry, zenotravel, gripper, depot, …).
 *
 * Study this whenever the domain has *locations* plus things that are `at` a
 * location and possibly `in` a vehicle/container. It is the template for the
 * single most common domain class, and the one whose layout most often goes wrong.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * DOMAIN ANALYSIS (a zenotravel-style domain)
 * ─────────────────────────────────────────────────────────────────────────────
 *   (:types person city aircraft)
 *   (:predicates
 *     (at ?x - (either person aircraft) ?c - city)   ; x is at city c
 *     (in ?p - person ?a - aircraft)                 ; person p is inside aircraft a
 *   )
 *   actions: board / debark / fly
 *
 * VISUAL METAPHOR: cities are BOXES; an aircraft `at` a city is drawn INSIDE that
 * city's box; a person `in` an aircraft is drawn nested INSIDE that aircraft. The
 * final image therefore reads back as the exact predicate set — with NO connector
 * lines (a line from an aircraft to city2 that crosses city4 is precisely what
 * makes a viewer misread it as `at city4`).
 *
 * KEY PATTERNS THIS FILE DEMONSTRATES:
 * 1. Classify objects by ROLE, inferred from the relation TARGET TYPES (generic —
 *    works regardless of the PDDL type names): a "location" is any object whose
 *    TYPE appears as an `at` target; a "vehicle" is any object whose TYPE appears
 *    as an `in` target; everything else is a "mover". (Using the *type*, not just
 *    the ids seen this step, means a city with nothing at it right now is still
 *    drawn as an empty location box — not dumped into "Unplaced".)
 * 2. Lay locations out as a grid of boxes (plus one synthetic "Unplaced" box).
 * 3. Position every contained object INSIDE its container's box (tiled, no overlap).
 * 4. Set properties.containerId on contents and properties.relationship on relations
 *    so the renderer draws containment, never lines.
 * 5. Route objects with no location to the labeled "Unplaced" box — nothing floats.
 * ─────────────────────────────────────────────────────────────────────────────
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

// ─── Stable color + label helpers (no Math.random) ──────────────────────────

const PALETTE = [
  "#4E79A7", "#F28E2B", "#59A14F", "#E15759", "#B07AA1",
  "#76B7B2", "#FF9DA7", "#EDC948", "#9C755F", "#499894",
];

function hashId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h;
}

function colorFor(id: string): string {
  return PALETTE[hashId(id) % PALETTE.length];
}

function makeLabel(id: string): string {
  const m = id.match(/^([a-zA-Z_-]+?)[\s_-]?(\d+|[A-Z])$/);
  if (m) return m[1].charAt(0).toUpperCase() + m[1].slice(1).toLowerCase() + " " + m[2];
  return id.charAt(0).toUpperCase() + id.slice(1);
}

// ─── Canvas layout constants ─────────────────────────────────────────────────

const CANVAS_W = 800;
const CANVAS_H = 600;
const UNPLACED = "__unplaced__";

/**
 * Tile `n` items into a grid of slots inside `box`, leaving `topPad` for the
 * container's own label. Returns the center + cell size of each slot.
 */
function tileSlots(
  n: number,
  box: { x: number; y: number; w: number; h: number },
  topPad: number,
): Array<{ cx: number; cy: number; cw: number; ch: number }> {
  if (n <= 0) return [];
  const cols = Math.max(1, Math.ceil(Math.sqrt(n)));
  const rows = Math.ceil(n / cols);
  const innerX = box.x + 6;
  const innerY = box.y + topPad;
  const innerW = box.w - 12;
  const innerH = box.h - topPad - 6;
  const cw = innerW / cols;
  const ch = innerH / rows;
  const out: Array<{ cx: number; cy: number; cw: number; ch: number }> = [];
  for (let i = 0; i < n; i++) {
    const c = i % cols;
    const r = Math.floor(i / cols);
    out.push({ cx: innerX + c * cw + cw / 2, cy: innerY + r * ch + ch / 2, cw, ch });
  }
  return out;
}

// ─── Main transformer ─────────────────────────────────────────────────────────

export function transformTransport(raw: RawState): RenderedState {
  // 1) Read relations into maps. Discover location/vehicle *types* from the
  //    relation targets, so that even a location/vehicle with nothing in it THIS
  //    step is still classified (and drawn) correctly.
  const typeOf: Record<string, string> = {};
  for (const o of raw.objects) typeOf[o.id] = o.type;

  const atOf: Record<string, string> = {}; // x -> location  (from (at x loc))
  const inOf: Record<string, string> = {}; // p -> vehicle   (from (in p veh))
  const locationTypes = new Set<string>();
  const vehicleTypes = new Set<string>();
  for (const r of raw.relations) {
    if (r.type === "at" && r.target) {
      atOf[r.source] = r.target;
      if (typeOf[r.target]) locationTypes.add(typeOf[r.target]);
    } else if (r.type === "in" && r.target) {
      inOf[r.source] = r.target;
      if (typeOf[r.target]) vehicleTypes.add(typeOf[r.target]);
    }
  }

  const role = (id: string): "location" | "vehicle" | "mover" =>
    locationTypes.has(typeOf[id]) ? "location" : vehicleTypes.has(typeOf[id]) ? "vehicle" : "mover";

  // 2) Place boxes = real locations (sorted for stability) + one "Unplaced" box.
  const realLocations = raw.objects
    .filter((o) => role(o.id) === "location")
    .map((o) => o.id)
    .sort();
  const places = [...realLocations, UNPLACED];

  // 3) Grid layout for the place boxes.
  const cols = Math.max(1, Math.ceil(Math.sqrt(places.length)));
  const rows = Math.ceil(places.length / cols);
  const margin = 20;
  const pad = 10;
  const cellW = (CANVAS_W - margin * 2) / cols;
  const cellH = (CANVAS_H - margin * 2) / rows;
  const placeRect: Record<string, { x: number; y: number; w: number; h: number }> = {};
  places.forEach((pid, i) => {
    const c = i % cols;
    const r = Math.floor(i / cols);
    placeRect[pid] = {
      x: margin + c * cellW + pad,
      y: margin + r * cellH + pad,
      w: cellW - pad * 2,
      h: cellH - pad * 2,
    };
  });

  const placeOf = (id: string): string =>
    atOf[id] && placeRect[atOf[id]] ? atOf[id] : UNPLACED;

  // 4) Direct contents of each place (vehicles + movers sitting directly at it),
  //    and the passengers of each vehicle.
  const directContents: Record<string, string[]> = {};
  const passengers: Record<string, string[]> = {};
  for (const pid of places) directContents[pid] = [];
  for (const o of raw.objects) {
    if (role(o.id) === "location") continue;
    if (role(o.id) === "mover" && inOf[o.id]) {
      (passengers[inOf[o.id]] = passengers[inOf[o.id]] || []).push(o.id);
    } else {
      directContents[placeOf(o.id)].push(o.id);
    }
  }

  // 5) Assign positions: tile each place's direct contents inside its box, then
  //    tile each vehicle's passengers inside the vehicle's sub-box.
  const positions: Record<string, [number, number]> = {};
  const sizes: Record<string, { w: number; h: number }> = {};

  for (const pid of places) {
    const items = directContents[pid].slice().sort();
    const slots = tileSlots(items.length, placeRect[pid], 26); // 26px for place label
    items.forEach((id, i) => {
      const s = slots[i];
      positions[id] = [s.cx, s.cy];
      if (role(id) === "vehicle") {
        // Generous so a recognizable vehicle icon + its passengers fit.
        const vw = Math.max(64, Math.min(s.cw - 10, 170));
        const vh = Math.max(48, Math.min(s.ch - 10, 110));
        sizes[id] = { w: vw, h: vh };
        const vbox = { x: s.cx - vw / 2, y: s.cy - vh / 2, w: vw, h: vh };
        const plist = (passengers[id] || []).slice().sort();
        const pslots = tileSlots(plist.length, vbox, 18); // 18px for vehicle label
        plist.forEach((pid2, j) => {
          positions[pid2] = [pslots[j].cx, pslots[j].cy];
        });
      }
    });
  }

  // 6) Build VisualObjects. Place boxes (locations + Unplaced) become objects so
  //    the renderer can draw the bounded regions.
  const objects: VisualObject[] = [];
  for (const pid of places) {
    const rect = placeRect[pid];
    const unplaced = pid === UNPLACED;
    objects.push({
      id: pid,
      type: unplaced ? "unplaced" : "location",
      label: unplaced ? "Unplaced" : makeLabel(pid),
      position: [rect.x + rect.w / 2, rect.y + rect.h / 2],
      properties: {
        color: unplaced ? "#9aa0a6" : colorFor(pid),
        role: "location",
        width: rect.w,
        height: rect.h,
        unplaced,
      },
    });
  }
  for (const o of raw.objects) {
    const rl = role(o.id);
    if (rl === "location") continue;
    const pos = positions[o.id] || [CANVAS_W / 2, CANVAS_H / 2];
    if (rl === "vehicle") {
      const sz = sizes[o.id] || { w: 90, h: 60 };
      objects.push({
        // Keep the raw PDDL `type` (e.g. "aircraft") so the renderer can pick a
        // matching icon; the role lives in `properties.role`.
        id: o.id,
        type: o.type,
        label: makeLabel(o.id),
        position: pos,
        properties: {
          color: colorFor(o.id),
          role: "vehicle",
          width: sz.w,
          height: sz.h,
          containerId: placeOf(o.id),
        },
      });
    } else {
      objects.push({
        id: o.id,
        type: o.type,
        label: makeLabel(o.id),
        position: pos,
        properties: {
          color: colorFor(o.id),
          role: "mover",
          radius: 16,
          containerId: inOf[o.id] || placeOf(o.id),
        },
      });
    }
  }

  // 7) Preserve all relations and tag them so the renderer draws containment.
  const relations: VisualRelation[] = raw.relations.map((r) => ({
    type: r.type,
    source: r.source,
    target: r.target,
    properties: {
      ...(r.properties || {}),
      relationship: r.type === "in" ? "nested" : r.type === "at" ? "contained" : "edge",
    },
  }));

  return { domain: raw.domain, objects, relations, metadata: raw.metadata };
}
