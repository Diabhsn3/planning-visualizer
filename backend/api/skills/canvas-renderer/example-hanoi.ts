/**
 * EXAMPLE: Complete working renderer for the Tower of Hanoi domain.
 * Study this file carefully as a template for generating new renderers.
 *
 * Key patterns to follow:
 * 1. Declare interfaces inline (VisualObject, VisualRelation, RenderedState)
 * 2. Extract objects by type using .filter()
 * 3. Build relationship maps from state.relations
 * 4. Calculate layout dynamically based on object count
 * 5. Use pure Canvas 2D API for all drawing
 * 6. Export exactly three items: render function, background function, legend (or undefined)
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
}

export interface RenderedState {
  domain: string;
  objects: VisualObject[];
  relations: VisualRelation[];
}

export function renderHanoi(ctx: CanvasRenderingContext2D, state: RenderedState) {
  const WORLD_WIDTH = 800;
  const WORLD_HEIGHT = 600;

  const pegColor = "#8B5A2B";
  const baseColor = "rgba(0,0,0,0.2)";
  const diskColors = ["#FF6B6B", "#4ECDC4", "#FFE66D", "#95E1D3", "#AA96DA"];

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

  // Step 1: Extract objects by type
  const pegs = state.objects.filter((o) => o.type === "peg").sort((a, b) => numFromId(a.id) - numFromId(b.id));
  const disks = state.objects.filter((o) => o.type === "disk").sort((a, b) => numFromId(a.id) - numFromId(b.id));
  const diskIds = new Set(disks.map((d) => d.id));

  // Step 2: Build relationship maps from relations
  const supportToDisk = new Map<string, string>();
  for (const rel of state.relations) {
    if (rel.type === "on" && rel.target && diskIds.has(rel.source)) {
      supportToDisk.set(rel.target, rel.source);
    }
  }

  // Step 3: Build stacks (which disks are on which pegs)
  const stacks = new Map<string, string[]>();
  for (const peg of pegs) {
    const stack: string[] = [];
    let support: string = peg.id;
    while (supportToDisk.has(support)) {
      const d = supportToDisk.get(support)!;
      stack.push(d);
      support = d;
    }
    stacks.set(peg.id, stack);
  }

  // Step 4: Calculate dynamic layout
  const pegCount = Math.max(1, pegs.length);
  const spacing = WORLD_WIDTH / (pegCount + 1);
  const poleWidth = 10;
  const baseWidth = 120;
  const baseHeight = 12;
  const diskHeight = 18;
  const pegHeight = 200;
  const pegBaseY = WORLD_HEIGHT - 60;

  // Step 5: Draw pegs
  const pegCenters: Record<string, number> = {};
  pegs.forEach((peg, i) => {
    const cx = spacing * (i + 1);
    pegCenters[peg.id] = cx;

    // Base shadow
    ctx.fillStyle = baseColor;
    roundRect(cx - baseWidth / 2, pegBaseY + 6, baseWidth, baseHeight, 6);
    ctx.fill();

    // Peg pole
    ctx.fillStyle = pegColor;
    roundRect(cx - poleWidth / 2, pegBaseY - pegHeight, poleWidth, pegHeight, 4);
    ctx.fill();

    // Peg label
    ctx.fillStyle = "rgba(0,0,0,0.65)";
    ctx.font = "bold 14px Arial";
    ctx.textAlign = "center";
    ctx.fillText(peg.id.toUpperCase(), cx, pegBaseY - pegHeight - 10);
  });

  // Step 6: Draw disks on pegs
  for (const [pegId, diskStack] of stacks.entries()) {
    const cx = pegCenters[pegId];
    if (cx === undefined) continue;

    let currentY = pegBaseY;
    for (const diskId of diskStack) {
      const rank = numFromId(diskId) || 1;
      const w = 120 - rank * 15;
      const x = cx - w / 2;
      const y = currentY - diskHeight;

      ctx.fillStyle = diskColors[(rank - 1) % diskColors.length];
      roundRect(x, y, w, diskHeight, 6);
      ctx.fill();

      ctx.fillStyle = "rgba(0,0,0,0.75)";
      ctx.font = "bold 11px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`D${rank}`, x + w / 2, y + diskHeight / 2);

      currentY = y;
    }
  }
}

export function renderHanoiBackground(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, "#f5f0e6");
  gradient.addColorStop(1, "#d4c9b5");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}

export const renderHanoiLegend = undefined;
