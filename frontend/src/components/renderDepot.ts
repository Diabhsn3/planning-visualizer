// ================= TYPES =================
export interface VisualObject {
  id: string;
  type: string;
  label: string;
  position?: [number, number];
  properties?: Record<string, any>;
}

export interface VisualRelation {
  type: string;
  source: string;
  target?: string;
}

export interface RenderedState {
  domain: string;
  objects: VisualObject[];
  relations: VisualRelation[];
}

// ================= ASSETS =================
const truckImg = new Image();
truckImg.src = "/truck.png";

// ================= MAIN =================
export function renderDepot(
  ctx: CanvasRenderingContext2D,
  state: RenderedState
) {
  const W = 800;

  // ---------- EXTRACT OBJECTS ----------
  const depots = state.objects.filter(o => o.type === "depot");
  const trucks = state.objects.filter(o => o.type === "truck");
  const cranes = state.objects.filter(o => o.type === "crane");
  const piles = state.objects.filter(o => o.type === "pile");
  const packages = state.objects.filter(o => o.type === "package");

  // ---------- EXTRACT RELATIONS ----------
  const truckAt = new Map<string, string>();       // truck -> depot
  const craneAt = new Map<string, string>();       // crane -> depot
  const pileAt = new Map<string, string>();        // pile -> depot
  const packageOnPile = new Map<string, string>(); // package -> pile
  const packageOn = new Map<string, string>();     // package -> package (stacking)
  const packageInTruck = new Map<string, string>(); // package -> truck
  const craneHolding = new Map<string, string>();  // crane -> package

  for (const r of state.relations) {
    if (r.type === "at-truck" && r.target) {
      truckAt.set(r.source, r.target);
    } else if (r.type === "at-crane" && r.target) {
      craneAt.set(r.source, r.target);
    } else if (r.type === "at-pile" && r.target) {
      pileAt.set(r.source, r.target);
    } else if (r.type === "on-pile" && r.target) {
      packageOnPile.set(r.source, r.target);
    } else if (r.type === "on" && r.target) {
      packageOn.set(r.source, r.target);
    } else if (r.type === "in-truck" && r.target) {
      packageInTruck.set(r.source, r.target);
    } else if (r.type === "holding" && r.target) {
      craneHolding.set(r.source, r.target);
    }
  }

  // ---------- LAYOUT CONSTANTS ----------
  const CONTAINER_W = 45;
  const CONTAINER_H = 28;
  const PILE_HEIGHT = 12;
  const PILE_PADDING = 8;
  const MIN_PILE_WIDTH = 60;
  const DEPOT_PADDING = 20;
  const TRUCK_W = 70;
  const TRUCK_H = 40;
  const TRUCK_SPACING = 10;
  const PILE_SPACING = 15;
  const BOTTOM_AREA_HEIGHT = 90;
  const CRANE_AREA_HEIGHT = 90;
  const DEPOT_SPACING = 80;

  // ---------- ASSIGN PILES TO DEPOTS ----------
  const pilesPerDepot = new Map<string, VisualObject[]>();
  for (const depot of depots) {
    pilesPerDepot.set(depot.id, []);
  }
  
  piles.forEach((pile, index) => {
    const assignedDepot = pileAt.get(pile.id);
    if (assignedDepot && pilesPerDepot.has(assignedDepot)) {
      pilesPerDepot.get(assignedDepot)?.push(pile);
    } else {
      const depotIndex = index % depots.length;
      const depot = depots[depotIndex];
      if (depot) {
        pilesPerDepot.get(depot.id)?.push(pile);
      }
    }
  });

  // ---------- ASSIGN TRUCKS TO DEPOTS ----------
  const trucksPerDepot = new Map<string, VisualObject[]>();
  for (const depot of depots) {
    trucksPerDepot.set(depot.id, []);
  }
  
  trucks.forEach((truck) => {
    const assignedDepot = truckAt.get(truck.id);
    if (assignedDepot && trucksPerDepot.has(assignedDepot)) {
      trucksPerDepot.get(assignedDepot)?.push(truck);
    }
  });

  // ---------- CALCULATE PILE WIDTHS ----------
  const getPileWidth = (pileId: string): number => {
    let count = 0;
    for (const pkg of packages) {
      if (packageOnPile.get(pkg.id) === pileId) {
        count++;
      }
    }
    return Math.max(MIN_PILE_WIDTH, count * (CONTAINER_W + 5) + PILE_PADDING * 2);
  };

  // ---------- CALCULATE STACK HEIGHT for a package ----------
  const getStackHeight = (basePkgId: string): number => {
    let height = 1;
    let currentId = basePkgId;
    while (true) {
      let found = false;
      for (const pkg of packages) {
        if (packageOn.get(pkg.id) === currentId) {
          height++;
          currentId = pkg.id;
          found = true;
          break;
        }
      }
      if (!found) break;
    }
    return height;
  };

  // ---------- CALCULATE MAX STACK HEIGHT on a pile ----------
  const getMaxStackHeightOnPile = (pileId: string): number => {
    let maxHeight = 0;
    for (const pkg of packages) {
      if (packageOnPile.get(pkg.id) === pileId) {
        const stackHeight = getStackHeight(pkg.id);
        maxHeight = Math.max(maxHeight, stackHeight);
      }
    }
    return maxHeight;
  };

  // ---------- CALCULATE DEPOT DIMENSIONS ----------
  const depotDimensions = new Map<string, { width: number; height: number }>();
  
  for (const depot of depots) {
    const depotPilesList = pilesPerDepot.get(depot.id) || [];
    const depotTrucksList = trucksPerDepot.get(depot.id) || [];
    
    const trucksWidth = depotTrucksList.length > 0 
      ? depotTrucksList.length * TRUCK_W + (depotTrucksList.length - 1) * TRUCK_SPACING
      : 0;
    
    let totalPilesWidth = 0;
    let maxStackHeight = 0;
    
    for (const pile of depotPilesList) {
      totalPilesWidth += getPileWidth(pile.id);
      const stackHeight = getMaxStackHeightOnPile(pile.id);
      maxStackHeight = Math.max(maxStackHeight, stackHeight);
    }
    if (depotPilesList.length > 1) {
      totalPilesWidth += (depotPilesList.length - 1) * PILE_SPACING;
    }
    
    const spacingBetween = (trucksWidth > 0 && totalPilesWidth > 0) ? 20 : 0;
    const bottomContentWidth = trucksWidth + spacingBetween + totalPilesWidth;
    const depotWidth = Math.max(180, bottomContentWidth + DEPOT_PADDING * 2);
    
    const stackSpace = maxStackHeight * CONTAINER_H + 20;
    const depotHeight = CRANE_AREA_HEIGHT + stackSpace + BOTTOM_AREA_HEIGHT;
    
    depotDimensions.set(depot.id, { width: depotWidth, height: depotHeight });
  }

  // ---------- CALCULATE TOTAL WIDTH AND STARTING POSITION ----------
  let totalWidth = 0;
  for (const depot of depots) {
    const dim = depotDimensions.get(depot.id)!;
    totalWidth += dim.width;
  }
  totalWidth += (depots.length - 1) * DEPOT_SPACING;
  
  const START_X = Math.max(20, (W - totalWidth) / 2);
  const DEPOT_Y = 50;

  // ---------- BACKGROUND ----------
  // ctx.fillStyle = "#f8f9fa";
  // ctx.fillRect(0, 0, W, H);

  // ---------- DRAW EACH DEPOT ----------
  let currentX = START_X;
  
  depots.forEach((depot) => {
    const dim = depotDimensions.get(depot.id)!;
    const depotX = currentX;
    const depotY = DEPOT_Y;
    const depotWidth = dim.width;
    const depotHeight = dim.height;

    // === DEPOT BOX ===
    ctx.fillStyle = "#B0BEC5";
    ctx.fillRect(depotX, depotY, depotWidth, depotHeight);
    ctx.strokeStyle = "#78909C";
    ctx.lineWidth = 2;
    ctx.strokeRect(depotX, depotY, depotWidth, depotHeight);

    // Depot label at top
    ctx.fillStyle = "#37474F";
    ctx.font = "bold 18px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(depot.label.toUpperCase(), depotX + depotWidth / 2, depotY + 5);

    // === CRANE (Gripper style) at top ===
    const depotCranes = cranes.filter(c => craneAt.get(c.id) === depot.id);
    depotCranes.forEach((crane, craneIndex) => {
      const craneX = depotX + depotWidth / 2 + (craneIndex - (depotCranes.length - 1) / 2) * 60;
      const craneTopY = depotY + 30;
      
      const heldPkgId = craneHolding.get(crane.id);
      const heldPkg = heldPkgId ? packages.find(p => p.id === heldPkgId) : null;

      ctx.strokeStyle = "#455A64";
      ctx.lineWidth = 6;
      ctx.lineCap = "round";

      if (heldPkg) {
        const containerCenterX = craneX;
        const containerTopY = craneTopY + 40;
        const margin = 5;
        const leftX = containerCenterX - CONTAINER_W / 2 - margin;
        const rightX = containerCenterX + CONTAINER_W / 2 + margin;
        const topBarY = containerTopY - 6;
        const bottomY = containerTopY + CONTAINER_H;

        ctx.beginPath();
        ctx.moveTo(craneX, craneTopY);
        ctx.lineTo(craneX, topBarY);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(leftX, topBarY);
        ctx.lineTo(rightX, topBarY);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(leftX, topBarY);
        ctx.lineTo(leftX, bottomY);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(rightX, topBarY);
        ctx.lineTo(rightX, bottomY);
        ctx.stroke();

        drawContainer(ctx, containerCenterX, containerTopY + CONTAINER_H / 2, CONTAINER_W, CONTAINER_H, heldPkg.label, true);

        ctx.fillStyle = "#455A64";
        ctx.font = "bold 10px Arial";
        ctx.textAlign = "center";
        ctx.fillText(crane.label, craneX, craneTopY - 8);
      } else {
        const armBottomY = craneTopY + 35;
        const gap = 35;
        const clawLength = 22;

        ctx.beginPath();
        ctx.moveTo(craneX, craneTopY);
        ctx.lineTo(craneX, armBottomY);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(craneX - gap / 2 - 4, armBottomY);
        ctx.lineTo(craneX + gap / 2 + 4, armBottomY);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(craneX - gap / 2, armBottomY);
        ctx.lineTo(craneX - gap / 2, armBottomY + clawLength);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(craneX + gap / 2, armBottomY);
        ctx.lineTo(craneX + gap / 2, armBottomY + clawLength);
        ctx.stroke();

        ctx.fillStyle = "#000000ff";
        ctx.font = "bold 13px Arial";
        ctx.textAlign = "center";
        ctx.fillText(crane.label, craneX +9, craneTopY +5 );
      }
    });

    // === BOTTOM AREA: TRUCKS (left) + PILES (right) ===
    const depotTrucksList = trucksPerDepot.get(depot.id) || [];
    const depotPilesList = pilesPerDepot.get(depot.id) || [];
    
    const trucksWidth = depotTrucksList.length > 0 
      ? depotTrucksList.length * TRUCK_W + (depotTrucksList.length - 1) * TRUCK_SPACING
      : 0;
    
    let totalPilesWidth = 0;
    for (const pile of depotPilesList) {
      totalPilesWidth += getPileWidth(pile.id);
    }
    if (depotPilesList.length > 1) {
      totalPilesWidth += (depotPilesList.length - 1) * PILE_SPACING;
    }
    
    const spacingBetween = (trucksWidth > 0 && totalPilesWidth > 0) ? 20 : 0;
    const totalContentWidth = trucksWidth + spacingBetween + totalPilesWidth;
    const contentStartX = depotX + (depotWidth - totalContentWidth) / 2;
    
    // --- TRUCKS at left ---
    let truckCurrentX = contentStartX;
    
    depotTrucksList.forEach((truck) => {
      const truckX = truckCurrentX;
      const truckY = depotY + depotHeight - TRUCK_H - 25;

      if (truckImg.complete && truckImg.naturalWidth > 0) {
        ctx.drawImage(truckImg, truckX, truckY, TRUCK_W, TRUCK_H);
      } else {
        ctx.fillStyle = "#607D8B";
        ctx.fillRect(truckX, truckY + 10, 45, 20);
        ctx.fillRect(truckX + 45, truckY + 13, 18, 17);
      }

      // Truck label ON the truck (on the cab area)
      ctx.fillStyle = "#ad1d1dff";
      ctx.font = "bold 13px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(truck.label, truckX + TRUCK_W -35, truckY + TRUCK_H / 2 + 10);

      // Draw packages in truck - REVERSE order so last loaded is on top
      const packagesInThisTruck = packages.filter(p => packageInTruck.get(p.id) === truck.id);
      const flatbedCenterX = truckX + 25;
      const flatbedBaseY = truckY + TRUCK_H - 21; // Base of flatbed
      
      // Draw from bottom to top: first package at bottom, last at top
      // Reverse the array so the last loaded package appears on top visually
      const reversedPackages = [...packagesInThisTruck];
      reversedPackages.forEach((pkg, pkgIndex) => {
        const containerY = flatbedBaseY - (reversedPackages.length - 1 - pkgIndex) * (CONTAINER_H - 8) - CONTAINER_H / 2;
        drawContainer(ctx, flatbedCenterX, containerY, CONTAINER_W - 5, CONTAINER_H - 5, pkg.label, false);
      });
      
      truckCurrentX += TRUCK_W + TRUCK_SPACING;
    });

    // --- PILES at right (beside trucks) ---
    let pileStartX = contentStartX + trucksWidth + spacingBetween;
    
    depotPilesList.forEach((pile) => {
      const pileWidth = getPileWidth(pile.id);
      const pileX = pileStartX;
      const pileBaseY = depotY + depotHeight - 30;

      // === DRAW PILE PLATFORM ===
      ctx.fillStyle = "#8D6E63";
      ctx.fillRect(pileX, pileBaseY, pileWidth, PILE_HEIGHT);
      
      ctx.strokeStyle = "#5D4037";
      ctx.lineWidth = 2;
      ctx.strokeRect(pileX, pileBaseY, pileWidth, PILE_HEIGHT);
      
      // 3D depth effect
      ctx.fillStyle = "#6D4C41";
      ctx.fillRect(pileX, pileBaseY + PILE_HEIGHT, pileWidth, 3);
      
      // Pile label ON the pile base (centered on the platform)
      ctx.fillStyle = "#FFFFFF";
      ctx.font = "bold 9px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(pile.label, pileX + pileWidth / 2, pileBaseY + PILE_HEIGHT / 2);

      // === DRAW PACKAGES ON PILE (side-by-side) ===
      const packagesOnThisPile = packages.filter(p => packageOnPile.get(p.id) === pile.id);
      
      packagesOnThisPile.forEach((pkg, pkgIndex) => {
        const containerX = pileX + PILE_PADDING + pkgIndex * (CONTAINER_W + 5) + CONTAINER_W / 2;
        const containerY = pileBaseY - CONTAINER_H / 2;
        
        drawContainer(ctx, containerX, containerY, CONTAINER_W, CONTAINER_H, pkg.label, false);
        
        drawStackedPackages(ctx, pkg, containerX, containerY - CONTAINER_H, packageOn, packages, CONTAINER_W, CONTAINER_H);
      });
      
      pileStartX += pileWidth + PILE_SPACING;
    });

    currentX += depotWidth + DEPOT_SPACING;
  });
}

// ================= HELPER FUNCTIONS =================

function drawStackedPackages(
  ctx: CanvasRenderingContext2D,
  basePkg: VisualObject,
  centerX: number,
  topY: number,
  packageOn: Map<string, string>,
  packages: VisualObject[],
  containerW: number,
  containerH: number
) {
  for (const pkg of packages) {
    if (packageOn.get(pkg.id) === basePkg.id) {
      drawContainer(ctx, centerX, topY -5 + containerH / 2, containerW, containerH, pkg.label, false);
      drawStackedPackages(ctx, pkg, centerX, topY - containerH , packageOn, packages, containerW, containerH);
      break;
    }
  }
}

function drawContainer(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  w: number,
  h: number,
  label: string,
  isHeld: boolean = false
) {
  const x = cx - w / 2;
  const y = cy - h / 2;

  const gradient = ctx.createLinearGradient(x, y, x, y + h);
  gradient.addColorStop(0, isHeld ? "#FFCA28" : "#FFC107");
  gradient.addColorStop(1, isHeld ? "#FFB300" : "#FFA000");

  ctx.fillStyle = gradient;
  ctx.fillRect(x, y, w, h);

  ctx.strokeStyle = isHeld ? "#FF8F00" : "#E65100";
  ctx.lineWidth = isHeld ? 2 : 1.5;
  ctx.strokeRect(x, y, w, h);

  ctx.strokeStyle = "rgba(0,0,0,0.1)";
  ctx.lineWidth = 1;
  for (let i = 1; i < 4; i++) {
    const rx = x + (w * i / 4);
    ctx.beginPath();
    ctx.moveTo(rx, y + 2);
    ctx.lineTo(rx, y + h - 2);
    ctx.stroke();
  }

  ctx.fillStyle = "#5D4037";
  ctx.font = `bold ${Math.min(10, h * 0.4)}px Arial`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, cx, cy);

  if (isHeld) {
    ctx.strokeStyle = "#ffd54f";
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(x - 2, y - 2, w + 4, h + 4);
    ctx.setLineDash([]);
  }
}


// ================= BACKGROUND FUNCTION =================
export function renderDepotBackground(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  // Industrial/warehouse themed background
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, "#e8e4e0");  // Light concrete gray at top
  gradient.addColorStop(0.7, "#d4cfc8"); // Slightly darker
  gradient.addColorStop(1, "#c4beb6");  // Concrete floor color
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  // Draw warehouse floor tiles pattern
  ctx.save();
  ctx.strokeStyle = "rgba(0, 0, 0, 0.08)";
  ctx.lineWidth = 1;
  const TILE_SIZE = 60;
  
  for (let x = 0; x <= width; x += TILE_SIZE) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  
  for (let y = 0; y <= height; y += TILE_SIZE) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
  ctx.restore();
}

// ================= LEGEND FUNCTION =================
export function renderDepotLegend(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  const LEGEND_WIDTH = 150;
  const LEGEND_HEIGHT = 140;
  const PADDING = 12;
  const LINE_HEIGHT = 22;

  // Draw legend background
  ctx.save();
  ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
  ctx.strokeStyle = "rgba(0, 0, 0, 0.15)";
  ctx.lineWidth = 1;
  
  const radius = 8;
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + LEGEND_WIDTH - radius, y);
  ctx.quadraticCurveTo(x + LEGEND_WIDTH, y, x + LEGEND_WIDTH, y + radius);
  ctx.lineTo(x + LEGEND_WIDTH, y + LEGEND_HEIGHT - radius);
  ctx.quadraticCurveTo(x + LEGEND_WIDTH, y + LEGEND_HEIGHT, x + LEGEND_WIDTH - radius, y + LEGEND_HEIGHT);
  ctx.lineTo(x + radius, y + LEGEND_HEIGHT);
  ctx.quadraticCurveTo(x, y + LEGEND_HEIGHT, x, y + LEGEND_HEIGHT - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Legend title
  ctx.fillStyle = "#333";
  ctx.font = "bold 12px Arial";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText("Depot Legend", x + PADDING, y + PADDING);

  let itemY = y + PADDING + LINE_HEIGHT + 4;
  ctx.font = "11px Arial";

  ctx.fillStyle = "#5c4033";
  ctx.fillText("🏭  Depot", x + PADDING, itemY);
  itemY += LINE_HEIGHT;

  ctx.fillStyle = "#1976d2";
  ctx.fillText("🚚  Truck", x + PADDING, itemY);
  itemY += LINE_HEIGHT;

  ctx.fillStyle = "#ff9800";
  ctx.fillText("🏗️  Crane", x + PADDING, itemY);
  itemY += LINE_HEIGHT;

  ctx.fillStyle = "#795548";
  ctx.fillText("📦  Package", x + PADDING, itemY);
  itemY += LINE_HEIGHT;

  ctx.fillStyle = "#607d8b";
  ctx.fillText("📚  Pile", x + PADDING, itemY);

  ctx.restore();
}

