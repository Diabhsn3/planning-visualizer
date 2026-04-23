import { useEffect, useRef, useState, useCallback } from "react";
import { renderDepot, renderDepotBackground, renderDepotLegend } from "@/components/renderDepot";
import { renderSatellite, renderSatelliteBackground, renderSatelliteLegend } from "@/components/renderSatellite";
import { renderHanoi, renderHanoiBackground, renderHanoiLegend } from "@/components/renderHanoi";
import { renderRovers, renderRoversBackground, renderRoversLegend } from "@/components/renderRovers";

// Type definitions for optional background and legend functions
type BackgroundRenderer = ((ctx: CanvasRenderingContext2D, width: number, height: number) => void) | undefined;
type LegendRenderer = ((ctx: CanvasRenderingContext2D, x: number, y: number) => void) | undefined;

// Domain renderer configuration
interface DomainRenderer {
  render: (ctx: CanvasRenderingContext2D, state: RenderedState) => void;
  background?: BackgroundRenderer;
  legend?: LegendRenderer;
}

// Map of domain names to their renderer configurations
// Note: blocks-world and gripper are defined later in this file
const domainRenderers: Record<string, DomainRenderer> = {
  "depot": {
    render: renderDepot,
    background: renderDepotBackground,
    legend: renderDepotLegend,
  },
  "satellite": {
    render: renderSatellite,
    background: renderSatelliteBackground,
    legend: renderSatelliteLegend,
  },
  "hanoi": {
    render: renderHanoi,
    background: renderHanoiBackground,
    legend: renderHanoiLegend,
  },
  "rovers": {
    render: renderRovers,
    background: renderRoversBackground,
    legend: renderRoversLegend,
  },
  // blocks-world and gripper are added after their functions are defined
};


// Global robot image for gripper domain
const robotImage = new Image();
robotImage.src = "/rooboot.png"; // served from /public
let robotImageLoaded = false;
robotImage.onload = () => {
  robotImageLoaded = true;
};

// ============================================
// PERSISTENT VIEW STATE (survives re-renders and re-mounts)
// ============================================
// Store view state outside of React to ensure it persists
// across step navigation, play/pause, and component re-mounts
const persistentViewState = {
  scale: 1,
  offsetX: 0,
  offsetY: 0,
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
  /** LLM-generated TypeScript code to use instead of hardcoded renderers */
  llmRendererCode?: string;
  /** LLM-generated TypeScript code to transform/enrich raw states before rendering */
  transformerCode?: string;
  /** Callback when LLM renderer execution fails */
  onLlmError?: (error: string) => void;
}


// ============================================
// LLM RENDERER EXECUTION ENGINE
// ============================================
// Parses LLM-generated TypeScript code and extracts the three renderer functions.
// Uses new Function() to safely evaluate the code in a sandboxed scope.
// Caches compiled functions to avoid re-parsing on every render.

interface CompiledLlmRenderer {
  render: ((ctx: CanvasRenderingContext2D, state: RenderedState) => void) | null;
  background: ((ctx: CanvasRenderingContext2D, width: number, height: number) => void) | null;
  legend: ((ctx: CanvasRenderingContext2D, x: number, y: number) => void) | null;
}

const llmRendererCache = new Map<string, CompiledLlmRenderer>();

function compileLlmRenderer(code: string): CompiledLlmRenderer {
  // Check cache first (keyed by code hash)
  const cacheKey = code.length + "_" + code.slice(0, 100) + code.slice(-100);
  const cached = llmRendererCache.get(cacheKey);
  if (cached) return cached;

  const result: CompiledLlmRenderer = { render: null, background: null, legend: null };

  try {
    // The backend already transpiles TypeScript to JavaScript using the TS compiler API,
    // so the code we receive here should be valid JavaScript.
    const jsCode = code;

    console.log("[LLM Renderer] Code preview (first 200 chars):", jsCode.slice(0, 200));

    // Find all function names that start with 'render' (or any top-level function)
    const functionNames: string[] = [];
    const fnRegex = /(?:function|const|let|var)\s+(\w+)/g;
    let fnMatch;
    while ((fnMatch = fnRegex.exec(jsCode)) !== null) {
      functionNames.push(fnMatch[1]);
    }
    // Also find standalone function names like: function roundRect(...)
    const standaloneFnRegex = /^\s*function\s+(\w+)/gm;
    while ((fnMatch = standaloneFnRegex.exec(jsCode)) !== null) {
      if (!functionNames.includes(fnMatch[1])) {
        functionNames.push(fnMatch[1]);
      }
    }

    console.log("[LLM Renderer] Discovered functions:", functionNames);

    // Build export collection code for render* functions
    const renderFunctions = functionNames.filter(n => n.startsWith('render'));
    const exportLines = renderFunctions.map(name =>
      `if (typeof ${name} !== 'undefined') __exports['${name}'] = ${name};`
    ).join('\n');

    // Wrap in a function that returns the renderer functions
    const wrappedCode = `
      ${jsCode}
      
      const __exports = {};
      try {
        ${exportLines}
      } catch(e) { console.error('[LLM Renderer] Export collection error:', e); }
      return __exports;
    `;

    const factory = new Function(wrappedCode);
    const exports = factory();

    console.log("[LLM Renderer] Exported keys:", Object.keys(exports));

    // Find the three functions by name pattern
    const keys = Object.keys(exports);
    
    // Main render function: the one that's NOT background and NOT legend
    for (const key of keys) {
      if (typeof exports[key] !== 'function') continue;
      
      if (key.toLowerCase().includes('background')) {
        result.background = exports[key];
      } else if (key.toLowerCase().includes('legend')) {
        result.legend = exports[key];
      } else if (key.startsWith('render')) {
        result.render = exports[key];
      }
    }

    // Handle legend = undefined exports (const renderXLegend = undefined)
    for (const key of keys) {
      if (key.toLowerCase().includes('legend') && exports[key] === undefined) {
        result.legend = null;
      }
    }

    // Cache the result
    llmRendererCache.set(cacheKey, result);

    console.log("[LLM Renderer] Compilation success. render:", !!result.render, "background:", !!result.background, "legend:", !!result.legend);

  } catch (error) {
    console.error("[LLM Renderer] Compilation failed:", error);
    // Return empty result - will fall back to default renderer
  }

  return result;
}

// ============================================
// TRANSFORMER EXECUTION ENGINE
// ============================================
// Compiles and runs LLM-generated transformer code to enrich raw states
// before they are passed to the renderer.
const transformerCache = new Map<string, ((state: RenderedState) => RenderedState) | null>();

function compileTransformer(code: string): ((state: RenderedState) => RenderedState) | null {
  const cacheKey = code.length + "_" + code.slice(0, 80) + code.slice(-80);
  if (transformerCache.has(cacheKey)) return transformerCache.get(cacheKey)!;
  try {
    const fnRegex = /(?:function|const|let|var)\s+(transform\w*)/g;
    let match;
    let transformFnName: string | null = null;
    while ((match = fnRegex.exec(code)) !== null) {
      transformFnName = match[1];
      break;
    }
    if (!transformFnName) {
      console.warn("[Transformer] No transform* function found in code");
      transformerCache.set(cacheKey, null);
      return null;
    }
    const wrappedCode = `
      ${code}
      return typeof ${transformFnName} !== 'undefined' ? ${transformFnName} : null;
    `;
    const factory = new Function(wrappedCode);
    const fn = factory();
    transformerCache.set(cacheKey, fn);
    console.log("[Transformer] Compiled successfully:", transformFnName);
    return fn;
  } catch (error) {
    console.error("[Transformer] Compilation failed:", error);
    transformerCache.set(cacheKey, null);
    return null;
  }
}

export function StateCanvas({ state, width = 800, height = 600, isFirst = false, isLast = false, llmRendererCode, transformerCode, onLlmError }: StateCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Initialize state from persistent storage to survive re-mounts
  const [scale, setScaleState] = useState(persistentViewState.scale);
  const [offset, setOffsetState] = useState({ 
    x: persistentViewState.offsetX, 
    y: persistentViewState.offsetY 
  });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  
  // Wrapper functions that update both React state and persistent storage
  const setScale = useCallback((newScale: number | ((prev: number) => number)) => {
    setScaleState(prev => {
      const nextScale = typeof newScale === 'function' ? newScale(prev) : newScale;
      persistentViewState.scale = nextScale;
      return nextScale;
    });
  }, []);
  
  const setOffset = useCallback((newOffset: { x: number; y: number }) => {
    persistentViewState.offsetX = newOffset.x;
    persistentViewState.offsetY = newOffset.y;
    setOffsetState(newOffset);
  }, []);

  // Native wheel event listener to properly prevent page scroll
  // React's onWheel uses passive listeners by default which can't preventDefault
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleWheelNative = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      // Calculate zoom
      const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
      const currentScale = persistentViewState.scale;
      const newScale = Math.min(Math.max(0.1, currentScale * zoomFactor), 5);

      // Adjust offset to zoom towards mouse position
      const scaleChange = newScale / currentScale;
      const currentOffsetX = persistentViewState.offsetX;
      const currentOffsetY = persistentViewState.offsetY;
      const newOffsetX = mouseX - (mouseX - currentOffsetX) * scaleChange;
      const newOffsetY = mouseY - (mouseY - currentOffsetY) * scaleChange;

      persistentViewState.scale = newScale;
      persistentViewState.offsetX = newOffsetX;
      persistentViewState.offsetY = newOffsetY;
      setScaleState(newScale);
      setOffsetState({ x: newOffsetX, y: newOffsetY });
    };

    // Add with passive: false to allow preventDefault
    canvas.addEventListener('wheel', handleWheelNative, { passive: false });

    return () => {
      canvas.removeEventListener('wheel', handleWheelNative);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // ============================================
    // APPLY TRANSFORMER (enrich state before rendering)
    // ============================================
    let effectiveState = state;
    if (transformerCode) {
      try {
        const transformFn = compileTransformer(transformerCode);
        if (transformFn) {
          effectiveState = transformFn(state);
        }
      } catch (err) {
        console.error("[Transformer] Runtime error:", err);
        // Fall back to raw state on error
      }
    }

    // ============================================
    // DETERMINE RENDERER: LLM or hardcoded
    // ============================================
    let useLlm = false;
    let llmRenderer: CompiledLlmRenderer | null = null;

    if (llmRendererCode) {
      llmRenderer = compileLlmRenderer(llmRendererCode);
      if (llmRenderer.render) {
        useLlm = true;
      } else {
        console.warn("[LLM Renderer] No main render function found, falling back to hardcoded");
        onLlmError?.("LLM code did not contain a valid render function. Falling back to basic renderer.");
      }
    }

    // Get domain-specific renderer configuration (hardcoded fallback)
    const domainConfig = domainRenderers[effectiveState.domain];

    // ============================================
    // 1. DRAW BACKGROUND (BEFORE zoom/pan transform)
    // ============================================
    if (useLlm && llmRenderer?.background) {
      try {
        llmRenderer.background(ctx, width, height);
      } catch (err) {
        console.error("[LLM Renderer] Background error:", err);
        drawDefaultBackground(ctx, width, height);
      }
    } else if (domainConfig?.background) {
      domainConfig.background(ctx, width, height);
    } else {
      drawDefaultBackground(ctx, width, height);
    }

    // ============================================
    // 2. APPLY ZOOM/PAN TRANSFORM
    // ============================================
    ctx.save();
    ctx.translate(offset.x, offset.y);
    ctx.scale(scale, scale);

    // ============================================
    // 3. DRAW MAIN VISUALIZATION
    // ============================================
    if (useLlm && llmRenderer?.render) {
      try {
        llmRenderer.render(ctx, effectiveState);
      } catch (err) {
        console.error("[LLM Renderer] Render error:", err);
        onLlmError?.("LLM renderer crashed: " + (err instanceof Error ? err.message : String(err)));
        // Fall back to default renderer on error
        renderDefault(ctx, effectiveState);
      }
    } else if (domainConfig) {
      domainConfig.render(ctx, effectiveState);
    } else if (effectiveState.domain === "blocks-world") {
      renderBlocksWorld(ctx, effectiveState);
    } else if (effectiveState.domain === "gripper") {
      renderGripper(ctx, effectiveState);
    } else {
      renderDefault(ctx, effectiveState);
    }

    // Restore context state (removes zoom/pan transform)
    ctx.restore();

    // ============================================
    // 4. DRAW LEGEND (AFTER restoring transform - fixed position)
    // ============================================
    if (useLlm && llmRenderer?.legend) {
      try {
        llmRenderer.legend(ctx, 20, 70);
      } catch (err) {
        console.error("[LLM Renderer] Legend error:", err);
      }
    } else if (!useLlm && domainConfig?.legend) {
      domainConfig.legend(ctx, 20, 70);
    }
  }, [state, width, height, scale, offset, isFirst, isLast, llmRendererCode, transformerCode]);

  // Default background with grid pattern
  function drawDefaultBackground(ctx: CanvasRenderingContext2D, w: number, h: number) {
    // Set background color
    ctx.fillStyle = "#f0f4f8";
    ctx.fillRect(0, 0, w, h);

    // Draw grid
    const GRID_SIZE = 40;
    ctx.strokeStyle = "rgba(0, 0, 0, 0.08)";
    ctx.lineWidth = 1;
    
    // Draw vertical lines
    for (let x = 0; x <= w; x += GRID_SIZE) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    
    // Draw horizontal lines
    for (let y = 0; y <= h; y += GRID_SIZE) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
  }

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
  const handleReset = useCallback(() => {
    persistentViewState.scale = 1;
    persistentViewState.offsetX = 0;
    persistentViewState.offsetY = 0;
    setScaleState(1);
    setOffsetState({ x: 0, y: 0 });
  }, []);

  return (
    <div ref={containerRef} style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      {/* Zoom controls - above the canvas */}
      <div style={{
        display: "flex",
        justifyContent: "flex-end",
        gap: "8px",
        padding: "4px 0"
      }}>
        <button
          onClick={() => setScale(s => Math.min(s * 1.2, 5))}
          style={{
            padding: "6px 14px",
            background: "#4CAF50",
            color: "white",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
            fontSize: "16px",
            fontWeight: "bold",
            boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
          }}
          title="Zoom In"
        >
          +
        </button>
        <button
          onClick={() => setScale(s => Math.max(s * 0.8, 0.1))}
          style={{
            padding: "6px 14px",
            background: "#4CAF50",
            color: "white",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
            fontSize: "16px",
            fontWeight: "bold",
            boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
          }}
          title="Zoom Out"
        >
          −
        </button>
        <button
          onClick={handleReset}
          style={{
            padding: "6px 14px",
            background: "#2196F3",
            color: "white",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
            fontSize: "12px",
            boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
          }}
          title="Reset View"
        >
          Reset
        </button>
        <span style={{
          padding: "6px 12px",
          background: "#f0f0f0",
          borderRadius: "6px",
          fontSize: "12px",
          display: "flex",
          alignItems: "center",
          fontWeight: "500",
          color: "#333"
        }}>
          {Math.round(scale * 100)}%
        </span>
      </div>
      
      {/* Canvas */}
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="border border-gray-300 rounded-lg shadow-sm"
        style={{ cursor: isDragging ? "grabbing" : "grab" }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      />
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


// ================= BLOCKS WORLD BACKGROUND =================
function renderBlocksWorldBackground(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  // Workshop/table themed background
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, "#e8e0d8");  // Light wood
  gradient.addColorStop(0.6, "#d4c8b8"); // Medium wood
  gradient.addColorStop(1, "#c4b4a0");  // Darker wood (table surface)
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  // Draw wood plank pattern
  ctx.save();
  ctx.strokeStyle = "rgba(139, 90, 43, 0.08)";
  ctx.lineWidth = 1;
  
  // Horizontal planks
  for (let y = 0; y < height; y += 40) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
  
  // Vertical grain lines
  for (let x = 0; x < width; x += 80) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  ctx.restore();
}

// ================= BLOCKS WORLD LEGEND =================
// Blocks World is self-explanatory (colored blocks and table are obvious)
// No legend needed
const renderBlocksWorldLegend = undefined;

// ================= GRIPPER BACKGROUND =================
function renderGripperBackground(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  // Robot lab themed background
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, "#e0e5ec");  // Light metallic
  gradient.addColorStop(0.5, "#d0d5dc"); // Medium gray
  gradient.addColorStop(1, "#c0c5cc");  // Floor color
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  // Draw tile floor pattern
  ctx.save();
  ctx.strokeStyle = "rgba(0, 0, 0, 0.06)";
  ctx.lineWidth = 1;
  const TILE_SIZE = 50;
  
  for (let x = 0; x <= width; x += TILE_SIZE) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  
  for (let y = 0; y <= height; y += TILE_SIZE) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
  ctx.restore();
}

// ================= GRIPPER LEGEND =================
// Gripper domain is self-explanatory (robot, rooms, balls are obvious)
// No legend needed
const renderGripperLegend = undefined;

// Register blocks-world and gripper in domainRenderers
domainRenderers["blocks-world"] = {
  render: renderBlocksWorld,
  background: renderBlocksWorldBackground,
  legend: renderBlocksWorldLegend,
};

domainRenderers["gripper"] = {
  render: renderGripper,
  background: renderGripperBackground,
  legend: renderGripperLegend,
};
