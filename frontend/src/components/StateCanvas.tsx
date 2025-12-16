import { useEffect, useRef, useState } from "react";

// Global robot image for gripper domain
const robotImage = new Image();
robotImage.src = "/rooboot.png"; // served from /public
let robotImageLoaded = false;
robotImage.onload = () => {
  robotImageLoaded = true;
};

interface VisualObject {
  id: string;
  type: string;
  label: string;
  position?: [number, number];
  properties?: Record<string, any>;
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

// interface StateCanvasProps {
//   state: RenderedState;
//   width?: number;
//   height?: number;
// }

interface StateCanvasProps {
  state: RenderedState;
  width?: number;
  height?: number;
  isFirst?: boolean;
  isLast?: boolean;
}


export function StateCanvas({ state, width = 800, height = 600, isFirst = false, isLast = false }: StateCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Zoom and pan state
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Set background
    ctx.fillStyle = "#f8f9fa";
    ctx.fillRect(0, 0, width, height);

    // Save context state
    ctx.save();

    // Apply transformations for zoom and pan
    ctx.translate(offset.x, offset.y);
    ctx.scale(scale, scale);

    // Render based on domain
    if (state.domain === "blocks-world") {
      renderBlocksWorld(ctx, state);
    } else if (state.domain === "gripper") {
      renderGripper(ctx, state);
    } else if(state.domain === "depot"){
      renderDepot(ctx, state,  { showBadges: isFirst || isLast });
    }  
     else {
      renderDefault(ctx, state);
    }

    // Restore context state
    ctx.restore();
  }, [state, width, height, scale, offset]);

  // Handle mouse wheel for zoom
  // const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
  //   e.preventDefault();
    
  //   const canvas = canvasRef.current;
  //   if (!canvas) return;

  //   const rect = canvas.getBoundingClientRect();
  //   const mouseX = e.clientX - rect.left;
  //   const mouseY = e.clientY - rect.top;

  //   // Calculate zoom
  //   const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
  //   const newScale = Math.min(Math.max(0.1, scale * zoomFactor), 5);

  //   // Adjust offset to zoom towards mouse position
  //   const scaleChange = newScale / scale;
  //   const newOffsetX = mouseX - (mouseX - offset.x) * scaleChange;
  //   const newOffsetY = mouseY - (mouseY - offset.y) * scaleChange;

  //   setScale(newScale);
  //   setOffset({ x: newOffsetX, y: newOffsetY });
  // };

  // Handle mouse down for panning
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
  };

  // Handle mouse move for panning
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging) return;

    const newOffsetX = e.clientX - dragStart.x;
    const newOffsetY = e.clientY - dragStart.y;
    setOffset({ x: newOffsetX, y: newOffsetY });
  };

  // Handle mouse up
  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Handle mouse leave
  const handleMouseLeave = () => {
    setIsDragging(false);
  };

  // Reset zoom and pan
  const handleReset = () => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  };

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="border border-gray-300 rounded-lg shadow-sm"
        style={{ cursor: isDragging ? "grabbing" : "grab" }}
        // onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      />
      <div style={{
        position: "absolute",
        top: "10px",
        right: "10px",
        display: "flex",
        gap: "8px",
        background: "rgba(255, 255, 255, 0.9)",
        padding: "8px",
        borderRadius: "6px",
        boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
      }}>
        <button
          onClick={() => setScale(s => Math.min(s * 1.2, 5))}
          style={{
            padding: "4px 12px",
            background: "#4CAF50",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
            fontSize: "16px",
            fontWeight: "bold"
          }}
          title="Zoom In"
        >
          +
        </button>
        <button
          onClick={() => setScale(s => Math.max(s * 0.8, 0.1))}
          style={{
            padding: "4px 12px",
            background: "#4CAF50",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
            fontSize: "16px",
            fontWeight: "bold"
          }}
          title="Zoom Out"
        >
          −
        </button>
        <button
          onClick={handleReset}
          style={{
            padding: "4px 12px",
            background: "#2196F3",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
            fontSize: "12px"
          }}
          title="Reset View"
        >
          Reset
        </button>
        <span style={{
          padding: "4px 8px",
          background: "#f0f0f0",
          borderRadius: "4px",
          fontSize: "12px",
          display: "flex",
          alignItems: "center"
        }}>
          {Math.round(scale * 100)}%
        </span>
      </div>
    </div>
  );
}


/**
 * DEPOT DOMAIN
 */

const truckImg = new Image();
truckImg.src = "/truck.png";

const packageImg = new Image();
packageImg.src = "/package.png";

function renderDepot(ctx: CanvasRenderingContext2D, state: RenderedState) {
  const gridSize = 100;
  const padding = 22;

  const truckW = 70, truckH = 44;
  const pkgW = 44, pkgH = 44;

  const locations = state.objects.filter((o) => o.type === "depot" || o.type === "distributor");
  const trucks = state.objects.filter((o) => o.type === "truck");
  const packages = state.objects.filter((o) => o.type === "package");

  // relations
  const truckAt = new Map<string, string>();        // truckId -> locationId
  const packageAt = new Map<string, string>();      // pkgId -> locationId
  const packageInTruck = new Map<string, string>(); // pkgId -> truckId

  for (const rel of state.relations) {
    if (rel.type === "at-truck" && rel.target) truckAt.set(rel.source, rel.target);
    if (rel.type === "at" && rel.target) packageAt.set(rel.source, rel.target);
    if (rel.type === "in-truck" && rel.target) packageInTruck.set(rel.source, rel.target);
  }

  const locById = new Map(locations.map((l) => [l.id, l]));
  const truckById = new Map(trucks.map((t) => [t.id, t]));

  // helpers
  const roundRectPath = (x: number, y: number, w: number, h: number, r = 16) => {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  };

  const drawShadowedImage = (
    img: HTMLImageElement,
    x: number,
    y: number,
    w: number,
    h: number,
    fallbackColor: string
  ) => {
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.18)";
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 3;

    if (img.complete) ctx.drawImage(img, x, y, w, h);
    else {
      ctx.fillStyle = fallbackColor;
      ctx.fillRect(x, y, w, h);
    }
    ctx.restore();
  };

  // bounds
  let maxGX = 0, maxGY = 0;
  for (const loc of locations) {
    if (!loc.position) continue;
    maxGX = Math.max(maxGX, loc.position[0]);
    maxGY = Math.max(maxGY, loc.position[1]);
  }
  const cols = Math.max(8, maxGX + 2);
  const rows = Math.max(5, maxGY + 2);
  const mapW = cols * gridSize;
  const mapH = rows * gridSize;

  // center in current transform
  const t = ctx.getTransform();
  const currentScale = t.a || 1;
  const viewW = ctx.canvas.width / currentScale;
  const viewH = ctx.canvas.height / currentScale;

  const startX = Math.max(padding, (viewW - mapW) / 2);
  const startY = Math.max(padding, (viewH - mapH) / 2);

  const gridToPx = (gx: number, gy: number) => ({
    px: startX + gx * gridSize,
    py: startY + gy * gridSize,
  });

  // background + panel
  ctx.save();
  ctx.fillStyle = "#f6f7fb";
  ctx.fillRect(0, 0, viewW, viewH);
  ctx.restore();

  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.10)";
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 6;
  roundRectPath(startX - 12, startY - 12, mapW + 24, mapH + 24, 18);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.restore();

  // grid
  ctx.save();
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const px = startX + x * gridSize;
      const py = startY + y * gridSize;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(px, py, gridSize, gridSize);
      ctx.strokeStyle = "rgba(0,0,0,0.08)";
      ctx.lineWidth = 1;
      ctx.strokeRect(px, py, gridSize, gridSize);
    }
  }
  ctx.strokeStyle = "rgba(0,0,0,0.18)";
  ctx.lineWidth = 2;
  ctx.strokeRect(startX, startY, mapW, mapH);
  ctx.restore();

  // build cell occupancy
  const cell = new Map<string, { truck?: VisualObject; pkgsAt: VisualObject[]; pkgsInTruck: VisualObject[] }>();
  const key = (x: number, y: number) => `${x},${y}`;
  const ensure = (x: number, y: number) => {
    const k = key(x, y);
    if (!cell.has(k)) cell.set(k, { pkgsAt: [], pkgsInTruck: [] });
    return cell.get(k)!;
  };

  // place trucks
  for (const tr of trucks) {
    const locId = truckAt.get(tr.id);
    const loc = locId ? locById.get(locId) : undefined;
    if (!loc?.position) continue;
    const [gx, gy] = loc.position;
    ensure(gx, gy).truck = tr;
  }

  // place packages: split between at-location and in-truck
  for (const p of packages) {
    if (packageInTruck.has(p.id)) {
      const trId = packageInTruck.get(p.id)!;
      const trLocId = truckAt.get(trId);
      const loc = trLocId ? locById.get(trLocId) : undefined;
      if (!loc?.position) continue;
      const [gx, gy] = loc.position;
      ensure(gx, gy).pkgsInTruck.push(p);
    } else if (packageAt.has(p.id)) {
      const locId = packageAt.get(p.id)!;
      const loc = locById.get(locId);
      if (!loc?.position) continue;
      const [gx, gy] = loc.position;
      ensure(gx, gy).pkgsAt.push(p);
    }
  }

  // draw locations (📍/✅)
  for (const loc of locations) {
    if (!loc.position) continue;
    const [gx, gy] = loc.position;
    const { px, py } = gridToPx(gx, gy);
    const props = loc.properties || {};

    ctx.save();
    roundRectPath(px + 8, py + 8, gridSize - 16, gridSize - 16, 16);
    ctx.fillStyle = props.color || "#dddddd";
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.30)";
    ctx.lineWidth = 2;
    ctx.stroke();

    const icon = loc.type === "depot" ? "📍" : "✅";
    roundRectPath(px + gridSize / 2 - 22, py + 16, 44, 28, 14);
    ctx.fillStyle = "rgba(255,255,255,0.90)";
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.18)";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = "#111";
    ctx.font = "bold 34px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(icon, px + gridSize / 2, py + 30);
    ctx.restore();
  }

  // draw trucks + packages per cell
  for (const [k, v] of cell.entries()) {
    const [gxStr, gyStr] = k.split(",");
    const gx = Number(gxStr);
    const gy = Number(gyStr);
    const { px, py } = gridToPx(gx, gy);

    const hasTruck = !!v.truck;
    const hasAt = v.pkgsAt.length > 0;
    const hasIn = v.pkgsInTruck.length > 0;

    const centerY = py + gridSize * 0.62;

    // slots
    const leftCX = px + gridSize * 0.34;
    const rightCX = px + gridSize * 0.72;
    const midCX = px + gridSize * 0.52;

    // TRUCK position (if packages are on the ground too, keep side-by-side)
    const truckCX = hasTruck && hasAt ? leftCX : (hasTruck ? midCX : midCX);

    // draw truck
    if (v.truck) {
      const tx = truckCX - truckW / 2;
      const ty = centerY - truckH / 2;
      drawShadowedImage(truckImg, tx, ty, truckW, truckH, "#00BFFF");

      // ✅ IMPORTANT: packages IN-TRUCK are drawn ON TOP of the truck
      if (hasIn) {
        const topPkgX = tx + truckW * 0.58 - pkgW * 0.32;
        const topPkgY = ty - pkgH * 0.20;

        ctx.save();
        // a tiny "loaded" glow so state 1/2 look different
        ctx.shadowColor = "rgba(255, 200, 0, 0.35)";
        ctx.shadowBlur = 14;

        // draw first package on truck
        drawShadowedImage(packageImg, topPkgX, topPkgY, pkgW * 0.65, pkgH * 0.65, "#FFD700");
        ctx.restore();

        // badge with count if more than 1
        if (v.pkgsInTruck.length > 1) {
          const extra = v.pkgsInTruck.length;
          const bx = tx + truckW - 10;
          const by = ty - 6;

          ctx.save();
          roundRectPath(bx - 16, by - 10, 34, 20, 10);
          ctx.fillStyle = "rgba(17,17,17,0.85)";
          ctx.fill();
          ctx.fillStyle = "#fff";
          ctx.font = "bold 11px Arial";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(`${extra}`, bx + 1, by);
          ctx.restore();
        }
      }
    }

    // packages AT-LOCATION (on the ground, right side if truck exists)
    if (hasAt) {
      const pkgCX = hasTruck ? rightCX : midCX;
      const maxShow = 2;
      const show = Math.min(v.pkgsAt.length, maxShow);

      for (let i = 0; i < show; i++) {
        const x = pkgCX - pkgW / 2;
        const y = (centerY - pkgH / 2) + i * (pkgH + 8);
        drawShadowedImage(packageImg, x, y, pkgW, pkgH, "#FFD700");
        // ❌ no border, no label
      }

      if (v.pkgsAt.length > maxShow) {
        const extra = v.pkgsAt.length - maxShow;
        const bx = pkgCX + 16;
        const by = centerY - pkgH / 2 - 8;

        ctx.save();
        roundRectPath(bx - 16, by - 10, 34, 20, 10);
        ctx.fillStyle = "rgba(17,17,17,0.85)";
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.font = "bold 11px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(`+${extra}`, bx + 1, by);
        ctx.restore();
      }
    }
  }
}



/**
 * BLOCKS WORLD
 * IMPORTANT: we **do not** change any x/y coming from the state.
 * The renderer only:
 *   - draws table, blocks, gripper
 *   - wraps the gripper around the held block
 */
function renderBlocksWorld(ctx: CanvasRenderingContext2D, state: RenderedState) {
  const surfaces = state.objects.filter((o) => o.type === "surface");
  const blocks = state.objects.filter((o) => o.type === "block");
  const others = state.objects.filter(
    (o) => o.type !== "surface" && o.type !== "block"
  );

  // Detect held blocks (by property or holding relation)
  const heldIds = new Set<string>();
  for (const b of blocks) {
    if (b.properties?.held) heldIds.add(b.id);
  }
  for (const rel of state.relations) {
    if (rel.type === "holding" && rel.target) {
      heldIds.add(rel.target);
    }
  }

  const heldBlock = blocks.find((b) => heldIds.has(b.id) && b.position);

  const drawObject = (obj: VisualObject) => {
    if (!obj.position) return;
    const [x, y] = obj.position;
    const props = obj.properties || {};

    if (obj.type === "block") {
      const width = props.width || 60;
      const height = props.height || 60;
      const color = props.color || "#999";

      ctx.fillStyle = color;
      ctx.fillRect(x, y, width, height);

      ctx.strokeStyle = props.clear ? "#000" : "#666";
      ctx.lineWidth = props.clear ? 3 : 2;
      ctx.strokeRect(x, y, width, height);

      ctx.fillStyle = "#fff";
      ctx.font = "bold 24px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(obj.label, x + width / 2, y + height / 2);

      if (heldIds.has(obj.id)) {
        ctx.strokeStyle = "#ffd54f";
        ctx.lineWidth = 3;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(x - 3, y - 3, width + 6, height + 6);
        ctx.setLineDash([]);
      }
    } else if (obj.type === "surface") {
      const width = props.width || 400;
      const height = props.height || 20;
      const color = props.color || "#8B4513";

      ctx.fillStyle = color;
      ctx.fillRect(x, y, width, height);

      ctx.strokeStyle = "#654321";
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, width, height);
    } else if (obj.type === "gripper") {
      ctx.strokeStyle = "#555";
      ctx.lineWidth = 4;
      ctx.lineCap = "round";

      // If holding a block -> ignore own x/y and draw around the block
      if (heldBlock && heldBlock.position) {
        const [bx, by] = heldBlock.position;
        const bw = heldBlock.properties?.width || 60;
        const bh = heldBlock.properties?.height || 60;

        const centerX = bx + bw / 2;
        const blockTop = by;
        const blockBottom = by + bh;
        const armTopY = blockTop - (props.armHeight ?? 80);
        const topBarY = blockTop - 10;
        const margin = props.margin ?? 6;
        const leftX = bx - margin;
        const rightX = bx + bw + margin;

        // vertical arm
        ctx.beginPath();
        ctx.moveTo(centerX, armTopY);
        ctx.lineTo(centerX, topBarY);
        ctx.stroke();

        // top bar
        ctx.beginPath();
        ctx.moveTo(leftX, topBarY);
        ctx.lineTo(rightX, topBarY);
        ctx.stroke();

        // left claw
        ctx.beginPath();
        ctx.moveTo(leftX, topBarY);
        ctx.lineTo(leftX, blockBottom);
        ctx.stroke();

        // right claw
        ctx.beginPath();
        ctx.moveTo(rightX, topBarY);
        ctx.lineTo(rightX, blockBottom);
        ctx.stroke();
      } else {
        // empty gripper – draw at its own position
        const armHeight = props.armHeight ?? 80;
        const gap = props.openGap ?? 28;
        const clawLength = props.clawLength ?? 24;

        // vertical arm
        ctx.beginPath();
        ctx.moveTo(x, y - armHeight);
        ctx.lineTo(x, y - 12);
        ctx.stroke();

        // horizontal bar
        ctx.beginPath();
        ctx.moveTo(x - 18, y - 12);
        ctx.lineTo(x + 18, y - 12);
        ctx.stroke();

        // left claw
        ctx.beginPath();
        ctx.moveTo(x - gap / 2, y - 12);
        ctx.lineTo(x - gap / 2, y + clawLength);
        ctx.stroke();

        // right claw
        ctx.beginPath();
        ctx.moveTo(x + gap / 2, y - 12);
        ctx.lineTo(x + gap / 2, y + clawLength);
        ctx.stroke();
      }
    }
  };

  // Z-order: table → blocks (bottom to top) → other objects (gripper)
  const blocksSorted = [...blocks].sort(
    (a, b) => (b.position?.[1] ?? 0) - (a.position?.[1] ?? 0)
  );

  surfaces.forEach(drawObject);
  blocksSorted.forEach(drawObject);
  others.forEach(drawObject);
}

/**
 * GRIPPER DOMAIN 
 */
function renderGripper(ctx: CanvasRenderingContext2D, state: RenderedState) {
  // Split objects
  const rooms = state.objects.filter((o) => o.type === "room");
  const robot = state.objects.find((o) => o.type === "robot");
  const balls = state.objects.filter((o) => o.type === "ball");

  const ballById = new Map<string, VisualObject>();
  balls.forEach((b) => ballById.set(b.id, b));

  // Precompute robot geometry (so we can use it for claws + ball snapping)
  let robotGeom:
    | {
        centerX: number;
        centerY: number;
        bodyX: number;
        bodyY: number;
        bodyWidth: number;
        bodyHeight: number;
        armOffsetX: number;
        armBaseY: number;
        armHeight: number;
        clawLength: number;
      }
    | null = null;

  if (robot && robot.position) {
    const [rx, ry] = robot.position;
    const rProps = robot.properties || {};

    const bodyWidth = rProps.width || 80;
    const bodyHeight = rProps.height || 80;

    // Raise robot up in the room a bit
    const offsetY = rProps.offsetY ?? 70;

    const bodyX = rx - bodyWidth / 2;
    const bodyY = ry - bodyHeight / 2 - offsetY;

    const armOffsetX = rProps.armOffsetX ?? 25;
    const armBaseY = bodyY + bodyHeight -10; // bottom edge of robot
    const armHeight = rProps.armHeight ?? 40;
    const clawLength = rProps.clawLength ?? 24;

    robotGeom = {
      centerX: rx,
      centerY: ry - offsetY,
      bodyX,
      bodyY,
      bodyWidth,
      bodyHeight,
      armOffsetX,
      armBaseY,
      armHeight,
      clawLength,
    };
  }

  // Map: ballId -> target arm X (left/right) when carried
  const ballGripX = new Map<string, number>();

  if (robotGeom) {
    const leftArmX = robotGeom.centerX - robotGeom.armOffsetX;
    const rightArmX = robotGeom.centerX + robotGeom.armOffsetX;

    for (const rel of state.relations) {
      if (!rel.target) continue;

      // Try to detect "carrying" relations: carry/holding
      if (rel.type === "carry" || rel.type === "holding") {
        const ballId = rel.target;
        const src = rel.source.toLowerCase();

        if (src.includes("right")) {
          ballGripX.set(ballId, leftArmX);
        } else if (src.includes("left")) {
          ballGripX.set(ballId, rightArmX);
        } else {
          // If we don't know which side, default to left arm
          ballGripX.set(ballId, leftArmX);
        }
      }
    }
  }

  // Helper to draw a single claw hanging down from the robot bottom
  const drawClaw = (
  centerX: number,
  baseY: number,
  options: { armHeight?: number; gap?: number; clawLength?: number } = {},
  label?: string
) => {
  const armHeight = options.armHeight ?? 40;
  const gap = options.gap ?? 28;
  const clawLength = options.clawLength ?? 30;

  const armEndY = baseY + armHeight;
  const barY = armEndY ;
  const clawTopY = barY;
  const clawBottomY = barY + clawLength;

  ctx.strokeStyle = "#797878ff";
  ctx.lineWidth = 10;
  ctx.lineCap = "round";

  // vertical arm
  ctx.beginPath();
  ctx.moveTo(centerX, baseY);
  ctx.lineTo(centerX, armEndY-3);
  ctx.stroke();


  ctx.strokeStyle = "#797878ff";
  ctx.lineWidth = 4;
  ctx.lineCap = "round";

  // horizontal bar
  ctx.beginPath();
  ctx.moveTo(centerX - 18, barY);
  ctx.lineTo(centerX + 18, barY);
  ctx.stroke();

  // left claw
  ctx.beginPath();
  ctx.moveTo(centerX - gap / 2, clawTopY);
  ctx.lineTo(centerX - gap / 2, clawBottomY);
  ctx.stroke();

  // right claw
  ctx.beginPath();
  ctx.moveTo(centerX + gap / 2, clawTopY);
  ctx.lineTo(centerX + gap / 2, clawBottomY);
  ctx.stroke();

  // label above the claw (optional)
  if (label) {
    ctx.fillStyle = "rgba(29, 230, 76, 1)";
    ctx.font = "14px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText(label, centerX, barY - 4); // a few px above the bar
  }
};

  // 1) Draw rooms
  for (const room of rooms) {
    if (!room.position) continue;
    const [x, y] = room.position;
    const props = room.properties || {};

    const width = props.width || 200;
    const height = props.height || 300;
    const color = props.color || "#f0f0f0";

    ctx.fillStyle = color;
    ctx.fillRect(x, y, width, height);

    ctx.strokeStyle = props.has_robot ? "#4CAF50" : "#999";
    ctx.lineWidth = props.has_robot ? 4 : 2;
    ctx.strokeRect(x, y, width, height);

    ctx.fillStyle = "#333";
    ctx.font = "16px Arial";
    ctx.textAlign = "center";
    ctx.fillText(room.label, x + width / 2, y + 20);
  }

  // 2) Draw robot (image only) + arms
  if (robot && robotGeom) {
    const {
      bodyX,
      bodyY,
      bodyWidth,
      bodyHeight,
      centerX,
      armOffsetX,
      armBaseY,
      armHeight,
      clawLength,
    } = robotGeom;

    // Draw PNG if loaded, otherwise minimal fallback
    if (robotImageLoaded) {
      ctx.drawImage(robotImage, bodyX, bodyY, bodyWidth, bodyHeight);
    } else {
      ctx.fillStyle = "#607D8B";
      ctx.fillRect(bodyX, bodyY, bodyWidth, bodyHeight);
    }

    const openGap = robot.properties?.openGap ?? 28;

    drawClaw(centerX - armOffsetX, armBaseY, {
  armHeight,
  gap: openGap,
  clawLength,
}, "R");

drawClaw(centerX + armOffsetX, armBaseY, {
  armHeight,
  gap: openGap,
  clawLength,
}, "L");
  }

  // 3) Draw balls (snap carried ones into the claws)
  for (const ball of balls) {
    if (!ball.position) continue;
    let [bx, by] = ball.position;
    const props = ball.properties || {};
    const size = props.size || 30;
    const radius = size / 2;
    const color = props.color || "#FF6B6B";

    // If the ball is carried and we know the arm X, override position
    if (robotGeom && ballGripX.has(ball.id)) {
      const gripX = ballGripX.get(ball.id)!;
      const baseY = robotGeom.armBaseY;
      const armHeight = robotGeom.armHeight;
      const clawLength = robotGeom.clawLength;

      const barY = baseY + armHeight;
      // Put ball center just below the claws
      bx = gripX ;
      by = barY + clawLength + radius - 10 ;
    }

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(bx, by, radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "#000";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = "#fff";
    ctx.font = "bold 18px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(ball.label, bx, by);
  }

}

/**
 * DEFAULT DOMAIN FALLBACK
 */
function renderDefault(ctx: CanvasRenderingContext2D, state: RenderedState) {
  ctx.fillStyle = "#333";
  ctx.font = "16px Arial";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";

  let y = 20;
  ctx.fillText(`Domain: ${state.domain}`, 20, y);
  y += 30;

  ctx.fillText(`Objects: ${state.objects.length}`, 20, y);
  y += 25;

  for (const obj of state.objects.slice(0, 10)) {
    ctx.fillText(`- ${obj.label} (${obj.type})`, 40, y);
    y += 20;
  }

  if (state.objects.length > 10) {
    ctx.fillText(`... and ${state.objects.length - 10} more`, 40, y);
  }
}
