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

interface StateCanvasProps {
  state: RenderedState;
  width?: number;
  height?: number;
}

export function StateCanvas({ state, width = 800, height = 600 }: StateCanvasProps) {
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
    } else {
      renderGeneric(ctx, state);
    }

    // Restore context state
    ctx.restore();
  }, [state, width, height, scale, offset]);

  

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
function renderGeneric(ctx: CanvasRenderingContext2D, state: RenderedState) {
  // Group objects by type for organized rendering
  const objectsByType = groupObjectsByType(state.objects);
  
  // Sort all objects by z_index for proper layering
  const sortedObjects = [...state.objects].sort((a, b) => {
    const zA = a.properties?.z_index ?? 0;
    const zB = b.properties?.z_index ?? 0;
    return zA - zB; // Lower z_index drawn first (background)
  });

  // Create a map for quick object lookup (used for relations)
  const objectMap = new Map<string, VisualObject>();
  state.objects.forEach(obj => objectMap.set(obj.id, obj));

  // Draw domain title
  drawDomainTitle(ctx, state.domain);

  // Draw all objects in z-order
  sortedObjects.forEach(obj => {
    drawGenericObject(ctx, obj, state.relations, objectMap);
  });

  // Draw relations (arrows, lines) on top
  drawRelations(ctx, state.relations, objectMap);

  // Draw legend
  drawLegend(ctx, objectsByType);
}

/**
 * Group objects by their type for legend and organized processing
 */
function groupObjectsByType(objects: VisualObject[]): Map<string, VisualObject[]> {
  const groups = new Map<string, VisualObject[]>();
  objects.forEach(obj => {
    const type = obj.type;
    if (!groups.has(type)) {
      groups.set(type, []);
    }
    groups.get(type)!.push(obj);
  });
  return groups;
}

/**
 * Draw the domain title at the top
 */
function drawDomainTitle(ctx: CanvasRenderingContext2D, domain: string) {
  ctx.fillStyle = "#333";
  ctx.font = "bold 18px Arial";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText(`Domain: ${domain}`, 20, 15);
}

/**
 * Draw a single object based on its properties
 */
function drawGenericObject(
  ctx: CanvasRenderingContext2D, 
  obj: VisualObject,
  relations: VisualRelation[],
  objectMap: Map<string, VisualObject>
) {
  if (!obj.position) return;

  const [x, y] = obj.position;
  const props = obj.properties || {};

  // Determine shape from properties
  const shape = inferShape(props);

  // Get visual properties with defaults
  const color = props.color || getDefaultColor(obj.type);
  const borderColor = props.borderColor || darkenColor(color);
  const borderWidth = props.borderWidth ?? 2;

  // Check if this object is "held" or "contained" (special highlighting)
  const isHeld = props.held || isObjectHeld(obj.id, relations);
  const isHighlighted = props.highlighted || props.selected;

  // Set styles
  ctx.fillStyle = color;
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = borderWidth;

  // Draw based on shape
  switch (shape) {
    case "circle":
      drawCircle(ctx, x, y, props);
      break;
    case "square":
      drawSquare(ctx, x, y, props);
      break;
    case "triangle":
      drawTriangle(ctx, x, y, props);
      break;
    case "ellipse":
      drawEllipse(ctx, x, y, props);
      break;
    case "diamond":
      drawDiamond(ctx, x, y, props);
      break;
    case "hexagon":
      drawHexagon(ctx, x, y, props);
      break;
    case "rectangle":
    default:
      drawRectangle(ctx, x, y, props);
      break;
  }

  // Draw highlight border if held/selected
  if (isHeld || isHighlighted) {
    drawHighlight(ctx, x, y, props, shape);
  }

  // Draw label
  drawLabel(ctx, x, y, obj.label, props, shape);

  // Draw type indicator (small text below)
  if (props.showType !== false) {
    drawTypeIndicator(ctx, x, y, obj.type, props, shape);
  }
}

/**
 * Infer shape from properties
 */
function inferShape(props: Record<string, any>): string {
  // Explicit shape property takes priority
  if (props.shape) return props.shape;

  // Infer from dimensions
  if (props.radius) return "circle";
  if (props.radiusX && props.radiusY) return "ellipse";
  if (props.size) return "square";
  if (props.width && props.height) {
    if (props.width === props.height) return "square";
    return "rectangle";
  }

  // Default to rectangle
  return "rectangle";
}

/**
 * Get default color based on object type
 */
function getDefaultColor(type: string): string {
  const colorMap: Record<string, string> = {
    // Common planning domain types
    "block": "#FF6B6B",
    "surface": "#8B4513",
    "table": "#8B4513",
    "gripper": "#607D8B",
    "robot": "#607D8B",
    "ball": "#4ECDC4",
    "room": "#E8E8E8",
    "location": "#90EE90",
    "city": "#87CEEB",
    "truck": "#4A90E2",
    "airplane": "#9B59B6",
    "package": "#F5A623",
    "crate": "#D2691E",
    "hoist": "#708090",
    "pallet": "#DEB887",
    "rover": "#E74C3C",
    "waypoint": "#3498DB",
    "store": "#2ECC71",
    "satellite": "#9B59B6",
    "instrument": "#E67E22",
    "mode": "#1ABC9C",
    "direction": "#F39C12",
    "objective": "#E91E63",
    "disk": "#FF9800",
    "peg": "#795548",
    // Generic fallbacks
    "agent": "#3498DB",
    "object": "#95A5A6",
    "container": "#BDC3C7",
    "target": "#E74C3C",
    "goal": "#2ECC71",
  };

  // Try exact match
  if (colorMap[type.toLowerCase()]) {
    return colorMap[type.toLowerCase()];
  }

  // Try partial match
  for (const [key, color] of Object.entries(colorMap)) {
    if (type.toLowerCase().includes(key)) {
      return color;
    }
  }

  // Generate consistent color from type name
  return stringToColor(type);
}

/**
 * Generate a consistent color from a string
 */
function stringToColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  const h = hash % 360;
  return `hsl(${h}, 65%, 55%)`;
}

/**
 * Darken a color for borders
 */
function darkenColor(color: string): string {
  // Simple darkening - works for hex colors
  if (color.startsWith("#")) {
    const r = Math.max(0, parseInt(color.slice(1, 3), 16) - 40);
    const g = Math.max(0, parseInt(color.slice(3, 5), 16) - 40);
    const b = Math.max(0, parseInt(color.slice(5, 7), 16) - 40);
    return `rgb(${r}, ${g}, ${b})`;
  }
  return "#333";
}

/**
 * Check if object is held by looking at relations
 */
function isObjectHeld(objId: string, relations: VisualRelation[]): boolean {
  return relations.some(rel => 
    (rel.type === "holding" || rel.type === "carry" || rel.type === "grasping") && 
    rel.target === objId
  );
}

// ============================================================
// SHAPE DRAWING FUNCTIONS
// ============================================================

function drawRectangle(ctx: CanvasRenderingContext2D, x: number, y: number, props: Record<string, any>) {
  const width = props.width || 60;
  const height = props.height || 60;
  const cornerRadius = props.cornerRadius || 0;

  if (cornerRadius > 0) {
    drawRoundedRect(ctx, x, y, width, height, cornerRadius);
  } else {
    ctx.fillRect(x, y, width, height);
    ctx.strokeRect(x, y, width, height);
  }
}

function drawRoundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

function drawCircle(ctx: CanvasRenderingContext2D, x: number, y: number, props: Record<string, any>) {
  const radius = props.radius || 30;

  ctx.beginPath();
  ctx.arc(x + radius, y + radius, radius, 0, 2 * Math.PI);
  ctx.fill();
  ctx.stroke();
}

function drawSquare(ctx: CanvasRenderingContext2D, x: number, y: number, props: Record<string, any>) {
  const size = props.size || props.width || 60;

  ctx.fillRect(x, y, size, size);
  ctx.strokeRect(x, y, size, size);
}

function drawTriangle(ctx: CanvasRenderingContext2D, x: number, y: number, props: Record<string, any>) {
  const width = props.width || 60;
  const height = props.height || 60;

  ctx.beginPath();
  ctx.moveTo(x + width / 2, y);           // Top point
  ctx.lineTo(x + width, y + height);       // Bottom right
  ctx.lineTo(x, y + height);               // Bottom left
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

function drawEllipse(ctx: CanvasRenderingContext2D, x: number, y: number, props: Record<string, any>) {
  const radiusX = props.radiusX || props.width / 2 || 30;
  const radiusY = props.radiusY || props.height / 2 || 20;

  ctx.beginPath();
  ctx.ellipse(x + radiusX, y + radiusY, radiusX, radiusY, 0, 0, 2 * Math.PI);
  ctx.fill();
  ctx.stroke();
}

function drawDiamond(ctx: CanvasRenderingContext2D, x: number, y: number, props: Record<string, any>) {
  const width = props.width || 60;
  const height = props.height || 60;

  ctx.beginPath();
  ctx.moveTo(x + width / 2, y);            // Top
  ctx.lineTo(x + width, y + height / 2);   // Right
  ctx.lineTo(x + width / 2, y + height);   // Bottom
  ctx.lineTo(x, y + height / 2);           // Left
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

function drawHexagon(ctx: CanvasRenderingContext2D, x: number, y: number, props: Record<string, any>) {
  const size = props.size || props.width || 60;
  const centerX = x + size / 2;
  const centerY = y + size / 2;
  const radius = size / 2;

  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 2;
    const px = centerX + radius * Math.cos(angle);
    const py = centerY + radius * Math.sin(angle);
    if (i === 0) {
      ctx.moveTo(px, py);
    } else {
      ctx.lineTo(px, py);
    }
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

// ============================================================
// LABEL AND HIGHLIGHT FUNCTIONS
// ============================================================

function drawHighlight(ctx: CanvasRenderingContext2D, x: number, y: number, props: Record<string, any>, shape: string) {
  const width = props.width || props.size || props.radius * 2 || 60;
  const height = props.height || props.size || props.radius * 2 || 60;

  ctx.save();
  ctx.strokeStyle = "#ffd54f";
  ctx.lineWidth = 3;
  ctx.setLineDash([4, 4]);
  ctx.strokeRect(x - 3, y - 3, width + 6, height + 6);
  ctx.setLineDash([]);
  ctx.restore();
}

function drawLabel(ctx: CanvasRenderingContext2D, x: number, y: number, label: string, props: Record<string, any>, shape: string) {
  const width = props.width || props.size || props.radius * 2 || 60;
  const height = props.height || props.size || props.radius * 2 || 60;

  // Calculate center
  let centerX = x + width / 2;
  let centerY = y + height / 2;

  // Adjust for circles (position is top-left of bounding box)
  if (shape === "circle") {
    const radius = props.radius || 30;
    centerX = x + radius;
    centerY = y + radius;
  }

  // Text styling
  const textColor = props.textColor || getContrastColor(props.color || "#999");
  const fontSize = props.fontSize || Math.min(24, Math.max(12, width / 3));
  const fontWeight = props.fontWeight || "bold";

  ctx.fillStyle = textColor;
  ctx.font = `${fontWeight} ${fontSize}px Arial`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, centerX, centerY);
}

function drawTypeIndicator(ctx: CanvasRenderingContext2D, x: number, y: number, type: string, props: Record<string, any>, shape: string) {
  const width = props.width || props.size || props.radius * 2 || 60;
  const height = props.height || props.size || props.radius * 2 || 60;

  // Position below the object
  const centerX = x + width / 2;
  const bottomY = y + height + 12;

  ctx.fillStyle = "#666";
  ctx.font = "10px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText(type, centerX, bottomY);
}

/**
 * Get contrasting text color (black or white) based on background
 */
function getContrastColor(bgColor: string): string {
  // Convert to RGB
  let r = 128, g = 128, b = 128;

  if (bgColor.startsWith("#")) {
    r = parseInt(bgColor.slice(1, 3), 16);
    g = parseInt(bgColor.slice(3, 5), 16);
    b = parseInt(bgColor.slice(5, 7), 16);
  } else if (bgColor.startsWith("rgb")) {
    const match = bgColor.match(/\d+/g);
    if (match) {
      r = parseInt(match[0]);
      g = parseInt(match[1]);
      b = parseInt(match[2]);
    }
  } else if (bgColor.startsWith("hsl")) {
    // For HSL, assume light colors need dark text
    return "#333";
  }

  // Calculate luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? "#333" : "#fff";
}

// ============================================================
// RELATIONS DRAWING
// ============================================================

function drawRelations(ctx: CanvasRenderingContext2D, relations: VisualRelation[], objectMap: Map<string, VisualObject>) {
  relations.forEach(rel => {
    if (!rel.target) return;

    const source = objectMap.get(rel.source);
    const target = objectMap.get(rel.target);

    if (!source?.position || !target?.position) return;

    // Skip containment relations (visual is implicit)
    if (rel.type === "in" || rel.type === "inside" || rel.type === "contains") {
      return;
    }

    // Skip location relations (position already reflects this)
    if (rel.type === "at" || rel.type === "on" || rel.type === "ontable") {
      return;
    }

    // Draw arrow for other relations
    const sourceCenter = getObjectCenter(source);
    const targetCenter = getObjectCenter(target);

    const relProps = rel.properties || {};
    const color = relProps.color || "#666";
    const lineWidth = relProps.lineWidth || 1;
    const showArrow = relProps.showArrow !== false;
    const dashed = relProps.dashed || false;

    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = lineWidth;

    if (dashed) {
      ctx.setLineDash([5, 5]);
    }

    if (showArrow) {
      drawArrow(ctx, sourceCenter, targetCenter);
    } else {
      ctx.beginPath();
      ctx.moveTo(sourceCenter.x, sourceCenter.y);
      ctx.lineTo(targetCenter.x, targetCenter.y);
      ctx.stroke();
    }

    if (dashed) {
      ctx.setLineDash([]);
    }

    // Draw relation label if specified
    if (relProps.showLabel && rel.type) {
      const midX = (sourceCenter.x + targetCenter.x) / 2;
      const midY = (sourceCenter.y + targetCenter.y) / 2;
      ctx.fillStyle = "#333";
      ctx.font = "10px Arial";
      ctx.textAlign = "center";
      ctx.fillText(rel.type, midX, midY - 5);
    }
  });
}

function getObjectCenter(obj: VisualObject): { x: number; y: number } {
  const [x, y] = obj.position || [0, 0];
  const props = obj.properties || {};

  const width = props.width || props.size || props.radius * 2 || 60;
  const height = props.height || props.size || props.radius * 2 || 60;

  return {
    x: x + width / 2,
    y: y + height / 2
  };
}

function drawArrow(ctx: CanvasRenderingContext2D, from: { x: number; y: number }, to: { x: number; y: number }) {
  const headLength = 10;
  const angle = Math.atan2(to.y - from.y, to.x - from.x);

  // Shorten the line slightly so arrow doesn't overlap target
  const shortenBy = 20;
  const dist = Math.sqrt((to.x - from.x) ** 2 + (to.y - from.y) ** 2);
  const ratio = (dist - shortenBy) / dist;
  const endX = from.x + (to.x - from.x) * ratio;
  const endY = from.y + (to.y - from.y) * ratio;

  // Draw line
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(endX, endY);
  ctx.stroke();

  // Draw arrow head
  ctx.beginPath();
  ctx.moveTo(endX, endY);
  ctx.lineTo(
    endX - headLength * Math.cos(angle - Math.PI / 6),
    endY - headLength * Math.sin(angle - Math.PI / 6)
  );
  ctx.lineTo(
    endX - headLength * Math.cos(angle + Math.PI / 6),
    endY - headLength * Math.sin(angle + Math.PI / 6)
  );
  ctx.closePath();
  ctx.fill();
}

// ============================================================
// LEGEND
// ============================================================

function drawLegend(ctx: CanvasRenderingContext2D, objectsByType: Map<string, VisualObject[]>) {
  const legendX = 20;
  let legendY = 50;
  const itemHeight = 20;
  const boxSize = 12;

  ctx.font = "12px Arial";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";

  // Draw legend title
  ctx.fillStyle = "#333";
  ctx.font = "bold 12px Arial";
  ctx.fillText("Legend:", legendX, legendY);
  legendY += itemHeight;

  ctx.font = "12px Arial";

  objectsByType.forEach((objects, type) => {
    // Get color from first object of this type
    const color = objects[0]?.properties?.color || getDefaultColor(type);

    // Draw color box
    ctx.fillStyle = color;
    ctx.fillRect(legendX, legendY - boxSize / 2, boxSize, boxSize);
    ctx.strokeStyle = "#333";
    ctx.lineWidth = 1;
    ctx.strokeRect(legendX, legendY - boxSize / 2, boxSize, boxSize);

    // Draw type name and count
    ctx.fillStyle = "#333";
    ctx.fillText(`${type} (${objects.length})`, legendX + boxSize + 8, legendY);

    legendY += itemHeight;
  });
}

