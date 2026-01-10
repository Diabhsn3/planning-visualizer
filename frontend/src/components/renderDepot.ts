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
  const pileAt = new Map<string, string>();        // pile -> depot
  const packageOnPile = new Map<string, string>(); // package -> pile
  const packageOn = new Map<string, string>();     // package -> package (stacking)
  const packageInTruck = new Map<string, string>(); // package -> truck
  const craneHolding = new Map<string, string>();  // crane -> package

  console.log("[DEPOT DEBUG] state.relations:", state.relations);
  for (const r of state.relations) {
    console.log("[DEPOT DEBUG] Processing relation:", r.type, r.source, r.target);
    if (r.type === "at-truck" && r.target) {
      truckAt.set(r.source, r.target);
    } else if (r.type === "at-crane" && r.target) {
      craneAt.set(r.source, r.target);
    } else if (r.type === "at-pile" && r.target) {
      pileAt.set(r.source, r.target);
      console.log("[DEPOT DEBUG] Added to pileAt:", r.source, "->", r.target);
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

  // ---------- LAYOUT ----------
  const numDepots = depots.length;
  const DEPOT_WIDTH = 160;
  const DEPOT_HEIGHT = 260;
  const PILE_WIDTH = 70;
  const PILE_HEIGHT = 15;
  const CONTAINER_W = 55;  // Wider to fill truck bed
  const CONTAINER_H = 25;
  const SPACING = 100;  // Space between depot and pile
  
  // Calculate total width needed: depots + piles beside them
  const AREA_WIDTH = DEPOT_WIDTH + PILE_WIDTH + SPACING;
  const TOTAL_WIDTH = numDepots * AREA_WIDTH;
  const START_X = Math.max(50, (W - TOTAL_WIDTH) / 2);
  const DEPOT_Y = 80;

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

      // Draw containers ON the truck flatbed (stacked, no gaps)
      // The flatbed is on the LEFT side of the truck image
      const packagesInThisTruck = packages.filter(p => packageInTruck.get(p.id) === truck.id);
      const flatbedCenterX = truckX + 22;  // Center of flatbed
      const flatbedTopY = truckY + 5;  // Top of flatbed area
      
      // Draw in REVERSE order so first loaded is at bottom, last loaded is on top
      // packagesInThisTruck[0] = first loaded = bottom
      // packagesInThisTruck[last] = last loaded = top
      packagesInThisTruck.forEach((pkg, pkgIndex) => {
        // pkgIndex 0 = bottom, higher index = higher position
        const containerY = flatbedTopY - pkgIndex * CONTAINER_H;
        drawContainer(ctx, flatbedCenterX, containerY, CONTAINER_W, CONTAINER_H, pkg.label, false);
      });
    });

    // === CRANE (Gripper style, like blocks-world) ===
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

    // === PILE BESIDE DEPOT ===
    // Find piles that belong to this depot
    console.log("[DEPOT DEBUG] Looking for piles for depot:", depot.id);
    console.log("[DEPOT DEBUG] pileAt map:", Array.from(pileAt.entries()));
    console.log("[DEPOT DEBUG] All piles:", piles.map(p => p.id));
    const depotPiles = piles.filter(p => {
      const pileDepot = pileAt.get(p.id);
      console.log("[DEPOT DEBUG] Pile", p.id, "belongs to depot:", pileDepot, "matches?", pileDepot === depot.id);
      return pileDepot === depot.id;
    });
    console.log("[DEPOT DEBUG] Found depotPiles:", depotPiles.map(p => p.id));
    
    depotPiles.forEach((pile, pileIndex) => {
      const pileX = depotX + DEPOT_WIDTH + 30;  // To the right of depot
      const pileBaseY = depotY + DEPOT_HEIGHT - 30 - pileIndex * 120;  // Base of pile platform

      // Pile platform
      ctx.fillStyle = "#8D6E63";
      ctx.fillRect(pileX, pileBaseY, PILE_WIDTH, PILE_HEIGHT);
      ctx.strokeStyle = "#5D4037";
      ctx.lineWidth = 2;
      ctx.strokeRect(pileX, pileBaseY, PILE_WIDTH, PILE_HEIGHT);

      // Pile label below
      ctx.fillStyle = "#5D4037";
      ctx.font = "bold 11px Arial";
      ctx.textAlign = "center";
      ctx.fillText(pile.label, pileX + PILE_WIDTH / 2, pileBaseY + PILE_HEIGHT + 14);

      // Draw containers stacked on this pile (no gaps)
      // Bottom container is at index 0, top is at last index
      const stackedPackages = getPackageStack(pile.id, packageOnPile, packageOn, packages);
      stackedPackages.forEach((pkg, stackIndex) => {
        // stackIndex 0 = bottom (just above pile platform)
        const containerCenterY = pileBaseY - CONTAINER_H / 2 - stackIndex * CONTAINER_H;
        drawContainer(ctx, pileX + PILE_WIDTH / 2, containerCenterY, CONTAINER_W, CONTAINER_H, pkg.label, false);
      });
    });
  });
}

// ================= HELPER FUNCTIONS =================

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
  ctx.font = `bold ${Math.min(11, h * 0.45)}px Arial`;
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

// Get stack of packages on a pile (bottom to top)
function getPackageStack(
  pileId: string,
  packageOnPile: Map<string, string>,
  packageOn: Map<string, string>,
  packages: VisualObject[]
): VisualObject[] {
  const stack: VisualObject[] = [];

  // Find bottom package (directly on pile)
  let bottomPkg: VisualObject | undefined;
  for (const pkg of packages) {
    if (packageOnPile.get(pkg.id) === pileId) {
      bottomPkg = pkg;
      break;
    }
  }

  if (!bottomPkg) return stack;
  stack.push(bottomPkg);

  // Find packages stacked on top
  let currentPkg = bottomPkg;
  while (true) {
    let found = false;
    for (const pkg of packages) {
      if (packageOn.get(pkg.id) === currentPkg.id) {
        stack.push(pkg);
        currentPkg = pkg;
        found = true;
        break;
      }
    }
    if (!found) break;
  }

  return stack;
}
