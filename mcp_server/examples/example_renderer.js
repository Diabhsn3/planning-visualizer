// Example renderer for blocks_world domain
// This shows the correct structure and patterns

function renderBlocksWorld(ctx, state) {
  // ALWAYS check for null/undefined state
  if (!state || !state.objects) return;
  
  // Get objects by type
  const blocks = state.objects.filter(obj => obj.type === 'block');
  const table = state.objects.find(obj => obj.type === 'table');
  const arm = state.objects.find(obj => obj.type === 'arm');
  
  // Build relation maps to understand where objects are
  const onMap = new Map(); // block -> what it's on
  const holdingMap = new Map(); // arm -> what it's holding
  
  for (const rel of state.relations || []) {
    if (rel.type === 'on') {
      onMap.set(rel.source, rel.target);
    } else if (rel.type === 'holding') {
      holdingMap.set(rel.source, rel.target);
    }
  }
  
  // Draw table first (background element)
  if (table) {
    const [tx, ty] = table.position || [400, 400];
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(tx - 200, ty, 400, 20);
  }
  
  // Draw blocks based on their relations
  for (const block of blocks) {
    const [bx, by] = block.position || [0, 0];
    const color = block.properties?.color || '#FF6B6B';
    
    ctx.fillStyle = color;
    ctx.fillRect(bx - 25, by - 25, 50, 50);
    
    // Label
    ctx.fillStyle = '#000';
    ctx.font = '14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(block.id, bx, by + 5);
  }
}

function renderBlocksWorldLegend(ctx, x, y) {
  // Legend with SMALL icons (15-20px)
  ctx.fillStyle = '#FFF';
  ctx.fillRect(x, y, 120, 80);
  ctx.strokeStyle = '#000';
  ctx.strokeRect(x, y, 120, 80);
  
  ctx.font = 'bold 12px Arial';
  ctx.fillStyle = '#000';
  ctx.fillText('Legend', x + 10, y + 15);
  
  // Block icon (small!)
  ctx.fillStyle = '#FF6B6B';
  ctx.fillRect(x + 10, y + 25, 15, 15);
  ctx.fillStyle = '#000';
  ctx.font = '11px Arial';
  ctx.fillText('Block', x + 30, y + 37);
  
  // Table icon
  ctx.fillStyle = '#8B4513';
  ctx.fillRect(x + 10, y + 50, 15, 5);
  ctx.fillText('Table', x + 30, y + 57);
}
