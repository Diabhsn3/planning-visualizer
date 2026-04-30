// ─── Helpers ──────────────────────────────────────────────────────────────────
function roundRectZeno(ctx, x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
}
function drawAircraftIcon(ctx, cx, cy, size, color) {
    const s = size * 0.5;
    ctx.save();
    ctx.translate(cx, cy);
    // Shadow
    ctx.fillStyle = "rgba(0,0,0,0.18)";
    ctx.beginPath();
    ctx.ellipse(2, 3, s * 1.1, s * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();
    // Fuselage
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(0, 0, s * 1.1, s * 0.38, 0, 0, Math.PI * 2);
    ctx.fill();
    // Nose cone
    ctx.beginPath();
    ctx.moveTo(s * 1.1, 0);
    ctx.lineTo(s * 1.55, s * 0.12);
    ctx.lineTo(s * 1.55, -s * 0.12);
    ctx.closePath();
    ctx.fill();
    // Main wings
    ctx.beginPath();
    ctx.moveTo(-s * 0.1, -s * 0.1);
    ctx.lineTo(-s * 0.5, -s * 0.95);
    ctx.lineTo(s * 0.45, -s * 0.95);
    ctx.lineTo(s * 0.5, -s * 0.1);
    ctx.closePath();
    ctx.fill();
    // Tail wing
    ctx.beginPath();
    ctx.moveTo(-s * 0.75, -s * 0.1);
    ctx.lineTo(-s * 1.0, -s * 0.55);
    ctx.lineTo(-s * 0.5, -s * 0.55);
    ctx.lineTo(-s * 0.45, -s * 0.1);
    ctx.closePath();
    ctx.fill();
    // Highlight stripe
    ctx.strokeStyle = "rgba(255,255,255,0.45)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(0, -s * 0.1, s * 0.7, s * 0.18, 0, Math.PI * 1.1, Math.PI * 1.9);
    ctx.stroke();
    ctx.restore();
}
function drawPersonIcon(ctx, cx, cy, size, color) {
    const r = size * 0.42;
    ctx.save();
    ctx.translate(cx, cy);
    // Shadow
    ctx.fillStyle = "rgba(0,0,0,0.15)";
    ctx.beginPath();
    ctx.ellipse(1, r * 3.4, r * 0.9, r * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();
    // Body
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(-r * 0.9, r * 3.2);
    ctx.quadraticCurveTo(-r * 1.1, r * 1.8, -r * 0.6, r * 1.2);
    ctx.lineTo(r * 0.6, r * 1.2);
    ctx.quadraticCurveTo(r * 1.1, r * 1.8, r * 0.9, r * 3.2);
    ctx.closePath();
    ctx.fill();
    // Head
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    // Highlight on head
    ctx.fillStyle = "rgba(255,255,255,0.25)";
    ctx.beginPath();
    ctx.arc(-r * 0.3, -r * 0.3, r * 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
}
function drawCityBox(ctx, cx, cy, w, h, color, label) {
    const x = cx - w / 2;
    const y = cy - h / 2;
    // Drop shadow
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.18)";
    roundRectZeno(ctx, x + 4, y + 5, w, h, 14);
    ctx.fill();
    // Main box gradient
    const grad = ctx.createLinearGradient(x, y, x, y + h);
    grad.addColorStop(0, lightenColor(color, 30));
    grad.addColorStop(1, color);
    ctx.fillStyle = grad;
    roundRectZeno(ctx, x, y, w, h, 14);
    ctx.fill();
    // Border
    ctx.strokeStyle = darkenColor(color, 30);
    ctx.lineWidth = 2;
    roundRectZeno(ctx, x, y, w, h, 14);
    ctx.stroke();
    // Top stripe (header)
    const headerH = 28;
    ctx.save();
    ctx.clip();
    const headerGrad = ctx.createLinearGradient(x, y, x, y + headerH);
    headerGrad.addColorStop(0, "rgba(255,255,255,0.22)");
    headerGrad.addColorStop(1, "rgba(255,255,255,0.04)");
    ctx.fillStyle = headerGrad;
    ctx.fillRect(x, y, w, headerH);
    ctx.restore();
    // Building silhouette inside box (decorative)
    ctx.fillStyle = "rgba(255,255,255,0.07)";
    const bx = x + 10;
    const by = y + h - 50;
    for (let i = 0; i < 4; i++) {
        const bw = 14 + i * 4;
        const bh = 20 + i * 12;
        ctx.fillRect(bx + i * 22, by - bh + 50, bw, bh);
    }
    // Label
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 13px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "rgba(0,0,0,0.5)";
    ctx.shadowBlur = 3;
    ctx.fillText(label, cx, y + headerH / 2);
    ctx.shadowBlur = 0;
    ctx.restore();
}
function lightenColor(hex, amount) {
    const num = parseInt(hex.replace("#", ""), 16);
    const r = Math.min(255, (num >> 16) + amount);
    const g = Math.min(255, ((num >> 8) & 0xff) + amount);
    const b = Math.min(255, (num & 0xff) + amount);
    return `rgb(${r},${g},${b})`;
}
function darkenColor(hex, amount) {
    const num = parseInt(hex.replace("#", ""), 16);
    const r = Math.max(0, (num >> 16) - amount);
    const g = Math.max(0, ((num >> 8) & 0xff) - amount);
    const b = Math.max(0, (num & 0xff) - amount);
    return `rgb(${r},${g},${b})`;
}
// ─── Main Renderer ────────────────────────────────────────────────────────────
function renderZeno(ctx, state) {
    const W = 800;
    const H = 600;
    // Extract objects by type
    const cities = state.objects.filter((o) => o.type === "city");
    const aircraft = state.objects.filter((o) => o.type === "aircraft");
    const persons = state.objects.filter((o) => o.type === "person");
    // ── Draw city connection lines ──────────────────────────────────────────────
    // Draw faint dashed lines connecting all cities (route network)
    if (cities.length > 1) {
        ctx.save();
        ctx.setLineDash([5, 8]);
        ctx.strokeStyle = "rgba(180,200,220,0.35)";
        ctx.lineWidth = 1.5;
        for (let i = 0; i < cities.length; i++) {
            for (let j = i + 1; j < cities.length; j++) {
                const [x1, y1] = cities[i].position || [W / 2, H / 2];
                const [x2, y2] = cities[j].position || [W / 2, H / 2];
                ctx.beginPath();
                ctx.moveTo(x1, y1);
                ctx.lineTo(x2, y2);
                ctx.stroke();
            }
        }
        ctx.setLineDash([]);
        ctx.restore();
    }
    // ── Draw cities ─────────────────────────────────────────────────────────────
    for (const city of cities) {
        const [cx, cy] = city.position || [W / 2, H / 2];
        const w = (city.properties && city.properties.width) || 130;
        const h = (city.properties && city.properties.height) || 200;
        const color = (city.properties && city.properties.color) || "#2E86AB";
        drawCityBox(ctx, cx, cy, w, h, color, city.label);
    }
    // ── Draw aircraft flight lines (aircraft to city) ────────────────────────────
    for (const ac of aircraft) {
        const [ax, ay] = ac.position || [W / 2, 80];
        const atCity = ac.properties && ac.properties.atCity;
        if (!atCity) {
            // Aircraft is airborne — draw a small motion arc indicating flight
            ctx.save();
            ctx.strokeStyle = (ac.properties && ac.properties.color) || "#E8A838";
            ctx.lineWidth = 1.5;
            ctx.setLineDash([4, 6]);
            ctx.globalAlpha = 0.5;
            ctx.beginPath();
            ctx.moveTo(ax - 30, ay + 10);
            ctx.quadraticCurveTo(ax, ay - 20, ax + 30, ay + 10);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.restore();
        }
    }
    // ── Draw persons inside aircraft (connection lines) ───────────────────────────
    for (const person of persons) {
        const inAircraft = person.properties && person.properties.inAircraft;
        if (inAircraft) {
            const acObj = aircraft.find((a) => a.id === inAircraft);
            if (acObj) {
                const [px, py] = person.position || [W / 2, H / 2];
                const [ax, ay] = acObj.position || [W / 2, 80];
                const acSize = (acObj.properties && acObj.properties.size) || 36;
                ctx.save();
                ctx.strokeStyle = "rgba(109,193,109,0.4)";
                ctx.lineWidth = 1.2;
                ctx.setLineDash([3, 5]);
                ctx.beginPath();
                ctx.moveTo(px, py);
                ctx.lineTo(ax, ay + acSize * 0.3);
                ctx.stroke();
                ctx.setLineDash([]);
                ctx.restore();
            }
        }
    }
    // ── Draw aircraft ────────────────────────────────────────────────────────────
    for (const ac of aircraft) {
        const [ax, ay] = ac.position || [W / 2, 80];
        const color = (ac.properties && ac.properties.color) || "#E8A838";
        const size = (ac.properties && ac.properties.size) || 36;
        const passengers = (ac.properties && ac.properties.passengers) || 0;
        drawAircraftIcon(ctx, ax, ay, size, color);
        // Aircraft label
        ctx.fillStyle = "#1a1a2e";
        ctx.font = "bold 11px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.shadowColor = "rgba(255,255,255,0.8)";
        ctx.shadowBlur = 3;
        ctx.fillText(ac.label, ax, ay + size * 0.6);
        ctx.shadowBlur = 0;
        // Passenger count badge (if any)
        if (passengers > 0) {
            const badgeX = ax + size * 0.55;
            const badgeY = ay - size * 0.55;
            const badgeR = 9;
            ctx.fillStyle = "#E53935";
            ctx.beginPath();
            ctx.arc(badgeX, badgeY, badgeR, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = "#ffffff";
            ctx.font = "bold 9px Arial";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(String(passengers), badgeX, badgeY);
        }
        // Status label
        const status = (ac.properties && ac.properties.status) || "";
        if (status) {
            ctx.fillStyle = "rgba(30,30,60,0.65)";
            ctx.font = "10px Arial";
            ctx.textAlign = "center";
            ctx.textBaseline = "top";
            ctx.fillText(status, ax, ay + size * 0.6 + 14);
        }
    }
    // ── Draw persons ─────────────────────────────────────────────────────────────
    for (const person of persons) {
        const [px, py] = person.position || [W / 2, H / 2];
        const color = (person.properties && person.properties.color) || "#4CAF50";
        const size = (person.properties && person.properties.size) || 22;
        drawPersonIcon(ctx, px, py, size * 0.5, color);
        // Person label
        ctx.fillStyle = "#1a1a2e";
        ctx.font = "bold 10px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.shadowColor = "rgba(255,255,255,0.85)";
        ctx.shadowBlur = 3;
        ctx.fillText(person.label, px, py + size * 1.2);
        ctx.shadowBlur = 0;
    }
    // ── Draw "IN FLIGHT" label for airborne aircraft ──────────────────────────────
    const airborneAircraft = aircraft.filter((ac) => !(ac.properties && ac.properties.atCity));
    if (airborneAircraft.length > 0) {
        ctx.save();
        ctx.fillStyle = "rgba(100,120,160,0.22)";
        roundRectZeno(ctx, 10, 5, 120, 22, 6);
        ctx.fill();
        ctx.fillStyle = "rgba(60,80,130,0.75)";
        ctx.font = "italic 11px Arial";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText("✈ In-flight zone", 18, 16);
        ctx.restore();
    }
}
// ─── Background ───────────────────────────────────────────────────────────────
function renderZenoBackground(ctx, width, height) {
    // Sky gradient
    const skyGrad = ctx.createLinearGradient(0, 0, 0, height * 0.72);
    skyGrad.addColorStop(0, "#c9dff5");
    skyGrad.addColorStop(0.5, "#ddeeff");
    skyGrad.addColorStop(1, "#eef5fb");
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, width, height);
    // Ground area at bottom
    const groundGrad = ctx.createLinearGradient(0, height * 0.72, 0, height);
    groundGrad.addColorStop(0, "#c8dfa8");
    groundGrad.addColorStop(1, "#a8c878");
    ctx.fillStyle = groundGrad;
    ctx.fillRect(0, height * 0.72, width, height * 0.28);
    // Horizon line
    ctx.strokeStyle = "rgba(100,160,80,0.45)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, height * 0.72);
    ctx.lineTo(width, height * 0.72);
    ctx.stroke();
    // Subtle cloud shapes
    function drawCloud(x, y, scale, alpha) {
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(x, y, 22 * scale, 0, Math.PI * 2);
        ctx.arc(x + 28 * scale, y - 8 * scale, 18 * scale, 0, Math.PI * 2);
        ctx.arc(x + 52 * scale, y, 22 * scale, 0, Math.PI * 2);
        ctx.arc(x + 26 * scale, y + 8 * scale, 16 * scale, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
    drawCloud(60, 55, 0.9, 0.55);
    drawCloud(260, 38, 0.7, 0.4);
    drawCloud(500, 62, 1.0, 0.5);
    drawCloud(680, 45, 0.75, 0.42);
    drawCloud(370, 28, 0.6, 0.35);
    // Faint grid lines on the ground to suggest terrain/map
    ctx.save();
    ctx.strokeStyle = "rgba(120,170,80,0.18)";
    ctx.lineWidth = 1;
    const groundTop = height * 0.72;
    const cols = 10;
    const colSpacing = width / cols;
    for (let i = 1; i < cols; i++) {
        ctx.beginPath();
        ctx.moveTo(i * colSpacing, groundTop);
        ctx.lineTo(i * colSpacing, height);
        ctx.stroke();
    }
    const rows = 4;
    const rowSpacing = (height - groundTop) / rows;
    for (let j = 1; j < rows; j++) {
        ctx.beginPath();
        ctx.moveTo(0, groundTop + j * rowSpacing);
        ctx.lineTo(width, groundTop + j * rowSpacing);
        ctx.stroke();
    }
    ctx.restore();
    // Title bar
    ctx.save();
    ctx.fillStyle = "rgba(20,60,110,0.12)";
    roundRectZeno(ctx, 0, 0, width, 28, 0);
    ctx.fill();
    ctx.fillStyle = "rgba(20,60,110,0.55)";
    ctx.font = "bold 13px Arial";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillText("Zeno Travel", width - 14, 14);
    ctx.restore();
}
// ─── Legend ───────────────────────────────────────────────────────────────────
function renderZenoLegend(ctx, x, y) {
    const items = [
        {
            label: "City",
            draw: () => {
                ctx.fillStyle = "#2E86AB";
                roundRectZeno(ctx, x + 4, y + 4, 20, 14, 3);
                ctx.fill();
                ctx.strokeStyle = "#1B6CA8";
                ctx.lineWidth = 1;
                roundRectZeno(ctx, x + 4, y + 4, 20, 14, 3);
                ctx.stroke();
            },
        },
        {
            label: "Aircraft",
            draw: () => {
                drawAircraftIcon(ctx, x + 14, y + 11, 18, "#E8A838");
            },
        },
        {
            label: "Person",
            draw: () => {
                drawPersonIcon(ctx, x + 14, y + 4, 11, "#4CAF50");
            },
        },
        {
            label: "Passenger badge = count on board",
            draw: () => {
                ctx.fillStyle = "#E53935";
                ctx.beginPath();
                ctx.arc(x + 14, y + 11, 7, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = "#fff";
                ctx.font = "bold 8px Arial";
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillText("2", x + 14, y + 11);
            },
        },
    ];
    const rowH = 28;
    const boxW = 220;
    const boxH = items.length * rowH + 12;
    // Background
    ctx.save();
    ctx.fillStyle = "rgba(255,255,255,0.88)";
    roundRectZeno(ctx, x, y - 6, boxW, boxH, 8);
    ctx.fill();
    ctx.strokeStyle = "rgba(100,140,180,0.4)";
    ctx.lineWidth = 1;
    roundRectZeno(ctx, x, y - 6, boxW, boxH, 8);
    ctx.stroke();
    items.forEach((item, i) => {
        const iy = y + i * rowH;
        item.draw();
        ctx.fillStyle = "#222244";
        ctx.font = "12px Arial";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText(item.label, x + 34, iy + 11);
    });
    ctx.restore();
}
