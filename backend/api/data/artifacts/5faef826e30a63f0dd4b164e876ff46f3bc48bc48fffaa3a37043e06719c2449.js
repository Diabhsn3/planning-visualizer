const PASSENGER_COLORS = ["#3498DB", "#E74C3C", "#2ECC71", "#F1C40F", "#9B59B6", "#1ABC9C", "#E67E22", "#34495E", "#D35400", "#2980B9"];
function getColor(id) {
    const code = id.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return PASSENGER_COLORS[code % PASSENGER_COLORS.length];
}
function makeLabel(id) {
    const match = id.match(/([a-zA-Z_-]+?)(\d+)/);
    if (match) {
        const name = match[1].charAt(0).toUpperCase() + match[1].slice(1);
        return `${name} ${match[2]}`;
    }
    return id.charAt(0).toUpperCase() + id.slice(1);
}
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const BUILDING_X = 250;
const LIFT_WIDTH = 100;
const FLOOR_WIDTH = 250;
const WAITING_AREA_X = 450;
const SERVED_AREA_X = 700;
const PASSENGER_SIZE = 30;
function transformMiconic(raw) {
    const passengers = raw.objects.filter(o => o.type === "passenger").sort((a, b) => a.id.localeCompare(b.id));
    const floors = raw.objects.filter(o => o.type === "floor");
    const above = {}; // key=lower_floor, val=upper_floor
    const origin = {}; // key=passenger, val=floor
    const destin = {}; // key=passenger, val=floor
    const boarded = new Set();
    const served = new Set();
    let liftAt = null;
    for (const rel of raw.relations) {
        switch (rel.type) {
            case "above":
                if (rel.source && rel.target)
                    above[rel.target] = rel.source;
                break;
            case "origin":
                if (rel.source && rel.target)
                    origin[rel.source] = rel.target;
                break;
            case "destin":
                if (rel.source && rel.target)
                    destin[rel.source] = rel.target;
                break;
            case "boarded":
                boarded.add(rel.source);
                break;
            case "served":
                served.add(rel.source);
                break;
            case "lift-at":
                liftAt = rel.source;
                break;
        }
    }
    const allUpperFloors = new Set(Object.values(above));
    const bottomFloor = floors.find(f => !allUpperFloors.has(f.id));
    const sortedFloors = [];
    if (bottomFloor) {
        let current = bottomFloor.id;
        while (current) {
            sortedFloors.push(current);
            current = above[current];
        }
    }
    else {
        floors.sort((a, b) => a.id.localeCompare(b.id)).forEach(f => sortedFloors.push(f.id));
    }
    const visualObjects = [];
    const floorPositions = {};
    const numFloors = sortedFloors.length;
    const topY = 80;
    const bottomY = CANVAS_HEIGHT - 80;
    const verticalGap = numFloors > 1 ? (bottomY - topY) / (numFloors - 1) : 0;
    sortedFloors.forEach((floorId, i) => {
        const y = bottomY - i * verticalGap;
        floorPositions[floorId] = { x: BUILDING_X, y };
        visualObjects.push({
            id: floorId,
            type: "floor",
            label: makeLabel(floorId),
            position: [BUILDING_X, y],
            properties: { color: "#9E9E9E", width: FLOOR_WIDTH, height: 4, zIndex: 1 },
        });
    });
    const liftY = liftAt && floorPositions[liftAt] ? floorPositions[liftAt].y : -100;
    const liftHeight = verticalGap > 0 ? verticalGap * 0.9 : 80;
    visualObjects.push({
        id: "__lift__",
        type: "lift",
        label: `Lift @ ${liftAt ? makeLabel(liftAt) : "Unknown"}`,
        position: [BUILDING_X, liftY],
        properties: { color: "#F44336", width: LIFT_WIDTH, height: liftHeight, zIndex: 5 },
    });
    const boardedPassengers = passengers.filter(p => boarded.has(p.id));
    boardedPassengers.forEach((p, i) => {
        const row = Math.floor(i / 2);
        const col = i % 2;
        visualObjects.push({
            id: p.id,
            type: "passenger",
            label: makeLabel(p.id),
            position: [BUILDING_X - LIFT_WIDTH / 4 + col * (LIFT_WIDTH / 2), liftY - liftHeight / 2 + 20 + row * (PASSENGER_SIZE + 5)],
            properties: { color: getColor(p.id), status: "boarded", destination: destin[p.id] ? makeLabel(destin[p.id]) : "?", zIndex: 10 },
        });
    });
    const servedPassengers = passengers.filter(p => served.has(p.id));
    servedPassengers.forEach((p, i) => {
        visualObjects.push({
            id: p.id,
            type: "passenger",
            label: makeLabel(p.id),
            position: [SERVED_AREA_X, topY + i * (PASSENGER_SIZE + 10)],
            properties: { color: getColor(p.id), status: "served", alpha: 0.5, zIndex: 10 },
        });
    });
    const waitingByFloor = {};
    passengers.forEach(p => {
        if (!boarded.has(p.id) && !served.has(p.id)) {
            const atFloor = origin[p.id];
            if (atFloor) {
                if (!waitingByFloor[atFloor])
                    waitingByFloor[atFloor] = [];
                waitingByFloor[atFloor].push(p);
            }
        }
    });
    Object.entries(waitingByFloor).forEach(([floorId, ps]) => {
        const floorPos = floorPositions[floorId];
        if (floorPos) {
            ps.forEach((p, i) => {
                const row = Math.floor(i / 3);
                const col = i % 3;
                visualObjects.push({
                    id: p.id,
                    type: "passenger",
                    label: makeLabel(p.id),
                    position: [WAITING_AREA_X + col * (PASSENGER_SIZE + 10), floorPos.y - PASSENGER_SIZE / 2 - row * (PASSENGER_SIZE + 5)],
                    properties: { color: getColor(p.id), status: "waiting", destination: destin[p.id] ? makeLabel(destin[p.id]) : "?", zIndex: 10 },
                });
            });
        }
    });
    return {
        domain: raw.domain,
        objects: visualObjects,
        relations: raw.relations.map(r => ({ ...r })),
        metadata: raw.metadata,
    };
}
