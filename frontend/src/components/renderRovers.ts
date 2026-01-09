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
// Animation state is keyed by step number - when step changes, animations reset
interface AnimationState {
  step: number;
  startTime: number;
}

// Single animation state tracker - resets when step changes
let animationState: AnimationState | null = null;

// Animation duration in milliseconds
const ANIMATION_DURATION = 1500;

// Check if animation should be active for current step
function isAnimationActive(currentStep: number): boolean {
  if (!animationState) return false;
  if (animationState.step !== currentStep) {
    // Step changed - reset animation state
    animationState = null;
    return false;
  }
  const elapsed = Date.now() - animationState.startTime;
  return elapsed < ANIMATION_DURATION;
}

// Start animation for a new step
function startAnimationForStep(step: number): void {
  if (!animationState || animationState.step !== step) {
    animationState = {
      step,
      startTime: Date.now()
    };
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

function drawCalibrationBadge(ctx: CanvasRenderingContext2D, x: number, y: number, isAnimating: boolean) {
  const badgeX = x + 16;
  const badgeY = y - 16;
  const radius = 10;

  // Animated glow effect
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

  // Badge background
  ctx.fillStyle = '#4CAF50';
  ctx.beginPath();
  ctx.arc(badgeX, badgeY, radius, 0, Math.PI * 2);
  ctx.fill();

  // Gear icon
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(badgeX, badgeY, 4, 0, Math.PI * 2);
  ctx.stroke();
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(badgeX + Math.cos(angle) * 4, badgeY + Math.sin(angle) * 4);
    ctx.lineTo(badgeX + Math.cos(angle) * 8, badgeY + Math.sin(angle) * 8);
    ctx.stroke();
  }
}

function drawImageBadge(ctx: CanvasRenderingContext2D, x: number, y: number, count: number, isAnimating: boolean) {
  const badgeX = x - 20;
  const badgeY = y - 16;
  const width = 18;
  const height = 14;

  // Flash effect when taking image (only during animation)
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

  // Badge background
  ctx.fillStyle = '#2196F3';
  ctx.beginPath();
  ctx.roundRect(badgeX - width/2, badgeY - height/2, width, height, 3);
  ctx.fill();

  // Camera lens
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(badgeX, badgeY, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#2196F3';
  ctx.beginPath();
  ctx.arc(badgeX, badgeY, 2, 0, Math.PI * 2);
  ctx.fill();

  // Image count badge
  if (count > 0) {
    ctx.fillStyle = '#FF5722';
    ctx.beginPath();
    ctx.arc(badgeX + 10, badgeY - 8, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 9px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(count.toString(), badgeX + 10, badgeY - 8);
  }
}

// ================= TARGET MARKER (3 distinct states) =================
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
    // ============================================
    // COMMUNICATED STATE: Green filled circle with satellite icon
    // ============================================
    
    // Animation: Signal waves
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

    // Outer glow
    ctx.save();
    ctx.shadowColor = '#4CAF50';
    ctx.shadowBlur = 12;
    
    // Filled green circle
    ctx.fillStyle = '#4CAF50';
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    
    // White border
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.stroke();

    // Satellite icon
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

    // "SENT" label
    ctx.fillStyle = '#2E7D32';
    ctx.font = 'bold 9px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('✓ SENT', x, y + size + 4);
    
    ctx.fillStyle = '#666';
    ctx.font = 'bold 10px Arial';
    ctx.fillText(label.toUpperCase(), x, y + size + 16);

  } else if (hasImage) {
    // ============================================
    // HAS IMAGE STATE: Blue solid crosshair
    // ============================================
    
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
    
    // Camera badge
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
    // ============================================
    // PENDING STATE: Orange dashed crosshair
    // ============================================
    
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

// ================= CALIBRATION RING ANIMATION =================
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
  // Fixed world-unit dimensions (camera zoom is handled by canvas transform)
  const W = 800;
  const H = 600;

  // ================= GRID BACKGROUND =================
  const GRID = 100;
  const cols = Math.ceil(W / GRID);
  const rows = Math.ceil(H / GRID);

  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#f8f9fa';
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = 'rgba(0,0,0,0.06)';
  ctx.lineWidth = 1;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      ctx.strokeRect(x * GRID, y * GRID, GRID, GRID);
    }
  }

  // ================= COLORS =================
  const waypointColor = '#66BB6A';
  const pathColor = '#B0BEC5';
  const textColor = '#444';

  // ================= GET CURRENT STEP AND ACTION =================
  const currentStep = state.metadata?.step ?? 0;
  const action = state.metadata?.action ?? null;

  // Start animation only when we arrive at a new step with an action
  if (action && currentStep > 0) {
    startAnimationForStep(currentStep);
  }

  // Check if animation is active for THIS step
  const showAnimation = isAnimationActive(currentStep);

  // Parse action to determine what type of animation to show
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

  // Note: targets are rendered based on at-target relations, not the objects array

  // ================= BUILD STATE FROM RELATIONS (PURE) =================
  // These are derived ONLY from the current state's relations
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

  // ================= RELATIONS =================
  const connected = state.relations.filter(r => r.type === 'connected');
  const atRovers = state.relations.filter(r => r.type === 'at-rover');
  const atTargets = state.relations.filter(r => r.type === 'at-target');

  // ================= COUNT ROVERS PER WAYPOINT =================
  // This is needed to:
  // 1. Dynamically size waypoints based on rover count
  // 2. Spread rovers horizontally when multiple are at the same waypoint
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

  // ================= LAYOUT =================
  waypoints.sort((a, b) => a.id.localeCompare(b.id));

  const wpPos: Record<string, { col: number; row: number; x: number; y: number }> = {};
  const colsWp = Math.ceil(Math.sqrt(waypoints.length));
  const CELL_STEP_X = 3;
  const CELL_STEP_Y = 2;
  const startCol = 1;
  const startRow = 1;

  waypoints.forEach((w, i) => {
    const col = startCol + (i % colsWp) * CELL_STEP_X;
    const row = startRow + Math.floor(i / colsWp) * CELL_STEP_Y;
    wpPos[w.id] = {
      col,
      row,
      x: col * GRID + GRID / 2,
      y: row * GRID + GRID / 2,
    };
  });

  // ================= DRAW PATHS =================
  ctx.strokeStyle = pathColor;
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';

  for (const r of connected) {
    const a = wpPos[r.source];
    const b = r.target ? wpPos[r.target] : null;
    if (!a || !b) continue;

    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }

  // ================= DRAW WAYPOINTS =================
  const BASE_WAYPOINT_RADIUS = 32;   // Base radius for 0-1 rovers
  const ROVER_SIZE = 50;             // Space needed per rover (reduced from 96)
  const SHADOW_OFFSET = 2;

  for (const w of waypoints) {
    const p = wpPos[w.id];
    if (!p) continue;

    // Calculate dynamic radius based on rover count
    const roverCount = roversAtWaypoint[w.id]?.length || 0;
    let waypointRadius = BASE_WAYPOINT_RADIUS;
    
    if (roverCount > 1) {
      // Expand waypoint to fit all rovers in a row
      // Each rover needs ROVER_SIZE width, plus some padding
      const totalRoverWidth = roverCount * ROVER_SIZE;
      waypointRadius = Math.max(BASE_WAYPOINT_RADIUS, totalRoverWidth / 2 + 10);
    }

    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.1)';
    ctx.beginPath();
    ctx.arc(
      p.x + SHADOW_OFFSET,
      p.y + SHADOW_OFFSET,
      waypointRadius,
      0,
      Math.PI * 2
    );
    ctx.fill();

    // main circle
    ctx.fillStyle = waypointColor;
    ctx.beginPath();
    ctx.arc(p.x, p.y, waypointRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#43A047';
    ctx.lineWidth = 2;
    ctx.stroke();

    // label
    ctx.fillStyle = textColor;
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(
      w.id.toUpperCase(),
      p.x,
      p.y + waypointRadius + 6
    );
  }

  // ================= DRAW TARGETS =================
  for (const t of atTargets) {
    const p = wpPos[t.target!];
    if (!p) continue;

    // Get state from the CURRENT state's data only
    const isCommunicated = communicatedTargets.has(t.source);
    const hasImage = imagedTargets.has(t.source);
    
    // Animation only for the specific target being communicated in THIS action
    const isAnimating = showAnimation && 
                        actionType === 'communicate' && 
                        actionParams[1] === t.source;

    // Calculate waypoint radius for target offset
    const roverCount = roversAtWaypoint[t.target!]?.length || 0;
    let waypointRadius = BASE_WAYPOINT_RADIUS;
    if (roverCount > 1) {
      const totalRoverWidth = roverCount * ROVER_SIZE;
      waypointRadius = Math.max(BASE_WAYPOINT_RADIUS, totalRoverWidth / 2 + 10);
    }

    // Position target outside the waypoint
    const tx = p.x + waypointRadius + 30;
    const ty = p.y + 30;

    drawTargetMarker(ctx, tx, ty, t.source, isCommunicated, hasImage, isAnimating);
  }

  // ================= DRAW ROVERS =================
  // Group rovers by waypoint for proper spreading
  for (const wpId of Object.keys(roversAtWaypoint)) {
    const roverIds = roversAtWaypoint[wpId];
    const p = wpPos[wpId];
    if (!p) continue;

    const roverCount = roverIds.length;
    
    // Calculate positions for each rover at this waypoint
    // Spread them horizontally, centered on the waypoint
    const spacing = ROVER_SIZE;
    const totalWidth = (roverCount - 1) * spacing;
    const startX = p.x - totalWidth / 2;

    roverIds.sort(); // Sort for consistent ordering

    roverIds.forEach((roverId, index) => {
      // Find the at-rover relation for this rover
      const roverRel = atRovers.find(r => r.source === roverId && r.target === wpId);
      if (!roverRel) return;

      // Get rover properties from the CURRENT state only
      const roverObj = rovers.find(ro => ro.id === roverId);
      const isCalibrated = roverObj?.properties?.calibrated === true;
      const images = roverObj?.properties?.images || [];
      const imageCount = images.length;

      // Calculate this rover's position
      const rx = startX + index * spacing;
      const ry = p.y;

      // Animation only for the specific rover being calibrated in THIS action
      const isCalibrateAnimating = showAnimation && 
                                    actionType === 'calibrate' && 
                                    actionParams[0] === roverId;
      
      const isTakeImageAnimating = showAnimation && 
                                    actionType === 'take-image' && 
                                    actionParams[0] === roverId;

      // Calibration ring animation
      if (isCalibrateAnimating) {
        drawCalibrationRing(ctx, rx, ry);
      }

      // Draw rover image (smaller when multiple rovers)
      const roverImgSize = roverCount > 1 ? 48 : 96;
      const roverImgOffset = roverImgSize / 2;
      
      if (roverImg.complete) {
        ctx.drawImage(roverImg, rx - roverImgOffset, ry - roverImgOffset, roverImgSize, roverImgSize);
      } else {
        ctx.fillStyle = '#FF6B6B';
        ctx.beginPath();
        ctx.arc(rx, ry, roverImgSize / 4, 0, Math.PI * 2);
        ctx.fill();
      }

      // Rover label (positioned below the rover)
      ctx.fillStyle = textColor;
      ctx.font = 'bold 11px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(roverId.toUpperCase(), rx, ry + roverImgOffset + 2);

      // Calibration badge (ONLY if calibrated in THIS state)
      if (isCalibrated) {
        drawCalibrationBadge(ctx, rx, ry - roverImgOffset/2, isCalibrateAnimating);
      }

      // Image badge (ONLY if has images in THIS state)
      if (imageCount > 0) {
        drawImageBadge(ctx, rx, ry - roverImgOffset/2, imageCount, isTakeImageAnimating);
      }
    });
  }

  // ================= LEGEND =================
  const legendX = 15;
  const legendY = H - 130;
  
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.fillRect(legendX - 5, legendY - 5, 145, 120);
  ctx.strokeStyle = '#ddd';
  ctx.lineWidth = 1;
  ctx.strokeRect(legendX - 5, legendY - 5, 145, 120);

  ctx.font = 'bold 10px Arial';
  ctx.fillStyle = '#666';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('LEGEND', legendX, legendY + 5);

  // Calibrated
  ctx.fillStyle = '#4CAF50';
  ctx.beginPath();
  ctx.arc(legendX + 8, legendY + 24, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#666';
  ctx.font = '9px Arial';
  ctx.fillText('Rover Calibrated', legendX + 20, legendY + 24);

  // Has image
  ctx.fillStyle = '#2196F3';
  ctx.beginPath();
  ctx.roundRect(legendX + 2, legendY + 38, 12, 10, 2);
  ctx.fill();
  ctx.fillStyle = '#666';
  ctx.fillText('Rover Has Image', legendX + 20, legendY + 43);

  // Target pending
  ctx.strokeStyle = '#FF9800';
  ctx.lineWidth = 2;
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.arc(legendX + 8, legendY + 62, 6, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = '#666';
  ctx.fillText('Target (Pending)', legendX + 20, legendY + 62);

  // Target imaged
  ctx.strokeStyle = '#2196F3';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(legendX + 8, legendY + 80, 6, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#666';
  ctx.fillText('Target (Imaged)', legendX + 20, legendY + 80);

  // Target communicated
  ctx.fillStyle = '#4CAF50';
  ctx.beginPath();
  ctx.arc(legendX + 8, legendY + 98, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = '#666';
  ctx.font = '9px Arial';
  ctx.fillText('Target (Sent ✓)', legendX + 20, legendY + 98);
}
