function renderZeno(ctx, state) {
    const PERSON_RADIUS = 10;
    const AIRCRAFT_WIDTH = 30;
    const AIRCRAFT_HEIGHT = 30;
    const FONT_SIZE = 12;
    const LABEL_OFFSET_Y = 18;
    const drawRoundRect = (x, y, w, h, r) => {
        if (w < 2 * r)
            r = w / 2;
        if (h < 2 * r)
            r = h / 2;
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
    };
    const drawAircraft = (cx, cy, width, height) => {
        ctx.beginPath();
        ctx.moveTo(cx, cy - height / 2);
        ctx.lineTo(cx + width / 2, cy + height / 2);
        ctx.lineTo(cx - width / 2, cy + height / 2);
        ctx.closePath();
    };
    const sortedObjects = [...state.objects].sort((a, b) => {
        const zA = a.properties?.zIndex ?? 0;
        const zB = b.properties?.zIndex ?? 0;
        return zA - zB;
    });
    for (const obj of sortedObjects) {
        if (!obj.position)
            continue;
        const [x, y] = obj.position;
        switch (obj.type) {
            case 'city': {
                const { width = 200, height = 150, color = '#EEEEEE' } = obj.properties || {};
                const cornerRadius = 15;
                const rectX = x - width / 2;
                const rectY = y - height / 2;
                ctx.fillStyle = color;
                ctx.strokeStyle = '#CCCCCC';
                ctx.lineWidth = 2;
                drawRoundRect(rectX, rectY, width, height, cornerRadius);
                ctx.fill();
                ctx.stroke();
                ctx.fillStyle = '#555555';
                ctx.font = `bold ${FONT_SIZE + 4}px sans-serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'bottom';
                ctx.fillText(obj.label, x, rectY - 10);
                break;
            }
            case 'aircraft': {
                const { color = '#4ECDC4' } = obj.properties || {};
                ctx.fillStyle = color;
                ctx.strokeStyle = 'rgba(0,0,0,0.5)';
                ctx.lineWidth = 2;
                drawAircraft(x, y, AIRCRAFT_WIDTH, AIRCRAFT_HEIGHT);
                ctx.fill();
                ctx.stroke();
                ctx.fillStyle = '#333333';
                ctx.font = `${FONT_SIZE}px sans-serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'top';
                ctx.fillText(obj.label, x, y + LABEL_OFFSET_Y);
                break;
            }
            case 'person': {
                const { color = '#FF6B6B' } = obj.properties || {};
                ctx.beginPath();
                ctx.arc(x, y, PERSON_RADIUS, 0, 2 * Math.PI);
                ctx.fillStyle = color;
                ctx.strokeStyle = 'rgba(0,0,0,0.5)';
                ctx.lineWidth = 2;
                ctx.fill();
                ctx.stroke();
                ctx.fillStyle = '#333333';
                ctx.font = `${FONT_SIZE}px sans-serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'top';
                ctx.fillText(obj.label, x, y + LABEL_OFFSET_Y);
                break;
            }
        }
    }
}
function renderZenoBackground(ctx, width, height) {
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, '#e0f7fa');
    gradient.addColorStop(1, '#b2ebf2');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
}
function renderZenoLegend(ctx, x, y) {
    const boxWidth = 120;
    const boxHeight = 110;
    const cornerRadius = 8;
    const padding = 10;
    const itemHeight = 30;
    const symbolX = x + padding + 15;
    const labelX = x + padding + 40;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.2)';
    ctx.shadowBlur = 5;
    ctx.shadowOffsetY = 2;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + cornerRadius, y);
    ctx.arcTo(x + boxWidth, y, x + boxWidth, y + boxHeight, cornerRadius);
    ctx.arcTo(x + boxWidth, y + boxHeight, x, y + boxHeight, cornerRadius);
    ctx.arcTo(x, y + boxHeight, x, y, cornerRadius);
    ctx.arcTo(x, y, x + boxWidth, y, cornerRadius);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = '#333';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('Legend', x + padding, y + padding);
    const startY = y + padding + 25;
    ctx.font = '12px sans-serif';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 2;
    const cityY = startY;
    ctx.fillStyle = '#EEEEEE';
    ctx.strokeStyle = '#CCCCCC';
    ctx.fillRect(symbolX - 10, cityY - 8, 20, 16);
    ctx.strokeRect(symbolX - 10, cityY - 8, 20, 16);
    ctx.fillStyle = '#333';
    ctx.fillText('City', labelX, cityY);
    const aircraftY = cityY + itemHeight;
    ctx.fillStyle = '#4ECDC4';
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath();
    ctx.moveTo(symbolX, aircraftY - 8);
    ctx.lineTo(symbolX + 10, aircraftY + 7);
    ctx.lineTo(symbolX - 10, aircraftY + 7);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#333';
    ctx.fillText('Aircraft', labelX, aircraftY);
    const personY = aircraftY + itemHeight;
    ctx.fillStyle = '#FF6B6B';
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath();
    ctx.arc(symbolX, personY, 8, 0, 2 * Math.PI);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#333';
    ctx.fillText('Person', labelX, personY);
}
