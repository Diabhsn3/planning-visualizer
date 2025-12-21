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
}

// ================= ASSETS =================
const truckImg = new Image();
truckImg.src = "/truck.png";

const packageImg = new Image();
packageImg.src = "/package.png";

// ================= MAIN =================
export function renderDepot(
  ctx: CanvasRenderingContext2D,
  state: RenderedState
) {
  const GRID = 100;
  const PADDING = 20;

  const TRUCK_W = 70;
  const TRUCK_H = 44;
  const PKG_W = 32;
  const PKG_H = 32;

  // ---------- OBJECTS ----------
  const locations = state.objects.filter(
    o => o.type === "depot" || o.type === "distributor"
  );
  const trucks = state.objects.filter(o => o.type === "truck");

  const locById = new Map(locations.map(l => [l.id, l]));

  // ---------- RELATIONS ----------
  const truckAt = new Map<string, string>();      // truck -> location
  const inTruckCount = new Map<string, number>(); // truck -> count
  const packagesInTruck = new Set<string>();      // package ids
  const groundCount = new Map<string, number>();  // location -> count

  // first pass – detect packages in trucks
  for (const r of state.relations) {
    if (r.type === "in-truck" && r.target) {
      packagesInTruck.add(r.source);
      inTruckCount.set(r.target, (inTruckCount.get(r.target) || 0) + 1);
    }
  }

  // second pass – count ground packages (ONLY if not in truck)
  for (const r of state.relations) {
    if (r.type === "at" && r.target && !packagesInTruck.has(r.source)) {
      groundCount.set(r.target, (groundCount.get(r.target) || 0) + 1);
    }
    if (r.type === "at-truck" && r.target) {
      truckAt.set(r.source, r.target);
    }
  }

  // ---------- GRID ----------
  let maxX = 0, maxY = 0;
  for (const l of locations) {
    if (!l.position) continue;
    maxX = Math.max(maxX, l.position[0]);
    maxY = Math.max(maxY, l.position[1]);
  }

  const cols = Math.max(8, maxX + 2);
  const rows = Math.max(5, maxY + 2);

  const scale = ctx.getTransform().a || 1;
  const viewW = ctx.canvas.width / scale;
  const viewH = ctx.canvas.height / scale;

  const startX = Math.max(PADDING, (viewW - cols * GRID) / 2);
  const startY = Math.max(PADDING, (viewH - rows * GRID) / 2);

  const toPx = (gx: number, gy: number) => ({
    x: startX + gx * GRID,
    y: startY + gy * GRID,
  });

  // ---------- BACKGROUND ----------
  ctx.fillStyle = "#f6f7fb";
  ctx.fillRect(0, 0, viewW, viewH);

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const px = startX + x * GRID;
      const py = startY + y * GRID;
      ctx.fillStyle = "#fff";
      ctx.fillRect(px, py, GRID, GRID);
      ctx.strokeStyle = "rgba(0,0,0,0.08)";
      ctx.strokeRect(px, py, GRID, GRID);
    }
  }

  // ---------- HELPERS ----------
  const drawImg = (
    img: HTMLImageElement,
    x: number,
    y: number,
    w: number,
    h: number,
    color: string
  ) => {
    if (img.complete) ctx.drawImage(img, x, y, w, h);
    else {
      ctx.fillStyle = color;
      ctx.fillRect(x, y, w, h);
    }
  };

  const drawBadge = (x: number, y: number, count: number) => {
    if (count <= 0) return;
    const r = 12;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = "#E53935";
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = "bold 13px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(count), x, y);
  };

  const drawLocationLabel = (x: number, y: number, text: string) => {
    ctx.font = "bold 12px Arial";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";

    const padding = 4;
    const metrics = ctx.measureText(text);
    const w = metrics.width + padding * 2;
    const h = 16;

    // background
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(x + 6, y + 6, w, h);

    // text
    ctx.fillStyle = "#fff";
    ctx.fillText(text, x + 6 + padding, y + 6 + 2);
  };


  // ---------- DRAW LOCATIONS ----------
    // ---------- DRAW LOCATIONS ----------
  for (const l of locations) {
    if (!l.position) continue;
    const { x, y } = toPx(l.position[0], l.position[1]);

    // background
    ctx.fillStyle = l.properties?.color || "#ddd";
    ctx.fillRect(x + 8, y + 8, GRID - 16, GRID - 16);

    // label (S1 / S2 / D1)
    drawLocationLabel(x, y, l.label);
    }


  // ---------- DRAW TRUCKS ----------
  for (const t of trucks) {
    const locId = truckAt.get(t.id);
    const loc = locById.get(locId || "");
    if (!loc?.position) continue;

    const { x, y } = toPx(loc.position[0], loc.position[1]);
    const cx = x + GRID * 0.3;
    const cy = y + GRID * 0.6;

    drawImg(
      truckImg,
      cx - TRUCK_W / 2,
      cy - TRUCK_H / 2,
      TRUCK_W,
      TRUCK_H,
      "#00BFFF"
    );

    const tCount = inTruckCount.get(t.id) || 0;

    // badge ABOVE truck
    drawBadge(cx, cy - TRUCK_H / 2 - 12, tCount);

    // small package INSIDE truck
    if (tCount > 0) {
      drawImg(
        packageImg,
        cx + TRUCK_W * 0.15,
        cy - PKG_H / 2,
        PKG_W * 0.9,
        PKG_H * 0.9,
        "#FFD700"
      );
    }
  }

  // ---------- DRAW GROUND PACKAGES ----------
  for (const [locId, count] of groundCount) {
    const loc = locById.get(locId);
    if (!loc?.position) continue;

    const { x, y } = toPx(loc.position[0], loc.position[1]);
    const cx = x + GRID * 0.75;
    const cy = y + GRID * 0.6;

    drawImg(
      packageImg,
      cx - PKG_W / 2,
      cy - PKG_H / 2,
      PKG_W,
      PKG_H,
      "#FFD700"
    );

    drawBadge(cx, cy - PKG_H / 2 - 10, count);
  }
}
