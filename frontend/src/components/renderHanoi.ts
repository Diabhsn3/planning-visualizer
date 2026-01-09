// src/components/renderHanoi.ts
// 
// CAMERA-BASED ZOOM: This renderer uses FIXED world-unit sizes.
// The canvas transform (scale + translate) handles zoom/pan.
// DO NOT read or compensate for the scale - just draw at fixed sizes.

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

// ================= MAIN =================
export function renderHanoi(ctx: CanvasRenderingContext2D, state: RenderedState) {
  // ---------- FIXED World Dimensions ----------
  // These are in "world units" - the canvas transform handles zoom
  // DO NOT divide by scale - that causes the "resize objects" bug
  const WORLD_WIDTH = 800;
  const WORLD_HEIGHT = 600;

  // Clear the world area (in world coordinates)
  ctx.clearRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
  
  // Background
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

  // ---------- Colors ----------
  const pegColor = "#8B5A2B";
  const baseColor = "rgba(0,0,0,0.2)";
  const labelColor = "rgba(0,0,0,0.65)";
  const diskColors = [
    "#FF6B6B",
    "#4ECDC4",
    "#FFE66D",
    "#95E1D3",
    "#AA96DA",
    "#A8D8EA",
    "#F38181",
    "#FCBAD3",
  ];

  // ---------- Helpers ----------
  const numFromId = (id: string) => Number(id.match(/\d+$/)?.[0] ?? 0);

  const roundRect = (x: number, y: number, w: number, h: number, r: number) => {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  };

  // ---------- Extract pegs & disks ----------
  const pegs = state.objects
    .filter((o) => o.type === "peg" && o.id !== "peg" && o.id !== "disk")
    .sort((a, b) => numFromId(a.id) - numFromId(b.id));

  const disks = state.objects
    .filter((o) => o.type === "disk" && o.id !== "peg" && o.id !== "disk")
    .sort((a, b) => numFromId(a.id) - numFromId(b.id));

  const diskIds = new Set(disks.map((d) => d.id));

  // ---------- Reconstruct stacks from "on" relations ----------
  const supportToDisk = new Map<string, string>();
  const diskToSupport = new Map<string, string>();

  for (const rel of state.relations) {
    if (rel.type !== "on") continue;
    if (!rel.target) continue;

    const disk = rel.source;
    const support = rel.target;

    if (!diskIds.has(disk)) continue;

    diskToSupport.set(disk, support);
    supportToDisk.set(support, disk);
  }

  // For each peg, climb upward peg -> disk -> disk -> ...
  const stacks = new Map<string, string[]>();
  for (const peg of pegs) {
    const stack: string[] = [];
    let support: string = peg.id;
    const seen = new Set<string>();

    while (supportToDisk.has(support)) {
      const d = supportToDisk.get(support)!;
      if (seen.has(d)) break;
      seen.add(d);
      stack.push(d);
      support = d;
    }

    stacks.set(peg.id, stack);
  }

  // ---------- FIXED Layout (world units) ----------
  const pegCount = Math.max(1, pegs.length);
  const spacing = WORLD_WIDTH / (pegCount + 1);
  const pegBaseY = WORLD_HEIGHT * 0.7;

  // Fixed sizes in world units
  const pegHeight = 150;
  const poleWidth = 10;
  const diskHeight = 18;
  const baseWidth = 120;
  const baseHeight = 12;

  // ---------- Draw pegs ----------
  const pegCenters: Record<string, number> = {};
  pegs.forEach((peg, i) => {
    const cx = spacing * (i + 1);
    pegCenters[peg.id] = cx;

    // Base shadow
    ctx.fillStyle = baseColor;
    roundRect(cx - baseWidth/2, pegBaseY + 6, baseWidth, baseHeight, 6);
    ctx.fill();

    // Pole
    ctx.fillStyle = pegColor;
    roundRect(cx - poleWidth / 2, pegBaseY - pegHeight, poleWidth, pegHeight, 4);
    ctx.fill();

    // Label
    ctx.fillStyle = labelColor;
    ctx.font = "bold 14px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText(peg.id.toUpperCase(), cx, pegBaseY - pegHeight - 10);
  });

  // ---------- Draw disks ----------
  const totalDisks = Math.max(1, disks.length);

  for (const [pegId, diskStack] of stacks.entries()) {
    const cx = pegCenters[pegId];
    if (cx === undefined) continue;

    let currentY = pegBaseY;

    for (const diskId of diskStack) {
      const rank = numFromId(diskId) || 1;
      const t = (rank - 1) / Math.max(1, totalDisks - 1);

      // Fixed disk sizes in world units
      const minW = 50;
      const maxW = 140;
      const w = minW + (maxW - minW) * t;

      const x = cx - w / 2;
      const y = currentY - diskHeight;

      // Shadow
      ctx.fillStyle = "rgba(0,0,0,0.12)";
      roundRect(x + 2, y + 2, w, diskHeight, 8);
      ctx.fill();

      // Disk
      ctx.fillStyle = diskColors[(rank - 1) % diskColors.length];
      roundRect(x, y, w, diskHeight, 8);
      ctx.fill();

      // Label
      ctx.fillStyle = "rgba(0,0,0,0.75)";
      ctx.font = "bold 11px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`D${rank}`, x + w / 2, y + diskHeight / 2);

      currentY = y;
    }
  }

  // ---------- Title ----------
  ctx.fillStyle = "#333";
  ctx.font = "bold 20px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText("Tower of Hanoi", WORLD_WIDTH / 2, 20);
  
  ctx.font = "14px Arial";
  ctx.fillStyle = "#666";
  ctx.fillText(`${disks.length} disk${disks.length !== 1 ? 's' : ''}`, WORLD_WIDTH / 2, 45);
}
