// ─── Color palettes ───────────────────────────────────────────────────────────
const CITY_COLORS = [
    "#2E86AB", // steel blue
    "#1B6CA8", // deep blue
    "#17879C", // teal blue
    "#0D6986", // dark teal
    "#3A7CA5", // medium blue
    "#1F5673", // navy
    "#2196A6", // cerulean
    "#126E82", // dark cerulean
];
const AIRCRAFT_COLORS = [
    "#E8A838", // amber
    "#D4881E", // dark amber
    "#F0B429", // golden
    "#C97A15", // burnt orange
    "#F5C542", // yellow gold
    "#E09B20", // honey
];
const PERSON_COLORS = [
    "#6DC16D", // medium green
    "#4CAF50", // green
    "#43A047", // darker green
    "#388E3C", // deep green
    "#2E7D32", // forest green
    "#81C784", // light green
    "#66BB6A", // soft green
    "#558B2F", // olive green
];
function hashId(id) {
    let h = 0;
    for (let i = 0; i < id.length; i++) {
        h = (h * 31 + id.charCodeAt(i)) >>> 0;
    }
    return h;
}
function colorForCity(id) {
    return CITY_COLORS[hashId(id) % CITY_COLORS.length];
}
function colorForAircraft(id) {
    return AIRCRAFT_COLORS[hashId(id) % AIRCRAFT_COLORS.length];
}
function colorForPerson(id) {
    return PERSON_COLORS[hashId(id) % PERSON_COLORS.length];
}
// ─── Label helpers ────────────────────────────────────────────────────────────
function makeLabel(id) {
    if (id.length === 1)
        return id.toUpperCase();
    const match = id.match(/^([a-zA-Z]+?)[\s_-]?(\d+)$/);
    if (match) {
        const prefix = match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase();
        return `${prefix} ${match[2]}`;
    }
    const matchLetter = id.match(/^([a-zA-Z]+?)[\s_-]?([a-zA-Z])$/);
    if (matchLetter && matchLetter[1].length >= 2) {
        const prefix = matchLetter[1].charAt(0).toUpperCase() + matchLetter[1].slice(1).toLowerCase();
        return `${prefix} ${matchLetter[2].toUpperCase()}`;
    }
    return id.charAt(0).toUpperCase() + id.slice(1);
}
// ─── Canvas constants ─────────────────────────────────────────────────────────
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const CITY_REGION_TOP = 60;
const CITY_REGION_BOTTOM = 520;
const CITY_BOX_WIDTH = 130;
const CITY_BOX_HEIGHT = 200;
const AIRCRAFT_OFFSET_Y = 30;
const PERSON_OFFSET_Y = 80;
const PERSON_SIZE = 22;
const AIRCRAFT_SIZE = 36;
const CITY_LABEL_OFFSET_Y = 20;
// ─── Main transformer ─────────────────────────────────────────────────────────
function transformZenotravel(raw) {
    // Collect objects by type
    const cities = raw.objects.filter((o) => o.type === "city").sort((a, b) => a.id.localeCompare(b.id));
    const aircraft = raw.objects.filter((o) => o.type === "aircraft").sort((a, b) => a.id.localeCompare(b.id));
    const persons = raw.objects.filter((o) => o.type === "person").sort((a, b) => a.id.localeCompare(b.id));
    // ── Build relation maps ──────────────────────────────────────────────────────
    // at[objId] = cityId
    const atMap = {};
    // in[personId] = aircraftId
    const inMap = {};
    for (const rel of raw.relations) {
        if (rel.type === "at" && rel.target) {
            atMap[rel.source] = rel.target;
        }
        else if (rel.type === "in" && rel.target) {
            inMap[rel.source] = rel.target;
        }
    }
    // ── Compute city positions ───────────────────────────────────────────────────
    // Cities are distributed evenly in a grid-like layout across the canvas.
    // We try to lay them out in rows: up to 4 per row, centered horizontally.
    const numCities = cities.length;
    const cityPositions = {};
    if (numCities > 0) {
        const cols = Math.min(numCities, 4);
        const rows = Math.ceil(numCities / cols);
        const colSpacing = (CANVAS_WIDTH - 80) / cols;
        const rowSpacing = (CITY_REGION_BOTTOM - CITY_REGION_TOP) / (rows + 0);
        cities.forEach((city, idx) => {
            const col = idx % cols;
            const row = Math.floor(idx / cols);
            const cx = 40 + colSpacing * col + colSpacing / 2;
            const cy = CITY_REGION_TOP + rowSpacing * row + rowSpacing / 2;
            cityPositions[city.id] = [cx, cy];
        });
    }
    // ── Compute aircraft positions ───────────────────────────────────────────────
    // Aircraft at a city appear above the city's center.
    // Multiple aircraft at the same city are spread horizontally.
    // Group aircraft by their current city (or "airborne" if not at any city)
    const aircraftAtCity = {};
    const airborneAircraft = [];
    for (const ac of aircraft) {
        const city = atMap[ac.id];
        if (city) {
            if (!aircraftAtCity[city])
                aircraftAtCity[city] = [];
            aircraftAtCity[city].push(ac.id);
        }
        else {
            airborneAircraft.push(ac.id);
        }
    }
    const aircraftPositions = {};
    for (const [cityId, acs] of Object.entries(aircraftAtCity)) {
        const [cx, cy] = cityPositions[cityId] || [CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2];
        const count = acs.length;
        acs.forEach((acId, i) => {
            const offsetX = count > 1 ? (i - (count - 1) / 2) * (AIRCRAFT_SIZE + 10) : 0;
            aircraftPositions[acId] = [cx + offsetX, cy - AIRCRAFT_OFFSET_Y - CITY_BOX_HEIGHT / 4];
        });
    }
    // Airborne aircraft get a position near the top center, spaced horizontally
    airborneAircraft.forEach((acId, i) => {
        const x = 80 + i * ((CANVAS_WIDTH - 160) / Math.max(airborneAircraft.length, 1));
        aircraftPositions[acId] = [Math.min(Math.max(x, 40), 760), 40];
    });
    // ── Compute person positions ─────────────────────────────────────────────────
    // Persons at a city appear inside/below the city box.
    // Persons inside an aircraft appear beside their aircraft.
    const personsAtCity = {};
    const personsInAircraft = {};
    for (const p of persons) {
        const city = atMap[p.id];
        const ac = inMap[p.id];
        if (city) {
            if (!personsAtCity[city])
                personsAtCity[city] = [];
            personsAtCity[city].push(p.id);
        }
        else if (ac) {
            if (!personsInAircraft[ac])
                personsInAircraft[ac] = [];
            personsInAircraft[ac].push(p.id);
        }
    }
    const personPositions = {};
    for (const [cityId, pids] of Object.entries(personsAtCity)) {
        const [cx, cy] = cityPositions[cityId] || [CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2];
        const count = pids.length;
        pids.forEach((pid, i) => {
            const offsetX = count > 1 ? (i - (count - 1) / 2) * (PERSON_SIZE + 6) : 0;
            personPositions[pid] = [
                Math.min(Math.max(cx + offsetX, 25), 775),
                cy + PERSON_OFFSET_Y / 2,
            ];
        });
    }
    for (const [acId, pids] of Object.entries(personsInAircraft)) {
        const [ax, ay] = aircraftPositions[acId] || [CANVAS_WIDTH / 2, 80];
        const count = pids.length;
        pids.forEach((pid, i) => {
            const offsetX = count > 1 ? (i - (count - 1) / 2) * (PERSON_SIZE + 6) : 0;
            personPositions[pid] = [
                Math.min(Math.max(ax + offsetX, 25), 775),
                ay + AIRCRAFT_SIZE + 10,
            ];
        });
    }
    // Fallback for persons with no known location
    persons.forEach((p, i) => {
        if (!personPositions[p.id]) {
            const x = 60 + i * ((CANVAS_WIDTH - 120) / Math.max(persons.length, 1));
            personPositions[p.id] = [Math.min(Math.max(x, 25), 775), CANVAS_HEIGHT - 40];
        }
    });
    // ── Build VisualObjects ──────────────────────────────────────────────────────
    const visualObjects = [];
    // Cities — rendered as boxes
    for (const city of cities) {
        const [cx, cy] = cityPositions[city.id] || [CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2];
        visualObjects.push({
            id: city.id,
            type: "city",
            label: makeLabel(city.id),
            position: [cx, cy],
            properties: {
                color: colorForCity(city.id),
                width: CITY_BOX_WIDTH,
                height: CITY_BOX_HEIGHT,
                zIndex: 0,
                status: "location",
            },
        });
    }
    // Aircraft
    for (const ac of aircraft) {
        const [ax, ay] = aircraftPositions[ac.id] || [CANVAS_WIDTH / 2, 80];
        const currentCity = atMap[ac.id] || null;
        const onboard = personsInAircraft[ac.id] || [];
        visualObjects.push({
            id: ac.id,
            type: "aircraft",
            label: makeLabel(ac.id),
            position: [ax, ay],
            properties: {
                color: colorForAircraft(ac.id),
                size: AIRCRAFT_SIZE,
                width: AIRCRAFT_SIZE + 20,
                height: AIRCRAFT_SIZE,
                zIndex: 2,
                atCity: currentCity,
                passengers: onboard.length,
                status: currentCity ? `at ${makeLabel(currentCity)}` : "in-flight",
            },
        });
    }
    // Persons
    for (const person of persons) {
        const [px, py] = personPositions[person.id] || [CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2];
        const currentCity = atMap[person.id] || null;
        const currentAircraft = inMap[person.id] || null;
        let status = "unknown";
        if (currentCity)
            status = `at ${makeLabel(currentCity)}`;
        else if (currentAircraft)
            status = `in ${makeLabel(currentAircraft)}`;
        visualObjects.push({
            id: person.id,
            type: "person",
            label: makeLabel(person.id),
            position: [px, py],
            properties: {
                color: colorForPerson(person.id),
                size: PERSON_SIZE,
                width: PERSON_SIZE,
                height: PERSON_SIZE + 10,
                zIndex: 3,
                atCity: currentCity,
                inAircraft: currentAircraft,
                status,
            },
        });
    }
    // ── Build VisualRelations ────────────────────────────────────────────────────
    const visualRelations = raw.relations.map((rel) => ({
        type: rel.type,
        source: rel.source,
        target: rel.target,
        properties: rel.properties,
    }));
    return {
        domain: raw.domain,
        objects: visualObjects,
        relations: visualRelations,
        metadata: raw.metadata,
    };
}
