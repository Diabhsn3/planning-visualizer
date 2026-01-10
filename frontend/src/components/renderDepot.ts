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

const packageImg = new Image();
packageImg.src = "/package.png";

const craneImg = new Image();
craneImg.src = "/crane.png";

// ================= MAIN =================
export function renderDepot(
  ctx: CanvasRenderingContext2D,
  state: RenderedState
) {
  const W = 800;
  const H = 600;
  const MARGIN = 60;

  // ---------- EXTRACT OBJECTS ----------
  const depots = state.objects.filter(o => o.type === "depot");
  const trucks = state.objects.filter(o => o.type === "truck");
  const cranes = state.objects.filter(o => o.type === "crane");
  const piles = state.objects.filter(o => o.type === "pile");
  const packages = state.objects.filter(o => o.type === "package");

  // ---------- EXTRACT RELATIONS ----------
  const truckAt = new Map<string, string>();      // truck -> depot
  const craneAt = new Map<string, string>();      // crane -> depot
  const pileAt = new Map<string, string>();       // pile -> depot
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

  // ---------- LAYOUT DEPOTS ----------
  const numDepots = depots.length;
  const depotWidth = 200;
  const depotHeight = 350;
  const depotSpacing = (W - 2 * MARGIN - numDepots * depotWidth) / (numDepots + 1);
  
  const depotPositions = new Map<string, { x: number; y: number }>();
  depots.forEach((depot, i) => {
    const x = MARGIN + depotSpacing * (i + 1) + depotWidth * i;
    const y = MARGIN + 50;
    depotPositions.set(depot.id, { x, y });
  });

  // ---------- BACKGROUND ----------
  ctx.fillStyle = "#f6f7fb";
  ctx.fillRect(0, 0, W, H);

  // Draw grid
  ctx.strokeStyle = "rgba(0,0,0,0.05)";
  for (let x = 0; x < W; x += 50) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }
  for (let y = 0; y < H; y += 50) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }

  // ---------- DRAW DEPOTS ----------
  for (const depot of depots) {
    const pos = depotPositions.get(depot.id);
    if (!pos) continue;

    // Depot background
    ctx.fillStyle = "#E8E8E8";
    ctx.fillRect(pos.x, pos.y, depotWidth, depotHeight);
    ctx.strokeStyle = "#999";
    ctx.lineWidth = 2;
    ctx.strokeRect(pos.x, pos.y, depotWidth, depotHeight);

    // Depot label
    ctx.fillStyle = "#333";
    ctx.font = "bold 16px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(depot.label.toUpperCase(), pos.x + depotWidth / 2, pos.y + 8);

    // Draw piles in this depot
    const depotPiles = piles.filter(p => pileAt.get(p.id) === depot.id);
    const pileWidth = 60;
    const pileSpacing = (depotWidth - depotPiles.length * pileWidth) / (depotPiles.length + 1);
    
    depotPiles.forEach((pile, pileIndex) => {
      const pileX = pos.x + pileSpacing * (pileIndex + 1) + pileWidth * pileIndex;
      const pileY = pos.y + depotHeight - 80;

      // Pile platform
      ctx.fillStyle = "#8B4513";
      ctx.fillRect(pileX, pileY + 50, pileWidth, 20);
      
      // Pile label
      ctx.fillStyle = "#666";
      ctx.font = "11px Arial";
      ctx.textAlign = "center";
      ctx.fillText(pile.label, pileX + pileWidth / 2, pileY + 75);

      // Draw packages on this pile
      const packagesOnThisPile = getPackageStack(pile.id, packageOnPile, packageOn, packages);
      packagesOnThisPile.forEach((pkg, stackIndex) => {
        const pkgY = pileY + 50 - (stackIndex + 1) * 35;
        drawPackage(ctx, pileX + pileWidth / 2, pkgY, pkg.label);
      });
    });

    // Draw crane in this depot
    const depotCranes = cranes.filter(c => craneAt.get(c.id) === depot.id);
    depotCranes.forEach((crane, craneIndex) => {
      const craneX = pos.x + 30 + craneIndex * 80;
      const craneY = pos.y + 40;

      // Crane arm
      ctx.strokeStyle = "#FF69B4";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(craneX, craneY);
      ctx.lineTo(craneX, craneY + 80);
      ctx.lineTo(craneX + 40, craneY + 80);
      ctx.stroke();

      // Crane hook
      ctx.beginPath();
      ctx.arc(craneX + 40, craneY + 90, 8, 0, Math.PI * 2);
      ctx.fillStyle = "#FF69B4";
      ctx.fill();

      // Crane label
      ctx.fillStyle = "#FF69B4";
      ctx.font = "bold 12px Arial";
      ctx.textAlign = "center";
      ctx.fillText(crane.label, craneX + 20, craneY - 5);

      // Draw held package
      const heldPkg = craneHolding.get(crane.id);
      if (heldPkg) {
        const pkg = packages.find(p => p.id === heldPkg);
        if (pkg) {
          drawPackage(ctx, craneX + 40, craneY + 110, pkg.label, true);
        }
      }
    });

    // Draw truck in this depot
    const depotTrucks = trucks.filter(t => truckAt.get(t.id) === depot.id);
    depotTrucks.forEach((truck, truckIndex) => {
      const truckX = pos.x + depotWidth - 80;
      const truckY = pos.y + 80 + truckIndex * 100;

      // Truck body
      ctx.fillStyle = "#00BFFF";
      ctx.fillRect(truckX, truckY, 70, 45);
      ctx.fillStyle = "#0099CC";
      ctx.fillRect(truckX + 50, truckY + 5, 20, 35);
      
      // Wheels
      ctx.fillStyle = "#333";
      ctx.beginPath();
      ctx.arc(truckX + 15, truckY + 45, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(truckX + 45, truckY + 45, 8, 0, Math.PI * 2);
      ctx.fill();

      // Truck label
      ctx.fillStyle = "#fff";
      ctx.font = "bold 12px Arial";
      ctx.textAlign = "center";
      ctx.fillText(truck.label, truckX + 25, truckY + 25);

      // Count packages in truck
      const packagesInThisTruck = packages.filter(p => packageInTruck.get(p.id) === truck.id);
      if (packagesInThisTruck.length > 0) {
        // Badge
        ctx.beginPath();
        ctx.arc(truckX + 60, truckY - 5, 14, 0, Math.PI * 2);
        ctx.fillStyle = "#E53935";
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.font = "bold 12px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(packagesInThisTruck.length), truckX + 60, truckY - 5);
      }
    });
  }

  // ---------- LEGEND ----------
  const legendX = 15;
  const legendY = H - 100;
  
  ctx.fillStyle = "rgba(255,255,255,0.95)";
  ctx.fillRect(legendX - 5, legendY - 5, 130, 90);
  ctx.strokeStyle = "#ddd";
  ctx.lineWidth = 1;
  ctx.strokeRect(legendX - 5, legendY - 5, 130, 90);

  ctx.font = "bold 10px Arial";
  ctx.fillStyle = "#666";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText("LEGEND", legendX, legendY + 5);

  // Depot
  ctx.fillStyle = "#E8E8E8";
  ctx.fillRect(legendX, legendY + 18, 14, 10);
  ctx.strokeStyle = "#999";
  ctx.strokeRect(legendX, legendY + 18, 14, 10);
  ctx.fillStyle = "#666";
  ctx.font = "9px Arial";
  ctx.fillText("Depot", legendX + 20, legendY + 23);

  // Crane
  ctx.fillStyle = "#FF69B4";
  ctx.beginPath();
  ctx.arc(legendX + 7, legendY + 40, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#666";
  ctx.fillText("Crane", legendX + 20, legendY + 40);

  // Truck
  ctx.fillStyle = "#00BFFF";
  ctx.fillRect(legendX, legendY + 52, 14, 10);
  ctx.fillStyle = "#666";
  ctx.fillText("Truck", legendX + 20, legendY + 57);

  // Package
  ctx.fillStyle = "#FFD700";
  ctx.fillRect(legendX, legendY + 68, 14, 10);
  ctx.strokeStyle = "#DAA520";
  ctx.strokeRect(legendX, legendY + 68, 14, 10);
  ctx.fillStyle = "#666";
  ctx.fillText("Package", legendX + 20, legendY + 73);
}

// Helper: Get stack of packages on a pile
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

// Helper: Draw a package
function drawPackage(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  label: string,
  isHeld: boolean = false
) {
  const w = 40;
  const h = 30;
  
  // Package body
  ctx.fillStyle = isHeld ? "#FFEB3B" : "#FFD700";
  ctx.fillRect(cx - w / 2, cy - h / 2, w, h);
  ctx.strokeStyle = isHeld ? "#FFC107" : "#DAA520";
  ctx.lineWidth = isHeld ? 3 : 2;
  ctx.strokeRect(cx - w / 2, cy - h / 2, w, h);
  
  // Label
  ctx.fillStyle = "#333";
  ctx.font = "bold 11px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, cx, cy);
  
  // Held indicator
  if (isHeld) {
    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = "#FF69B4";
    ctx.lineWidth = 2;
    ctx.strokeRect(cx - w / 2 - 3, cy - h / 2 - 3, w + 6, h + 6);
    ctx.setLineDash([]);
  }
}
