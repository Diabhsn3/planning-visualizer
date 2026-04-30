const OBJECT_COLORS = ["#FF6B6B", "#4ECDC4", "#45B7D1", "#FFA07A", "#98D8C8", "#F7DC6F", "#BB8FCE", "#85C1E2", "#F39C12", "#2ECC71", "#E74C3C", "#3498DB"];
function getColor(id) {
    const lower = id.toLowerCase();
    let index = lower.length === 1 && lower >= "a" && lower <= "z"
        ? lower.charCodeAt(0) - 97
        : lower.split("").reduce((s, c) => s + c.charCodeAt(0), 0);
    return OBJECT_COLORS[index % OBJECT_COLORS.length];
}
function makeLabel(id) {
    if (id.length === 1)
        return id.toUpperCase();
    const m = id.match(/^([a-zA-Z_-]+?)[\s_-]?(\d+|[A-Z])$/);
    if (m) {
        const prefix = m[1].charAt(0).toUpperCase() + m[1].slice(1).toLowerCase();
        return `${prefix} ${m[2]}`;
    }
    return id.charAt(0).toUpperCase() + id.slice(1);
}
function transformZeno(raw) {
    const people = raw.objects.filter(o => o.type === 'person').sort((a, b) => a.id.localeCompare(b.id));
    const aircrafts = raw.objects.filter(o => o.type === 'aircraft').sort((a, b) => a.id.localeCompare(b.id));
    const cities = raw.objects.filter(o => o.type === 'city').sort((a, b) => a.id.localeCompare(b.id));
    const at = {}; // { objectId -> cityId }
    const inAircraft = {}; // { personId -> aircraftId }
    const aircraftContents = {}; // { aircraftId -> [personId, ...] }
    for (const rel of raw.relations) {
        if (rel.type === 'at' && rel.target) {
            at[rel.source] = rel.target;
        }
        else if (rel.type === 'in' && rel.target) {
            inAircraft[rel.source] = rel.target;
            if (!aircraftContents[rel.target]) {
                aircraftContents[rel.target] = [];
            }
            aircraftContents[rel.target].push(rel.source);
        }
    }
    // Sort passengers for deterministic layout
    Object.values(aircraftContents).forEach(passengers => passengers.sort());
    const positions = {};
    const visualObjects = [];
    const CANVAS_WIDTH = 800;
    const CANVAS_HEIGHT = 600;
    // 1. Layout cities in a grid
    const numCities = cities.length;
    const cols = numCities > 0 ? Math.ceil(Math.sqrt(numCities)) : 1;
    const rows = numCities > 0 ? Math.ceil(numCities / cols) : 1;
    const cellWidth = CANVAS_WIDTH / cols;
    const cellHeight = CANVAS_HEIGHT / rows;
    const cityWidth = cellWidth * 0.9;
    const cityHeight = cellHeight * 0.8;
    cities.forEach((city, i) => {
        const row = Math.floor(i / cols);
        const col = i % cols;
        const cx = col * cellWidth + cellWidth / 2;
        const cy = row * cellHeight + cellHeight / 2;
        positions[city.id] = [cx, cy];
        visualObjects.push({
            id: city.id,
            type: 'city',
            label: makeLabel(city.id),
            position: [cx, cy],
            properties: {
                color: '#EEEEEE',
                width: cityWidth,
                height: cityHeight,
                zIndex: 0,
                shape: 'rectangle',
                labelPosition: 'top'
            }
        });
        // 2. Layout objects within each city
        const cityAircrafts = aircrafts.filter(a => at[a.id] === city.id);
        const unboardedPeople = people.filter(p => at[p.id] === city.id);
        const topLevelItems = [...cityAircrafts, ...unboardedPeople];
        const itemCount = topLevelItems.length;
        const itemRegionWidth = cityWidth * 0.9;
        const itemSpacing = itemCount > 1 ? itemRegionWidth / (itemCount - 1) : 0;
        const startX = cx - itemRegionWidth / 2;
        topLevelItems.forEach((item, j) => {
            const itemX = itemCount > 1 ? startX + j * itemSpacing : cx;
            const itemY = cy - cityHeight * 0.1;
            positions[item.id] = [itemX, itemY];
            // If it's an aircraft, layout its passengers below it
            if (item.type === 'aircraft') {
                const passengers = aircraftContents[item.id] || [];
                const passengerCount = passengers.length;
                const passengerRegionWidth = Math.min(60, itemSpacing > 0 ? itemSpacing : 60);
                const passengerSpacing = passengerCount > 1 ? passengerRegionWidth / (passengerCount - 1) : 0;
                const passengerStartX = itemX - passengerRegionWidth / 2;
                const passengerY = itemY + 35;
                passengers.forEach((passengerId, k) => {
                    const passengerX = passengerCount > 1 ? passengerStartX + k * passengerSpacing : itemX;
                    positions[passengerId] = [passengerX, passengerY];
                });
            }
        });
    });
    // 3. Create VisualObjects for aircraft and people
    aircrafts.forEach(aircraft => {
        const cityId = at[aircraft.id];
        visualObjects.push({
            id: aircraft.id,
            type: 'aircraft',
            label: makeLabel(aircraft.id),
            position: positions[aircraft.id] || [50, 50],
            properties: {
                color: getColor(aircraft.id),
                location: cityId ? makeLabel(cityId) : "In Flight",
                zIndex: 2,
                shape: 'triangle'
            }
        });
    });
    people.forEach(person => {
        const locationId = at[person.id] || inAircraft[person.id];
        const locationType = at[person.id] ? 'city' : 'aircraft';
        visualObjects.push({
            id: person.id,
            type: 'person',
            label: makeLabel(person.id),
            position: positions[person.id] || [50, 100],
            properties: {
                color: getColor(person.id),
                location: locationId ? makeLabel(locationId) : "Unknown",
                locationType: locationType,
                zIndex: 3,
                shape: 'circle'
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
