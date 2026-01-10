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
  const DEPOT_WIDTH = 180;
  const DEPOT_HEIGHT = 280;
  const CONTAINER_W = 50;
  const CONTAINER_H = 30;
  const PILE_HEIGHT = 12;  // Height of pile platform
  const PILE_PADDING = 10; // Padding on each side of pile
  const MIN_PILE_WIDTH = 80; // Minimum pile width when empty

  // ---------- CALCULATE PILE WIDTHS (dynamic based on packages) ----------
  const pilePackageCounts = new Map<string, number>();
  for (const pile of piles) {
    // Count packages directly on this pile (side-by-side)
    let count = 0;
    for (const pkg of packages) {
      if (packageOnPile.get(pkg.id) === pile.id) {
        count++;
      }
    }
    pilePackageCounts.set(pile.id, Math.max(1, count)); // At least 1 slot
  }

  // Calculate dynamic pile width
  const getPileWidth = (pileId: string) => {
    const count = pilePackageCounts.get(pileId) || 1;
    return Math.max(MIN_PILE_WIDTH, count * (CONTAINER_W + 5) + PILE_PADDING * 2);
  };

  // ---------- LAYOUT CALCULATION ----------
  const numDepots = depots.length;
  const SPACING = 60;
  
  // Calculate max pile width for layout
  let maxPileWidth = MIN_PILE_WIDTH;
  for (const pile of piles) {
    maxPileWidth = Math.max(maxPileWidth, getPileWidth(pile.id));
  }
  
  const AREA_WIDTH = DEPOT_WIDTH + maxPileWidth + SPACING;
  const TOTAL_WIDTH = numDepots * AREA_WIDTH;
  const START_X = Math.max(30, (W - TOTAL_WIDTH) / 2);
  const DEPOT_Y = 60;

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

  // ---------- ASSIGN PILES TO DEPOTS ----------
  // Since there's no at-pile relation, assign piles to depots by index
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

  // ---------- DRAW EACH DEPOT AREA ----------
  depots.forEach((depot, depotIndex) => {
    const depotX = START_X + depotIndex * AREA_WIDTH;
    const depotY = DEPOT_Y;

    // === DEPOT BOX ===
    ctx.fillStyle = "#B0BEC5";
    ctx.fillRect(depotX, depotY, DEPOT_WIDTH, DEPOT_HEIGHT);
    ctx.strokeStyle = "#78909C";
    ctx.lineWidth = 2;
    ctx.strokeRect(depotX, depotY, DEPOT_WIDTH, DEPOT_HEIGHT);

    // Depot label at top
    ctx.fillStyle = "#37474F";
    ctx.font = "bold 16px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(depot.label.toUpperCase(), depotX + DEPOT_WIDTH / 2, depotY + 8);

    // === TRUCK INSIDE DEPOT ===
    const depotTrucks = trucks.filter(t => truckAt.get(t.id) === depot.id);
    depotTrucks.forEach((truck, truckIndex) => {
      const truckW = 90;
      const truckH = 50;
      const truckX = depotX + 20 + truckIndex * 100;
      const truckY = depotY + DEPOT_HEIGHT - truckH - 40;

      // Draw truck image
      if (truckImg.complete && truckImg.naturalWidth > 0) {
        ctx.drawImage(truckImg, truckX, truckY, truckW, truckH);
      } else {
        // Fallback
        ctx.fillStyle = "#607D8B";
        ctx.fillRect(truckX, truckY + 15, 55, 25);
        ctx.fillRect(truckX + 55, truckY + 18, 25, 22);
      }

      // Truck label below
      ctx.fillStyle = "#37474F";
      ctx.font = "bold 11px Arial";
      ctx.textAlign = "center";
      ctx.fillText(truck.label, truckX + truckW / 2, truckY + truckH + 12);

      // Draw containers ON the truck flatbed (stacked vertically)
      const packagesInThisTruck = packages.filter(p => packageInTruck.get(p.id) === truck.id);
      const flatbedCenterX = truckX + 22;
      const flatbedTopY = truckY + 5;
      
      packagesInThisTruck.forEach((pkg, pkgIndex) => {
        const containerY = flatbedTopY - pkgIndex * CONTAINER_H;
        drawContainer(ctx, flatbedCenterX, containerY, CONTAINER_W, CONTAINER_H, pkg.label, false);
      });
    });

    // === CRANE (Gripper style) ===
    const depotCranes = cranes.filter(c => craneAt.get(c.id) === depot.id);
    depotCranes.forEach((crane, craneIndex) => {
      const craneX = depotX + DEPOT_WIDTH / 2 + (craneIndex - (depotCranes.length - 1) / 2) * 60;
      const craneTopY = depotY + 35;
      
      const heldPkgId = craneHolding.get(crane.id);
      const heldPkg = heldPkgId ? packages.find(p => p.id === heldPkgId) : null;

      ctx.strokeStyle = "#455A64";
      ctx.lineWidth = 4;
      ctx.lineCap = "round";

      if (heldPkg) {
        // Gripper wrapped around held container
        const containerCenterX = craneX;
        const containerTopY = craneTopY + 50;
        const margin = 6;
        const leftX = containerCenterX - CONTAINER_W / 2 - margin;
        const rightX = containerCenterX + CONTAINER_W / 2 + margin;
        const topBarY = containerTopY - 8;
        const bottomY = containerTopY + CONTAINER_H;

        // Vertical arm
        ctx.beginPath();
        ctx.moveTo(craneX, craneTopY);
        ctx.lineTo(craneX, topBarY);
        ctx.stroke();

        // Top bar
        ctx.beginPath();
        ctx.moveTo(leftX, topBarY);
        ctx.lineTo(rightX, topBarY);
        ctx.stroke();

        // Left claw
        ctx.beginPath();
        ctx.moveTo(leftX, topBarY);
        ctx.lineTo(leftX, bottomY);
        ctx.stroke();

        // Right claw
        ctx.beginPath();
        ctx.moveTo(rightX, topBarY);
        ctx.lineTo(rightX, bottomY);
        ctx.stroke();

        // Draw held container
        drawContainer(ctx, containerCenterX, containerTopY + CONTAINER_H / 2, CONTAINER_W, CONTAINER_H, heldPkg.label, true);

        // Crane label
        ctx.fillStyle = "#455A64";
        ctx.font = "bold 10px Arial";
        ctx.textAlign = "center";
        ctx.fillText(crane.label, craneX, craneTopY - 5);
      } else {
        // Empty gripper
        const armBottomY = craneTopY + 45;
        const gap = 40;
        const clawLength = 28;

        ctx.beginPath();
        ctx.moveTo(craneX, craneTopY);
        ctx.lineTo(craneX, armBottomY);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(craneX - gap / 2 - 5, armBottomY);
        ctx.lineTo(craneX + gap / 2 + 5, armBottomY);
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
        ctx.fillText(crane.label, craneX, craneTopY - 5);
      }
    });

    // === PILES BESIDE DEPOT ===
    // Get piles assigned to this depot
    const depotPiles = pilesPerDepot.get(depot.id) || [];
    
    depotPiles.forEach((pile, pileIndex) => {
      const pileWidth = getPileWidth(pile.id);
      const pileX = depotX + DEPOT_WIDTH + 20;
      const pileBaseY = depotY + DEPOT_HEIGHT - 50 - pileIndex * 100;

      // === DRAW PILE PLATFORM (wide surface) ===
      // Main pile surface
      ctx.fillStyle = "#8D6E63";
      ctx.fillRect(pileX, pileBaseY, pileWidth, PILE_HEIGHT);
      
      // Pile border
      ctx.strokeStyle = "#5D4037";
      ctx.lineWidth = 2;
      ctx.strokeRect(pileX, pileBaseY, pileWidth, PILE_HEIGHT);
      
      // Add some depth effect (3D look)
      ctx.fillStyle = "#6D4C41";
      ctx.fillRect(pileX, pileBaseY + PILE_HEIGHT, pileWidth, 4);
      
      // Pile label below
      ctx.fillStyle = "#5D4037";
      ctx.font = "bold 12px Arial";
      ctx.textAlign = "center";
      ctx.fillText(pile.label, pileX + pileWidth / 2, pileBaseY + PILE_HEIGHT + 18);

      // === DRAW PACKAGES ON PILE (side-by-side) ===
      // Get all packages directly on this pile
      const packagesOnThisPile = packages.filter(p => packageOnPile.get(p.id) === pile.id);
      
      packagesOnThisPile.forEach((pkg, pkgIndex) => {
        // Position packages side-by-side on the pile surface
        const containerX = pileX + PILE_PADDING + pkgIndex * (CONTAINER_W + 5) + CONTAINER_W / 2;
        const containerY = pileBaseY - CONTAINER_H / 2;
        
        // Draw the base package
        drawContainer(ctx, containerX, containerY, CONTAINER_W, CONTAINER_H, pkg.label, false);
        
        // Draw any packages stacked ON TOP of this package (vertical stacking via 'on' predicate)
        drawStackedPackages(ctx, pkg, containerX, containerY - CONTAINER_H, packageOn, packages, CONTAINER_W, CONTAINER_H);
      });
    });
  });
}

// ================= HELPER FUNCTIONS =================

// Draw packages stacked on top of a base package (recursive for multiple levels)
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
  // Find package that is ON this base package
  for (const pkg of packages) {
    if (packageOn.get(pkg.id) === basePkg.id) {
      // Draw this package on top
      drawContainer(ctx, centerX, topY + containerH / 2, containerW, containerH, pkg.label, false);
      
      // Recursively draw any packages stacked on this one
      drawStackedPackages(ctx, pkg, centerX, topY - containerH, packageOn, packages, containerW, containerH);
      break; // Only one package can be directly on top
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

  // Container body with gradient
  const gradient = ctx.createLinearGradient(x, y, x, y + h);
  gradient.addColorStop(0, isHeld ? "#FFCA28" : "#FFC107");
  gradient.addColorStop(1, isHeld ? "#FFB300" : "#FFA000");

  ctx.fillStyle = gradient;
  ctx.fillRect(x, y, w, h);

  // Container border
  ctx.strokeStyle = isHeld ? "#FF8F00" : "#E65100";
  ctx.lineWidth = isHeld ? 2 : 1.5;
  ctx.strokeRect(x, y, w, h);

  // Container ridges
  ctx.strokeStyle = "rgba(0,0,0,0.1)";
  ctx.lineWidth = 1;
  for (let i = 1; i < 4; i++) {
    const rx = x + (w * i / 4);
    ctx.beginPath();
    ctx.moveTo(rx, y + 2);
    ctx.lineTo(rx, y + h - 2);
    ctx.stroke();
  }

  // Label
  ctx.fillStyle = "#5D4037";
  ctx.font = `bold ${Math.min(11, h * 0.4)}px Arial`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, cx, cy);

  // Held indicator
  if (isHeld) {
    ctx.strokeStyle = "#ffd54f";
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(x - 2, y - 2, w + 4, h + 4);
    ctx.setLineDash([]);
  }
}
