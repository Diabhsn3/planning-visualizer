// src/components/renderRovers.ts
// Enhanced Rovers Domain Visualization
// Each action has clear visual feedback for viewer-first design

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

// ================= IMAGE CACHE =================
const roverImg = new Image();
roverImg.src = "/rover.png";

// ================= ANIMATION STATE =================
// Track temporary visual effects for actions
interface ActionEffect {
  type: 'calibrate' | 'take-image' | 'communicate';
  targetId: string;
  startTime: number;
  duration: number;
}

let activeEffects: ActionEffect[] = [];
let lastAction: string | null = null;
let lastStep: number = -1;

// Effect durations in milliseconds
const EFFECT_DURATION = {
  calibrate: 1500,
  'take-image': 1200,
  communicate: 1500,
};

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
  // Draw a gear/calibration icon badge on the rover
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

  // Gear icon (simplified)
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  // Inner circle
  ctx.arc(badgeX, badgeY, 4, 0, Math.PI * 2);
  ctx.stroke();
  // Gear teeth (6 lines radiating out)
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(badgeX + Math.cos(angle) * 4, badgeY + Math.sin(angle) * 4);
    ctx.lineTo(badgeX + Math.cos(angle) * 8, badgeY + Math.sin(angle) * 8);
    ctx.stroke();
  }
}

function drawImageBadge(ctx: CanvasRenderingContext2D, x: number, y: number, count: number, isAnimating: boolean) {
  // Draw a camera/image icon showing rover has captured images
  const badgeX = x - 20;
  const badgeY = y - 16;
  const width = 18;
  const height = 14;

  // Flash effect when taking image
  if (isAnimating) {
    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.restore();
    
    // Camera flash burst
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

function drawCommunicatedBadge(ctx: CanvasRenderingContext2D, x: number, y: number, isAnimating: boolean) {
  // Draw a checkmark/signal icon showing target has been communicated
  const badgeX = x + 12;
  const badgeY = y - 12;

  // Signal wave animation
  if (isAnimating) {
    const time = Date.now() % 1500;
    const progress = time / 1500;
    
    ctx.save();
    ctx.strokeStyle = `rgba(156, 39, 176, ${1 - progress})`;
    ctx.lineWidth = 2;
    
    // Expanding signal waves
    for (let i = 0; i < 3; i++) {
      const waveProgress = (progress + i * 0.3) % 1;
      const radius = 10 + waveProgress * 30;
      ctx.globalAlpha = 1 - waveProgress;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  // Badge background (green checkmark circle)
  ctx.fillStyle = '#9C27B0';
  ctx.beginPath();
  ctx.arc(badgeX, badgeY, 9, 0, Math.PI * 2);
  ctx.fill();

  // Checkmark
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(badgeX - 4, badgeY);
  ctx.lineTo(badgeX - 1, badgeY + 3);
  ctx.lineTo(badgeX + 5, badgeY - 3);
  ctx.stroke();
}

function drawTargetMarker(ctx: CanvasRenderingContext2D, x: number, y: number, label: string, isCommunicated: boolean, isAnimating: boolean) {
  // Draw target as a distinct marker
  const size = 16;

  // Target crosshair
  ctx.strokeStyle = isCommunicated ? '#9C27B0' : '#FF9800';
  ctx.lineWidth = 2;
  
  // Outer circle
  ctx.beginPath();
  ctx.arc(x, y, size, 0, Math.PI * 2);
  ctx.stroke();
  
  // Inner circle
  ctx.beginPath();
  ctx.arc(x, y, size * 0.5, 0, Math.PI * 2);
  ctx.stroke();
  
  // Center dot
  ctx.fillStyle = isCommunicated ? '#9C27B0' : '#FF9800';
  ctx.beginPath();
  ctx.arc(x, y, 3, 0, Math.PI * 2);
  ctx.fill();

  // Crosshair lines
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

  // Label
  ctx.fillStyle = '#666';
  ctx.font = 'bold 10px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(label.toUpperCase(), x, y + size + 6);

  // Communicated badge
  if (isCommunicated) {
    drawCommunicatedBadge(ctx, x, y, isAnimating);
  }
}

function drawCalibrationRing(ctx: CanvasRenderingContext2D, x: number, y: number) {
  // Draw an animated calibration ring around the rover
  const time = Date.now() % 2000;
  const rotation = (time / 2000) * Math.PI * 2;
  
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  
  // Dashed rotating ring
  ctx.strokeStyle = '#4CAF50';
  ctx.lineWidth = 3;
  ctx.setLineDash([8, 8]);
  ctx.beginPath();
  ctx.arc(0, 0, 35, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  
  // Calibration markers (4 points)
  ctx.fillStyle = '#4CAF50';
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(Math.cos(angle) * 35, Math.sin(angle) * 35, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  
  ctx.restore();
}

// ================= MAIN RENDER FUNCTION =================
export function renderRovers(
  ctx: CanvasRenderingContext2D,
  state: RenderedState
) {
  const scale = ctx.getTransform().a || 1;
  const W = ctx.canvas.width / scale;
  const H = ctx.canvas.height / scale;

  // ================= GRID BACKGROUND =================
  const GRID = 100;
  const cols = Math.ceil(W / GRID);
  const rows = Math.ceil(H / GRID);

  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#f8f9fa';
  ctx.fillRect(0, 0, W, H);

  // Subtle grid
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

  // ================= PROCESS ACTION FOR EFFECTS =================
  const currentStep = state.metadata?.step ?? 0;
  const action = state.metadata?.action ?? null;
  const now = Date.now();

  // Detect new action and create effect
  if (action && (action !== lastAction || currentStep !== lastStep)) {
    const parsed = parseAction(action);
    if (parsed) {
      let effectType: ActionEffect['type'] | null = null;
      let targetId = '';

      if (parsed.name === 'calibrate') {
        effectType = 'calibrate';
        targetId = parsed.params[0] || ''; // rover id
      } else if (parsed.name === 'take-image') {
        effectType = 'take-image';
        targetId = parsed.params[0] || ''; // rover id
      } else if (parsed.name === 'communicate') {
        effectType = 'communicate';
        targetId = parsed.params[1] || ''; // target id
      }

      if (effectType && targetId) {
        activeEffects.push({
          type: effectType,
          targetId,
          startTime: now,
          duration: EFFECT_DURATION[effectType],
        });
      }
    }
    lastAction = action;
    lastStep = currentStep;
  }

  // Clean up expired effects
  activeEffects = activeEffects.filter(e => now - e.startTime < e.duration);

  // Check if specific effects are active
  const isEffectActive = (type: ActionEffect['type'], targetId: string) => {
    return activeEffects.some(e => e.type === type && e.targetId === targetId);
  };

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

  const targets = state.objects.filter(o => {
    if (o.type !== 'target') return false;
    const id = (o.id ?? '').toLowerCase();
    if (id === 'rover' || id === 'waypoint' || id === 'target') return false;
    return true;
  });

  // ================= RELATIONS =================
  const connected = state.relations.filter(r => r.type === 'connected');
  const atRovers = state.relations.filter(r => r.type === 'at-rover');
  const atTargets = state.relations.filter(r => r.type === 'at-target');

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
  for (const w of waypoints) {
    const p = wpPos[w.id];
    if (!p) continue;

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.1)';
    ctx.beginPath();
    ctx.arc(p.x + 2, p.y + 2, 20, 0, Math.PI * 2);
    ctx.fill();

    // Waypoint circle
    ctx.fillStyle = waypointColor;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 20, 0, Math.PI * 2);
    ctx.fill();

    // Border
    ctx.strokeStyle = '#43A047';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Label
    ctx.fillStyle = textColor;
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(w.id.toUpperCase(), p.x, p.y + 26);
  }

  // ================= DRAW TARGETS =================
  for (const t of atTargets) {
    const p = wpPos[t.target!];
    if (!p) continue;

    // Find target object to check communicated status
    const targetObj = targets.find(to => to.id === t.source);
    const isCommunicated = targetObj?.properties?.communicated === true;
    const isAnimating = isEffectActive('communicate', t.source);

    // Position target offset from waypoint
    const tx = p.x + 35;
    const ty = p.y + 35;

    drawTargetMarker(ctx, tx, ty, t.source, isCommunicated, isAnimating);
  }

  // ================= DRAW ROVERS =================
  for (const r of atRovers) {
    const p = wpPos[r.target!];
    if (!p) continue;

    // Find rover object to get properties
    const roverObj = rovers.find(ro => ro.id === r.source);
    const isCalibrated = roverObj?.properties?.calibrated === true;
    const images = roverObj?.properties?.images || [];
    const imageCount = images.length;

    const rx = p.x;
    const ry = p.y;

    // Calibration animation ring (when calibrating)
    const isCalibrateAnimating = isEffectActive('calibrate', r.source);
    if (isCalibrateAnimating) {
      drawCalibrationRing(ctx, rx, ry);
    }

    // Take-image flash effect
    const isTakeImageAnimating = isEffectActive('take-image', r.source);

    // Draw rover image
    if (roverImg.complete) {
      ctx.drawImage(roverImg, rx - 24, ry - 24, 48, 48);
    } else {
      // Fallback: draw a simple rover shape
      ctx.fillStyle = '#FF6B6B';
      ctx.beginPath();
      ctx.arc(rx, ry, 20, 0, Math.PI * 2);
      ctx.fill();
    }

    // Rover label
    ctx.fillStyle = textColor;
    ctx.font = 'bold 11px Arial';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(r.source.toUpperCase(), rx + 30, ry);

    // Calibration badge (persistent when calibrated)
    if (isCalibrated) {
      drawCalibrationBadge(ctx, rx, ry, isCalibrateAnimating);
    }

    // Image badge (shows count of captured images)
    if (imageCount > 0 || isTakeImageAnimating) {
      drawImageBadge(ctx, rx, ry, imageCount, isTakeImageAnimating);
    }
  }

  // ================= LEGEND =================
  const legendX = 15;
  const legendY = H - 100;
  
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.fillRect(legendX - 5, legendY - 5, 130, 90);
  ctx.strokeStyle = '#ddd';
  ctx.lineWidth = 1;
  ctx.strokeRect(legendX - 5, legendY - 5, 130, 90);

  ctx.font = 'bold 10px Arial';
  ctx.fillStyle = '#666';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('LEGEND', legendX, legendY + 5);

  // Calibrated indicator
  ctx.fillStyle = '#4CAF50';
  ctx.beginPath();
  ctx.arc(legendX + 8, legendY + 22, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#666';
  ctx.font = '9px Arial';
  ctx.fillText('Calibrated', legendX + 20, legendY + 22);

  // Has image indicator
  ctx.fillStyle = '#2196F3';
  ctx.beginPath();
  ctx.roundRect(legendX + 2, legendY + 35, 12, 10, 2);
  ctx.fill();
  ctx.fillStyle = '#666';
  ctx.fillText('Has Image', legendX + 20, legendY + 40);

  // Communicated indicator
  ctx.fillStyle = '#9C27B0';
  ctx.beginPath();
  ctx.arc(legendX + 8, legendY + 58, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#666';
  ctx.fillText('Communicated', legendX + 20, legendY + 58);

  // Target indicator
  ctx.strokeStyle = '#FF9800';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(legendX + 8, legendY + 75, 6, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#666';
  ctx.fillText('Target', legendX + 20, legendY + 75);
}
