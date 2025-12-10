import { useEffect, useRef } from "react";

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

    // Render based on domain
    if (state.domain === "blocks-world") {
      renderBlocksWorld(ctx, state);
    } else if (state.domain === "gripper") {
      renderGripper(ctx, state);
    } else {
      renderDefault(ctx, state);
    }
  }, [state, width, height]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="border border-gray-300 rounded-lg shadow-sm"
    />
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
    ctx.font = "10px Arial";
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