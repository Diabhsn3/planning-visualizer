// src/components/renderRovers.ts

// ================= TYPES =================
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
}

export interface RenderedState {
  domain: string;
  objects: VisualObject[];
  relations: VisualRelation[];
  metadata?: Record<string, any>;
}

// ================= IMAGE CACHE =================
const roverImg = new Image();
roverImg.src = "/rover.png";

const cameraImg = new Image();
cameraImg.src = "/camera.png";

// ================= CAMERA FLASH STATE =================
let cameraVisibleUntil = 0;
let lastAction: string | null = null;

// ================= MAIN =================
export function renderRovers(
  ctx: CanvasRenderingContext2D,
  state: RenderedState
) {
  const scale = ctx.getTransform().a || 1;
  const W = ctx.canvas.width / scale;
  const H = ctx.canvas.height / scale;

  // ================= GRID BACKGROUND =================
  const GRID = 100;
  const cols = Math.ceil(W / GRID);
  const rows = Math.ceil(H / GRID);

  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = "rgba(0,0,0,0.08)";
  ctx.lineWidth = 1;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      ctx.strokeRect(x * GRID, y * GRID, GRID, GRID);
    }
  }

  // ================= COLORS =================
  const waypointColor = "#66BB6A";
  const pathColor = "#B0BEC5";
  const textColor = "#444";

  // ================= FILTER OBJECTS =================
    const waypoints = state.objects.filter(o => {
    if (o.type !== "waypoint") return false;
    const id = (o.id ?? "").toLowerCase();
    const label = (o.label ?? "").toLowerCase();

    // מסננים placeholders שמופיעים לפעמים כ-waypoint
    if (id === "rover" || id === "waypoint") return false;
    if (label === "rover" || label === "waypoint") return false;

    return true;
    });


  // ================= RELATIONS =================
  const connected = state.relations.filter(r => r.type === "connected");
  const atRovers = state.relations.filter(r => r.type === "at-rover");
  const atTargets = state.relations.filter(r => r.type === "at-target");

  // ================= CAMERA FLASH LOGIC =================
  const now = Date.now();
  const action = state.metadata?.action ?? null;

  if (action && action !== lastAction && action.startsWith("(take-image")) {
    cameraVisibleUntil = now + 1000;
  }
  lastAction = action;

  const showCamera = now < cameraVisibleUntil;

  function parseTakeImageAction(action: string | null): { rover?: string; waypoint?: string } {
  if (!action) return {};
  const s = action.trim();
  if (!s.startsWith("(take-image")) return {};
  // פורמט צפוי: (take-image rover1 t1 w2)
  const parts = s.replace(/[()]/g, "").split(/\s+/);
  if (parts.length < 4) return {};
  return { rover: parts[1], waypoint: parts[3] };
 }
  
   const takeImgInfo = parseTakeImageAction(action);

  // ================= LAYOUT (SPREAD CELLS) =================
  waypoints.sort((a, b) => a.id.localeCompare(b.id));

  const wpPos: Record<
    string,
    { col: number; row: number; x: number; y: number }
  > = {};

  const colsWp = Math.ceil(Math.sqrt(waypoints.length));

  // ⬅️ כאן הפיזור
  const CELL_STEP_X = 3; // כמה תאים לדלג אופקית
  const CELL_STEP_Y = 2; // כמה תאים לדלג אנכית

  const startCol = 1;
  const startRow = 1;

  waypoints.forEach((w, i) => {
    const col =
      startCol + (i % colsWp) * CELL_STEP_X;
    const row =
      startRow + Math.floor(i / colsWp) * CELL_STEP_Y;

    wpPos[w.id] = {
      col,
      row,
      x: col * GRID + GRID / 2,
      y: row * GRID + GRID / 2,
    };
  });

  // ================= PATHS =================
  ctx.strokeStyle = pathColor;
  ctx.lineWidth = 4;

  for (const r of connected) {
    const a = wpPos[r.source];
    const b = r.target ? wpPos[r.target] : null;
    if (!a || !b) continue;

    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }

  // ================= WAYPOINTS =================
  for (const w of waypoints) {
    const p = wpPos[w.id];
    if (!p) continue;

    ctx.fillStyle = waypointColor;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 18, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = textColor;
    ctx.font = "bold 12px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(w.id.toUpperCase(), p.x, p.y + 22);
  }

  // ================= TARGETS (TEXT ONLY) =================
  for (const t of atTargets) {
    const p = wpPos[t.target!];
    if (!p) continue;

    ctx.fillStyle = "#666";
    ctx.font = "10px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText("TARGET", p.x, p.row * GRID + GRID - 6);
  }

    // ================= CAMERA OVERLAY =================
    if (showCamera && cameraImg.complete) {
    // אם יש TAKE-IMAGE – נצייר לפי ה-waypoint שמופיע בפעולה
    const wpIdFromAction = takeImgInfo.waypoint;
    const pFromAction = wpIdFromAction ? wpPos[wpIdFromAction] : null;

    // fallback: אם לא הצלחנו לפרסר, נשתמש במיקום של הרובר הראשון
    const pFallback = atRovers.length > 0 ? wpPos[atRovers[0].target!] : null;

    const p = pFromAction ?? pFallback;

    if (p) {
        ctx.drawImage(cameraImg, p.col * GRID, p.row * GRID, GRID, GRID);
    }
    return;
    }


  // ================= ROVERS (MULTI) =================
  for (const r of atRovers) {
    const p = wpPos[r.target!];
    if (!p || !roverImg.complete) continue;

    ctx.drawImage(
      roverImg,
      p.x - 24,
      p.y - 24,
      48,
      48
    );

    // label ליד הרובר (ימין)
    ctx.fillStyle = textColor;
    ctx.font = "bold 11px Arial";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(
      r.source.toUpperCase(),
      p.x + 30,
      p.y
    );
  }
}
