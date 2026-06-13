/**
 * EXAMPLE: Complete working renderer for a LOCATIONS + NESTED-CONTAINMENT domain
 * (the "transport" family: logistics, ferry, zenotravel, gripper, depot, …).
 *
 * Study this whenever the domain has *locations* plus things that are `at` a
 * location and possibly `in` a vehicle/container. It is the template for the
 * single most common — and most often mis-drawn — domain class.
 *
 * TWO things this template shows together:
 *
 * 1. CONTAINMENT (accuracy): relations are drawn as PHYSICAL NESTING, never as
 *    connector lines. A vehicle that is `at` city2 is drawn INSIDE the city2 box;
 *    a passenger that is `in` aircraft a1 is drawn INSIDE the a1 glyph. Reads back
 *    unambiguously: location box ⊃ vehicle glyph ⊃ passenger glyph ⇒ (at a1 city2),
 *    (in p1 a1). There is NOT one connector line here — that is the point.
 *
 * 2. RECOGNIZABLE ICONS (legibility): each object TYPE is drawn as a simple
 *    Canvas-path icon of what it actually is — an aircraft looks like an aircraft,
 *    a person looks like a person — NOT a generic box or dot. Pick the icon by the
 *    object's real-world type and DRAW IT WITH CANVAS PATHS (no images). The
 *    vehicle's body doubles as the cabin so its passengers nest inside it.
 *    For YOUR domain choose fitting silhouettes (truck, ship, robot, package…);
 *    `drawVehicleBox` / `drawToken` below are the fallbacks when no icon fits.
 *
 * The Stage 1 transformer already did the layout: every object carries a
 * `position`; `properties.role` is "location" | "vehicle" | "mover"; location and
 * vehicle boxes carry `width`/`height`, movers carry `radius`; `type` is the raw
 * PDDL type used to pick the icon.
 */

export interface VisualObject {
  id: string;
  type: string;
  label: string;
  position?: [number, number];
  properties?: Record<string, any>;
}

export interface VisualRelation {
  type: string;
  source: string;
  target?: string;
  properties?: Record<string, any>;
}

export interface RenderedState {
  domain: string;
  objects: VisualObject[];
  relations: VisualRelation[];
}

// ─── Small Canvas helpers (pure Canvas 2D, no external assets) ────────────────

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function hexToRgba(hex: string, alpha: number): string {
  const m = hex.replace("#", "");
  const v = m.length === 3 ? m.split("").map((c) => c + c).join("") : m;
  return `rgba(${parseInt(v.slice(0, 2), 16)}, ${parseInt(v.slice(2, 4), 16)}, ${parseInt(v.slice(4, 6), 16)}, ${alpha})`;
}

function darken(hex: string, f = 0.6): string {
  const m = hex.replace("#", "");
  const v = m.length === 3 ? m.split("").map((c) => c + c).join("") : m;
  return `rgb(${Math.round(parseInt(v.slice(0, 2), 16) * f)}, ${Math.round(parseInt(v.slice(2, 4), 16) * f)}, ${Math.round(parseInt(v.slice(4, 6), 16) * f)})`;
}

// ─── Type icons (Canvas paths) — make each object look like what it is ───────

/** A person: head + shoulders, centered at (cx, cy), sized to radius r. */
function drawPerson(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string): void {
  const dark = darken(color, 0.5);
  const headR = r * 0.4;
  const headCy = cy - r * 0.46;
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.62, cy + r * 0.78);
  ctx.lineTo(cx - r * 0.48, cy + r * 0.02);
  ctx.quadraticCurveTo(cx, cy - r * 0.34, cx + r * 0.48, cy + r * 0.02);
  ctx.lineTo(cx + r * 0.62, cy + r * 0.78);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = dark;
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, headCy, headR, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.stroke();
}

/** An aircraft (top/side view) filling `box`; the fuselage doubles as the cabin
 *  so passengers nest inside it. */
function drawPlane(ctx: CanvasRenderingContext2D, box: { x: number; y: number; w: number; h: number }, color: string): void {
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  const fw = box.w * 0.78;
  const fh = Math.max(26, box.h * 0.46);
  const fx = cx - fw / 2;
  const fy = cy - fh / 2;
  const dark = darken(color, 0.5);
  ctx.lineJoin = "miter";
  ctx.fillStyle = hexToRgba(color, 0.6);
  ctx.strokeStyle = dark;
  ctx.lineWidth = 1.5;
  // main wings (thin, swept back)
  ctx.beginPath();
  ctx.moveTo(cx + fw * 0.06, cy - fh * 0.45); ctx.lineTo(cx - fw * 0.08, box.y + box.h * 0.1);
  ctx.lineTo(cx - fw * 0.28, box.y + box.h * 0.12); ctx.lineTo(cx - fw * 0.16, cy - fh * 0.45);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx + fw * 0.06, cy + fh * 0.45); ctx.lineTo(cx - fw * 0.08, box.y + box.h * 0.9);
  ctx.lineTo(cx - fw * 0.28, box.y + box.h * 0.88); ctx.lineTo(cx - fw * 0.16, cy + fh * 0.45);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  // tail stabilizers (back/left)
  ctx.beginPath();
  ctx.moveTo(fx + fw * 0.04, cy - fh * 0.4); ctx.lineTo(fx - fw * 0.08, cy - fh * 0.95);
  ctx.lineTo(fx + fw * 0.02, cy - fh * 0.95); ctx.lineTo(fx + fw * 0.16, cy - fh * 0.4);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(fx + fw * 0.04, cy + fh * 0.4); ctx.lineTo(fx - fw * 0.08, cy + fh * 0.95);
  ctx.lineTo(fx + fw * 0.02, cy + fh * 0.95); ctx.lineTo(fx + fw * 0.16, cy + fh * 0.4);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  // fuselage (the cabin)
  ctx.fillStyle = hexToRgba(color, 0.95);
  ctx.strokeStyle = dark;
  ctx.lineWidth = 2;
  roundRect(ctx, fx, fy, fw, fh, fh / 2); ctx.fill(); ctx.stroke();
  // nose cone (right)
  ctx.beginPath();
  ctx.moveTo(fx + fw - 3, fy + 1); ctx.lineTo(fx + fw + box.w * 0.12, cy); ctx.lineTo(fx + fw - 3, fy + fh - 1);
  ctx.closePath(); ctx.fillStyle = hexToRgba(color, 0.95); ctx.fill(); ctx.stroke();
}

/** Fallback vehicle/container icon (when no recognizable silhouette fits): a box. */
function drawVehicleBox(ctx: CanvasRenderingContext2D, box: { x: number; y: number; w: number; h: number }, color: string): void {
  ctx.fillStyle = hexToRgba(color, 0.9);
  ctx.strokeStyle = darken(color, 0.5);
  ctx.lineWidth = 2;
  roundRect(ctx, box.x, box.y, box.w, box.h, 8); ctx.fill(); ctx.stroke();
}

/** Fallback mover icon (when not a person): a labeled disc. */
function drawToken(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string): void {
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = darken(color, 0.5);
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

// ─── Main renderer ────────────────────────────────────────────────────────────

export function renderTransport(ctx: CanvasRenderingContext2D, state: RenderedState): void {
  const locations = state.objects.filter((o) => o.properties?.role === "location");
  const vehicles = state.objects.filter((o) => o.properties?.role === "vehicle");
  const movers = state.objects.filter((o) => o.properties?.role === "mover");

  // 1) Location boxes first (behind their contents). The "Unplaced" box is a
  //    location with properties.unplaced — dashed/grey so it is never mistaken
  //    for a real location.
  for (const loc of locations) {
    if (!loc.position) continue;
    const [cx, cy] = loc.position;
    const w = loc.properties?.width ?? 160;
    const h = loc.properties?.height ?? 120;
    const x = cx - w / 2;
    const y = cy - h / 2;
    const unplaced = !!loc.properties?.unplaced;
    const color = loc.properties?.color ?? "#4E79A7";
    if (unplaced) {
      ctx.setLineDash([6, 4]);
      ctx.strokeStyle = "#9aa0a6";
      ctx.fillStyle = "rgba(154, 160, 166, 0.08)";
    } else {
      ctx.setLineDash([]);
      ctx.strokeStyle = color;
      ctx.fillStyle = hexToRgba(color, 0.1);
    }
    ctx.lineWidth = 2;
    roundRect(ctx, x, y, w, h, 10); ctx.fill(); ctx.stroke(); ctx.setLineDash([]);
    if (!unplaced) {
      // tiny skyline so a "place" reads as a place
      ctx.fillStyle = hexToRgba(color, 0.55);
      const bx = x + w - 46, by = y + 8;
      ctx.fillRect(bx, by + 8, 8, 12); ctx.fillRect(bx + 11, by + 3, 8, 17); ctx.fillRect(bx + 22, by + 10, 8, 10);
    }
    ctx.fillStyle = unplaced ? "#5f6368" : darken(color, 0.55);
    ctx.font = "bold 14px Arial";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(loc.label, x + 8, y + 6);
  }

  // 2) Vehicles — pick an icon that matches the real-world type. Here the
  //    transport vehicle is an aircraft; for a trucks/ferry domain draw a
  //    truck/boat instead. Fall back to a box when nothing fits.
  for (const v of vehicles) {
    if (!v.position) continue;
    const [cx, cy] = v.position;
    const w = v.properties?.width ?? 120;
    const h = v.properties?.height ?? 80;
    const box = { x: cx - w / 2, y: cy - h / 2, w, h };
    const kind = (v.type || v.properties?.kind || "").toString();
    if (/air|plane|jet|flight|aircraft/i.test(kind)) drawPlane(ctx, box, v.properties?.color ?? "#F28E2B");
    else drawVehicleBox(ctx, box, v.properties?.color ?? "#F28E2B");
    ctx.fillStyle = darken(v.properties?.color ?? "#F28E2B", 0.5);
    ctx.font = "bold 11px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText(v.label, cx, box.y - 1);
  }

  // 3) Movers — people get a figure, anything else a labeled token. Drawn at the
  //    position the transformer chose: INSIDE their vehicle (if `in`) or their
  //    location (if `at`).
  for (const m of movers) {
    if (!m.position) continue;
    const [cx, cy] = m.position;
    const r = m.properties?.radius ?? 16;
    const kind = (m.type || m.properties?.kind || "").toString();
    if (/person|people|passenger|traveler|pilot|crew|human/i.test(kind)) drawPerson(ctx, cx, cy - 2, r, m.properties?.color ?? "#59A14F");
    else drawToken(ctx, cx, cy, r * 0.8, m.properties?.color ?? "#59A14F");
    ctx.fillStyle = "#1a1a1a";
    ctx.font = "bold 10px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(m.label, cx, cy + r * 0.85);
  }
}

// ─── Background — subtle and clearly NON-semantic (no roads/lanes to sit on) ──

export function renderTransportBackground(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  const g = ctx.createLinearGradient(0, 0, 0, height);
  g.addColorStop(0, "#f7f9fc");
  g.addColorStop(1, "#eef2f7");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "rgba(120, 130, 150, 0.06)";
  for (let x = 20; x < width; x += 40) {
    for (let y = 20; y < height; y += 40) {
      ctx.beginPath();
      ctx.arc(x, y, 1.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// ─── Legend — decodes the icons AND the relation ENCODINGS (containment) ─────

export function renderTransportLegend(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.save();
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.font = "bold 13px Arial";
  ctx.fillStyle = "#1a1a1a";
  ctx.fillText("Legend", x, y);
  let ly = y + 24;
  const line = 30;

  ctx.setLineDash([]);
  ctx.strokeStyle = "#4E79A7";
  ctx.fillStyle = hexToRgba("#4E79A7", 0.1);
  ctx.lineWidth = 2;
  roundRect(ctx, x, ly - 10, 28, 20, 4); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#333";
  ctx.font = "12px Arial";
  ctx.fillText("Location  (a box = a place)", x + 38, ly);

  ly += line;
  drawPlane(ctx, { x: x - 2, y: ly - 12, w: 34, h: 24 }, "#F28E2B");
  ctx.fillStyle = "#333";
  ctx.fillText("Vehicle inside a Location  =  (at vehicle location)", x + 38, ly);

  ly += line;
  drawPerson(ctx, x + 14, ly, 12, "#59A14F");
  ctx.fillStyle = "#333";
  ctx.fillText("Person inside a Vehicle  =  (in person vehicle)", x + 38, ly);

  ly += line;
  ctx.setLineDash([6, 4]);
  ctx.strokeStyle = "#9aa0a6";
  ctx.fillStyle = "rgba(154,160,166,0.08)";
  ctx.lineWidth = 2;
  roundRect(ctx, x, ly - 10, 28, 20, 4); ctx.fill(); ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle = "#333";
  ctx.fillText("Unplaced  (no location this step)", x + 38, ly);

  ctx.restore();
}
