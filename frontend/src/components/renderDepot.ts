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

  // ---------- LAYOUT ----------
  // Each depot area: depot box + pile beside it + crane hanging + truck below
  const numDepots = depots.length;
  const DEPOT_WIDTH = 120;
  const DEPOT_HEIGHT = 100;
  const PILE_WIDTH = 60;
  const AREA_WIDTH = DEPOT_WIDTH + PILE_WIDTH + 40; // depot + pile + spacing
  const TOTAL_WIDTH = numDepots * AREA_WIDTH;
  const START_X = (W - TOTAL_WIDTH) / 2;
  const DEPOT_Y = 80;

  // Store positions for each depot area
  const depotAreas = new Map<string, {
    depotX: number;
    depotY: number;
    pileX: number;
    pileY: number;
    craneX: number;
    craneY: number;
    truckX: number;
    truckY: number;
  }>();

  depots.forEach((depot, i) => {
    const areaX = START_X + i * AREA_WIDTH;
    depotAreas.set(depot.id, {
      depotX: areaX,
      depotY: DEPOT_Y,
      pileX: areaX + DEPOT_WIDTH + 20,
      pileY: DEPOT_Y + DEPOT_HEIGHT - 20,
      craneX: areaX + DEPOT_WIDTH / 2,
      craneY: DEPOT_Y,
      truckX: areaX + 20,
      truckY: DEPOT_Y + DEPOT_HEIGHT + 80
    });
  });

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
  for (const depot of depots) {
    const area = depotAreas.get(depot.id);
    if (!area) continue;

    // === DEPOT BOX ===
    // Shadow
    ctx.fillStyle = "rgba(0,0,0,0.1)";
    ctx.fillRect(area.depotX + 4, area.depotY + 4, DEPOT_WIDTH, DEPOT_HEIGHT);
    
    // Main box
    ctx.fillStyle = "#B0BEC5";
    ctx.fillRect(area.depotX, area.depotY, DEPOT_WIDTH, DEPOT_HEIGHT);
    ctx.strokeStyle = "#78909C";
    ctx.lineWidth = 2;
    ctx.strokeRect(area.depotX, area.depotY, DEPOT_WIDTH, DEPOT_HEIGHT);

    // Depot label
    ctx.fillStyle = "#37474F";
    ctx.font = "bold 14px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(depot.label.toUpperCase(), area.depotX + DEPOT_WIDTH / 2, area.depotY + DEPOT_HEIGHT / 2);

    // === CRANE (Claw hanging from depot) ===
    const depotCranes = cranes.filter(c => craneAt.get(c.id) === depot.id);
    depotCranes.forEach((crane, craneIndex) => {
      const cx = area.craneX + (craneIndex - (depotCranes.length - 1) / 2) * 50;
      const cy = area.craneY + DEPOT_HEIGHT;
      
      // Crane arm (vertical line from depot)
      ctx.strokeStyle = "#455A64";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(cx, area.depotY + DEPOT_HEIGHT);
      ctx.lineTo(cx, cy + 40);
      ctx.stroke();

      // Claw
      drawClaw(ctx, cx, cy + 40, crane.label);

      // If holding a package, draw it inside the claw
      const heldPkgId = craneHolding.get(crane.id);
      if (heldPkgId) {
        const pkg = packages.find(p => p.id === heldPkgId);
        if (pkg) {
          drawContainer(ctx, cx, cy + 70, pkg.label, true);
        }
      }
    });

    // === PILE (beside depot) ===
    const depotPiles = piles.filter(p => pileAt.get(p.id) === depot.id);
    depotPiles.forEach((pile, pileIndex) => {
      const px = area.pileX;
      const py = area.pileY + pileIndex * 120;

      // Pile platform
      ctx.fillStyle = "#8D6E63";
      ctx.fillRect(px - 5, py, PILE_WIDTH + 10, 15);
      ctx.strokeStyle = "#5D4037";
      ctx.lineWidth = 2;
      ctx.strokeRect(px - 5, py, PILE_WIDTH + 10, 15);

      // Pile label
      ctx.fillStyle = "#5D4037";
      ctx.font = "bold 11px Arial";
      ctx.textAlign = "center";
      ctx.fillText(pile.label, px + PILE_WIDTH / 2, py + 28);

      // Draw packages stacked on this pile
      const stackedPackages = getPackageStack(pile.id, packageOnPile, packageOn, packages);
      stackedPackages.forEach((pkg, stackIndex) => {
        const pkgY = py - (stackIndex + 1) * 35;
        drawContainer(ctx, px + PILE_WIDTH / 2, pkgY, pkg.label, false);
      });
    });

    // === TRUCK (below depot) ===
    const depotTrucks = trucks.filter(t => truckAt.get(t.id) === depot.id);
    depotTrucks.forEach((truck, truckIndex) => {
      const tx = area.truckX + truckIndex * 120;
      const ty = area.truckY;

      // Draw truck image
      const truckW = 100;
      const truckH = 60;
      
      if (truckImg.complete && truckImg.naturalWidth > 0) {
        ctx.drawImage(truckImg, tx, ty, truckW, truckH);
      } else {
        // Fallback: draw simple truck shape
        ctx.fillStyle = "#607D8B";
        ctx.fillRect(tx, ty + 15, 60, 30);
        ctx.fillRect(tx + 60, ty + 20, 30, 25);
        ctx.fillStyle = "#455A64";
        ctx.beginPath();
        ctx.arc(tx + 20, ty + 50, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(tx + 50, ty + 50, 8, 0, Math.PI * 2);
        ctx.fill();
      }

      // Truck label
      ctx.fillStyle = "#37474F";
      ctx.font = "bold 12px Arial";
      ctx.textAlign = "center";
      ctx.fillText(truck.label, tx + truckW / 2, ty + truckH + 15);

      // Draw packages in truck (stacked on the back/left part)
      const packagesInThisTruck = packages.filter(p => packageInTruck.get(p.id) === truck.id);
      packagesInThisTruck.forEach((pkg, pkgIndex) => {
        // Stack containers on the back of the truck (left side of the image)
        const containerX = tx + 25;
        const containerY = ty - 10 - pkgIndex * 30;
        drawContainer(ctx, containerX, containerY, pkg.label, false, 0.8);
      });
    });
  }

  // ---------- LEGEND ----------
  drawLegend(ctx, W, H);
}

// ================= HELPER FUNCTIONS =================

// Draw a claw (crane gripper)
function drawClaw(ctx: CanvasRenderingContext2D, x: number, y: number, label: string) {
  // Claw body
  ctx.fillStyle = "#FF7043";
  ctx.strokeStyle = "#E64A19";
  ctx.lineWidth = 2;

  // Main claw housing
  ctx.beginPath();
  ctx.roundRect(x - 15, y - 10, 30, 20, 4);
  ctx.fill();
  ctx.stroke();

  // Left claw arm
  ctx.beginPath();
  ctx.moveTo(x - 12, y + 10);
  ctx.lineTo(x - 18, y + 30);
  ctx.lineTo(x - 8, y + 30);
  ctx.lineTo(x - 5, y + 10);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Right claw arm
  ctx.beginPath();
  ctx.moveTo(x + 12, y + 10);
  ctx.lineTo(x + 18, y + 30);
  ctx.lineTo(x + 8, y + 30);
  ctx.lineTo(x + 5, y + 10);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Claw label
  ctx.fillStyle = "#fff";
  ctx.font = "bold 9px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, x, y);
}

// Draw a container/package
function drawContainer(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  label: string,
  isHeld: boolean = false,
  scale: number = 1
) {
  const w = 45 * scale;
  const h = 28 * scale;

  // Container body
  const gradient = ctx.createLinearGradient(cx - w/2, cy - h/2, cx - w/2, cy + h/2);
  gradient.addColorStop(0, isHeld ? "#FFCA28" : "#FFC107");
  gradient.addColorStop(1, isHeld ? "#FFB300" : "#FFA000");
  
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.roundRect(cx - w/2, cy - h/2, w, h, 3);
  ctx.fill();

  // Container border
  ctx.strokeStyle = isHeld ? "#FF8F00" : "#FF6F00";
  ctx.lineWidth = isHeld ? 3 : 2;
  ctx.stroke();

  // Container ridges (shipping container look)
  ctx.strokeStyle = "rgba(0,0,0,0.15)";
  ctx.lineWidth = 1;
  for (let i = 1; i < 4; i++) {
    const rx = cx - w/2 + (w * i / 4);
    ctx.beginPath();
    ctx.moveTo(rx, cy - h/2 + 3);
    ctx.lineTo(rx, cy + h/2 - 3);
    ctx.stroke();
  }

  // Label
  ctx.fillStyle = "#5D4037";
  ctx.font = `bold ${10 * scale}px Arial`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, cx, cy);

  // Held indicator (glow effect)
  if (isHeld) {
    ctx.shadowColor = "#FFCA28";
    ctx.shadowBlur = 10;
    ctx.strokeStyle = "#FF8F00";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(cx - w/2 - 2, cy - h/2 - 2, w + 4, h + 4, 4);
    ctx.stroke();
    ctx.shadowBlur = 0;
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

// Draw legend
function drawLegend(ctx: CanvasRenderingContext2D, W: number, H: number) {
  const legendX = 15;
  const legendY = H - 110;

  ctx.fillStyle = "rgba(255,255,255,0.95)";
  ctx.beginPath();
  ctx.roundRect(legendX - 5, legendY - 5, 140, 100, 6);
  ctx.fill();
  ctx.strokeStyle = "#ddd";
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.font = "bold 11px Arial";
  ctx.fillStyle = "#455A64";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText("LEGEND", legendX, legendY + 8);

  // Depot
  ctx.fillStyle = "#B0BEC5";
  ctx.fillRect(legendX, legendY + 22, 16, 12);
  ctx.strokeStyle = "#78909C";
  ctx.lineWidth = 1;
  ctx.strokeRect(legendX, legendY + 22, 16, 12);
  ctx.fillStyle = "#546E7A";
  ctx.font = "10px Arial";
  ctx.fillText("Depot", legendX + 22, legendY + 28);

  // Crane
  ctx.fillStyle = "#FF7043";
  ctx.beginPath();
  ctx.roundRect(legendX, legendY + 40, 16, 12, 2);
  ctx.fill();
  ctx.fillStyle = "#546E7A";
  ctx.fillText("Crane", legendX + 22, legendY + 46);

  // Pile
  ctx.fillStyle = "#8D6E63";
  ctx.fillRect(legendX, legendY + 58, 16, 8);
  ctx.fillStyle = "#546E7A";
  ctx.fillText("Pile", legendX + 22, legendY + 62);

  // Container
  ctx.fillStyle = "#FFC107";
  ctx.beginPath();
  ctx.roundRect(legendX, legendY + 74, 16, 10, 2);
  ctx.fill();
  ctx.strokeStyle = "#FF6F00";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = "#546E7A";
  ctx.fillText("Container", legendX + 22, legendY + 79);
}
