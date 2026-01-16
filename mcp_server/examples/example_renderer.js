/**
 * EXAMPLE RENDERER - Blocks World Domain
 * 
 * This is a reference implementation showing the correct structure
 * and patterns for a planning domain renderer.
 * 
 * Key patterns demonstrated:
 * 1. Null-checking state data
 * 2. Filtering objects by type
 * 3. Using object positions and properties
 * 4. Drawing with Canvas API
 * 5. Creating a legend box
 * 6. Creating a custom background
 */

// ============================================================================
// MAIN RENDER FUNCTION - Required
// ============================================================================
function renderBlocksWorld(ctx, state) {
  // ALWAYS check for valid state first
  if (!state || !state.objects) return;
  
  // Filter objects by type
  const blocks = state.objects.filter(obj => obj.type === 'block');
  const table = state.objects.find(obj => obj.type === 'surface' || obj.type === 'table');
  const gripper = state.objects.find(obj => obj.type === 'gripper' || obj.type === 'arm');
  
  // Draw table/surface
  if (table) {
    const x = table.position ? table.position[0] : 0;
    const y = table.position ? table.position[1] : 400;
    const width = table.properties?.width || 400;
    const height = table.properties?.height || 20;
    
    ctx.fillStyle = table.properties?.color || '#8B4513';
    ctx.fillRect(x, y, width, height);
    
    // Add shadow
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.fillRect(x, y + height, width, 5);
  }
  
  // Draw blocks
  for (const block of blocks) {
    const x = block.position ? block.position[0] : 100;
    const y = block.position ? block.position[1] : 300;
    const width = block.properties?.width || 60;
    const height = block.properties?.height || 60;
    const color = block.properties?.color || '#4ECDC4';
    
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.fillRect(x + 3, y + 3, width, height);
    
    // Block body
    ctx.fillStyle = color;
    ctx.fillRect(x, y, width, height);
    
    // Block border
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, width, height);
    
    // Block label
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 20px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(block.label || block.id, x + width/2, y + height/2);
  }
  
  // Draw gripper/arm
  if (gripper) {
    const x = gripper.position ? gripper.position[0] : 200;
    const y = gripper.position ? gripper.position[1] : 50;
    const isEmpty = gripper.properties?.empty !== false;
    
    // Arm vertical bar
    ctx.fillStyle = '#607D8B';
    ctx.fillRect(x - 5, 0, 10, y);
    
    // Gripper claws
    ctx.fillStyle = isEmpty ? '#4CAF50' : '#FF5722';
    ctx.fillRect(x - 25, y, 20, 10);
    ctx.fillRect(x + 5, y, 20, 10);
    
    // Status label
    ctx.fillStyle = '#333';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(isEmpty ? 'Empty' : 'Holding', x, y + 25);
  }
  
  // Title
  ctx.fillStyle = '#333';
  ctx.font = 'bold 18px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('Blocks World', 200, 30);
}

// ============================================================================
// LEGEND FUNCTION - Required
// ============================================================================
function renderBlocksWorldLegend(ctx, x, y) {
  const boxWidth = 140;
  const boxHeight = 100;
  const padding = 10;
  
  // Background box
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.fillRect(x, y, boxWidth, boxHeight);
  ctx.strokeStyle = '#ccc';
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, boxWidth, boxHeight);
  
  // Title
  ctx.fillStyle = '#333';
  ctx.font = 'bold 12px Arial';
  ctx.textAlign = 'left';
  ctx.fillText('Legend', x + padding, y + 18);
  
  // Block item
  ctx.fillStyle = '#4ECDC4';
  ctx.fillRect(x + padding, y + 30, 20, 20);
  ctx.fillStyle = '#333';
  ctx.font = '11px Arial';
  ctx.fillText('Block', x + padding + 28, y + 44);
  
  // Gripper empty
  ctx.fillStyle = '#4CAF50';
  ctx.fillRect(x + padding, y + 55, 20, 10);
  ctx.fillStyle = '#333';
  ctx.fillText('Gripper (empty)', x + padding + 28, y + 64);
  
  // Gripper holding
  ctx.fillStyle = '#FF5722';
  ctx.fillRect(x + padding, y + 75, 20, 10);
  ctx.fillStyle = '#333';
  ctx.fillText('Gripper (holding)', x + padding + 28, y + 84);
}

// ============================================================================
// BACKGROUND FUNCTION - Optional
// ============================================================================
function renderBlocksWorldBackground(ctx, width, height) {
  // Gradient background
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, '#f5f5f5');
  gradient.addColorStop(1, '#e0e0e0');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  
  // Grid pattern (subtle)
  ctx.strokeStyle = 'rgba(0,0,0,0.05)';
  ctx.lineWidth = 1;
  
  for (let gx = 0; gx < width; gx += 50) {
    ctx.beginPath();
    ctx.moveTo(gx, 0);
    ctx.lineTo(gx, height);
    ctx.stroke();
  }
  
  for (let gy = 0; gy < height; gy += 50) {
    ctx.beginPath();
    ctx.moveTo(0, gy);
    ctx.lineTo(width, gy);
    ctx.stroke();
  }
}
