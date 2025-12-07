import { useEffect, useRef } from "react";

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
 * GRIPPER DOMAIN (unchanged)
 */
function renderGripper(ctx: CanvasRenderingContext2D, state: RenderedState) {
  for (const obj of state.objects) {
    if (!obj.position) continue;

    const [x, y] = obj.position;
    const props = obj.properties || {};

    if (obj.type === "room") {
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
      ctx.fillText(obj.label, x + width / 2, y + 20);
    } else if (obj.type === "robot") {
      const width = props.width || 60;
      const height = props.height || 80;
      const color = props.color || "#607D8B";

      ctx.fillStyle = color;
      ctx.fillRect(x - width / 2, y - height / 2, width, height);

      ctx.strokeStyle = "#000";
      ctx.lineWidth = 2;
      ctx.strokeRect(x - width / 2, y - height / 2, width, height);

      ctx.fillStyle = "#fff";
      ctx.font = "12px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("🤖", x, y);
    } else if (obj.type === "gripper") {
      const size = props.size || 30;
      const color = props.color || "#4CAF50";

      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, size / 2, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = "#000";
      ctx.lineWidth = 2;
      ctx.stroke();
    } else if (obj.type === "ball") {
      const size = props.size || 30;
      const color = props.color || "#FF6B6B";

      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, size / 2, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = "#000";
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = "#fff";
      ctx.font = "10px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(obj.label, x, y);
    }
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