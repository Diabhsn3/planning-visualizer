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
export function renderHanoi(
  ctx: CanvasRenderingContext2D,
  state: RenderedState
) {
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
  const numFromId = (id: string) =>
    Number(id.match(/\d+$/)?.[0] ?? 0);

  const roundRect = (
    x: number,
    y: number,
    w: number,
    h: number,
    r: number
  ) => {
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
    .filter(o => o.type === "peg" && o.id !== "peg" && o.id !== "disk")
    .sort((a, b) => numFromId(a.id) - numFromId(b.id));

  const disks = state.objects
    .filter(o => o.type === "disk" && o.id !== "peg" && o.id !== "disk")
    .sort((a, b) => numFromId(a.id) - numFromId(b.id)); // d1 הכי קטן

  // ---------- Build stacks ----------
  const stacks = new Map<string, string[]>();
  for (const peg of pegs) stacks.set(peg.id, []);

  for (const rel of state.relations) {
    if (rel.type === "on" && rel.target) {
      stacks.get(rel.target)?.push(rel.source);
    }
  }

  // מיון דיסקים בכל עמוד: גדול למטה
  for (const arr of stacks.values()) {
    arr.sort((a, b) => numFromId(b) - numFromId(a));
  }

  // ---------- Layout ----------
  const pegCount = pegs.length;
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
    roundRect(
      cx - poleWidth / 2,
      pegBaseY - pegHeight,
      poleWidth,
      pegHeight,
      4
    );
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

  for (const [pegId, diskIds] of stacks.entries()) {
    const cx = pegCenters[pegId];
    let currentY = pegBaseY;

    for (const diskId of diskIds) {
      const rank = numFromId(diskId) || 1;
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

      // Label inside disk (D1, D2, ...)
      ctx.fillStyle = "rgba(0,0,0,0.75)";
      ctx.font = "bold 11px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(
        `D${rank}`,
        x + w / 2,
        y + diskHeight / 2
      );

      currentY = y;
    }
  }
}
