// src/components/renderHanoi.ts

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
  // ---------- Canvas ----------
  const scale = ctx.getTransform().a || 1;
  const viewW = ctx.canvas.width / scale;
  const viewH = ctx.canvas.height / scale;

  ctx.clearRect(0, 0, viewW, viewH);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, viewW, viewH);

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
  // (the "o.id !== 'peg'" filters are unnecessary, but keeping your guardrails)
  const pegs = state.objects
    .filter((o) => o.type === "peg" && o.id !== "peg" && o.id !== "disk")
    .sort((a, b) => numFromId(a.id) - numFromId(b.id));

  const disks = state.objects
    .filter((o) => o.type === "disk" && o.id !== "peg" && o.id !== "disk")
    .sort((a, b) => numFromId(a.id) - numFromId(b.id)); // d1 smallest

  const diskIds = new Set(disks.map((d) => d.id));

  // ---------- Reconstruct stacks from "on" relations ----------
  // We expect relations like:
  //   (on d1 d2)  and (on d2 a)
  // Build: supportToDisk["a"] = "d2", supportToDisk["d2"] = "d1"
  const supportToDisk = new Map<string, string>();
  const diskToSupport = new Map<string, string>();

  for (const rel of state.relations) {
    if (rel.type !== "on") continue;
    if (!rel.target) continue;

    const disk = rel.source;
    const support = rel.target;

    // Defensive: only consider "on" where source is actually a disk object
    if (!diskIds.has(disk)) continue;

    // In valid Hanoi, each disk has exactly one support, and each support has at most one disk on it.
    diskToSupport.set(disk, support);
    supportToDisk.set(support, disk);
  }

  // For each peg, climb upward peg -> disk -> disk -> ...
  const stacks = new Map<string, string[]>();
  for (const peg of pegs) {
    const stack: string[] = [];
    let support: string = peg.id;

    // Prevent infinite loops if state is inconsistent
    const seen = new Set<string>();

    while (supportToDisk.has(support)) {
      const d = supportToDisk.get(support)!;
      if (seen.has(d)) break;
      seen.add(d);

      stack.push(d);
      support = d; // next disk sits on this disk
    }

    // stack is bottom->top already by construction
    stacks.set(peg.id, stack);
  }

  // Optional: detect floating disks (inconsistent states)
  // We'll ignore them in drawing to avoid random junk, but you could draw them aside if you want.
  // const rendered = new Set<string>();
  // for (const arr of stacks.values()) arr.forEach((d) => rendered.add(d));

  // ---------- Layout ----------
  const pegCount = Math.max(1, pegs.length);
  const spacing = viewW / (pegCount + 1);
  const pegBaseY = viewH * 0.7;

  const pegHeight = 150;
  const poleWidth = 10;
  const diskHeight = 18;

  // ---------- Draw pegs ----------
  const pegCenters: Record<string, number> = {};
  pegs.forEach((peg, i) => {
    const cx = spacing * (i + 1);
    pegCenters[peg.id] = cx;

    // Base
    ctx.fillStyle = baseColor;
    roundRect(cx - 60, pegBaseY + 6, 120, 12, 6);
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

    // Draw bottom->top (diskStack is already bottom->top)
    for (const diskId of diskStack) {
      const rank = numFromId(diskId) || 1; // assumes ids like d1,d2,...
      const t = (rank - 1) / Math.max(1, totalDisks - 1);

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
}
