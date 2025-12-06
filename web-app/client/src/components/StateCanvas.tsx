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

function renderBlocksWorld(ctx: CanvasRenderingContext2D, state: RenderedState) {
  // Render objects
  for (const obj of state.objects) {
    if (!obj.position) continue;

    const [x, y] = obj.position;
    const props = obj.properties || {};

    if (obj.type === "block") {
      // Draw block
      const width = props.width || 60;
      const height = props.height || 60;
      const color = props.color || "#999";

      // Block body
      ctx.fillStyle = color;
      ctx.fillRect(x, y, width, height);

      // Block border
      ctx.strokeStyle = props.clear ? "#000" : "#666";
      ctx.lineWidth = props.clear ? 3 : 2;
      ctx.strokeRect(x, y, width, height);

      // Label
      ctx.fillStyle = "#fff";
      ctx.font = "bold 24px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(obj.label, x + width / 2, y + height / 2);

      // Held indicator
      if (props.held) {
        ctx.strokeStyle = "#ff0";
        ctx.lineWidth = 4;
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(x - 5, y - 5, width + 10, height + 10);
        ctx.setLineDash([]);
      }
    } else if (obj.type === "surface") {
      // Draw table
      const width = props.width || 400;
      const height = props.height || 20;
      const color = props.color || "#8B4513";

      ctx.fillStyle = color;
      ctx.fillRect(x, y, width, height);

      ctx.strokeStyle = "#654321";
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, width, height);
    } else if (obj.type === "gripper") {
      // Draw hand/gripper
      const size = 40;
      ctx.fillStyle = props.empty ? "#4CAF50" : "#FF5722";
      ctx.beginPath();
      ctx.arc(x, y, size / 2, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = "#000";
      ctx.lineWidth = 2;
      ctx.stroke();

      // Label
      ctx.fillStyle = "#fff";
      ctx.font = "12px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(props.empty ? "✋" : "✊", x, y);
    }
  }
}

function renderGripper(ctx: CanvasRenderingContext2D, state: RenderedState) {
  // Render objects
  for (const obj of state.objects) {
    if (!obj.position) continue;

    const [x, y] = obj.position;
    const props = obj.properties || {};

    if (obj.type === "room") {
      // Draw room
      const width = props.width || 200;
      const height = props.height || 300;
      const color = props.color || "#f0f0f0";

      ctx.fillStyle = color;
      ctx.fillRect(x, y, width, height);

      ctx.strokeStyle = props.has_robot ? "#4CAF50" : "#999";
      ctx.lineWidth = props.has_robot ? 4 : 2;
      ctx.strokeRect(x, y, width, height);

      // Label
      ctx.fillStyle = "#333";
      ctx.font = "16px Arial";
      ctx.textAlign = "center";
      ctx.fillText(obj.label, x + width / 2, y + 20);
    } else if (obj.type === "robot") {
      // Draw robot
      const width = props.width || 60;
      const height = props.height || 80;
      const color = props.color || "#607D8B";

      ctx.fillStyle = color;
      ctx.fillRect(x - width / 2, y - height / 2, width, height);

      ctx.strokeStyle = "#000";
      ctx.lineWidth = 2;
      ctx.strokeRect(x - width / 2, y - height / 2, width, height);

      // Label
      ctx.fillStyle = "#fff";
      ctx.font = "12px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("🤖", x, y);
    } else if (obj.type === "gripper") {
      // Draw gripper
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
      // Draw ball
      const size = props.size || 30;
      const color = props.color || "#FF6B6B";

      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, size / 2, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = "#000";
      ctx.lineWidth = 2;
      ctx.stroke();

      // Label
      ctx.fillStyle = "#fff";
      ctx.font = "10px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(obj.label, x, y);
    }
  }
}

function renderDefault(ctx: CanvasRenderingContext2D, state: RenderedState) {
  // Simple text-based rendering for unknown domains
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
