function drawCar(ctx, x, y, w, h, color, label) {
    ctx.save();
    ctx.translate(x, y);
    // Shadow
    ctx.shadowColor = 'rgba(0,0,0,0.3)';
    ctx.shadowBlur = 5;
    ctx.shadowOffsetY = 3;
    // Wheels
    ctx.fillStyle = "#212121";
    ctx.beginPath();
    ctx.arc(-w * 0.3, h * 0.2, h * 0.18, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(w * 0.3, h * 0.2, h * 0.18, 0, Math.PI * 2);
    ctx.fill();
    // Car Body
    ctx.fillStyle = color;
    ctx.strokeStyle = "rgba(0,0,0,0.4)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(-w / 2, -h / 2, w, h * 0.8, 6);
    ctx.fill();
    ctx.stroke();
    // Windshield
    ctx.fillStyle = "#B2EBF2"; // Light blue for windows
    ctx.beginPath();
    ctx.moveTo(-w * 0.4, -h / 2);
    ctx.lineTo(-w * 0.25, -h * 0.8);
    ctx.lineTo(w * 0.2, -h * 0.8);
    ctx.lineTo(w * 0.35, -h / 2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    // Label
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.9)";
    ctx.font = "bold 10px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, x, y - h * 0.1);
    ctx.restore();
}
function drawFerry(ctx, x, y, w, h, color, label) {
    ctx.save();
    // Shadow
    ctx.shadowColor = 'rgba(0,0,0,0.4)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 5;
    // Hull
    ctx.fillStyle = color;
    ctx.strokeStyle = "rgba(0,0,0,0.5)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - w / 2, y + h / 2);
    ctx.lineTo(x + w / 2, y + h / 2);
    ctx.lineTo(x + w / 2 - 20, y - h / 2);
    ctx.lineTo(x - w / 2 + 20, y - h / 2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Cabin
    ctx.fillStyle = "#E0E0E0";
    const cabinW = w * 0.6;
    const cabinH = h * 0.4;
    ctx.fillRect(x - cabinW / 2, y - h / 2 - cabinH, cabinW, cabinH);
    ctx.strokeRect(x - cabinW / 2, y - h / 2 - cabinH, cabinW, cabinH);
    ctx.restore();
    // Label
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.9)";
    ctx.font = "bold 14px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, x, y);
    ctx.restore();
}
function drawLocation(ctx, x, y, w, h, color, label) {
    ctx.save();
    const topY = y - h / 2;
    // Main dock area
    ctx.fillStyle = color;
    ctx.fillRect(x - w / 2, topY, w, h);
    // Wooden planks effect
    ctx.strokeStyle = "rgba(0,0,0,0.1)";
    ctx.lineWidth = 2;
    const plankWidth = 30;
    const numPlanks = Math.floor(w / plankWidth);
    for (let i = 1; i < numPlanks; i++) {
        const lineX = x - w / 2 + i * plankWidth;
        ctx.beginPath();
        ctx.moveTo(lineX, topY);
        ctx.lineTo(lineX, topY + h);
        ctx.stroke();
    }
    // Border
    ctx.strokeStyle = "rgba(0,0,0,0.4)";
    ctx.lineWidth = 4;
    ctx.strokeRect(x - w / 2, topY, w, h);
    // Label
    ctx.fillStyle = "#212121";
    ctx.font = "bold 18px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText(label, x, topY - 15);
    ctx.restore();
}
function renderFerry(ctx, state) {
    const objects = [...state.objects].sort((a, b) => (a.properties?.zIndex || 0) - (b.properties?.zIndex || 0));
    for (const obj of objects) {
        if (!obj.position || !obj.properties)
            continue;
        const [x, y] = obj.position;
        const { width, height, color } = obj.properties;
        switch (obj.type) {
            case 'location':
                drawLocation(ctx, x, y, width, height, color, obj.label);
                break;
            case 'ferry':
                drawFerry(ctx, x, y, width, height, color, obj.label);
                break;
            case 'car':
                if (x > 0 && y > 0) { // Don't draw cars that are off-screen
                    drawCar(ctx, x, y, width, height, color, obj.label);
                }
                break;
        }
    }
}
function renderFerryBackground(ctx, width, height) {
    const waterLevel = 500;
    // Sky
    const skyGradient = ctx.createLinearGradient(0, 0, 0, waterLevel);
    skyGradient.addColorStop(0, "#87CEEB");
    skyGradient.addColorStop(1, "#D1ECF7");
    ctx.fillStyle = skyGradient;
    ctx.fillRect(0, 0, width, waterLevel);
    // Water
    const waterGradient = ctx.createLinearGradient(0, waterLevel, 0, height);
    waterGradient.addColorStop(0, "#4682B4");
    waterGradient.addColorStop(1, "#315a7d");
    ctx.fillStyle = waterGradient;
    ctx.fillRect(0, waterLevel, width, height - waterLevel);
    // Subtle waves
    ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 15; i++) {
        const y = waterLevel + 10 + Math.random() * (height - waterLevel - 20);
        const startX = Math.random() * width;
        const len = 50 + Math.random() * 100;
        ctx.beginPath();
        ctx.moveTo(startX, y);
        ctx.bezierCurveTo(startX + len / 3, y - 3, startX + (2 * len) / 3, y + 3, startX + len, y);
        ctx.stroke();
    }
}
function renderFerryLegend(ctx, x, y) {
    const items = [
        { label: "Location", color: "#BDBDBD" },
        { label: "Ferry", color: "#FF7043" },
        { label: "Car", color: "#42A5F5" },
    ];
    const boxWidth = 140;
    const boxHeight = items.length * 30 + 20;
    const padding = 10;
    const swatchWidth = 25;
    const swatchHeight = 15;
    const textOffsetX = 35;
    ctx.save();
    // Background box
    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.strokeStyle = "rgba(0, 0, 0, 0.4)";
    ctx.shadowColor = 'rgba(0,0,0,0.2)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 2;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(x, y, boxWidth, boxHeight, 8);
    ctx.fill();
    ctx.stroke();
    // Reset shadow for text and swatches
    ctx.shadowColor = 'transparent';
    ctx.font = "bold 13px Arial";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    items.forEach((item, i) => {
        const itemY = y + padding + i * 30 + 10;
        ctx.fillStyle = item.color;
        ctx.fillRect(x + padding, itemY - swatchHeight / 2, swatchWidth, swatchHeight);
        ctx.strokeStyle = "rgba(0,0,0,0.3)";
        ctx.strokeRect(x + padding, itemY - swatchHeight / 2, swatchWidth, swatchHeight);
        ctx.fillStyle = "#333";
        ctx.fillText(item.label, x + padding + textOffsetX, itemY);
    });
    ctx.restore();
}
