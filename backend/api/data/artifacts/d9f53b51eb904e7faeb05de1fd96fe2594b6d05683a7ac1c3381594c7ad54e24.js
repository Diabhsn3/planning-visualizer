const CAR_COLORS = ["#EF5350", "#EC407A", "#AB47BC", "#7E57C2", "#5C6BC0", "#42A5F5", "#29B6F6", "#26C6DA", "#26A69A", "#66BB6A"];
const FERRY_COLORS = ["#FF7043", "#FFA726", "#FFCA28", "#FFEE58", "#D4E157", "#9CCC65", "#66BB6A", "#26A69A"];
const LOCATION_COLOR = "#BDBDBD"; // Grey for docks/land
function getDeterministicIndex(id) {
    return id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
}
function getColor(id, type) {
    const index = getDeterministicIndex(id);
    if (type === 'car')
        return CAR_COLORS[index % CAR_COLORS.length];
    if (type === 'ferry')
        return FERRY_COLORS[index % FERRY_COLORS.length];
    return LOCATION_COLOR;
}
function makeLabel(id) {
    const m = id.match(/^([a-zA-Z_-]+?)[\s_-]?(\d+)$/);
    if (m) {
        const name = m[1].charAt(0).toUpperCase() + m[1].slice(1).toLowerCase();
        return `${name} ${m[2]}`;
    }
    return id.charAt(0).toUpperCase() + id.slice(1);
}
const CAR_SIZE = { width: 60, height: 35 };
const FERRY_SIZE = { width: 120, height: 50 };
const LOCATION_Y_BASE = 530;
const DOCK_Y = 480;
const PARKING_Y_START = 420;
function transformFerry(raw) {
    const locations = raw.objects.filter(o => o.type === 'location').sort((a, b) => a.id.localeCompare(b.id));
    const cars = raw.objects.filter(o => o.type === 'car').sort((a, b) => a.id.localeCompare(b.id));
    const ferries = raw.objects.filter(o => o.type === 'ferry').sort((a, b) => a.id.localeCompare(b.id));
    const at = {}; // objId -> locId
    const on = {}; // carId -> ferryId
    const emptyFerries = new Set();
    for (const rel of raw.relations) {
        if (rel.type === 'at' && rel.target)
            at[rel.source] = rel.target;
        else if (rel.type === 'on' && rel.target)
            on[rel.source] = rel.target;
        else if (rel.type === 'empty')
            emptyFerries.add(rel.source);
    }
    const visualObjects = [];
    const locationPositions = {};
    const numLocations = locations.length;
    const zoneWidth = 800 / Math.max(1, numLocations);
    // 1. Create and position locations (docks)
    locations.forEach((loc, i) => {
        const x = zoneWidth / 2 + i * zoneWidth;
        const y = LOCATION_Y_BASE;
        locationPositions[loc.id] = [x, y];
        visualObjects.push({
            id: loc.id,
            type: 'location',
            label: makeLabel(loc.id),
            position: [x, y],
            properties: {
                color: LOCATION_COLOR,
                width: zoneWidth,
                height: 140,
                zIndex: 0,
            }
        });
    });
    // 2. Create and position ferries
    const ferryPositions = {};
    ferries.forEach(ferry => {
        const locId = at[ferry.id];
        let position = [400, 100]; // Default floating position if not at a location
        if (locId && locationPositions[locId]) {
            const [locX] = locationPositions[locId];
            position = [locX, DOCK_Y];
        }
        ferryPositions[ferry.id] = position;
        visualObjects.push({
            id: ferry.id,
            type: 'ferry',
            label: makeLabel(ferry.id),
            position: position,
            properties: {
                color: getColor(ferry.id, 'ferry'),
                width: FERRY_SIZE.width,
                height: FERRY_SIZE.height,
                isEmpty: emptyFerries.has(ferry.id),
                zIndex: 2,
            }
        });
    });
    // 3. Create and position cars
    const carsAtLocationCount = {};
    cars.forEach(car => {
        let position;
        let zIndex = 1;
        const ferryId = on[car.id];
        const locId = at[car.id];
        if (ferryId && ferryPositions[ferryId]) {
            // Car is on a ferry
            const [ferryX, ferryY] = ferryPositions[ferryId];
            // Since a ferry can only hold one car in this domain, we can center it
            position = [ferryX, ferryY - FERRY_SIZE.height / 2 + 3];
            zIndex = 3;
        }
        else if (locId && locationPositions[locId]) {
            // Car is at a location (parked)
            const carIndex = carsAtLocationCount[locId] || 0;
            const [locX] = locationPositions[locId];
            const zoneStartX = locX - zoneWidth / 2;
            const carsPerRow = Math.max(1, Math.floor((zoneWidth - 20) / (CAR_SIZE.width + 10)));
            const row = Math.floor(carIndex / carsPerRow);
            const col = carIndex % carsPerRow;
            const carX = zoneStartX + 10 + CAR_SIZE.width / 2 + col * (CAR_SIZE.width + 10);
            const carY = PARKING_Y_START - row * (CAR_SIZE.height + 10);
            position = [carX, carY];
            carsAtLocationCount[locId] = carIndex + 1;
        }
        else {
            // Car is in transit (e.g., during board action). Place it off-screen.
            position = [-100, -100];
        }
        visualObjects.push({
            id: car.id,
            type: 'car',
            label: makeLabel(car.id),
            position: position,
            properties: {
                color: getColor(car.id, 'car'),
                width: CAR_SIZE.width,
                height: CAR_SIZE.height,
                isOnFerry: !!ferryId,
                atLocation: locId,
                zIndex: zIndex,
            }
        });
    });
    return {
        domain: raw.domain,
        objects: visualObjects,
        relations: raw.relations.map(r => ({ type: r.type, source: r.source, target: r.target, properties: r.properties })),
        metadata: raw.metadata,
    };
}
