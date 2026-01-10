// src/components/renderRovers.ts
// Enhanced Rovers Domain Visualization - PURE RENDERER
// 
// CRITICAL: This renderer is a PURE FUNCTION.
// - All visuals are derived ONLY from the current state's predicates
// - NO global mutable state that persists across renders
// - Stepping backward/forward shows EXACTLY what that state contains
// - Animations are keyed to step number and cleared on step change
//
// Visual Design:
// - Targets NOT communicated: Orange dashed crosshair (pending)
// - Targets IMAGED: Blue solid crosshair (image captured)
// - Targets COMMUNICATED: Green filled circle with satellite icon (completed/sent)
// - Multiple rovers at same waypoint: Spread in a row, waypoint expands
// - Connection lines connect to waypoint edges (not centers)
// - Waypoints dynamically space apart based on their sizes

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
  metadata?: Record<string, any>;
}

// ================= IMAGE CACHE (static, not state) =================
const roverImg = new Image();
roverImg.src = "/rover.png";

// ================= ANIMATION STATE =================
interface AnimationState {
  step: number;
  startTime: number;
}

let animationState: AnimationState | null = null;
const ANIMATION_DURATION = 1500;

function isAnimationActive(currentStep: number): boolean {
  if (!animationState) return false;
  if (animationState.step !== currentStep) {
    animationState = null;
    return false;
  }
  const elapsed = Date.now() - animationState.startTime;
  return elapsed < ANIMATION_DURATION;
}

function startAnimationForStep(step: number): void {
  if (!animationState || animationState.step !== step) {
    animationState = { step, startTime: Date.now() };
  }
}

// ================= HELPER FUNCTIONS =================
function parseAction(action: string | null): { name: string; params: string[] } | null {
  if (!action) return null;
  const s = action.trim();
  if (!s.startsWith('(')) return null;
  const parts = s.replace(/[()]/g, '').split(/\s+/);
  if (parts.length === 0) return null;
  return { name: parts[0], params: parts.slice(1) };
}

// Calculate point on circle edge given center, radius, and angle to target point
function getEdgePoint(cx: number, cy: number, radius: number, tx: number, ty: number): { x: number; y: number } {
  const angle = Math.atan2(ty - cy, tx - cx);
  return {
    x: cx + Math.cos(angle) * radius,
    y: cy + Math.sin(angle) * radius
  };
}

function drawCalibrationBadge(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, isAnimating: boolean) {
  const badgeX = x + size * 0.3;
  const badgeY = y - size * 0.3;
  const radius = 8;

  if (isAnimating) {
    const time = Date.now() % 1000;
    const pulse = Math.sin((time / 1000) * Math.PI * 2) * 0.3 + 0.7;
    ctx.save();
    ctx.shadowColor = '#4CAF50';
    ctx.shadowBlur = 15 * pulse;
    ctx.fillStyle = `rgba(76, 175, 80, ${0.3 + pulse * 0.3})`;
    ctx.beginPath();
    ctx.arc(badgeX, badgeY, radius + 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  ctx.fillStyle = '#4CAF50';
  ctx.beginPath();
  ctx.arc(badgeX, badgeY, radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(badgeX, badgeY, 3, 0, Math.PI * 2);
  ctx.stroke();
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(badgeX + Math.cos(angle) * 3, badgeY + Math.sin(angle) * 3);
    ctx.lineTo(badgeX + Math.cos(angle) * 6, badgeY + Math.sin(angle) * 6);
    ctx.stroke();
  }
}

function drawImageBadge(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, count: number, isAnimating: boolean) {
  const badgeX = x - size * 0.3;
  const badgeY = y - size * 0.3;
  const width = 14;
  const height = 11;

  if (isAnimating) {
    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.restore();
    
    ctx.save();
    ctx.shadowColor = '#FFD700';
    ctx.shadowBlur = 30;
    ctx.fillStyle = 'rgba(255, 215, 0, 0.6)';
    ctx.beginPath();
    ctx.arc(x, y, 40, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  ctx.fillStyle = '#2196F3';
  ctx.beginPath();
  ctx.roundRect(badgeX - width/2, badgeY - height/2, width, height, 2);
  ctx.fill();

  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(badgeX, badgeY, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#2196F3';
  ctx.beginPath();
  ctx.arc(badgeX, badgeY, 1.5, 0, Math.PI * 2);
  ctx.fill();

  if (count > 0) {
    ctx.fillStyle = '#FF5722';
    ctx.beginPath();
    ctx.arc(badgeX + 8, badgeY - 6, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 8px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(count.toString(), badgeX + 8, badgeY - 6);
  }
}

// ================= TARGET MARKER =================
function drawTargetMarker(
  ctx: CanvasRenderingContext2D, 
  x: number, 
  y: number, 
  label: string, 
  isCommunicated: boolean, 
  hasImage: boolean,
  isAnimating: boolean
) {
  const size = 22;

  if (isCommunicated) {
    if (isAnimating) {
      const time = Date.now() % 2000;
      const progress = time / 2000;
      ctx.save();
      for (let i = 0; i < 3; i++) {
        const waveProgress = (progress + i * 0.33) % 1;
        const radius = size + waveProgress * 40;
        const alpha = 1 - waveProgress;
        ctx.strokeStyle = `rgba(76, 175, 80, ${alpha})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }

    ctx.save();
    ctx.shadowColor = '#4CAF50';
    ctx.shadowBlur = 12;
    ctx.fillStyle = '#4CAF50';
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = '#fff';
    ctx.fillStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x - 2, y - 2, 10, -Math.PI * 0.8, -Math.PI * 0.2);
    ctx.stroke();
    ctx.lineWidth = 1.5;
    for (let i = 1; i <= 3; i++) {
      ctx.beginPath();
      ctx.arc(x + 6, y - 6, i * 4, Math.PI * 0.6, Math.PI * 1.1);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(x - 6, y + 8);
    ctx.lineTo(x, y);
    ctx.lineTo(x + 6, y + 8);
    ctx.stroke();

    ctx.fillStyle = '#2E7D32';
    ctx.font = 'bold 9px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('✓ SENT', x, y + size + 4);
    ctx.fillStyle = '#666';
    ctx.font = 'bold 10px Arial';
    ctx.fillText(label.toUpperCase(), x, y + size + 16);

  } else if (hasImage) {
    ctx.fillStyle = 'rgba(33, 150, 243, 0.2)';
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.strokeStyle = '#2196F3';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y, size * 0.5, 0, Math.PI * 2);
    ctx.stroke();
    
    ctx.fillStyle = '#2196F3';
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(x - size - 6, y);
    ctx.lineTo(x - size + 8, y);
    ctx.moveTo(x + size - 8, y);
    ctx.lineTo(x + size + 6, y);
    ctx.moveTo(x, y - size - 6);
    ctx.lineTo(x, y - size + 8);
    ctx.moveTo(x, y + size - 8);
    ctx.lineTo(x, y + size + 6);
    ctx.stroke();
    
    ctx.fillStyle = '#2196F3';
    ctx.beginPath();
    ctx.arc(x + size - 4, y - size + 4, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(x + size - 4, y - size + 4, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#1565C0';
    ctx.font = 'bold 9px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('IMAGED', x, y + size + 4);
    ctx.fillStyle = '#666';
    ctx.font = 'bold 10px Arial';
    ctx.fillText(label.toUpperCase(), x, y + size + 16);

  } else {
    ctx.strokeStyle = '#FF9800';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    
    ctx.beginPath();
    ctx.arc(x, y, size * 0.5, 0, Math.PI * 2);
    ctx.stroke();
    
    ctx.fillStyle = '#FF9800';
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(x - size - 4, y);
    ctx.lineTo(x - size + 6, y);
    ctx.moveTo(x + size - 6, y);
    ctx.lineTo(x + size + 4, y);
    ctx.moveTo(x, y - size - 4);
    ctx.lineTo(x, y - size + 6);
    ctx.moveTo(x, y + size - 6);
    ctx.lineTo(x, y + size + 4);
    ctx.stroke();

    ctx.fillStyle = '#E65100';
    ctx.font = 'bold 9px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('PENDING', x, y + size + 4);
    ctx.fillStyle = '#666';
    ctx.font = 'bold 10px Arial';
    ctx.fillText(label.toUpperCase(), x, y + size + 16);
  }
}

function drawCalibrationRing(ctx: CanvasRenderingContext2D, x: number, y: number) {
  const time = Date.now() % 2000;
  const progress = time / 2000;
  
  ctx.save();
  for (let i = 0; i < 3; i++) {
    const ringProgress = (progress + i * 0.33) % 1;
    const radius = 30 + ringProgress * 30;
    const alpha = 1 - ringProgress;
    ctx.strokeStyle = `rgba(76, 175, 80, ${alpha})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

// ================= MAIN RENDER FUNCTION =================
export function renderRovers(
  ctx: CanvasRenderingContext2D,
  state: RenderedState
): void {
  const W = 800;
  const H = 600;
  const GRID = 100;

  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#f8f9fa';
  ctx.fillRect(0, 0, W, H);

  const waypointColor = '#66BB6A';
  const pathColor = '#B0BEC5';
  const textColor = '#444';

  const currentStep = state.metadata?.step ?? 0;
  const action = state.metadata?.action ?? null;

  if (action && currentStep > 0) {
    startAnimationForStep(currentStep);
  }

  const showAnimation = isAnimationActive(currentStep);
  const parsedAction = parseAction(action);
  const actionType = parsedAction?.name ?? '';
  const actionParams = parsedAction?.params ?? [];

  // ================= FILTER OBJECTS =================
  const waypoints = state.objects.filter(o => {
    if (o.type !== 'waypoint') return false;
    const id = (o.id ?? '').toLowerCase();
    if (id === 'rover' || id === 'waypoint' || id === 'target') return false;
    return true;
  });

  const rovers = state.objects.filter(o => {
    if (o.type !== 'rover') return false;
    const id = (o.id ?? '').toLowerCase();
    if (id === 'rover' || id === 'waypoint' || id === 'target') return false;
    return true;
  });

  // ================= BUILD STATE FROM RELATIONS =================
  const imagedTargets = new Set<string>();
  for (const rel of state.relations) {
    if (rel.type === 'have-image' && rel.target) {
      imagedTargets.add(rel.target);
    }
  }

  const communicatedTargets = new Set<string>();
  for (const rel of state.relations) {
    if (rel.type === 'communicated') {
      communicatedTargets.add(rel.source);
    }
  }

  const connected = state.relations.filter(r => r.type === 'connected');
  const atRovers = state.relations.filter(r => r.type === 'at-rover');
  const atTargets = state.relations.filter(r => r.type === 'at-target');

  // ================= COUNT ROVERS PER WAYPOINT =================
  const roversAtWaypoint: Record<string, string[]> = {};
  for (const r of atRovers) {
    const wp = r.target;
    if (wp) {
      if (!roversAtWaypoint[wp]) {
        roversAtWaypoint[wp] = [];
      }
      roversAtWaypoint[wp].push(r.source);
    }
  }

  // ================= CALCULATE WAYPOINT RADII =================
  const BASE_WAYPOINT_RADIUS = 45;  // Larger base size
  const ROVER_SLOT_SIZE = 60;  // More space per rover when multiple
  const SHADOW_OFFSET = 2;

  const waypointRadii: Record<string, number> = {};
  for (const w of waypoints) {
    const roverCount = roversAtWaypoint[w.id]?.length || 0;
    if (roverCount > 1) {
      const totalRoverWidth = roverCount * ROVER_SLOT_SIZE;
      waypointRadii[w.id] = Math.max(BASE_WAYPOINT_RADIUS, totalRoverWidth / 2 + 15);
    } else {
      waypointRadii[w.id] = BASE_WAYPOINT_RADIUS;
    }
  }

  // ================= DYNAMIC LAYOUT WITH FORCE-BASED SPACING =================
  waypoints.sort((a, b) => a.id.localeCompare(b.id));

  // Calculate layout to use full canvas
  const numWaypoints = waypoints.length;
  const colsWp = Math.ceil(Math.sqrt(numWaypoints));
  const rowsWp = Math.ceil(numWaypoints / colsWp);
  
  // Use most of the canvas, leaving margins
  const MARGIN_X = 100;
  const MARGIN_Y = 80;
  const MARGIN_BOTTOM = 150; // Extra space for legend
  const usableW = W - 2 * MARGIN_X;
  const usableH = H - MARGIN_Y - MARGIN_BOTTOM;
  
  // Calculate spacing based on number of waypoints
  const BASE_CELL_X = colsWp > 1 ? usableW / (colsWp - 1) : usableW;
  const BASE_CELL_Y = rowsWp > 1 ? usableH / (rowsWp - 1) : usableH;
  const startX = MARGIN_X;
  const startY = MARGIN_Y;

  interface WaypointPos {
    x: number;
    y: number;
    radius: number;
  }

  const wpPos: Record<string, WaypointPos> = {};

  // Initial positions - spread across full canvas
  waypoints.forEach((w, i) => {
    const col = i % colsWp;
    const row = Math.floor(i / colsWp);
    
    // Center single column/row
    let x = startX + col * BASE_CELL_X;
    let y = startY + row * BASE_CELL_Y;
    
    // For single waypoint, center it
    if (numWaypoints === 1) {
      x = W / 2;
      y = H / 2 - 50;
    }
    
    wpPos[w.id] = {
      x,
      y,
      radius: waypointRadii[w.id]
    };
  });

  // Apply force-based repulsion to prevent overlaps
  // Run a few iterations to push apart overlapping waypoints
  const MIN_GAP = 50; // Minimum gap between waypoint edges
  
  for (let iteration = 0; iteration < 10; iteration++) {
    let moved = false;
    
    for (let i = 0; i < waypoints.length; i++) {
      for (let j = i + 1; j < waypoints.length; j++) {
        const wp1 = wpPos[waypoints[i].id];
        const wp2 = wpPos[waypoints[j].id];
        
        const dx = wp2.x - wp1.x;
        const dy = wp2.y - wp1.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const minDist = wp1.radius + wp2.radius + MIN_GAP;
        
        if (dist < minDist && dist > 0) {
          // Push apart
          const overlap = minDist - dist;
          const pushX = (dx / dist) * overlap * 0.5;
          const pushY = (dy / dist) * overlap * 0.5;
          
          wp1.x -= pushX;
          wp1.y -= pushY;
          wp2.x += pushX;
          wp2.y += pushY;
          
          // Keep within bounds
          wp1.x = Math.max(wp1.radius + 20, Math.min(W - wp1.radius - 20, wp1.x));
          wp1.y = Math.max(wp1.radius + 20, Math.min(H - wp1.radius - 60, wp1.y));
          wp2.x = Math.max(wp2.radius + 20, Math.min(W - wp2.radius - 20, wp2.x));
          wp2.y = Math.max(wp2.radius + 20, Math.min(H - wp2.radius - 60, wp2.y));
          
          moved = true;
        }
      }
    }
    
    if (!moved) break;
  }

  // ================= DRAW PATHS (connecting to edges) =================
  ctx.strokeStyle = pathColor;
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';

  for (const r of connected) {
    const a = wpPos[r.source];
    const b = r.target ? wpPos[r.target] : null;
    if (!a || !b) continue;

    // Calculate edge points
    const edgeA = getEdgePoint(a.x, a.y, a.radius, b.x, b.y);
    const edgeB = getEdgePoint(b.x, b.y, b.radius, a.x, a.y);

    ctx.beginPath();
    ctx.moveTo(edgeA.x, edgeA.y);
    ctx.lineTo(edgeB.x, edgeB.y);
    ctx.stroke();
  }

  // ================= DRAW WAYPOINTS =================
  for (const w of waypoints) {
    const p = wpPos[w.id];
    if (!p) continue;

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.1)';
    ctx.beginPath();
    ctx.arc(p.x + SHADOW_OFFSET, p.y + SHADOW_OFFSET, p.radius, 0, Math.PI * 2);
    ctx.fill();

    // Main circle
    ctx.fillStyle = waypointColor;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#43A047';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Label below waypoint
    ctx.fillStyle = textColor;
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(w.id.toUpperCase(), p.x, p.y + p.radius + 6);
  }

  // ================= DRAW TARGETS =================
  for (const t of atTargets) {
    const p = wpPos[t.target!];
    if (!p) continue;

    const isCommunicated = communicatedTargets.has(t.source);
    const hasImage = imagedTargets.has(t.source);
    const isAnimating = showAnimation && actionType === 'communicate' && actionParams[1] === t.source;

    // Position target outside waypoint (to the right and down)
    const tx = p.x + p.radius + 35;
    const ty = p.y + 25;

    drawTargetMarker(ctx, tx, ty, t.source, isCommunicated, hasImage, isAnimating);
  }

  // ================= DRAW ROVERS =================
  for (const wpId of Object.keys(roversAtWaypoint)) {
    const roverIds = roversAtWaypoint[wpId];
    const p = wpPos[wpId];
    if (!p) continue;

    const roverCount = roverIds.length;
    roverIds.sort();

    // Calculate rover size based on count
    const roverImgSize = roverCount > 1 ? 55 : 85;
    const spacing = roverCount > 1 ? ROVER_SLOT_SIZE : 0;
    const totalWidth = (roverCount - 1) * spacing;
    const startRoverX = p.x - totalWidth / 2;

    roverIds.forEach((roverId, index) => {
      const roverObj = rovers.find(ro => ro.id === roverId);
      const isCalibrated = roverObj?.properties?.calibrated === true;
      const images = roverObj?.properties?.images || [];
      const imageCount = images.length;

      const rx = startRoverX + index * spacing;
      const ry = p.y;

      const isCalibrateAnimating = showAnimation && actionType === 'calibrate' && actionParams[0] === roverId;
      const isTakeImageAnimating = showAnimation && actionType === 'take-image' && actionParams[0] === roverId;

      if (isCalibrateAnimating) {
        drawCalibrationRing(ctx, rx, ry);
      }

      // Draw rover image
      const halfSize = roverImgSize / 2;
      if (roverImg.complete) {
        ctx.drawImage(roverImg, rx - halfSize, ry - halfSize, roverImgSize, roverImgSize);
      } else {
        ctx.fillStyle = '#FF6B6B';
        ctx.beginPath();
        ctx.arc(rx, ry, halfSize / 2, 0, Math.PI * 2);
        ctx.fill();
      }

      // Rover label INSIDE at the TOP of the rover image
      ctx.fillStyle = '#fff';
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 2;
      ctx.font = `bold ${roverCount > 1 ? 9 : 11}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      
      // Draw label background for better visibility
      const labelY = ry - halfSize + 3;
      const labelText = roverId.toUpperCase();
      const labelWidth = ctx.measureText(labelText).width + 6;
      
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.beginPath();
      ctx.roundRect(rx - labelWidth/2 +10, labelY + 15, labelWidth, roverCount > 1 ? 11 : 14, 3);
      ctx.fill();
      
      ctx.fillStyle = '#fff';
      ctx.fillText(labelText, rx+10 , labelY+15);

      // Badges
      if (isCalibrated) {
        drawCalibrationBadge(ctx, rx, ry, halfSize, isCalibrateAnimating);
      }
      if (imageCount > 0) {
        drawImageBadge(ctx, rx, ry, halfSize, imageCount, isTakeImageAnimating);
      }
    });
  }
}
