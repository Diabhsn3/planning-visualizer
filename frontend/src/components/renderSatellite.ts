// src/components/renderSatellite.ts
// Satellite Domain Visualization - PURE RENDERER
//
// Implemented improvements (ALL):
// 1) Target->Satellite "ready" lines: if a satellite is pointing at the required DIR of a target (target-dir),
//    draw a thin blue link from the target to that satellite.
// 2) Active satellite highlight + action badge: based on metadata.action (TAKE / CAL / TX / TURN).
// 3) Targets show "who imaged": uses (image-taken i t) + (onboard i s) => shows "S?:I?".
// 4) Visibility lines: light gray lines sat -> groundstation when (visible s g).
// 5) Mini timeline inside Legend: shows last/current actions if metadata provides a list; fallback shows current action.
// 6) Smart target ordering: Pending -> Imaged -> Sent (left to right).
// 7) DIR badge color: green if current DIR matches any PENDING target's required DIR; blue otherwise.
//    During TURN step: show only "Dfrom → Dto" (orange).

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
  metadata?: Record<string, any>;
}

// ================= IMAGE CACHE (static, not state) =================
const satImg = new Image();
satImg.src = "/satellite.png";

const gsImg = new Image();
gsImg.src = "/groundstation.png";

const camImg = new Image();
camImg.src = "/camera.png";

// ================= HELPERS =================
function pick<T>(arr: T[], n: number) {
  return arr.slice(0, n);
}

function norm(s: string) {
  return (s ?? "").toLowerCase();
}

function isOneOf(t: string, set: string[]) {
  const x = norm(t);
  return set.some((v) => x === norm(v));
}

function getRelTargetSingle(relations: VisualRelation[], relTypes: string[]) {
  const m = new Map<string, string>();
  for (const r of relations) {
    if (!r.target) continue;
    if (!isOneOf(r.type, relTypes)) continue;
    m.set(norm(r.source), norm(r.target));
  }
  return m;
}

function parseAction(action: string | null | undefined): { name: string; params: string[] } | null {
  if (!action) return null;
  const s = action.trim();
  if (!s.startsWith("(")) return null;
  const parts = s.replace(/[()]/g, "").split(/\s+/).filter(Boolean);
  if (parts.length === 0) return null;
  return { name: parts[0].toLowerCase(), params: parts.slice(1).map((x) => x.toLowerCase()) };
}

function drawRoundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawLabel(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  opts: { font?: string; color?: string; align?: CanvasTextAlign; baseline?: CanvasTextBaseline } = {}
) {
  ctx.fillStyle = opts.color ?? "#2b2b2b";
  ctx.font = opts.font ?? "bold 12px Arial";
  ctx.textAlign = opts.align ?? "center";
  ctx.textBaseline = opts.baseline ?? "top";
  ctx.fillText(text, x, y);
}

function drawBadge(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  text: string,
  style: "blue" | "orange" | "neutral" | "green" = "neutral"
) {
  ctx.save();
  const font = "bold 10px Arial";
  ctx.font = font;

  const padX = 10;
  const w = ctx.measureText(text).width + padX * 2;
  const h = 20;

  const fill =
    style === "blue"
      ? "rgba(227,242,253,0.92)"
      : style === "orange"
      ? "rgba(255,243,224,0.92)"
      : style === "green"
      ? "rgba(232,245,233,0.92)"
      : "rgba(255,255,255,0.9)";

  const stroke =
    style === "blue"
      ? "rgba(33,150,243,0.28)"
      : style === "orange"
      ? "rgba(255,152,0,0.35)"
      : style === "green"
      ? "rgba(76,175,80,0.35)"
      : "rgba(0,0,0,0.12)";

  const textColor = style === "blue" ? "#1565C0" : style === "orange" ? "#E65100" : style === "green" ? "#2E7D32" : "#345";

  ctx.fillStyle = fill;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 1;

  drawRoundedRect(ctx, x, y, w, h, 10);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = textColor;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x + w / 2, y + h / 2);

  ctx.restore();

  return { w, h };
}

// function drawChip(
//   ctx: CanvasRenderingContext2D,
//   x: number,
//   y: number,
//   text: string,
//   active: boolean
// ) {
//   ctx.save();
//   ctx.font = "bold 9px Arial";
//   const padX = 8;
//   const w = ctx.measureText(text).width + padX * 2;
//   const h = 18;

//   ctx.fillStyle = active ? "rgba(33,150,243,0.12)" : "rgba(0,0,0,0.04)";
//   ctx.strokeStyle = active ? "rgba(33,150,243,0.25)" : "rgba(0,0,0,0.10)";
//   ctx.lineWidth = 1;

//   drawRoundedRect(ctx, x, y, w, h, 9);
//   ctx.fill();
//   ctx.stroke();

//   ctx.fillStyle = active ? "#1565C0" : "#556";
//   ctx.textAlign = "center";
//   ctx.textBaseline = "middle";
//   ctx.fillText(text, x + w / 2, y + h / 2);

//   ctx.restore();
//   return w;
// }

function drawThinLine(
  ctx: CanvasRenderingContext2D,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  color: string,
  width: number,
  dash?: number[]
) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  if (dash && dash.length) ctx.setLineDash(dash);
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  ctx.lineTo(bx, by);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

// Nice background
function drawSpaceBackground(ctx: CanvasRenderingContext2D, W: number, H: number) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#eef5ff");
  g.addColorStop(1, "#f6f9ff");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  ctx.globalAlpha = 0.35;
  for (let i = 0; i < 70; i++) {
    const x = (i * 97) % W;
    const y = (i * 53) % H;
    const r = (i % 3) + 0.6;
    ctx.fillStyle = "#9fb5d6";
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawInstrumentMarker(ctx: CanvasRenderingContext2D, x: number, y: number, _label: string, calibrated: boolean) {
  const r = 10;

  if (!calibrated) {
    ctx.save();
    ctx.strokeStyle = "#FF9800";
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);

    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();

    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(x, y, r * 0.45, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x - r - 3, y);
    ctx.lineTo(x - r + 6, y);
    ctx.moveTo(x + r - 6, y);
    ctx.lineTo(x + r + 3, y);
    ctx.moveTo(x, y - r - 3);
    ctx.lineTo(x, y - r + 6);
    ctx.moveTo(x, y + r - 6);
    ctx.lineTo(x, y + r + 3);
    ctx.stroke();

    ctx.fillStyle = "#FF9800";
    ctx.beginPath();
    ctx.arc(x, y, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }

  ctx.save();
  ctx.shadowColor = "rgba(76,175,80,0.5)";
  ctx.shadowBlur = 10;

  ctx.fillStyle = "#4CAF50";
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();

  if (camImg.complete && camImg.naturalWidth > 0) {
    const s = 14;
    ctx.drawImage(camImg, x - s / 2, y - s / 2, s, s);
  } else {
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(x - 4, y + 1);
    ctx.lineTo(x - 1, y + 4);
    ctx.lineTo(x + 6, y - 4);
    ctx.stroke();
  }

  ctx.restore();
}

function drawTargetMarker(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  label: string,
  isCommunicated: boolean,
  hasImage: boolean
) {
  const size = 22;

  if (isCommunicated) {
    ctx.save();
    ctx.shadowColor = "#4CAF50";
    ctx.shadowBlur = 10;
    ctx.fillStyle = "#4CAF50";
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x - 8, y + 2);
    ctx.lineTo(x - 2, y + 8);
    ctx.lineTo(x + 10, y - 6);
    ctx.stroke();

    drawLabel(ctx, "SENT", x, y + size + 4, { font: "bold 9px Arial", color: "#2E7D32" });
    drawLabel(ctx, label.toUpperCase(), x, y + size + 16, { font: "bold 10px Arial", color: "#666" });
    return;
  }

  if (hasImage) {
    ctx.fillStyle = "rgba(33, 150, 243, 0.2)";
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "#2196F3";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y, size * 0.5, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = "#2196F3";
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(x - size - 6, y);
    ctx.lineTo(x - size + 8, y);
    ctx.moveTo(x + size - 8, y);
    ctx.lineTo(x + size + 6, y);
    ctx.moveTo(x, y - size - 6);
    ctx.lineTo(x, y - size + 8);
    ctx.moveTo(x, y + size - 8);
    ctx.lineTo(x, y + size + 6);
    ctx.stroke();

    drawLabel(ctx, "IMAGED", x, y + size + 4, { font: "bold 9px Arial", color: "#1565C0" });
    drawLabel(ctx, label.toUpperCase(), x, y + size + 16, { font: "bold 10px Arial", color: "#666" });
    return;
  }

  ctx.strokeStyle = "#FF9800";
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.arc(x, y, size, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.beginPath();
  ctx.arc(x, y, size * 0.5, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = "#FF9800";
  ctx.beginPath();
  ctx.arc(x, y, 3, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(x - size - 4, y);
  ctx.lineTo(x - size + 6, y);
  ctx.moveTo(x + size - 6, y);
  ctx.lineTo(x + size + 4, y);
  ctx.moveTo(x, y - size - 4);
  ctx.lineTo(x, y - size + 6);
  ctx.moveTo(x, y + size - 6);
  ctx.lineTo(x, y + size + 4);
  ctx.stroke();

  drawLabel(ctx, "PENDING", x, y + size + 4, { font: "bold 9px Arial", color: "#E65100" });
  drawLabel(ctx, label.toUpperCase(), x, y + size + 16, { font: "bold 10px Arial", color: "#666" });
}

function actionTag(name: string): { tag: string; style: "blue" | "orange" | "green" | "neutral" } {
  const n = norm(name);
  if (n === "turn") return { tag: "TURN", style: "orange" };
  if (n === "calibrate") return { tag: "CAL", style: "orange" };
  if (n === "take-image" || n === "take_image") return { tag: "IMG", style: "blue" };
  if (n === "transmit-image" || n === "transmit_image" || n === "downlink") return { tag: "TX", style: "green" };
  return { tag: n.toUpperCase() || "ACT", style: "neutral" };
}

// function formatActionChip(act: string) {
//   const p = parseAction(act);
//   if (!p) return "STEP";
//   const a = actionTag(p.name).tag;
//   const s = p.params[0] ? p.params[0].toUpperCase() : "";
//   return s ? `${a}:${s}` : a;
// }

// ================= MAIN =================
export function renderSatellite(ctx: CanvasRenderingContext2D, state: RenderedState): void {
  // Use fixed dimensions like other renderers (Rovers, Depot, etc.)
  // The StateCanvas component handles zooming via ctx.scale() transform
  const W = 800;
  const H = 600;

  // NOTE: Background is handled by StateCanvas component (grid pattern)
  // Do NOT draw custom background here to maintain consistency with other domains

  // ---- LEGEND safe area (so nothing gets covered) ----
  // Move LEGEND higher by making LEGEND_Y more negative if you want.
  const LEGEND_W = 540;
  const LEGEND_H = 78;        // slightly taller to host the mini-timeline row
  const LEGEND_Y = -18;       // <<<<<<<<<<<<<< legend up
  const SAFE_TOP = LEGEND_H + 12; // stable safe area (independent of LEGEND_Y)

  // ---- Extract objects ----
  const satellites = state.objects.filter((o) => norm(o.type) === "satellite");
  const groundStations = state.objects.filter((o) =>
    ["groundstation", "ground-station", "ground_station"].includes(norm(o.type))
  );
  const targets = state.objects.filter((o) => norm(o.type) === "target");
  const instruments = state.objects.filter((o) => norm(o.type) === "instrument");

  const sats = (satellites.length ? satellites : state.objects.filter((o) => norm(o.id).startsWith("s"))).sort((a, b) =>
    a.id.localeCompare(b.id)
  );
  const gss = (groundStations.length ? groundStations : state.objects.filter((o) => norm(o.id).startsWith("g"))).sort(
    (a, b) => a.id.localeCompare(b.id)
  );
  const tgs0 = (targets.length ? targets : state.objects.filter((o) => norm(o.id).startsWith("t"))).sort((a, b) =>
    a.id.localeCompare(b.id)
  );
  const insts = (instruments.length ? instruments : state.objects.filter((o) => norm(o.id).startsWith("i"))).sort(
    (a, b) => a.id.localeCompare(b.id)
  );

  // ---- Relations ----
  const instrumentOnSat = getRelTargetSingle(state.relations, ["onboard", "on-board", "on_board"]);
  const satPointing = getRelTargetSingle(state.relations, ["pointing", "pointing-to", "aimed-at", "aimed_at"]);
  const targetToDir = getRelTargetSingle(state.relations, ["target-dir", "target_dir", "requires-dir", "requires_dir"]);
  const satVisibleGS = new Map<string, Set<string>>();
  for (const r of state.relations) {
    if (!isOneOf(r.type, ["visible"])) continue;
    const s = norm(r.source);
    const g = norm(r.target ?? "");
    if (!g) continue;
    if (!satVisibleGS.has(s)) satVisibleGS.set(s, new Set());
    satVisibleGS.get(s)!.add(g);
  }

  // instrument calibrated
  const calibratedInst = new Set<string>();
  for (const obj of insts) {
    if (obj.properties?.calibrated === true) calibratedInst.add(norm(obj.id));
  }
  for (const r of state.relations) {
    if (isOneOf(r.type, ["calibrated", "instrument-calibrated"])) {
      calibratedInst.add(norm(r.source));
    }
  }

  // target status + who imaged
  const haveImage = new Set<string>();
  const communicated = new Set<string>();

  // t -> instrument that took it (if known)
  const targetImagedByInst = new Map<string, string>();

  for (const r of state.relations) {
    if (isOneOf(r.type, ["have-image", "have_image"])) {
      haveImage.add(norm(r.source));
      if (r.target) haveImage.add(norm(r.target));
    }
    if (isOneOf(r.type, ["image-taken", "took-image", "have-image-of"])) {
      const inst = norm(r.source);
      const tgt = norm(r.target ?? "");
      if (tgt) {
        haveImage.add(tgt);
        // keep first if multiple
        if (!targetImagedByInst.has(tgt)) targetImagedByInst.set(tgt, inst);
      }
    }
    if (isOneOf(r.type, ["communicated", "transmitted", "sent", "downlinked"])) {
      communicated.add(norm(r.source));
    }
  }

  for (const t of tgs0) {
    if (t.properties?.have_image === true) haveImage.add(norm(t.id));
  }

  const action = parseAction(state.metadata?.action);
  const actName = action?.name ?? "";
  const actParams = action?.params ?? [];

  // Pure fallback: transmit marks communicated for this step
  if (actName === "transmit-image" || actName === "transmit_image" || actName === "downlink") {
    const tgt = actParams[2];
    if (tgt) communicated.add(norm(tgt));
  }

  // TURN info
  const isTurn = actName === "turn";
  const turnSat = isTurn ? norm(actParams[0] ?? "") : null;
  const turnFrom = isTurn ? norm(actParams[1] ?? "") : null;
  const turnTo = isTurn ? norm(actParams[2] ?? "") : null;

  // active satellite + badge
  const activeSat =
    (actName === "turn" ||
      actName === "calibrate" ||
      actName === "take-image" ||
      actName === "take_image" ||
      actName === "transmit-image" ||
      actName === "transmit_image" ||
      actName === "downlink")
      ? norm(actParams[0] ?? "")
      : null;

  const activeBadge = action ? actionTag(action.name) : null;

  // ---- Smart target ordering: Pending -> Imaged -> Sent ----
  const tgs = [...tgs0].sort((a, b) => {
    const ta = norm(a.id);
    const tb = norm(b.id);

    const aSent = communicated.has(ta);
    const bSent = communicated.has(tb);
    const aImg = haveImage.has(ta);
    const bImg = haveImage.has(tb);

    const rank = (sent: boolean, img: boolean) => (sent ? 2 : img ? 1 : 0);
    const ra = rank(aSent, aImg);
    const rb = rank(bSent, bImg);

    if (ra !== rb) return ra - rb; // pending first
    return a.id.localeCompare(b.id);
  });

  // Pending dirs set (for green DIR badge)
  const pendingDirs = new Set<string>();
  for (const t of tgs) {
    const tid = norm(t.id);
    const isSent = communicated.has(tid);
    const isImg = haveImage.has(tid);
    if (!isSent && !isImg) {
      const d = targetToDir.get(tid);
      if (d) pendingDirs.add(norm(d));
    }
  }

  // ---- Layout ----
  const topY = SAFE_TOP + 35;
  const bottomY = H - 120;

  const satSize = 78;
  const gsSize = 70;

  const leftPad = 90;
  const rightPad = 90;

  const satRowW = Math.max(10, W - leftPad - rightPad);
  const gsRowW = Math.max(10, W - leftPad - rightPad);

  const satStep = sats.length > 1 ? satRowW / (sats.length - 1) : 0;
  const gsStep = gss.length > 1 ? gsRowW / (gss.length - 1) : 0;

  const satPos = new Map<string, { x: number; y: number }>();
  sats.forEach((s, idx) => {
    const x = sats.length === 1 ? W / 2 : leftPad + idx * satStep;
    satPos.set(norm(s.id), { x, y: topY });
  });

  const gsPos = new Map<string, { x: number; y: number }>();
  gss.forEach((g, idx) => {
    const x = gss.length === 1 ? W / 2 : leftPad + idx * gsStep;
    gsPos.set(norm(g.id), { x, y: bottomY });
  });

  // ---- Targets row (horizontal) ----
  const targetRowY = Math.round(SAFE_TOP + (H - SAFE_TOP) * 0.58);
  const gapX = 150;

  const rowW = (tgs.length - 1) * gapX;
  const endX = W - 120;
  const startX = Math.max(220, endX - rowW);

  const targetPos = new Map<string, { x: number; y: number }>();
  tgs.forEach((t, i) => {
    targetPos.set(norm(t.id), { x: startX + i * gapX, y: targetRowY });
  });

  // ---- Orbit arc (optional aesthetic) ----
  ctx.save();
  ctx.strokeStyle = "rgba(120, 150, 190, 0.22)";
  ctx.lineWidth = 3;
  ctx.setLineDash([10, 10]);
  ctx.beginPath();
  ctx.ellipse(W / 2, topY + 18, Math.min(330, W * 0.40), 88, 0, Math.PI * 1.05, Math.PI * 1.95);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  // 4) Visibility lines (sat -> GS)
  for (const [sid, gsSet] of satVisibleGS.entries()) {
    const sp = satPos.get(sid);
    if (!sp) continue;
    for (const gid of gsSet.values()) {
      const gp = gsPos.get(gid);
      if (!gp) continue;
      drawThinLine(ctx, sp.x, sp.y + 20, gp.x, gp.y - 18, "rgba(0,0,0,0.08)", 2, [6, 8]);
    }
  }

  // TX highlight line (sat -> gs) when current action transmit-image
  if (actName === "transmit-image" || actName === "transmit_image" || actName === "downlink") {
    const sid = norm(actParams[0] ?? "");
    const gid = norm(actParams[3] ?? "");
    const a = satPos.get(sid);
    const b = gsPos.get(gid);
    if (a && b) {
      drawThinLine(ctx, a.x, a.y + 18, b.x, b.y - 22, "rgba(76,175,80,0.85)", 4);
    }
  }

  // 1) Target->Satellite "ready" lines (thin blue)
  // If satellite current DIR matches target-dir, draw link
  for (const t of tgs) {
    const tid = norm(t.id);
    const tp = targetPos.get(tid);
    const need = targetToDir.get(tid);
    if (!tp || !need) continue;

    const needN = norm(need);
    for (const s of sats) {
      const sid = norm(s.id);
      const cur = satPointing.get(sid);
      if (!cur) continue;
      if (norm(cur) !== needN) continue;

      const sp = satPos.get(sid);
      if (!sp) continue;

      // subtle: only show for targets not SENT (still relevant)
      const isSent = communicated.has(tid);
      if (isSent) continue;

      drawThinLine(ctx, sp.x, sp.y + 5, tp.x, tp.y - 10, "rgba(33,150,243,0.22)", 3, [5, 8]);
    }
  }

  // ---- Draw Satellites ----
  for (const s of sats) {
    const sid = norm(s.id);
    const p = satPos.get(sid);
    if (!p) continue;

    const isActive = !!(activeSat && sid === activeSat);

    // glow halo (stronger if active)
    ctx.save();
    ctx.shadowColor = isActive ? "rgba(255,152,0,0.55)" : "rgba(33,150,243,0.35)";
    ctx.shadowBlur = isActive ? 22 : 18;
    ctx.fillStyle = isActive ? "rgba(255,152,0,0.08)" : "rgba(33,150,243,0.08)";
    ctx.beginPath();
    ctx.arc(p.x, p.y, satSize * 0.62, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    const x = p.x - satSize / 2;
    const y = p.y - satSize / 2;

    if (satImg.complete && satImg.naturalWidth > 0) {
      ctx.drawImage(satImg, x, y, satSize, satSize);
    } else {
      ctx.fillStyle = "#90A4AE";
      ctx.beginPath();
      ctx.arc(p.x, p.y, satSize * 0.32, 0, Math.PI * 2);
      ctx.fill();
    }

    // sat label
    drawLabel(ctx, s.id.toUpperCase(), p.x, p.y + satSize * 0.45, {
      font: "bold 11px Arial",
      color: "#345",
      baseline: "top",
    });

    // 2) active action badge above the active sat
    if (isActive && activeBadge) {
      drawBadge(ctx, p.x - 22, p.y - satSize * 0.55 - 10, activeBadge.tag, activeBadge.style);
    }

    // DIR badge: green if it matches ANY pending target required-dir, otherwise blue.
    const curDir = satPointing.get(sid) ?? null;

    if (isTurn && turnSat && turnSat === sid && turnFrom && turnTo) {
      // show only the replacement: D1 → DCAL
      drawBadge(ctx, p.x - 46, p.y + satSize * 0.45 + 16, `${turnFrom.toUpperCase()} → ${turnTo.toUpperCase()}`, "orange");
    } else if (curDir) {
      const curN = norm(String(curDir));
      const ready = pendingDirs.has(curN);
      drawBadge(ctx, p.x - 24, p.y + satSize * 0.45 + 16, `DIR: ${String(curDir).toUpperCase()}`, ready ? "green" : "blue");
    }

    // instruments markers
    const instHere = insts.filter((ins) => norm(instrumentOnSat.get(ins.id) ?? "") === sid);
    if (instHere.length) {
      const shown = pick(instHere, 3);
      shown.forEach((ins, idx) => {
        const bx = p.x - 26 + idx * 18;
        const by = p.y - satSize * 0.45;
        const cal = calibratedInst.has(norm(ins.id)) || ins.properties?.calibrated === true;
        drawInstrumentMarker(ctx, bx, by, ins.id, cal);
      });
    }
  }

  // ---- Draw Ground Stations ----
  for (const g of gss) {
    const gid = norm(g.id);
    const p = gsPos.get(gid);
    if (!p) continue;

    const x = p.x - gsSize / 2;
    const y = p.y - gsSize / 2;

    ctx.save();
    ctx.fillStyle = "rgba(70, 90, 120, 0.10)";
    drawRoundedRect(ctx, x - 18, y + gsSize - 18, gsSize + 36, 28, 14);
    ctx.fill();
    ctx.restore();

    if (gsImg.complete && gsImg.naturalWidth > 0) {
      ctx.drawImage(gsImg, x, y, gsSize, gsSize);
    } else {
      ctx.fillStyle = "#607D8B";
      ctx.beginPath();
      ctx.arc(p.x, p.y, gsSize * 0.28, 0, Math.PI * 2);
      ctx.fill();
    }

    drawLabel(ctx, g.id.toUpperCase(), p.x, y + gsSize + 6, {
      font: "bold 11px Arial",
      color: "#234",
      baseline: "top",
    });
  }

  // ---- Draw Targets (row) ----
  for (const t of tgs) {
    const tid = norm(t.id);
    const p = targetPos.get(tid);
    if (!p) continue;

    const hasImg = haveImage.has(tid);
    const isSent = communicated.has(tid);

    drawTargetMarker(ctx, p.x, p.y, t.id, isSent, hasImg);

    // required DIR badge
    const needDir = targetToDir.get(tid);
    if (needDir) {
      drawBadge(ctx, p.x - 26, p.y + 34, `DIR: ${needDir.toUpperCase()}`, "neutral");
    }

    // 3) who imaged (S?:I?)
    const inst = targetImagedByInst.get(tid);
    if (inst) {
      const sat = instrumentOnSat.get(inst);
      const who = sat ? `${sat.toUpperCase()}:${inst.toUpperCase()}` : inst.toUpperCase();
      drawLabel(ctx, `by ${who}`, p.x, p.y + 62, {
        font: "bold 9px Arial",
        color: "#567",
        baseline: "top",
      });
    }
  }

  // ================= LEGEND (DRAW LAST) =================
  const lx = (W - LEGEND_W) / 2;
  const ly = LEGEND_Y;

  ctx.save();
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  drawRoundedRect(ctx, lx, ly, LEGEND_W, LEGEND_H, 14);
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.08)";
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = "#333";
  ctx.font = "bold 12px Arial";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText("Satellite legend", lx + 12, ly + 8);

  // legend markers row
  drawTargetMarker(ctx, lx + 80, ly + 42, "T?", false, false);
  drawLabel(ctx, "Pending", lx + 120, ly + 32, { align: "left", font: "12px Arial", color: "#444" });

  drawTargetMarker(ctx, lx + 250, ly + 42, "T?", false, true);
  drawLabel(ctx, "Imaged", lx + 290, ly + 32, { align: "left", font: "12px Arial", color: "#444" });

  drawTargetMarker(ctx, lx + 410, ly + 42, "T?", true, true);
  drawLabel(ctx, "Sent", lx + 450, ly + 32, { align: "left", font: "12px Arial", color: "#444" });

  // 5) Mini timeline (inside legend, bottom row)
//   const rawList: unknown =
//     state.metadata?.recentActions ??
//     state.metadata?.actions ??
//     state.metadata?.plan ??
//     state.metadata?.history ??
//     null;

//   let actions: string[] = [];
//   if (Array.isArray(rawList)) {
//     actions = (rawList as any[]).map((x) => String(x)).filter((x) => x.trim().startsWith("("));
//   }

//   // fallback: just current action
//   if (actions.length === 0 && state.metadata?.action) actions = [String(state.metadata.action)];

//   // keep last 6
//   if (actions.length > 6) actions = actions.slice(actions.length - 6);

//   if (actions.length) {
//     ctx.fillStyle = "#556";
//     ctx.font = "bold 10px Arial";
//     ctx.textAlign = "left";
//     ctx.textBaseline = "top";
//     ctx.fillText("Timeline:", lx + 12, ly + 60);

//     let cx = lx + 78;
//     const cy = ly + 56;
//     const current = String(state.metadata?.action ?? "");

//     for (const a of actions) {
//       const text = formatActionChip(a);
//       const isNow = a === current;
//       const w = drawChip(ctx, cx, cy, text, isNow);
//       cx += w + 8;
//       if (cx > lx + LEGEND_W - 60) break; // don't overflow
//     }
//   }

  ctx.restore();

  // ---- Fallback debug ----
  if (sats.length === 0 && gss.length === 0 && tgs.length === 0) {
    ctx.fillStyle = "#333";
    ctx.font = "16px Arial";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("Satellite renderer: no satellite/groundstation/target objects detected.", 30, 30);
    ctx.font = "12px Arial";
    ctx.fillText(`Objects found: ${state.objects.length}`, 30, 55);
  }
}
