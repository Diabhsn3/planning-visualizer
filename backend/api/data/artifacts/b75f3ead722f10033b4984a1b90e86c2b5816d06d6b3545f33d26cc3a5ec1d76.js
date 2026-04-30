function renderMiconic(ctx, state) {
    const objects = [...state.objects].sort((a, b) => {
        const za = a.properties?.zIndex ?? 0;
        const zb = b.properties?.zIndex ?? 0;
        return za - zb;
    });
    const drawPassenger = (ctx, x, y, size, color, label, destination, status, alpha = 1.0) => {
        ctx.save();
        ctx.globalAlpha = alpha;
        const headRadius = size * 0.2;
        const headY = y - size * 0.2;
        const bodyY = y;
        // Body
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, headY, headRadius, 0, Math.PI * 2);
        ctx.fill();
        // Rounded rectangle for torso
        const bodyWidth = size * 0.5;
        const bodyHeight = size * 0.4;
        const bodyX = x - bodyWidth / 2;
        const cornerRadius = size * 0.1;
        ctx.beginPath();
        ctx.moveTo(bodyX + cornerRadius, bodyY);
        ctx.arcTo(bodyX + bodyWidth, bodyY, bodyX + bodyWidth, bodyY + bodyHeight, cornerRadius);
        ctx.arcTo(bodyX + bodyWidth, bodyY + bodyHeight, bodyX, bodyY + bodyHeight, cornerRadius);
        ctx.arcTo(bodyX, bodyY + bodyHeight, bodyX, bodyY, cornerRadius);
        ctx.arcTo(bodyX, bodyY, bodyX + bodyWidth, bodyY, cornerRadius);
        ctx.closePath();
        ctx.fill();
        // Text labels
        ctx.fillStyle = `rgba(0, 0, 0, ${alpha * 0.9})`;
        ctx.font = "bold 10px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        ctx.fillText(label, x, y - size * 0.5);
        if (status !== 'served') {
            ctx.font = "9px Arial";
            ctx.textBaseline = "top";
            ctx.fillStyle = `rgba(0, 0, 0, ${alpha * 0.7})`;
            ctx.fillText(`→ ${destination}`, x, y + size * 0.45);
        }
        ctx.restore();
    };
    for (const obj of objects) {
        if (!obj.position)
            continue;
        const [x, y] = obj.position;
        const props = obj.properties ?? {};
        ctx.save();
        switch (obj.type) {
            case 'floor':
                ctx.fillStyle = props.color ?? '#9E9E9E';
                ctx.fillRect(x - props.width / 2, y - props.height / 2, props.width, props.height);
                ctx.fillStyle = '#444';
                ctx.font = 'bold 14px Arial';
                ctx.textAlign = 'right';
                ctx.textBaseline = 'middle';
                ctx.fillText(obj.label, x - props.width / 2 - 15, y);
                break;
            case 'lift':
                ctx.fillStyle = props.color ?? '#F44336';
                ctx.strokeStyle = 'rgba(0,0,0,0.3)';
                ctx.lineWidth = 2;
                ctx.fillRect(x - props.width / 2, y - props.height, props.width, props.height);
                ctx.strokeRect(x - props.width / 2, y - props.height, props.width, props.height);
                // Lift cable
                ctx.strokeStyle = '#555';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.moveTo(x, y - props.height);
                ctx.lineTo(x, 0);
                ctx.stroke();
                break;
            case 'passenger':
                drawPassenger(ctx, x, y, 30, // Corresponds to PASSENGER_SIZE from transformer
                props.color ?? '#3498DB', obj.label, props.destination ?? '?', props.status ?? 'unknown', props.alpha ?? 1.0);
                break;
        }
        ctx.restore();
    }
}
function renderMiconicBackground(ctx, width, height) {
    // Background gradient
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, '#e9f2f9');
    gradient.addColorStop(1, '#d0e0ed');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    // Constants from transformer for alignment
    const BUILDING_X = 250;
    const LIFT_WIDTH = 100;
    const WAITING_AREA_X = 450;
    const SERVED_AREA_X = 700;
    // Elevator Shaft
    const shaftWidth = LIFT_WIDTH + 10;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
    ctx.fillRect(BUILDING_X - shaftWidth / 2, 0, shaftWidth, height);
    // Area dividers and labels
    const topMargin = 40;
    const labelFont = 'bold 16px Arial';
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.15)';
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
    // Building/Shaft Area
    ctx.font = labelFont;
    ctx.textAlign = 'center';
    ctx.fillText('BUILDING', BUILDING_X, topMargin);
    // Waiting Area
    const waitingDividerX = (BUILDING_X + LIFT_WIDTH / 2 + WAITING_AREA_X) / 2;
    ctx.beginPath();
    ctx.moveTo(waitingDividerX, topMargin + 20);
    ctx.lineTo(waitingDividerX, height - 20);
    ctx.stroke();
    ctx.fillText('WAITING AREA', (waitingDividerX + SERVED_AREA_X - 100) / 2, topMargin);
    // Served Area
    const servedDividerX = (SERVED_AREA_X - 50 + WAITING_AREA_X + 100) / 2 + 10;
    ctx.beginPath();
    ctx.moveTo(servedDividerX, topMargin + 20);
    ctx.lineTo(servedDividerX, height - 20);
    ctx.stroke();
    ctx.fillText('SERVED', (servedDividerX + width) / 2, topMargin);
    ctx.setLineDash([]);
}
function renderMiconicLegend(ctx, x, y) {
    const startY = y + 20;
    const itemHeight = 45;
    const padding = 10;
    const textOffsetX = 35;
    ctx.font = "bold 12px Arial";
    ctx.fillStyle = "#333";
    ctx.fillText("Legend", x, y);
    const drawPassenger = (ctx, px, py, size, color) => {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(px, py - size * 0.15, size * 0.25, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(px - size * 0.25, py, size * 0.5, size * 0.4);
    };
    // Passenger
    let currentY = startY;
    drawPassenger(ctx, x + 15, currentY + 10, 20, '#3498DB');
    ctx.fillStyle = "#333";
    ctx.font = "11px Arial";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText("Passenger", x + textOffsetX, currentY + 10);
    ctx.font = "10px Arial";
    ctx.fillStyle = "#666";
    ctx.fillText("Label -> Destination", x + textOffsetX, currentY + 22);
    // Lift
    currentY += itemHeight;
    ctx.fillStyle = '#F44336';
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 1;
    ctx.fillRect(x + 5, currentY, 20, 25);
    ctx.strokeRect(x + 5, currentY, 20, 25);
    ctx.fillStyle = "#333";
    ctx.font = "11px Arial";
    ctx.fillText("Lift", x + textOffsetX, currentY + 12.5);
    // Floor
    currentY += itemHeight - 10;
    ctx.fillStyle = '#9E9E9E';
    ctx.fillRect(x, currentY + 12, 30, 3);
    ctx.fillStyle = "#333";
    ctx.font = "11px Arial";
    ctx.fillText("Floor", x + textOffsetX, currentY + 12.5);
    // Served Passenger
    currentY += itemHeight - 10;
    ctx.globalAlpha = 0.5;
    drawPassenger(ctx, x + 15, currentY + 10, 20, '#E74C3C');
    ctx.globalAlpha = 1.0;
    ctx.fillStyle = "#333";
    ctx.font = "11px Arial";
    ctx.fillText("Served (Completed)", x + textOffsetX, currentY + 12.5);
}
