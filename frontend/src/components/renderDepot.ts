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
  const H = 600;

  // ---------- EXTRACT OBJECTS ----------
  const depots = state.objects.filter(o => o.type === "depot");
  const trucks = state.objects.filter(o => o.type === "truck");
  const cranes = state.objects.filter(o => o.type === "crane");
  const piles = state.objects.filter(o => o.type === "pile");
  const packages = state.objects.filter(o => o.type === "package");

  // ---------- EXTRACT RELATIONS ----------
  const truckAt = new Map<string, string>();       // truck -> depot
  const craneAt = new Map<string, string>();       // crane -> depot
  const packageOnPile = new Map<string, string>(); // package -> pile
  const packageOn = new Map<string, string>();     // package -> package (stacking)
  const packageInTruck = new Map<string, string>(); // package -> truck
  const craneHolding = new Map<string, string>();  // crane -> package

  for (const r of state.relations) {
    if (r.type === "at-truck" && r.target) {
      truckAt.set(r.source, r.target);
    } else if (r.type === "at-crane" && r.target) {
      craneAt.set(r.source, r.target);
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
  const PILE_HEIGHT = 10;
  const PILE_PADDING = 8;
  const MIN_PILE_WIDTH = 60;
  const DEPOT_PADDING = 20;
  const MIN_DEPOT_WIDTH = 140;
  const DEPOT_TOP_MARGIN = 100; // Space for crane at top
  const DEPOT_BOTTOM_MARGIN = 30;
  const PILE_VERTICAL_SPACING = 15;
  const DEPOT_SPACING = 40; // Space between depots

  // ---------- ASSIGN PILES TO DEPOTS ----------
  const pilesPerDepot = new Map<string, VisualObject[]>();
  for (const depot of depots) {
    pilesPerDepot.set(depot.id, []);
  }
  
  // Distribute piles evenly among depots
  piles.forEach((pile, index) => {
    const depotIndex = index % depots.length;
    const depot = depots[depotIndex];
    if (depot) {
      pilesPerDepot.get(depot.id)?.push(pile);
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
    
    // Calculate max pile width for this depot
    let maxPileWidth = MIN_PILE_WIDTH;
    let totalPileHeight = 0;
    let maxStackHeight = 0;
    
    for (const pile of depotPilesList) {
      const pileWidth = getPileWidth(pile.id);
      maxPileWidth = Math.max(maxPileWidth, pileWidth);
      
      const stackHeight = getMaxStackHeightOnPile(pile.id);
      maxStackHeight = Math.max(maxStackHeight, stackHeight);
      
      // Each pile needs space for: pile platform + packages stacked on it
      totalPileHeight += PILE_HEIGHT + PILE_VERTICAL_SPACING;
    }
    
    // Depot width based on max pile width
    const depotWidth = Math.max(MIN_DEPOT_WIDTH, maxPileWidth + DEPOT_PADDING * 2);
    
    // Depot height based on: top margin (crane) + pile area + stacked packages + bottom margin
    const pileAreaHeight = depotPilesList.length * (PILE_HEIGHT + maxStackHeight * CONTAINER_H + PILE_VERTICAL_SPACING + 20);
    const depotHeight = DEPOT_TOP_MARGIN + Math.max(pileAreaHeight, 120) + DEPOT_BOTTOM_MARGIN;
    
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
  ctx.fillStyle = "#f0f4f8";
  ctx.fillRect(0, 0, W, H);

  // Draw subtle grid
  ctx.strokeStyle = "rgba(0,0,0,0.05)";
  ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }
  for (let y = 0; y < H; y += 40) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }

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
    ctx.font = "bold 16px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(depot.label.toUpperCase(), depotX + depotWidth / 2, depotY + 8);

    // === CRANE (Gripper style) ===
    const depotCranes = cranes.filter(c => craneAt.get(c.id) === depot.id);
    depotCranes.forEach((crane, craneIndex) => {
      const craneX = depotX + depotWidth / 2 + (craneIndex - (depotCranes.length - 1) / 2) * 60;
      const craneTopY = depotY + 30;
      
      const heldPkgId = craneHolding.get(crane.id);
      const heldPkg = heldPkgId ? packages.find(p => p.id === heldPkgId) : null;

      ctx.strokeStyle = "#455A64";
      ctx.lineWidth = 3;
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

        ctx.fillStyle = "#455A64";
        ctx.font = "bold 10px Arial";
        ctx.textAlign = "center";
        ctx.fillText(crane.label, craneX, craneTopY - 8);
      }
    });

    // === PILES INSIDE DEPOT ===
    const depotPilesList = pilesPerDepot.get(depot.id) || [];
    
    depotPilesList.forEach((pile, pileIndex) => {
      const pileWidth = getPileWidth(pile.id);
      const pileX = depotX + (depotWidth - pileWidth) / 2; // Center pile in depot
      const pileBaseY = depotY + DEPOT_TOP_MARGIN + pileIndex * (PILE_HEIGHT + 80);

      // === DRAW PILE PLATFORM ===
      ctx.fillStyle = "#8D6E63";
      ctx.fillRect(pileX, pileBaseY, pileWidth, PILE_HEIGHT);
      
      ctx.strokeStyle = "#5D4037";
      ctx.lineWidth = 2;
      ctx.strokeRect(pileX, pileBaseY, pileWidth, PILE_HEIGHT);
      
      // 3D depth effect
      ctx.fillStyle = "#6D4C41";
      ctx.fillRect(pileX, pileBaseY + PILE_HEIGHT, pileWidth, 3);
      
      // Pile label below
      ctx.fillStyle = "#5D4037";
      ctx.font = "bold 11px Arial";
      ctx.textAlign = "center";
      ctx.fillText(pile.label, pileX + pileWidth / 2, pileBaseY + PILE_HEIGHT + 14);

      // === DRAW PACKAGES ON PILE (side-by-side) ===
      const packagesOnThisPile = packages.filter(p => packageOnPile.get(p.id) === pile.id);
      
      packagesOnThisPile.forEach((pkg, pkgIndex) => {
        const containerX = pileX + PILE_PADDING + pkgIndex * (CONTAINER_W + 5) + CONTAINER_W / 2;
        const containerY = pileBaseY - CONTAINER_H / 2;
        
        // Draw the base package on the pile
        drawContainer(ctx, containerX, containerY, CONTAINER_W, CONTAINER_H, pkg.label, false);
        
        // Draw packages stacked ON TOP of this package (vertical stacking)
        drawStackedPackages(ctx, pkg, containerX, containerY - CONTAINER_H, packageOn, packages, CONTAINER_W, CONTAINER_H);
      });
    });

    // === TRUCK INSIDE DEPOT (at bottom) ===
    const depotTrucks = trucks.filter(t => truckAt.get(t.id) === depot.id);
    depotTrucks.forEach((truck, truckIndex) => {
      const truckW = 80;
      const truckH = 45;
      const truckX = depotX + (depotWidth - truckW) / 2 + truckIndex * 90;
      const truckY = depotY + depotHeight - truckH - 25;

      if (truckImg.complete && truckImg.naturalWidth > 0) {
        ctx.drawImage(truckImg, truckX, truckY, truckW, truckH);
      } else {
        ctx.fillStyle = "#607D8B";
        ctx.fillRect(truckX, truckY + 12, 50, 23);
        ctx.fillRect(truckX + 50, truckY + 15, 22, 20);
      }

      ctx.fillStyle = "#37474F";
      ctx.font = "bold 10px Arial";
      ctx.textAlign = "center";
      ctx.fillText(truck.label, truckX + truckW / 2, truckY + truckH + 10);

      // Draw packages in truck
      const packagesInThisTruck = packages.filter(p => packageInTruck.get(p.id) === truck.id);
      const flatbedCenterX = truckX + 20;
      const flatbedTopY = truckY + 5;
      
      packagesInThisTruck.forEach((pkg, pkgIndex) => {
        const containerY = flatbedTopY - pkgIndex * CONTAINER_H;
        drawContainer(ctx, flatbedCenterX, containerY, CONTAINER_W - 5, CONTAINER_H - 3, pkg.label, false);
      });
    });

    // Move to next depot position
    currentX += depotWidth + DEPOT_SPACING;
  });
}

// ================= HELPER FUNCTIONS =================

// Draw packages stacked on top of a base package (recursive)
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
      drawContainer(ctx, centerX, topY + containerH / 2, containerW, containerH, pkg.label, false);
      drawStackedPackages(ctx, pkg, centerX, topY - containerH, packageOn, packages, containerW, containerH);
      break;
    }
  }
}

// Draw a container/package
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
