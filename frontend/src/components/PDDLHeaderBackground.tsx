import { useEffect, useRef } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────
type PlanAction =
  | { block: string; to: { kind: "table"; slot: number } }
  | { block: string; to: { kind: "on"; onBlock: string } };

type WorldEntry = { support: string; slot: number | null };
type BlockStyle = { fill: string; top: string; side: string; text: string };
type Particle = {
  sx: number; sy: number; tx: number; ty: number;
  mx: number; my: number; t0: number; dur: number;
  color: string; size: number;
};
type Phase =
  | "idle" | "approach" | "descend" | "grab" | "ascend"
  | "move" | "place" | "release" | "retreat" | "done";

// ─── Component ────────────────────────────────────────────────────────────────
interface PDDLHeaderBackgroundProps {
  height?: number;
  /** CSS left offset — use to push the canvas away from the title area, e.g. "45%" */
  left?: string | number;
  /**
   * Which half of the scene to render:
   * • "full"          — code + blocks + particles (default — matches old behavior)
   * • "code"          — only the dissolving PDDL text, particles fly off the right edge
   * • "scene"         — only the blocks-world stage, no code, no particles
   * • "welcome-hero"  — code on the far left, blocks-world vertically centered
   *                    on the far right, particles cross the whole canvas so
   *                    they're visible through the centre column
   */
  view?: "full" | "code" | "scene" | "welcome-hero";
}

export const PDDLHeaderBackground = ({
  left = 0, view = "full",
}: PDDLHeaderBackgroundProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Cap DPR at 1.5 on mobile for performance, 2 on desktop
    const isMobile = window.innerWidth < 768;
    const dpr = Math.min(window.devicePixelRatio || 1, isMobile ? 1.5 : 2);

    let W = 0, H = 0;

    function resize() {
      const rect = canvas!.getBoundingClientRect();
      W = rect.width; H = rect.height;
      canvas!.width  = W * dpr;
      canvas!.height = H * dpr;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();

    // ── PDDL text & plan (identical to prototype) ─────────────────────────
    const PDDL_LINES = [
      "(:init (on-table A)",
      "       (on B A)",
      "       (on C B))",
      "(:goal (and (on A B)",
      "            (on B C)))",
    ];

    const PLAN: PlanAction[] = [
      { block: "C", to: { kind: "table", slot: 1 } },   // unstack C → table
      { block: "B", to: { kind: "table", slot: 2 } },   // unstack B → table
      { block: "B", to: { kind: "on", onBlock: "C" } }, // B on C (both clear) ✓
      { block: "A", to: { kind: "on", onBlock: "B" } }, // A on B (both clear) ✓
    ];

    const BLOCK_STYLES: Record<string, BlockStyle> = {
      A: { fill: "#8b7fd8", top: "#a89cee", side: "#6d63b8", text: "#1a1333" },
      B: { fill: "#6d8cf0", top: "#8ba6ff", side: "#4e6cc2", text: "#0a1833" },
      C: { fill: "#b794f4", top: "#d0b4ff", side: "#8e6dc8", text: "#2a1544" },
    };

    // ── Layout ───────────────────────────────────────────────────────────────
    function layout() {
      const isScene  = view === "scene";
      const isCode   = view === "code";
      const isWelcome = view === "welcome-hero";
      const codeBig  = isCode || isWelcome;
      const tallStage = isScene || isWelcome;

      // Scene position. In welcome-hero we tuck the blocks into the right
      // ~25% so they sit beside the centre summary column; in scene-only we
      // expand to fill the canvas; otherwise we keep the original frame.
      const sceneX = isScene   ? W * 0.04
                   : isWelcome ? W * 0.72
                   :             W * 0.38;
      const sceneW = isScene   ? W * 0.92
                   : isWelcome ? W * 0.25
                   :             W * 0.60;

      // Vertical anchors. tallStage centres the scene vertically inside the
      // canvas (rail near 1/3 down, ground at 2/3) so blocks read as
      // mid-height rather than glued to the bottom.
      const railY   = tallStage ? H * 0.32 : Math.max(10, H * 0.10);
      const groundY = tallStage ? H * 0.72 : H * 0.82;

      // Block size — larger in the tall stages where we have vertical room.
      const bh = tallStage
        ? Math.max(28, Math.min(42, H * 0.055))
        : Math.max(20, Math.min(34, H * 0.22));
      const bw = bh * 1.1;
      const slotXs = [
        sceneX + sceneW * 0.22,
        sceneX + sceneW * 0.50,
        sceneX + sceneW * 0.78,
      ];

      // When we render code as a primary element (not just a header strip),
      // use a bigger font and more line-height for readability.
      const textSize = codeBig
        ? Math.max(13, Math.min(18, H * 0.022))
        : Math.max(11, Math.min(13, H * 0.135));
      const lineH    = codeBig
        ? Math.max(20, Math.min(30, H * 0.035))
        : Math.max(16, Math.min(19, H * 0.18));
      const textTop  = codeBig
        ? Math.max(20, (H - lineH * 5) / 2)
        : Math.max(6, (H - lineH * 5) / 2 + 1);
      return {
        sceneX, sceneW, groundY, bw, bh,
        slot: (i: number) => slotXs[i],
        railY,
        textX: codeBig ? Math.max(24, W * 0.06) : 20,
        textTop,
        lineH,
        textSize,
      };
    }
    let L = layout();

    // ── World model ──────────────────────────────────────────────────────────
    let world: Record<string, WorldEntry>;

    function resetWorld() {
      world = {
        A: { support: "table", slot: 0 },
        B: { support: "A",     slot: null },
        C: { support: "B",     slot: null },
      };
    }
    resetWorld();

    function stackDepth(b: string): number {
      let n = 0, cur = world[b].support;
      while (cur !== "table") { n++; cur = world[cur].support; }
      return n;
    }
    function rootSlot(b: string): number {
      let cur = b;
      while (world[cur].support !== "table") cur = world[cur].support;
      return world[cur].slot as number;
    }
    function blockPos(b: string) {
      return { x: L.slot(rootSlot(b)), y: L.groundY - (stackDepth(b) + 1) * L.bh };
    }
    function countAtSlot(slot: number, exclude: string): number {
      let n = 0;
      for (const k of Object.keys(world)) {
        if (k !== exclude && rootSlot(k) === slot) n++;
      }
      return n;
    }
    function resolveTarget(action: PlanAction) {
      const t = action.to;
      if (t.kind === "table") {
        const count = countAtSlot(t.slot, action.block);
        return { x: L.slot(t.slot), y: L.groundY - (count + 1) * L.bh };
      } else {
        const onP = blockPos(t.onBlock);
        return { x: onP.x, y: onP.y - L.bh };
      }
    }
    function applyAction(action: PlanAction) {
      const b = action.block;
      if (action.to.kind === "table") {
        world[b] = { support: "table", slot: action.to.slot };
      } else {
        world[b] = { support: action.to.onBlock, slot: null };
      }
    }

    // ── State machine ────────────────────────────────────────────────────────
    const state = {
      phase: "idle" as Phase,
      t0: 0,
      actionIdx: 0,
      gripperX: L.slot(1),
      gripperY: L.railY,
      carrying: null as string | null,
      fromX: 0, fromY: 0,
      toX: 0,   toY: 0,
      approachStartX: 0, approachStartY: 0,
      idleStart: 0,
    };
    state.idleStart = performance.now();

    function beginAction(idx: number) {
      const a = PLAN[idx];
      const from = blockPos(a.block);
      const to   = resolveTarget(a);
      state.fromX = from.x; state.fromY = from.y;
      state.toX   = to.x;   state.toY   = to.y;
      state.approachStartX = state.gripperX;
      state.approachStartY = state.gripperY;
      state.carrying = null;
      state.phase    = "approach";
      state.t0       = performance.now();
    }

    function easeInOut(t: number) {
      return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    }

    // Slower, calmer movement — the arm glides so it doesn't pull the eye
    // away from the heading. Roughly 1.7× the previous timings, with longer
    // pauses between actions.
    const D = {
      approach: 1050, descend: 720, grab:    280, ascend:  720,
      move:     1300, place:   720, release: 280, retreat: 720,
      idleGap:  1300, doneGap: 2200,
    };

    function tick(now: number) {
      const dt = now - state.t0;

      if (state.phase === "idle") {
        if (now - state.idleStart >= D.idleGap) beginAction(state.actionIdx);
        return;
      }
      if (state.phase === "approach") {
        const p = Math.min(1, dt / D.approach), e = easeInOut(p);
        state.gripperX = state.approachStartX + (state.fromX - state.approachStartX) * e;
        state.gripperY = state.approachStartY + (L.railY    - state.approachStartY) * e;
        if (p >= 1) { state.phase = "descend"; state.t0 = now; }
      } else if (state.phase === "descend") {
        const p = Math.min(1, dt / D.descend);
        state.gripperX = state.fromX;
        state.gripperY = L.railY + ((state.fromY - 2) - L.railY) * easeInOut(p);
        if (p >= 1) { state.phase = "grab"; state.t0 = now; }
      } else if (state.phase === "grab") {
        if (dt >= D.grab) {
          state.carrying = PLAN[state.actionIdx].block;
          state.phase = "ascend"; state.t0 = now;
        }
      } else if (state.phase === "ascend") {
        const p = Math.min(1, dt / D.ascend);
        state.gripperY = (state.fromY - 2) + (L.railY - (state.fromY - 2)) * easeInOut(p);
        if (p >= 1) { state.phase = "move"; state.t0 = now; }
      } else if (state.phase === "move") {
        const p = Math.min(1, dt / D.move);
        state.gripperX = state.fromX + (state.toX - state.fromX) * easeInOut(p);
        state.gripperY = L.railY;
        if (p >= 1) { state.phase = "place"; state.t0 = now; }
      } else if (state.phase === "place") {
        const p = Math.min(1, dt / D.place);
        state.gripperX = state.toX;
        state.gripperY = L.railY + ((state.toY - 2) - L.railY) * easeInOut(p);
        if (p >= 1) { state.phase = "release"; state.t0 = now; }
      } else if (state.phase === "release") {
        if (dt >= D.release) {
          applyAction(PLAN[state.actionIdx]);
          state.carrying = null;
          state.phase = "retreat"; state.t0 = now;
        }
      } else if (state.phase === "retreat") {
        const p = Math.min(1, dt / D.retreat);
        state.gripperY = (state.toY - 2) + (L.railY - (state.toY - 2)) * easeInOut(p);
        if (p >= 1) {
          state.actionIdx++;
          if (state.actionIdx >= PLAN.length) {
            state.phase = "done"; state.t0 = now;
          } else {
            beginAction(state.actionIdx);
          }
        }
      } else if (state.phase === "done") {
        if (dt >= D.doneGap) {
          resetWorld();
          state.actionIdx = 0;
          state.phase     = "idle";
          state.idleStart = now;
        }
      }
    }

    // ── Drawing ──────────────────────────────────────────────────────────────
    function drawBlock(x: number, y: number, w: number, h: number, style: BlockStyle, label: string) {
      const left = Math.round(x - w / 2);
      ctx!.fillStyle = style.side;
      ctx!.fillRect(left, y, w, h);
      ctx!.fillStyle = style.top;
      ctx!.fillRect(left, y, w, 3);
      ctx!.fillStyle = style.fill;
      ctx!.fillRect(left, y + 3, w, h - 3);
      ctx!.strokeStyle = "rgba(255,255,255,0.14)";
      ctx!.lineWidth = 0.5;
      ctx!.strokeRect(left + 0.25, y + 0.25, w - 0.5, h - 0.5);
      ctx!.fillStyle = style.text;
      const fs = Math.max(9, h * 0.42);
      ctx!.font = `600 ${fs}px ui-sans-serif, system-ui, sans-serif`;
      ctx!.textAlign    = "center";
      ctx!.textBaseline = "middle";
      ctx!.fillText(label, x, y + h / 2 + 1);
    }

    function drawGripper(x: number, y: number, open: boolean) {
      ctx!.strokeStyle = "rgba(232, 230, 255, 0.32)";
      ctx!.lineWidth   = 1;
      ctx!.setLineDash([2, 3]);
      ctx!.beginPath();
      ctx!.moveTo(x, L.railY - 4);
      ctx!.lineTo(x, y - 5);
      ctx!.stroke();
      ctx!.setLineDash([]);
      ctx!.fillStyle = "#e8e6ff";
      ctx!.fillRect(Math.round(x - 10), Math.round(y - 5), 20, 5);
      const jawGap = open ? 6 : 1.5;
      // left jaw
      ctx!.beginPath();
      ctx!.moveTo(x - 10, y);
      ctx!.lineTo(x - 10 - jawGap, y + 7);
      ctx!.lineTo(x - 6  - jawGap, y + 7);
      ctx!.lineTo(x - 6,  y);
      ctx!.closePath();
      ctx!.fill();
      // right jaw
      ctx!.beginPath();
      ctx!.moveTo(x + 10, y);
      ctx!.lineTo(x + 10 + jawGap, y + 7);
      ctx!.lineTo(x + 6  + jawGap, y + 7);
      ctx!.lineTo(x + 6,  y);
      ctx!.closePath();
      ctx!.fill();
    }

    function drawTable() {
      // Long, exponential-feel fades at both ends so the table looks like it
      // condenses out of the header rather than sitting on top of it.
      const x0 = L.sceneX + 10;
      const x1 = L.sceneX + L.sceneW - 10;
      const topGrad = ctx!.createLinearGradient(x0, 0, x1, 0);
      topGrad.addColorStop(0,    "rgba(42, 38, 80, 0)");
      topGrad.addColorStop(0.2,  "rgba(42, 38, 80, 0.45)");
      topGrad.addColorStop(0.38, "rgba(42, 38, 80, 0.95)");
      topGrad.addColorStop(0.62, "rgba(42, 38, 80, 0.95)");
      topGrad.addColorStop(0.8,  "rgba(42, 38, 80, 0.45)");
      topGrad.addColorStop(1,    "rgba(42, 38, 80, 0)");
      ctx!.fillStyle = topGrad;
      ctx!.fillRect(x0, L.groundY, x1 - x0, 3);

      const shadowGrad = ctx!.createLinearGradient(x0, 0, x1, 0);
      shadowGrad.addColorStop(0,    "rgba(26, 24, 56, 0)");
      shadowGrad.addColorStop(0.2,  "rgba(26, 24, 56, 0.45)");
      shadowGrad.addColorStop(0.38, "rgba(26, 24, 56, 0.95)");
      shadowGrad.addColorStop(0.62, "rgba(26, 24, 56, 0.95)");
      shadowGrad.addColorStop(0.8,  "rgba(26, 24, 56, 0.45)");
      shadowGrad.addColorStop(1,    "rgba(26, 24, 56, 0)");
      ctx!.fillStyle = shadowGrad;
      ctx!.fillRect(x0, L.groundY + 3, x1 - x0, 1);
    }

    // ── Particle stream ──────────────────────────────────────────────────────
    const particles: Particle[] = [];
    const MAX_PARTICLES   = 70;
    const PARTICLE_COLORS = ["#a78bfa", "#7dd3fc", "#b794f4", "#8b7fd8"];
    let lastSpawn = 0;
    const SPAWN_INTERVAL  = 45; // ms between spawns

    // Per-character dissolve alpha. Each character gets its own opacity that
    // drops when a particle spawns from (or near) it, then slowly recovers.
    // This produces a much more organic "being eaten" vanish than the older
    // per-line dim, because individual letters disappear and re-emerge while
    // their neighbours stay bright.
    const charAlphas: number[][] = PDDL_LINES.map(line =>
      Array.from({ length: line.length }, () => 1.0),
    );

    function spawnParticle(now: number) {
      const li   = Math.floor(Math.random() * PDDL_LINES.length);
      const line = PDDL_LINES[li];
      const ci   = Math.floor(Math.random() * line.length);

      // Drain a small window around the spawn point. The drain is stronger
      // and the floor is lower in code-emphasising views so the text really
      // looks like it vanishes; in the small Visualizer header we keep it
      // gentle so the code stays legible.
      const codePrimary = view === "code" || view === "welcome-hero";
      const drain = codePrimary ? 0.40 : 0.18;
      const floor = codePrimary ? 0.05 : 0.55;
      const spread = 2;
      for (let off = -spread; off <= spread; off++) {
        const k = ci + off;
        if (k < 0 || k >= charAlphas[li].length) continue;
        // Triangular falloff so the centre char dims hardest.
        const factor = 1 - Math.abs(off) / (spread + 1);
        charAlphas[li][k] = Math.max(floor, charAlphas[li][k] - drain * factor);
      }

      // Source position: middle of the eaten character — particles look like
      // they're being pulled directly out of that letter.
      ctx!.font = `${L.textSize}px ui-monospace, SFMono-Regular, Menlo, monospace`;
      const prefix = ctx!.measureText(line.slice(0, ci)).width;
      const chW    = ctx!.measureText(line[ci] ?? " ").width;
      const sx = L.textX + prefix + chW / 2;
      const sy = L.textTop + li * L.lineH;

      // In code-only view, particles fly off the right edge instead of
      // landing on the (non-existent) blocks.
      let tx: number, ty: number, mx: number, my: number;
      if (view === "code") {
        tx = W + 60 + Math.random() * 40;
        ty = sy + (Math.random() - 0.5) * 60;
        mx = (sx + tx) / 2 + (Math.random() - 0.5) * 40;
        my = sy - (15 + Math.random() * 35);
      } else {
        const targets = ["A", "B", "C"];
        const tgt     = targets[Math.floor(Math.random() * 3)];
        let bp: { x: number; y: number };
        if (state.carrying === tgt) {
          bp = { x: state.gripperX, y: state.gripperY + 6 };
        } else {
          bp = blockPos(tgt);
        }
        const jitter = L.bw * 0.5;
        tx = bp.x + (Math.random() - 0.5) * jitter;
        ty = bp.y + L.bh * (0.3 + Math.random() * 0.5);
        mx = (sx + tx) / 2 + (Math.random() - 0.5) * 30;
        my = Math.min(sy, ty) - (20 + Math.random() * 25);
      }

      particles.push({
        sx, sy, tx, ty, mx, my,
        t0:    now,
        // Longer flight time — particles drift gracefully toward the blocks
        dur:   2200 + Math.random() * 1400,
        color: PARTICLE_COLORS[Math.floor(Math.random() * PARTICLE_COLORS.length)],
        size:  1.1 + Math.random() * 1.0,
      });
    }

    function drawParticles(now: number) {
      while (now - lastSpawn > SPAWN_INTERVAL && particles.length < MAX_PARTICLES) {
        spawnParticle(now);
        lastSpawn += SPAWN_INTERVAL;
      }
      // catch up if tab was inactive
      if (now - lastSpawn > SPAWN_INTERVAL * 3) lastSpawn = now;

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        const u = (now - p.t0) / p.dur;
        if (u >= 1) { particles.splice(i, 1); continue; }
        const e = easeInOut(u);
        // quadratic bezier
        const x = (1-e)*(1-e)*p.sx + 2*(1-e)*e*p.mx + e*e*p.tx;
        const y = (1-e)*(1-e)*p.sy + 2*(1-e)*e*p.my + e*e*p.ty;
        // fade in from source, bright mid-flight, fade into target
        const alpha = Math.min(1, 3.2 * e * (1 - e)) * 0.75;
        ctx!.globalAlpha = alpha;
        ctx!.fillStyle   = p.color;
        ctx!.beginPath();
        ctx!.arc(x, y, p.size, 0, Math.PI * 2);
        ctx!.fill();
      }
      ctx!.globalAlpha = 1;
    }

    function drawPDDL() {
      // Per-character recovery. Each character refills on its own clock so
      // letters fade and re-emerge independently of their neighbours.
      const codePrimary = view === "code" || view === "welcome-hero";
      const recover = codePrimary ? 0.0028 : 0.0055;
      for (let li = 0; li < charAlphas.length; li++) {
        const row = charAlphas[li];
        for (let ci = 0; ci < row.length; ci++) {
          row[ci] = Math.min(1, row[ci] + recover);
        }
      }

      const font = `${L.textSize}px ui-monospace, SFMono-Regular, Menlo, monospace`;
      ctx!.font         = font;
      ctx!.textAlign    = "left";
      ctx!.textBaseline = "middle";

      // ── Token coloring regex ────────────────────────────────────────────
      //   1 = PDDL keywords  (:init :goal :objects :domain)
      //   2 = logical ops    (and or not)
      //   3 = predicates     (on-table on at clear handempty)
      //   4 = block labels   (standalone A B C)
      //   5 = parens
      const TOKEN_RE = /(:[a-z][a-z\-]*)|(and|or|not)|(on-table|on|at|clear|handempty)|\b([ABC])\b|([()])/g;

      PDDL_LINES.forEach((line, li) => {
        const y = L.textTop + li * L.lineH;
        const row = charAlphas[li];

        // Build per-char x positions once per frame
        const charX: number[] = new Array(line.length);
        let runX = L.textX;
        for (let ci = 0; ci < line.length; ci++) {
          charX[ci] = runX;
          runX += ctx!.measureText(line[ci]).width;
        }

        // Determine each char's token color, if any
        const tokenColors: (string | null)[] = new Array(line.length).fill(null);
        for (const m of line.matchAll(TOKEN_RE)) {
          let c: string;
          if      (m[1]) c = "rgba(220, 200, 255, 1.00)";  // :keyword — bright lavender
          else if (m[2]) c = "rgba(255, 210, 130, 0.95)";  // and/or/not — amber
          else if (m[3]) c = "rgba(165, 250, 195, 0.92)";  // predicate — green
          else if (m[4]) c = "rgba(165, 230, 255, 1.00)";  // block label — sky
          else           c = "rgba(180, 170, 220, 0.65)";  // paren — dim
          const start = m.index!;
          for (let k = start; k < start + m[0].length; k++) tokenColors[k] = c;
        }

        // Pass 1 — base body colour for every char
        for (let ci = 0; ci < line.length; ci++) {
          const a = row[ci];
          if (a < 0.02) continue;
          ctx!.globalAlpha = a;
          ctx!.fillStyle = "rgba(196, 188, 240, 0.78)";
          ctx!.fillText(line[ci], charX[ci], y);
        }
        // Pass 2 — token colour overlay
        for (let ci = 0; ci < line.length; ci++) {
          const a = row[ci];
          if (a < 0.02 || !tokenColors[ci]) continue;
          ctx!.globalAlpha = a;
          ctx!.fillStyle = tokenColors[ci]!;
          ctx!.fillText(line[ci], charX[ci], y);
        }
      });
      ctx!.globalAlpha = 1;
    }

    function drawScene() {
      // Tight radial glow — radius sized so alpha is genuinely 0 before it
      // can ever reach the canvas edge. Extra intermediate stops give an
      // exponential falloff that's imperceptible at the boundary.
      const cx = L.sceneX + L.sceneW * 0.5;
      const cy = L.groundY - L.bh;
      const rad = Math.min(L.sceneW * 0.55, W * 0.26);
      const grad = ctx!.createRadialGradient(cx, cy, 8, cx, cy, rad);
      grad.addColorStop(0,    "rgba(139, 92, 246, 0.10)");
      grad.addColorStop(0.45, "rgba(139, 92, 246, 0.04)");
      grad.addColorStop(0.8,  "rgba(11, 21, 36, 0.01)");
      grad.addColorStop(1,    "rgba(11, 21, 36, 0)");
      ctx!.fillStyle = grad;
      ctx!.fillRect(0, 0, W, H);

      // Rail line — wider fade zones so both ends dissolve imperceptibly
      const railGrad = ctx!.createLinearGradient(L.sceneX, 0, L.sceneX + L.sceneW, 0);
      railGrad.addColorStop(0,    "rgba(232, 230, 255, 0)");
      railGrad.addColorStop(0.35, "rgba(232, 230, 255, 0.12)");
      railGrad.addColorStop(0.65, "rgba(232, 230, 255, 0.12)");
      railGrad.addColorStop(1,    "rgba(232, 230, 255, 0)");
      ctx!.strokeStyle = railGrad;
      ctx!.lineWidth   = 0.5;
      ctx!.beginPath();
      ctx!.moveTo(L.sceneX,              L.railY - 4);
      ctx!.lineTo(L.sceneX + L.sceneW,  L.railY - 4);
      ctx!.stroke();

      drawTable();

      for (const name of ["A", "B", "C"]) {
        if (state.carrying === name) continue;
        const p = blockPos(name);
        drawBlock(p.x, p.y, L.bw, L.bh, BLOCK_STYLES[name], name);
      }

      const isOpen = !state.carrying;
      drawGripper(state.gripperX, state.gripperY, isOpen);
      if (state.carrying) {
        drawBlock(state.gripperX, state.gripperY + 2, L.bw, L.bh, BLOCK_STYLES[state.carrying], state.carrying);
      }
    }

    // ── RAF loop ─────────────────────────────────────────────────────────────
    let rafId: number;

    function frame() {
      const now = performance.now();
      // Only advance the scene state machine when the scene is visible.
      if (view !== "code") tick(now);
      // Transparent clear — header's own dark bg shows through
      ctx!.clearRect(0, 0, W, H);
      if (view !== "scene") drawPDDL();
      if (view !== "code")  drawScene();
      // Particles connect text → blocks. In code-only they fly off-screen
      // right; in scene-only they're suppressed entirely.
      if (view !== "scene") drawParticles(now);
      rafId = requestAnimationFrame(frame);
    }

    rafId = requestAnimationFrame(frame);

    // Resize handler — mirrors the prototype
    function handleResize() {
      resize();
      L = layout();
      state.gripperX = L.slot(1);
    }
    window.addEventListener("resize", handleResize);

    // Cleanup on unmount
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", handleResize);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <canvas
      ref={canvasRef}
      style={{
        position:      "absolute",
        top:           0,
        bottom:        0,
        right:         0,
        left:          left,
        width:         left ? undefined : "100%",
        height:        "100%",
        display:       "block",
        pointerEvents: "none",
      }}
    />
  );
};
