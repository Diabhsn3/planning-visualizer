import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence, useMotionValue, useMotionValueEvent, animate as motionAnimate } from "framer-motion";
import { trpc } from "@/lib/trpc";
import { Textarea } from "@/components/ui/textarea";
import { StateCanvas } from "@/components/StateCanvas";
import { PDDLHeaderBackground } from "@/components/PDDLHeaderBackground";
import {
  PlayIcon, PauseIcon, SkipForwardIcon, SkipBackIcon,
  UploadIcon, FileCodeIcon, AlertIcon, ClockIcon, ZapIcon,
  CheckCircleIcon,
  ChevronDownIcon, WandIcon, RefreshIcon, BrainIcon,
  MenuIcon, CloseIcon, TerminalIcon,
  BlocksWorldIcon, GripperIcon, DepotIcon, HanoiIcon, RoverIcon, SatelliteIcon,
  SparklesIcon,
} from "@/components/Icons";

interface SearchStrategy {
  id: string; name: string; description: string;
  isOptimal: boolean; speed: "fast" | "medium" | "slow";
  whenToUse: string; warning: string | null;
}

// ─── Animation tokens ────────────────────────────────────────────────────────
const easeOut: [number, number, number, number] = [0.23, 1, 0.32, 1];
const spring = { type: "spring", stiffness: 380, damping: 34 } as const;

const fadeInUp = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit:    { opacity: 0, y: -4 },
};

const modalVariants = {
  initial: { opacity: 0, scale: 0.96, y: 8 },
  animate: { opacity: 1, scale: 1,    y: 0 },
  exit:    { opacity: 0, scale: 0.96, y: 4 },
};

const listStagger = {
  animate: { transition: { staggerChildren: 0.04, delayChildren: 0.02 } },
};

const listItem = {
  initial: { opacity: 0, x: -8 },
  animate: { opacity: 1, x: 0  },
};

// ─── Ambient background orbs ─────────────────────────────────────────────────
const AmbientOrbs = () => (
  <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
    <div className="orb-a absolute rounded-full"
      style={{ width: 900, height: 900, top: -200, left: -180,
        background: "radial-gradient(circle, rgba(34,197,94,0.22) 0%, transparent 65%)" }} />
    <div className="orb-b absolute rounded-full"
      style={{ width: 700, height: 700, bottom: -150, right: -120,
        background: "radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 65%)" }} />
    <div className="orb-c absolute rounded-full"
      style={{ width: 500, height: 500, top: "40%", right: "18%",
        background: "radial-gradient(circle, rgba(6,182,212,0.12) 0%, transparent 65%)" }} />
  </div>
);

// ─── Animated counter ────────────────────────────────────────────────────────
const AnimatedNumber = ({ value }: { value: number }) => {
  const mv = useMotionValue(value);
  const [display, setDisplay] = useState(value);
  useMotionValueEvent(mv, "change", (v) => setDisplay(Math.round(v)));
  useEffect(() => {
    const ctrl = motionAnimate(mv, value, { duration: 0.4, ease: easeOut });
    return () => ctrl.stop();
  }, [value, mv]);
  return <span className="tabular-nums" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{display}</span>;
};

// ─── Blinking cursor ─────────────────────────────────────────────────────────
const BlinkingCursor = () => (
  <span className="inline-block w-[7px] h-[13px] bg-green-500 ml-0.5 animate-blink"
    style={{ verticalAlign: "middle", borderRadius: "1px" }} />
);

// ─── Planning search-tree (empty state) ─────────────────────────────────────
const PlanningGraph = () => {
  type NodeType = "start" | "state" | "goal" | "dead";
  const nodes: { id: number; x: number; y: number; label: string; type: NodeType }[] = [
    { id: 0, x: 160, y: 28,  label: "S₀", type: "start" },
    { id: 1, x: 80,  y: 100, label: "S₁", type: "state" },
    { id: 2, x: 160, y: 100, label: "S₂", type: "state" },
    { id: 3, x: 240, y: 100, label: "S₃", type: "state" },
    { id: 4, x: 50,  y: 172, label: "S₄", type: "dead"  },
    { id: 5, x: 110, y: 172, label: "S₅", type: "state" },
    { id: 6, x: 160, y: 172, label: "G",  type: "goal"  },
    { id: 7, x: 250, y: 172, label: "S₇", type: "dead"  },
    { id: 8, x: 300, y: 172, label: "S₈", type: "state" },
  ];
  const edges = [
    [0,1],[0,2],[0,3],[1,4],[1,5],[2,6],[3,7],[3,8],
  ];
  const goalPath = new Set([0, 2, 6]);
  const goalEdgeSet = new Set(["0-2","2-6"]);

  return (
    <svg viewBox="0 0 320 200" className="w-full max-w-lg"
      style={{ filter: "drop-shadow(0 0 40px rgba(34,197,94,0.25)) drop-shadow(0 0 80px rgba(99,102,241,0.12))" }}>
      {edges.map(([f, t], i) => {
        const fn = nodes[f], tn = nodes[t];
        const isGoalEdge = goalEdgeSet.has(`${f}-${t}`);
        return (
          <motion.line key={i}
            x1={fn.x} y1={fn.y + 13} x2={tn.x} y2={tn.y - 13}
            stroke={isGoalEdge ? "#22C55E" : "rgba(255,255,255,0.1)"}
            strokeWidth={isGoalEdge ? "1.5" : "0.8"}
            initial={{ opacity: 0, pathLength: 0 }}
            animate={{ opacity: 1, pathLength: 1 }}
            transition={{ duration: 0.45, delay: 0.25 + i * 0.09, ease: easeOut }}
          />
        );
      })}
      {nodes.map((n, i) => {
        const isGoal  = n.type === "goal";
        const isStart = n.type === "start";
        const isDead  = n.type === "dead";
        const isOnPath = goalPath.has(n.id);
        const r = isGoal ? 13 : isStart ? 12 : 10;
        return (
          <motion.g key={n.id}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", delay: 0.08 + i * 0.07, stiffness: 340, damping: 22 }}
            style={{ transformOrigin: `${n.x}px ${n.y}px` }}
          >
            {/* Goal pulsing ring */}
            {isGoal && (
              <motion.circle cx={n.x} cy={n.y} r={18}
                stroke="#22C55E" strokeWidth="0.8" fill="none"
                animate={{ r: [18, 25, 18], opacity: [0.25, 0, 0.25] }}
                transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
              />
            )}
            {/* Start pulsing ring */}
            {isStart && (
              <motion.circle cx={n.x} cy={n.y} r={16}
                stroke="#6366F1" strokeWidth="0.7" fill="none"
                animate={{ r: [16, 22, 16], opacity: [0.2, 0, 0.2] }}
                transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
              />
            )}
            <circle cx={n.x} cy={n.y} r={r}
              fill={isGoal ? "rgba(34,197,94,0.15)" : isStart ? "rgba(99,102,241,0.15)" : isDead ? "rgba(255,255,255,0.02)" : "rgba(255,255,255,0.04)"}
              stroke={isGoal ? "#22C55E" : isStart ? "#6366F1" : isOnPath ? "#22C55E" : isDead ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.15)"}
              strokeWidth={isGoal || isStart ? "1.5" : "1"}
            />
            <text x={n.x} y={n.y + 4} textAnchor="middle" fontSize="7.5"
              fill={isGoal ? "#22C55E" : isStart ? "#A5B4FC" : isOnPath ? "#86EFAC" : isDead ? "#374151" : "#475569"}
              fontFamily="JetBrains Mono, monospace"
              fontWeight={isGoal || isStart ? "600" : "400"}
            >
              {n.label}
            </text>
          </motion.g>
        );
      })}
    </svg>
  );
};

// ─── Processing scan beam ────────────────────────────────────────────────────
const ScanBeam = () => (
  <motion.div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ borderRadius: "inherit", zIndex: 2 }}>
    <motion.div className="absolute left-0 right-0 h-px"
      style={{ background: "linear-gradient(90deg, transparent 0%, rgba(34,197,94,0.5) 30%, rgba(34,197,94,0.9) 50%, rgba(34,197,94,0.5) 70%, transparent 100%)" }}
      animate={{ top: ["0%", "100%"] }}
      transition={{ duration: 2.5, repeat: Infinity, ease: "linear" }}
    />
    <motion.div className="absolute left-0 right-0 h-8"
      style={{ background: "linear-gradient(180deg, rgba(34,197,94,0.04) 0%, transparent 100%)" }}
      animate={{ top: ["-32px", "calc(100% + 32px)"] }}
      transition={{ duration: 2.5, repeat: Infinity, ease: "linear" }}
    />
  </motion.div>
);

// ─── Collapsible wrapper ─────────────────────────────────────────────────────
const CollapseSection = ({ open, children }: { open: boolean; children: React.ReactNode }) => (
  <AnimatePresence>
    {open && (
      <motion.div
        initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
        exit={{ height: 0, opacity: 0 }}
        transition={{ type: "spring", stiffness: 400, damping: 36 }}
        style={{ overflow: "hidden" }}
      >
        {children}
      </motion.div>
    )}
  </AnimatePresence>
);

// ─── Pill toggle ─────────────────────────────────────────────────────────────
const PillToggle = ({
  options, value, onChange,
}: { options: { id: string; label: React.ReactNode }[]; value: string; onChange: (v: string) => void }) => (
  <div className="flex bg-white/[0.04] rounded-lg p-0.5 border border-white/[0.07]">
    {options.map(o => (
      <button key={o.id} onClick={() => onChange(o.id)}
        className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-md text-xs font-medium transition-all duration-150 ${
          value === o.id
            ? "bg-[#1a2e48] text-slate-100 shadow-sm border border-white/[0.1]"
            : "text-slate-600 hover:text-slate-400"
        }`}>
        {o.label}
      </button>
    ))}
  </div>
);

// ─── Modal backdrop ───────────────────────────────────────────────────────────
const ModalBackdrop = ({ children, onClose }: { children: React.ReactNode; onClose: () => void }) => (
  <motion.div
    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    transition={{ duration: 0.18 }}
    onClick={onClose}
    className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
  >
    <motion.div {...modalVariants} transition={{ type: "spring", stiffness: 350, damping: 28 }}
      onClick={e => e.stopPropagation()}>
      {children}
    </motion.div>
  </motion.div>
);

// ─── Custom-domain LLM loading state ─────────────────────────────────────────
// Shown in the visualization box while the two LLM calls (transformer →
// renderer) are pending for a custom domain.

type LoadingStage = "transformer" | "renderer";

const StepPill = ({
  n, label, state,
}: { n: number; label: string; state: "pending" | "active" | "done" }) => (
  <div className="flex items-center gap-2">
    <div className={`relative w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold transition-colors ${
      state === "done"
        ? "bg-green-500/15 text-green-400 ring-1 ring-green-500/35"
        : state === "active"
        ? "bg-purple-500/20 text-purple-300 ring-1 ring-purple-500/45"
        : "bg-white/[0.04] text-slate-600 ring-1 ring-white/[0.06]"
    }`}>
      {state === "active" && (
        <motion.span
          className="absolute inset-[-2px] rounded-full ring-1 ring-purple-400/70 pointer-events-none"
          animate={{ scale: [1, 1.55], opacity: [0.55, 0] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeOut" }}
        />
      )}
      {state === "done" ? <CheckCircleIcon className="w-3.5 h-3.5" /> : <span>{n}</span>}
    </div>
    <span className={`text-[11px] uppercase tracking-wider font-semibold ${
      state === "done"   ? "text-green-400/85"
      : state === "active" ? "text-purple-200"
      : "text-slate-600"
    }`}>{label}</span>
  </div>
);

const FloatingParticles = () => {
  const particles = Array.from({ length: 16 }, (_, i) => ({
    id:       i,
    x:        5  + (i * 37) % 90,
    y:        10 + (i * 53) % 80,
    delay:    (i * 0.41) % 4,
    duration: 5  + (i * 0.31) % 4,
    color:    i % 3 === 0 ? "#a78bfa" : i % 3 === 1 ? "#7dd3fc" : "#d8b4fe",
  }));
  return (
    <div className="absolute inset-0 pointer-events-none">
      {particles.map(p => (
        <motion.div key={p.id}
          className="absolute w-1 h-1 rounded-full"
          style={{ left: `${p.x}%`, top: `${p.y}%`, background: p.color }}
          animate={{ y: [0, -22, 0], opacity: [0, 0.7, 0] }}
          transition={{ duration: p.duration, repeat: Infinity, ease: "easeInOut", delay: p.delay }}
        />
      ))}
    </div>
  );
};

// ── Stage 1 icon: an animated PDDL document being parsed ────────────────────
const AnalyzingIcon = () => {
  // code lines, each with width + syntax-coloured tint
  const lines = [
    { y: 30, w: 56, color: "#c4b5fd" }, // (define
    { y: 42, w: 38, color: "#a5e3ff" }, //   (domain
    { y: 54, w: 64, color: "#d8b4fe" }, //   (:predicates
    { y: 66, w: 30, color: "#fbcfe8" }, //     (on ?x ?y)
    { y: 78, w: 50, color: "#a5e3ff" }, //     (clear ?x)
    { y: 90, w: 44, color: "#c4b5fd" }, //   (:action pick-up
  ];

  return (
    <svg viewBox="0 0 128 128" className="absolute inset-0 w-full h-full" overflow="visible">
      <defs>
        <linearGradient id="anaScan" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%"   stopColor="#a78bfa" stopOpacity="0" />
          <stop offset="50%"  stopColor="#a78bfa" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#a78bfa" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="anaPaper" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#1a1f3a" />
          <stop offset="100%" stopColor="#0f1428" />
        </linearGradient>
      </defs>

      {/* document body with folded corner */}
      <motion.g
        animate={{ y: [0, -1.5, 0] }}
        transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
      >
        <path
          d="M 28 14 L 88 14 L 100 26 L 100 110 L 28 110 Z"
          fill="url(#anaPaper)"
          stroke="rgba(167,139,250,0.4)"
          strokeWidth="1"
        />
        <path
          d="M 88 14 L 88 26 L 100 26"
          fill="rgba(167,139,250,0.12)"
          stroke="rgba(167,139,250,0.4)"
          strokeWidth="1"
        />

        {/* code lines that pulse as the scan crosses */}
        {lines.map((ln, i) => {
          const phase = (ln.y - 22) / 92; // 0..1
          return (
            <motion.rect
              key={i}
              x="36" y={ln.y} width={ln.w} height="3" rx="1.5"
              fill={ln.color}
              animate={{ opacity: [0.18, 0.95, 0.35, 0.18] }}
              transition={{
                duration: 2.6,
                repeat: Infinity,
                ease: "easeInOut",
                times: [0, Math.max(0.05, phase), Math.min(0.95, phase + 0.2), 1],
              }}
            />
          );
        })}

        {/* scanning beam */}
        <motion.g
          animate={{ y: [22, 100, 22] }}
          transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
        >
          <rect x="30" y="-10" width="68" height="16" fill="url(#anaScan)" opacity="0.55" />
          <line x1="30" y1="0" x2="98" y2="0"
            stroke="#c4b5fd" strokeWidth="1.2" strokeLinecap="round" />
          <circle cx="30" cy="0" r="1.6" fill="#a78bfa" />
          <circle cx="98" cy="0" r="1.6" fill="#a78bfa" />
        </motion.g>
      </motion.g>

      {/* extracted tokens floating upward out of the document */}
      {[
        { x: 46, delay: 0,   color: "#c4b5fd" },
        { x: 64, delay: 0.7, color: "#a5e3ff" },
        { x: 80, delay: 1.4, color: "#d8b4fe" },
        { x: 56, delay: 2.1, color: "#fbcfe8" },
      ].map((t, i) => (
        <motion.circle
          key={i}
          cx={t.x} r="1.8"
          fill={t.color}
          initial={{ cy: 80, opacity: 0 }}
          animate={{ cy: [80, 8], opacity: [0, 0.9, 0] }}
          transition={{ duration: 2.8, repeat: Infinity, ease: "easeOut", delay: t.delay }}
        />
      ))}

      {/* magnifying-glass annotation in the upper-right */}
      <motion.g
        animate={{ x: [0, 4, 0], y: [0, -3, 0], rotate: [-4, 6, -4] }}
        transition={{ duration: 3.6, repeat: Infinity, ease: "easeInOut" }}
        style={{ transformOrigin: "108px 24px" }}
      >
        <circle cx="108" cy="24" r="9"
          fill="rgba(167,139,250,0.08)"
          stroke="#c4b5fd" strokeWidth="1.4" />
        <line x1="115" y1="31" x2="122" y2="38"
          stroke="#c4b5fd" strokeWidth="1.6" strokeLinecap="round" />
      </motion.g>
    </svg>
  );
};

// ── Stage 2 icon: an animated canvas being painted ──────────────────────────
const RenderingIcon = () => {
  const cycle = 4.6;
  // Each shape draws in, holds, then fades as the cycle restarts
  const drawAnim = (begin: number) => ({
    duration: cycle,
    repeat: Infinity,
    ease: "easeInOut" as const,
    times: [0, begin, begin + 0.12, 0.88, 1],
  });

  return (
    <svg viewBox="0 0 128 128" className="absolute inset-0 w-full h-full" overflow="visible">
      <defs>
        <linearGradient id="renCanvas" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#11172e" />
          <stop offset="100%" stopColor="#0a1024" />
        </linearGradient>
      </defs>

      {/* canvas surface */}
      <rect x="20" y="22" width="88" height="84" rx="3"
        fill="url(#renCanvas)"
        stroke="rgba(125,211,252,0.32)" strokeWidth="1" />

      {/* corner crop marks */}
      {[
        { x: 14, y: 16, d: "M 6 0 L 0 0 L 0 6" },
        { x: 114, y: 16, d: "M -6 0 L 0 0 L 0 6" },
        { x: 14, y: 112, d: "M 6 0 L 0 0 L 0 -6" },
        { x: 114, y: 112, d: "M -6 0 L 0 0 L 0 -6" },
      ].map((c, i) => (
        <motion.path key={i}
          d={c.d}
          stroke="#7dd3fc" strokeWidth="1" strokeLinecap="round" fill="none"
          transform={`translate(${c.x} ${c.y})`}
          animate={{ opacity: [0.3, 0.8, 0.3] }}
          transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut", delay: i * 0.18 }}
        />
      ))}

      {/* baseline grid that breathes */}
      <motion.g
        animate={{ opacity: [0.05, 0.14, 0.05] }}
        transition={{ duration: 3.4, repeat: Infinity, ease: "easeInOut" }}
      >
        {[36, 50, 64, 78, 92].map(y => (
          <line key={y} x1="24" y1={y} x2="104" y2={y}
            stroke="#7dd3fc" strokeWidth="0.4" />
        ))}
      </motion.g>

      {/* shape 1: rectangle */}
      <motion.rect
        x="32" y="40" width="22" height="22" rx="2"
        fill="rgba(167,139,250,0.18)"
        stroke="#a78bfa" strokeWidth="1.4"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{
          pathLength: [0, 0, 1, 1, 0],
          opacity:    [0, 0, 1, 1, 0],
        }}
        transition={drawAnim(0.04)}
      />

      {/* shape 2: circle */}
      <motion.circle
        cx="84" cy="50" r="11"
        fill="rgba(125,211,252,0.18)"
        stroke="#7dd3fc" strokeWidth="1.4"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{
          pathLength: [0, 0, 1, 1, 0],
          opacity:    [0, 0, 1, 1, 0],
        }}
        transition={drawAnim(0.22)}
      />

      {/* shape 3: triangle */}
      <motion.path
        d="M 56 90 L 72 70 L 88 90 Z"
        fill="rgba(216,180,254,0.18)"
        stroke="#d8b4fe" strokeWidth="1.4" strokeLinejoin="round"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{
          pathLength: [0, 0, 1, 1, 0],
          opacity:    [0, 0, 1, 1, 0],
        }}
        transition={drawAnim(0.42)}
      />

      {/* shape 4: connector line between rect and circle */}
      <motion.line
        x1="54" y1="51" x2="73" y2="50"
        stroke="#fbcfe8" strokeWidth="1.4" strokeLinecap="round"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{
          pathLength: [0, 0, 1, 1, 0],
          opacity:    [0, 0, 0.9, 0.9, 0],
        }}
        transition={drawAnim(0.62)}
      />

      {/* pen cursor that hops between shape anchors on the same cycle */}
      <motion.g
        animate={{
          x: [32,  32, 84, 72,  64, 32],
          y: [40,  40, 50, 70,  50, 40],
          rotate: [-12, -12, -4, -18, -8, -12],
        }}
        transition={{
          duration: cycle, repeat: Infinity, ease: "easeInOut",
          times: [0, 0.04, 0.22, 0.42, 0.62, 1],
        }}
      >
        {/* pen body */}
        <path d="M 0 0 L 10 -3 L 14 1 L 4 4 Z" fill="#c4b5fd" />
        <path d="M 0 0 L -3 4 L 1 5 L 4 4 Z" fill="#a78bfa" />
        <circle cx="-2.5" cy="4.5" r="1.4" fill="#fbcfe8" />
        {/* tiny ink tick that pulses each time the pen lands */}
        <motion.circle
          cx="-2.5" cy="6" r="2"
          fill="#fbcfe8"
          animate={{ opacity: [0, 0.8, 0], scale: [0.6, 1.6, 0.6] }}
          transition={{
            duration: cycle, repeat: Infinity, ease: "easeOut",
            times: [0, 0.06, 0.18],
          }}
        />
      </motion.g>
    </svg>
  );
};

const CustomDomainLoading = ({
  stage, domainName,
}: { stage: LoadingStage; domainName: string }) => {
  const copy = stage === "transformer"
    ? { title: "Reading domain structure", desc: "Identifying objects, predicates, and how they relate" }
    : { title: "Composing visualization",   desc: "Drawing the visual primitives that match your domain" };

  // glow tint shifts with the active stage — purple for analyze, sky for render
  const glow = stage === "transformer"
    ? "rgba(167,139,250,0.28)"
    : "rgba(125,211,252,0.26)";

  return (
    <div className="relative w-full h-[420px] flex items-center justify-center overflow-hidden rounded-xl"
      style={{ background: "radial-gradient(ellipse at 50% 38%, rgba(167,139,250,0.07) 0%, rgba(11,21,36,0) 62%)" }}>

      {/* Drawing-surface grid */}
      <div className="absolute inset-0 opacity-[0.035] pointer-events-none"
        style={{
          backgroundImage: "linear-gradient(rgba(167,139,250,1) 1px, transparent 1px), linear-gradient(90deg, rgba(167,139,250,1) 1px, transparent 1px)",
          backgroundSize:  "32px 32px",
        }}
      />

      <FloatingParticles />

      <div className="relative flex flex-col items-center px-6 text-center">
        {/* Animated stage emblem — crossfades between Analyze and Render */}
        <div className="relative w-32 h-32 mb-7">
          <motion.div
            className="absolute inset-[-14px] rounded-full"
            style={{ background: `radial-gradient(circle, ${glow} 0%, transparent 70%)` }}
            animate={{ scale: [1, 1.18, 1], opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
          />
          <AnimatePresence mode="wait">
            <motion.div key={stage}
              className="absolute inset-0"
              initial={{ opacity: 0, scale: 0.92, rotate: -3 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              exit={{ opacity: 0, scale: 0.92, rotate: 3 }}
              transition={{ duration: 0.42, ease: easeOut }}
            >
              {stage === "transformer" ? <AnalyzingIcon /> : <RenderingIcon />}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Stage text crossfades when stage flips */}
        <AnimatePresence mode="wait">
          <motion.div key={stage}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.32, ease: easeOut }}
          >
            <h3 className="text-base font-semibold text-slate-100 tracking-tight"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}>
              {copy.title}
            </h3>
            <p className="text-xs text-slate-500 mt-2 max-w-md leading-relaxed">
              {copy.desc}
              {domainName && stage === "transformer" && (
                <> in <span className="text-purple-300/85 font-medium">{domainName}</span></>
              )}…
            </p>
          </motion.div>
        </AnimatePresence>

        {/* Step pills with progress connector */}
        <div className="mt-7 flex items-center gap-3">
          <StepPill n={1} label="Analyze" state={stage === "transformer" ? "active" : "done"} />
          <div className="relative w-14 h-[2px] rounded-full bg-white/[0.06] overflow-hidden">
            <motion.div
              className="absolute inset-y-0 left-0"
              style={{ background: "linear-gradient(90deg, #a78bfa, #22c55e)" }}
              initial={{ width: "0%" }}
              animate={{ width: stage === "renderer" ? "100%" : "50%" }}
              transition={{ duration: 0.55, ease: easeOut }}
            />
          </div>
          <StepPill n={2} label="Render" state={stage === "renderer" ? "active" : "pending"} />
        </div>

        <p className="text-[10px] text-slate-600 mt-6 uppercase tracking-[0.22em]">
          The AI is working · this usually takes 2–3 minutes
        </p>
      </div>
    </div>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────
export default function Visualizer() {
  const [selectedDomain, setSelectedDomain]     = useState("blocks-world");
  const [selectedStrategy, setSelectedStrategy] = useState("astar-lmcut");
  const [problemType, setProblemType]           = useState<"example" | "custom">("example");
  const [inputMode, setInputMode]               = useState<"file" | "text">("file");
  const [problemFile, setProblemFile]           = useState<File | null>(null);
  const [problemText, setProblemText]           = useState("");
  const [renderedStates, setRenderedStates]     = useState<any[]>([]);
  const [plan, setPlan]                         = useState<string[]>([]);
  const [currentStateIndex, setCurrentStateIndex] = useState(0);
  const [isPlaying, setIsPlaying]               = useState(false);
  const [playbackSpeed, setPlaybackSpeed]       = useState(1000);
  const [plannerInfo, setPlannerInfo]           = useState<{ used_planner: boolean; info: string; strategy?: any } | null>(null);
  const [elapsedTime, setElapsedTime]           = useState(0);
  const [isProcessing, setIsProcessing]         = useState(false);
  const [isDomainOpen, setIsDomainOpen]         = useState(true);
  const [isStrategyOpen, setIsStrategyOpen]     = useState(false);
  const [isRenderModeOpen, setIsRenderModeOpen] = useState(false);
  const [showExampleProblem, setShowExampleProblem]     = useState(false);
  const [showDomainDefinition, setShowDomainDefinition] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed]     = useState(false);
  const [showSuccessFlash, setShowSuccessFlash]         = useState(false);

  const playbackIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const planStepsRef        = useRef<HTMLDivElement>(null);
  const usingSavedDomainRef = useRef(false);  // tracks if current upload is from a saved domain

  // LLM Renderer state
  const [renderMode, setRenderMode]           = useState<"basic" | "llm">("basic");
  const [llmProvider, setLlmProvider]         = useState<"claude" | "gemini">("claude");
  const [llmRendererCode, setLlmRendererCode] = useState<string | null>(null);
  const [isLlmGenerating, setIsLlmGenerating] = useState(false);
  const [llmError, setLlmError]               = useState<string | null>(null);
  const [llmModelInfo, setLlmModelInfo]       = useState<string | null>(null);
  const [errorModal, setErrorModal] = useState<{
    show: boolean; title: string; message: string;
    errorType?: string; suggestedDomain?: string; suggestedDomainName?: string;
  }>({ show: false, title: "", message: "" });

  // "Domain already exists" modal — surfaces when an upload's PDDL hash
  // matches one or more entries in the saved-domains library. Lets the
  // user pick a specific existing version to reuse, or proceed with a
  // fresh LLM generation that creates a new versioned entry.
  const [duplicateModal, setDuplicateModal] = useState<{
    show: boolean;
    matches: Array<{
      id: number;
      displayName: string;
      domainName: string;
      provider: string;
      createdAt: string;
      transformerHash: string;
      rendererHash: string;
    }>;
    /** PDDL the user just submitted — used if they pick "Create new". */
    pendingDomainPddl: string;
  }>({ show: false, matches: [], pendingDomainPddl: "" });
  // Custom Domain state
  const [isCustomDomain, setIsCustomDomain]         = useState(false);
  const [customDomainName, setCustomDomainName]     = useState("");
  const [customMode, setCustomMode]                 = useState<"saved" | "new">("saved");
  const [selectedSavedDomainId, setSelectedSavedDomainId] = useState<number | null>(null);
  const [customDomainFile, setCustomDomainFile]     = useState<File | null>(null);
  const [customDomainText, setCustomDomainText]     = useState("");
  const [customDomainInputMode, setCustomDomainInputMode] = useState<"file" | "text">("file");
  const [customProblemFile, setCustomProblemFile]   = useState<File | null>(null);
  const [customProblemText, setCustomProblemText]   = useState("");
  const [customProblemInputMode, setCustomProblemInputMode] = useState<"file" | "text">("file");
  // LLM Transformer state (for custom domains)
  const [llmTransformerCode, setLlmTransformerCode]     = useState<string | null>(null);
  const [isTransformerGenerating, setIsTransformerGenerating] = useState(false);
  const [transformerError, setTransformerError]         = useState<string | null>(null);
  // transformerModelInfo: kept as a no-op setter so callers that previously
  // wrote it don't need to be touched. Read-side was removed when the
  // State Transformer status box was deleted.
  const setTransformerModelInfo = (_v: string | null) => {};
  const [showGeneratedCode, setShowGeneratedCode] = useState(false);

  // Format a byte count like "1234" -> "1.2 KB" / "768 B"
  const formatBytes = (n: number): string => {
    if (!n || n < 1024) return `${n} B`;
    const kb = n / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    return `${(kb / 1024).toFixed(2)} MB`;
  };

  const strategiesQuery      = trpc.visualizer.listStrategies.useQuery();
  const savedDomainsQuery    = trpc.visualizer.listSavedDomains.useQuery(undefined, { enabled: isCustomDomain, staleTime: 30000, refetchOnWindowFocus: false, refetchOnMount: false, retry: 1 });
  const loadSavedDomainQuery = trpc.visualizer.loadSavedDomain.useQuery(
    { id: selectedSavedDomainId! }, { enabled: !!selectedSavedDomainId, staleTime: 60000, refetchOnWindowFocus: false, refetchOnMount: false, retry: 1 }
  );
  const saveDomainMutation   = trpc.visualizer.saveDomainToLibrary.useMutation({
    onSuccess: (data) => {
      console.log("[SavedDomains] Domain saved to library:", data.displayName);
      savedDomainsQuery.refetch();
      // Auto-switch to saved domains section and select the new domain
      setCustomMode("saved");
      setSelectedSavedDomainId(data.id);
    },
    onError: (err) => {
      console.error("[SavedDomains] Failed to save domain:", err.message);
    },
  });
  const domainDefinitionQuery = trpc.visualizer.getDomainDefinition.useQuery(
    { domainName: selectedDomain as any }, { enabled: showDomainDefinition }
  );

  const domains = [
    { id: "blocks-world", name: "Blocks World",  description: "Classic block stacking",              Icon: BlocksWorldIcon },
    { id: "gripper",      name: "Gripper",        description: "Robot gripper moving balls",          Icon: GripperIcon     },
    { id: "depot",        name: "Depot",          description: "Truck & crane depot logistics",       Icon: DepotIcon       },
    { id: "hanoi",        name: "Hanoi",          description: "Tower of Hanoi disk puzzle",          Icon: HanoiIcon       },
    { id: "rovers",       name: "Rovers",         description: "Planetary exploration mission",       Icon: RoverIcon       },
    { id: "satellite",    name: "Satellite",      description: "Orbital imaging & transmission",      Icon: SatelliteIcon   },
  ];

  const domainColors: Record<string, { iconBg: string; iconColor: string; selBg: string; selBorder: string; nameColor: string; dotColor: string; dotGlow: string }> = {
    "blocks-world": { iconBg: "rgba(99,102,241,0.2)",   iconColor: "#A5B4FC", selBg: "rgba(99,102,241,0.1)",  selBorder: "rgba(99,102,241,0.35)", nameColor: "#C7D2FE", dotColor: "#818CF8", dotGlow: "rgba(99,102,241,0.7)"  },
    "gripper":      { iconBg: "rgba(245,158,11,0.18)",  iconColor: "#FCD34D", selBg: "rgba(245,158,11,0.1)", selBorder: "rgba(245,158,11,0.32)", nameColor: "#FDE68A", dotColor: "#F59E0B", dotGlow: "rgba(245,158,11,0.7)"  },
    "depot":        { iconBg: "rgba(6,182,212,0.18)",   iconColor: "#67E8F9", selBg: "rgba(6,182,212,0.1)",  selBorder: "rgba(6,182,212,0.32)",  nameColor: "#A5F3FC", dotColor: "#06B6D4", dotGlow: "rgba(6,182,212,0.7)"   },
    "hanoi":        { iconBg: "rgba(244,63,94,0.18)",   iconColor: "#FDA4AF", selBg: "rgba(244,63,94,0.1)",  selBorder: "rgba(244,63,94,0.32)",  nameColor: "#FECDD3", dotColor: "#F43F5E", dotGlow: "rgba(244,63,94,0.7)"   },
    "rovers":       { iconBg: "rgba(249,115,22,0.18)",  iconColor: "#FDBA74", selBg: "rgba(249,115,22,0.1)", selBorder: "rgba(249,115,22,0.32)", nameColor: "#FED7AA", dotColor: "#F97316", dotGlow: "rgba(249,115,22,0.7)"  },
    "satellite":    { iconBg: "rgba(14,165,233,0.18)",  iconColor: "#7DD3FC", selBg: "rgba(14,165,233,0.1)", selBorder: "rgba(14,165,233,0.32)", nameColor: "#BAE6FD", dotColor: "#0EA5E9", dotGlow: "rgba(14,165,233,0.7)"  },
  };

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isProcessing) {
      setElapsedTime(0);
      interval = setInterval(() => setElapsedTime(p => p + 1), 1000);
    }
    return () => { if (interval) clearInterval(interval); };
  }, [isProcessing]);

  useEffect(() => {
    return () => { if (playbackIntervalRef.current) clearInterval(playbackIntervalRef.current); };
  }, []);

  useEffect(() => {
    // Only run when switching TO a real basic domain. An empty selectedDomain
    // is the marker for "Custom mode" — handled by the Custom button itself.
    // Without this guard, picking Custom would set selectedDomain="" → this
    // effect fires → it sees isCustomDomain=true (just set in the same batch)
    // → it resets isCustomDomain back to false, requiring a second click.
    if (!selectedDomain) return;

    setProblemType("example"); setProblemFile(null); setProblemText(""); setInputMode("file");
    // Reset visualization state when switching domains
    setRenderedStates([]); setPlan([]); setCurrentStateIndex(0); setPlannerInfo(null);
    setIsPlaying(false); if (playbackIntervalRef.current) { clearInterval(playbackIntervalRef.current); playbackIntervalRef.current = null; }
    // Reset custom domain state when switching to a built-in domain
    if (isCustomDomain) {
      setIsCustomDomain(false); setCustomDomainName(""); setCustomDomainFile(null);
      setCustomDomainText(""); setCustomProblemFile(null); setCustomProblemText("");
      setLlmTransformerCode(null); setTransformerError(null); setTransformerModelInfo(null);
    }
  }, [selectedDomain]);

  useEffect(() => {
    if (planStepsRef.current && plan.length > 0 && currentStateIndex > 0) {
      const container = planStepsRef.current;
      const el = container.children[currentStateIndex - 1] as HTMLElement;
      if (el) {
        const elRect = el.getBoundingClientRect(), cRect = container.getBoundingClientRect();
        if (elRect.top < cRect.top || elRect.bottom > cRect.bottom)
          container.scrollTop = el.offsetTop - container.offsetTop;
      }
    }
  }, [currentStateIndex, plan.length]);

  const currentStrategy = strategiesQuery.data?.find((s: SearchStrategy) => s.id === selectedStrategy) as SearchStrategy | undefined;

  const getDefaultProblem = (domain: string): string => {
    if (domain === "blocks-world") return `(define (problem bw-default)\n  (:domain blocks-world)\n  (:objects a b c - block)\n  (:init\n    (ontable a) (ontable b) (ontable c)\n    (clear a) (clear b) (clear c)\n    (handempty)\n  )\n  (:goal (and (on c b) (on b a)))\n)`;
    if (domain === "gripper") return `(define (problem gripper-default)\n  (:domain gripper)\n  (:objects rooma roomb - room  ball1 ball2 - ball  left right - gripper)\n  (:init\n    (at-robby rooma) (free left) (free right)\n    (at ball1 rooma) (at ball2 rooma)\n  )\n  (:goal (and (at ball1 roomb) (at ball2 roomb)))\n)`;
    if (domain === "depot") return `(define (problem depot-simple)\n  (:domain depot)\n  (:objects d1 d2 - depot  t1 - truck  c1 c2 - crane  pile1 pile2 - pile  p1 p2 - package)\n  (:init\n    (at-truck t1 d1) (at-crane c1 d1) (empty-crane c1) (at-crane c2 d2) (empty-crane c2)\n    (at-pile pile1 d1) (at-pile pile2 d2) (on-pile p2 pile1) (on p1 p2)\n    (at p1 d1) (at p2 d1) (clear p1) (clear pile2)\n  )\n  (:goal (on-pile p2 pile2))\n)`;
    if (domain === "hanoi") return `(define (problem hanoi-2-disks)\n  (:domain hanoi)\n  (:objects d1 d2 - disk  a b c - peg)\n  (:init\n    (is-disk d1) (is-disk d2) (is-peg a) (is-peg b) (is-peg c)\n    (smaller d1 d2) (on d2 a) (on d1 d2)\n    (clear d1) (clear b) (clear c)\n  )\n  (:goal (and (on d2 c) (on d1 d2)))\n)`;
    if (domain === "rovers") return `(define (problem rovers-default)\n  (:domain rovers)\n  (:objects r1 - rover  w1 w2 - waypoint  t1 - target)\n  (:init\n    (at-rover r1 w1) (connected w1 w2) (connected w2 w1) (at-target t1 w2)\n  )\n  (:goal (and (communicated t1)))\n)`;
    if (domain === "satellite") return `(define (problem satellite-default)\n  (:domain satellite)\n  (:objects s1 - satellite  i1 - instrument  t1 - target  dcal d1 - direction  g1 - groundstation)\n  (:init\n    (onboard i1 s1) (supports i1 t1) (calibration-target i1 t1) (target-dir t1 d1)\n    (pointing s1 dcal) (power-avail s1) (storage-avail s1) (visible s1 g1)\n  )\n  (:goal (and (have-image t1)))\n)`;
    return "";
  };

  const uploadMutation = trpc.visualizer.uploadAndGenerate.useMutation({
    onSuccess: (data) => {
      setIsProcessing(false);
      setRenderedStates(data.states);
      setPlan(data.plan);
      setCurrentStateIndex(0);
      setPlannerInfo({ used_planner: data.used_planner || false, info: data.planner_info || "Unknown", strategy: data.search_strategy });
      // Success flash
      setShowSuccessFlash(true);
      setTimeout(() => setShowSuccessFlash(false), 900);
    },
    onError: (error: any) => {
      setIsProcessing(false);
      let errorMessage = error.message || "An unknown error occurred";
      let errorType = "general", title = "Error";
      let suggestedDomain: string | undefined, suggestedDomainName: string | undefined;
      try {
        const ed = error.data?.error || error.data;
        if (ed?.error_type === "domain_mismatch" || ed?.error_type === "possible_domain_mismatch") {
          errorType = ed.error_type; suggestedDomain = ed.suggested_domain;
          suggestedDomainName = ed.suggested_domain_name; errorMessage = ed.error; title = "Domain Mismatch Detected";
        }
      } catch {}
      if (errorMessage.toLowerCase().includes("different domain") || errorMessage.toLowerCase().includes("domain mismatch")) {
        title = "Domain Mismatch Detected"; errorType = "domain_mismatch";
      } else if (errorMessage.toLowerCase().includes("timed out")) {
        title = "Request Timed Out";
        if (currentStrategy?.isOptimal) errorMessage += "\n\nTip: Try a satisficing strategy like 'Lazy Greedy + FF' for quicker results.";
      } else if (errorMessage.toLowerCase().includes("no solution")) {
        title = "No Solution Found";
      }
      setErrorModal({ show: true, title, message: errorMessage, errorType, suggestedDomain, suggestedDomainName });
    },
  });

  const llmGenerateMutation = trpc.visualizer.llmGenerateRenderer.useMutation({
    onSuccess: (data) => {
      setIsLlmGenerating(false);
      if (data.code) {
        setLlmRendererCode(data.code); setLlmError(null);
        setLlmModelInfo(`${data.provider} (${data.model})`);

        // Auto-save to Saved Domains Library (only for new custom domains)
        if (isCustomDomain && customMode === "new" && llmTransformerCode) {
          const getDomainPddl = async () => {
            if (customDomainInputMode === "file" && customDomainFile) {
              return new Promise<string>((resolve) => {
                const r = new FileReader();
                r.onload = (e) => resolve(e.target?.result as string);
                r.readAsText(customDomainFile);
              });
            }
            return customDomainText;
          };
          getDomainPddl().then(domainPddl => {
            if (domainPddl) {
              saveDomainMutation.mutate({
                domainName: customDomainName || "custom",
                domainPddl,
                transformerCode: llmTransformerCode,
                rendererCode: data.code!,
                provider: data.provider || "unknown",
              });
            }
          });
        }
      }
    },
    onError: (error: any) => { setIsLlmGenerating(false); setLlmError(error.message || "Failed to generate LLM renderer"); },
  });

  const handleLlmGenerate = async () => {
    if (renderedStates.length === 0) { setLlmError("Generate states first, then switch to LLM mode."); return; }
    setIsLlmGenerating(true); setLlmError(null); setLlmRendererCode(null);

    // Cache-first: if we've previously generated this (domain, provider)
    // pair, reuse it and skip the LLM call.
    try {
      const url = `/api/trpc/visualizer.lookupBasicRenderer?input=${encodeURIComponent(
        JSON.stringify({ json: { domain: selectedDomain, provider: llmProvider } })
      )}`;
      const res = await fetch(url);
      const json = await res.json();
      const hit = json?.result?.data?.json;
      if (hit && hit.code) {
        console.log(`[BasicRenderer] HIT — (${selectedDomain}, ${llmProvider}) → reusing cached artifact ${hit.artifactHash.slice(0, 12)}…`);
        setIsLlmGenerating(false);
        setLlmRendererCode(hit.code);
        setLlmModelInfo(`Cached (${hit.provider})`);
        return;
      }
      console.log(`[BasicRenderer] MISS — no cached renderer for (${selectedDomain}, ${llmProvider}); calling LLM`);
    } catch (err) {
      console.warn("[BasicRenderer] Lookup failed, proceeding with LLM:", err);
    }

    llmGenerateMutation.mutate({ domainName: selectedDomain, states: renderedStates.slice(0, 3), domainPddl: "", transformerCode: "", provider: llmProvider });
  };

  useEffect(() => { setLlmRendererCode(null); setLlmError(null); setLlmModelInfo(null); }, [selectedDomain]);
  // Custom domain upload mutation
  const uploadCustomMutation = trpc.visualizer.uploadAndGenerateCustom.useMutation({
    onSuccess: (data) => {
      setIsProcessing(false);
      setRenderedStates(data.states);
      setPlan(data.plan);
      setCurrentStateIndex(0);
      setPlannerInfo({ used_planner: data.used_planner || false, info: data.planner_info || "Unknown", strategy: data.search_strategy });
      setShowSuccessFlash(true);
      setTimeout(() => setShowSuccessFlash(false), 900);
      // Auto-trigger transformer generation ONLY for new domain flow
      // Use ref (not state) to avoid React batching race condition
      if (data.states.length > 0 && !usingSavedDomainRef.current) {
        triggerTransformerGeneration();
      }
      // Reset the ref after processing
      usingSavedDomainRef.current = false;
    },
    onError: (error: any) => {
      setIsProcessing(false);
      setErrorModal({ show: true, title: "Error", message: error.message || "Failed to solve custom problem" });
    },
  });
  // LLM Transformer mutation
  const llmTransformerMutation = trpc.visualizer.llmGenerateTransformer.useMutation({
    onSuccess: (data) => {
      setIsTransformerGenerating(false);
      if (data.code) {
        setLlmTransformerCode(data.code); setTransformerError(null);
        setTransformerModelInfo(`${data.provider} (${data.model})`);
        // Auto-chain: trigger canvas renderer generation using enriched sample states
        // Apply transformer to sample states FIRST so renderer LLM sees enriched
        // objects (with positions, colors, etc.) instead of raw predicate data.
        if (renderedStates.length > 0) {
          setRenderMode("llm");
          setIsLlmGenerating(true); setLlmError(null); setLlmRendererCode(null);

          // Dynamically find and run the transform* function on sample states
          let enrichedStates = renderedStates.slice(0, 3);
          try {
            const fnMatch = data.code.match(/function\s+(transform\w+)/);
            const transformFnName = fnMatch ? fnMatch[1] : null;
            if (transformFnName) {
              // eslint-disable-next-line no-new-func
              const factory = new Function(
                data.code + "\nreturn typeof " + transformFnName + " !== 'undefined' ? " + transformFnName + " : null;"
              );
              const transformFn = factory();
              if (typeof transformFn === 'function') {
                enrichedStates = enrichedStates.map((s: any) => {
                  try { return transformFn(s); } catch { return s; }
                });
              }
            }
          } catch (e) {
            console.warn("[Auto-chain] Could not pre-enrich states for renderer LLM:", e);
          }

          // Get the domain PDDL to pass alongside enriched states
          const getDomainPddlForRenderer = async (): Promise<string> => {
            if (customDomainInputMode === "file" && customDomainFile) {
              return new Promise<string>((resolve) => {
                const r = new FileReader();
                r.onload = (e) => resolve(e.target?.result as string);
                r.readAsText(customDomainFile);
              });
            }
            return customDomainText;
          };
          getDomainPddlForRenderer().then(domainPddl => {
            console.log("[Stage 2 - Frontend] Sending enriched states + transformer code to renderer LLM");
            console.log("[Stage 2 - Frontend] Domain:", customDomainName || "custom");
            console.log("[Stage 2 - Frontend] Provider:", data.provider);
            console.log("[Stage 2 - Frontend] Enriched states count:", enrichedStates.length);
            if (enrichedStates.length > 0 && enrichedStates[0]?.objects?.[0]) {
              console.log("[Stage 2 - Frontend] Sample object keys:", Object.keys(enrichedStates[0].objects[0]).join(", "));
            }
            llmGenerateMutation.mutate({
              domainName: customDomainName || "custom",
              states: enrichedStates,
              domainPddl,
              transformerCode: data.code!,
              provider: (data.provider?.toLowerCase().includes("claude") ? "claude" : "gemini") as "claude" | "gemini",
            });
          });
        }
      }
    },
    onError: (error: any) => {
      setIsTransformerGenerating(false);
      setTransformerError(error.message || "Failed to generate state transformer");
    },
  });
  const triggerTransformerGeneration = () => {
    const domainContent = customDomainText || "";
    if (!domainContent && !customDomainFile) return;
    setIsTransformerGenerating(true); setTransformerError(null); setLlmTransformerCode(null);

    // Look up the saved-domains library by PDDL hash BEFORE calling the LLM.
    // If matches exist, surface the duplicate-detection modal so the user
    // can choose: reuse a specific existing version, or proceed with a
    // fresh LLM generation that becomes a new versioned entry.
    const tryCacheThenGenerate = async (domainPddl: string) => {
      try {
        const url = `/api/trpc/visualizer.lookupSavedDomainByPddl?input=${encodeURIComponent(
          JSON.stringify({ json: { domainPddl } })
        )}`;
        const res = await fetch(url);
        const json = await res.json();
        const data = json?.result?.data?.json;
        const matches: typeof duplicateModal.matches = data?.matches || [];
        if (matches.length > 0) {
          console.log(`[Cache] HIT — ${matches.length} existing version(s); prompting user`);
          // Pause the spinner; the modal owns what happens next.
          setIsTransformerGenerating(false);
          setDuplicateModal({ show: true, matches, pendingDomainPddl: domainPddl });
          return;
        }
        console.log("[Cache] MISS — proceeding with LLM generation");
      } catch (err) {
        console.warn("[Cache] Lookup failed, proceeding with LLM generation:", err);
      }

      // Cache miss → run Stage 1 (which auto-chains Stage 2)
      llmTransformerMutation.mutate({
        domainName: customDomainName || "custom",
        domainPddl,
        sampleStates: renderedStates.slice(0, 3),
        provider: llmProvider,
      });
    };

    if (customDomainFile) {
      const reader = new FileReader();
      reader.onload = (e) => tryCacheThenGenerate(e.target?.result as string);
      reader.readAsText(customDomainFile);
    } else {
      tryCacheThenGenerate(customDomainText);
    }
  };

  // ─── Duplicate-modal action handlers ────────────────────────────────────
  // Picked an existing version — load its code and apply it as if it were
  // a saved-domain selection. This mirrors the silent cache-hit path that
  // existed before the modal was introduced.
  const handleReuseExistingVersion = async (id: number) => {
    try {
      const url = `/api/trpc/visualizer.loadSavedDomain?input=${encodeURIComponent(
        JSON.stringify({ json: { id } })
      )}`;
      const res = await fetch(url);
      const json = await res.json();
      const sd = json?.result?.data?.json;
      if (!sd?.transformerCode || !sd?.rendererCode) {
        setTransformerError("Failed to load the selected version.");
        setDuplicateModal({ show: false, matches: [], pendingDomainPddl: "" });
        return;
      }
      setLlmTransformerCode(sd.transformerCode);
      setLlmRendererCode(sd.rendererCode);
      setRenderMode("llm");
      setTransformerModelInfo(`Cached (${sd.provider})`);
      setLlmModelInfo(`Cached (${sd.provider})`);
      setTransformerError(null);
      setLlmError(null);
      // Flip the UI so the user sees their choice highlighted in Saved Domains.
      setCustomMode("saved");
      setSelectedSavedDomainId(id);
      setDuplicateModal({ show: false, matches: [], pendingDomainPddl: "" });
    } catch (err) {
      console.error("[DuplicateModal] Failed to load existing version:", err);
      setTransformerError("Failed to load the selected version.");
      setDuplicateModal({ show: false, matches: [], pendingDomainPddl: "" });
    }
  };

  // Picked "Create new version" — proceed exactly as the cache-miss path
  // would have. Backend `saveDomain` now allows multiple entries per
  // pddlHash and `generateDisplayName` will append (2), (3), etc.
  const handleCreateNewVersion = () => {
    const pendingPddl = duplicateModal.pendingDomainPddl;
    setDuplicateModal({ show: false, matches: [], pendingDomainPddl: "" });
    setIsTransformerGenerating(true);
    llmTransformerMutation.mutate({
      domainName: customDomainName || "custom",
      domainPddl: pendingPddl,
      sampleStates: renderedStates.slice(0, 3),
      provider: llmProvider,
    });
  };

  // Cancel / dismiss — back out cleanly. No LLM call, no save, the whole
  // generate button becomes ready again.
  const handleDismissDuplicateModal = () => {
    setDuplicateModal({ show: false, matches: [], pendingDomainPddl: "" });
    setIsTransformerGenerating(false);
    setIsProcessing(false);
  };
  // Reset custom domain state when switching away
  useEffect(() => {
    if (!isCustomDomain) {
      setLlmTransformerCode(null); setTransformerError(null); setTransformerModelInfo(null);
    }
  }, [isCustomDomain]);

  const handleGenerate = () => {
    setIsProcessing(true);
    // Custom domain flow
    if (isCustomDomain) {
      const hasProblem = customProblemInputMode === "file" ? !!customProblemFile : !!customProblemText.trim();
      if (!hasProblem) { setIsProcessing(false); alert("Please provide the problem PDDL file"); return; }

      const readFile = (file: File): Promise<string> =>
        new Promise((resolve) => { const r = new FileReader(); r.onload = (e) => resolve(e.target?.result as string); r.readAsText(file); });

      // Saved domain flow: use stored domain PDDL + pre-trained transformer/renderer
      if (customMode === "saved" && selectedSavedDomainId && loadSavedDomainQuery.data) {
        const savedDomain = loadSavedDomainQuery.data;
        console.log("[handleGenerate] Using saved domain:", savedDomain.displayName);
        // Mark as saved domain flow BEFORE mutate (ref is synchronous, no batching issue)
        usingSavedDomainRef.current = true;
        // Pre-load the saved transformer and renderer codes BEFORE triggering upload
        setLlmTransformerCode(savedDomain.transformerCode);
        setLlmRendererCode(savedDomain.rendererCode);
        setRenderMode("llm");
        const run = async () => {
          const problemContent = customProblemInputMode === "file" && customProblemFile
            ? await readFile(customProblemFile) : customProblemText;
          // Use the saved domain's PDDL for planning only (no LLM calls needed)
          uploadCustomMutation.mutate({
            domainContent: savedDomain.domainPddl,
            problemContent,
            domainName: savedDomain.domainName,
            searchStrategy: selectedStrategy as any,
          });
        };
        run();
        return;
      }

      // Upload New flow: requires both domain.pddl and problem.pddl
      const hasDomain = customDomainInputMode === "file" ? !!customDomainFile : !!customDomainText.trim();
      if (!customDomainName.trim()) { setIsProcessing(false); alert("Please enter a domain name"); return; }
      if (!hasDomain) { setIsProcessing(false); alert("Please provide the domain PDDL file"); return; }
      const run = async () => {
        const domainContent = customDomainInputMode === "file" && customDomainFile
          ? await readFile(customDomainFile) : customDomainText;
        const problemContent = customProblemInputMode === "file" && customProblemFile
          ? await readFile(customProblemFile) : customProblemText;
        uploadCustomMutation.mutate({
          domainContent, problemContent,
          domainName: customDomainName.trim(),
          searchStrategy: selectedStrategy as any,
        });
      };
      run();
      return;
    }
    // Standard domain flow
    if (problemType === "custom") {
      if (inputMode === "file" && !problemFile) { setIsProcessing(false); alert("Please select a problem file"); return; }
      if (inputMode === "text" && !problemText.trim()) { setIsProcessing(false); alert("Please paste PDDL content"); return; }
      const reader = new FileReader();
      const process = (content: string) =>
        uploadMutation.mutate({ domainContent: "", problemContent: content, domainName: selectedDomain as any, searchStrategy: selectedStrategy as any });
      if (inputMode === "file" && problemFile) { reader.onload = (e) => process(e.target?.result as string); reader.readAsText(problemFile); }
      else if (inputMode === "text") process(problemText);
    } else {
      uploadMutation.mutate({ domainContent: "", problemContent: getDefaultProblem(selectedDomain), domainName: selectedDomain as any, searchStrategy: selectedStrategy as any });
    }
  };

  const handlePlay = () => {
    if (playbackIntervalRef.current) clearInterval(playbackIntervalRef.current);
    setIsPlaying(true);
    playbackIntervalRef.current = setInterval(() => {
      setCurrentStateIndex(prev => {
        if (prev >= renderedStates.length - 1) {
          setIsPlaying(false);
          if (playbackIntervalRef.current) { clearInterval(playbackIntervalRef.current); playbackIntervalRef.current = null; }
          return prev;
        }
        return prev + 1;
      });
    }, playbackSpeed);
  };

  const handlePause = () => {
    setIsPlaying(false);
    if (playbackIntervalRef.current) { clearInterval(playbackIntervalRef.current); playbackIntervalRef.current = null; }
  };

  const handleNext     = () => setCurrentStateIndex(prev => Math.min(prev + 1, renderedStates.length - 1));
  const handlePrevious = () => setCurrentStateIndex(prev => Math.max(prev - 1, 0));

  const getSpeedBadge = (speed: string) => {
    const map = {
      fast:   { Icon: ZapIcon,   bg: "bg-green-500/15",  text: "text-green-400",  label: "Fast"   },
      medium: { Icon: ClockIcon, bg: "bg-amber-500/15",  text: "text-amber-400",  label: "Medium" },
      slow:   { Icon: AlertIcon, bg: "bg-red-500/15",    text: "text-red-400",    label: "Slow"   },
    }[speed] ?? { Icon: ClockIcon, bg: "bg-white/8", text: "text-slate-400", label: speed };
    const { Icon } = map;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${map.bg} ${map.text}`}>
        <Icon className="w-2.5 h-2.5" />{map.label}
      </span>
    );
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60); const sec = s % 60;
    return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
  };

  const currentDomain = domains.find(d => d.id === selectedDomain);

  // ──────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0B1524] bg-grid relative" style={{ isolation: "isolate" }}>
      {/* Scanline overlay */}
      <div className="scanlines" />

      {/* Ambient background orbs */}
      <AmbientOrbs />

      {/* ── Header ── */}
      {/* h-24 = 96 px — enough vertical room for 3-block stack in the animation */}
      <header className="border-b border-white/[0.06] bg-[#0B1524]/90 backdrop-blur-md sticky top-0 h-[100px]"
        style={{ zIndex: 40 }}>
        <div className="container max-w-[1440px] h-full flex items-center gap-6">

          {/* ── Left: eye icon + title ── */}
          <div className="flex items-center gap-4 flex-shrink-0">
            <motion.div
              className="w-[84px] h-[84px] rounded-2xl flex-shrink-0 overflow-hidden"
              style={{ boxShadow: "0 0 0 1px rgba(167,139,250,0.3), 0 4px 24px rgba(109,99,184,0.28)" }}
              animate={{ boxShadow: [
                "0 0 0 1px rgba(167,139,250,0.3), 0 4px 24px rgba(109,99,184,0.28)",
                "0 0 0 1px rgba(167,139,250,0.55), 0 4px 36px rgba(109,99,184,0.50)",
                "0 0 0 1px rgba(167,139,250,0.3), 0 4px 24px rgba(109,99,184,0.28)",
              ]}}
              transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
            >
              {/* icon6.svg — glowing eye with eyelashes and three-node graph iris */}
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" className="w-full h-full" aria-hidden="true">
                <defs>
                  <filter id="outerglow" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="2.5"/>
                  </filter>
                  <radialGradient id="bgglow" cx="50%" cy="50%" r="60%">
                    <stop offset="0%" stopColor="#a78bfa" stopOpacity="0.6"/>
                    <stop offset="100%" stopColor="#a78bfa" stopOpacity="0"/>
                  </radialGradient>
                </defs>
                <rect x="2" y="2" width="96" height="96" rx="20" fill="#151336"/>
                <circle cx="50" cy="50" r="42" fill="url(#bgglow)"/>
                {/* glow layer */}
                <path d="M18 50 Q50 22 82 50 Q50 78 18 50 Z" fill="none" stroke="#a78bfa" strokeWidth="4" strokeLinejoin="round" opacity="0.5" filter="url(#outerglow)"/>
                {/* eyelashes */}
                <g stroke="#d8cfff" strokeWidth="1.7" strokeLinecap="round">
                  <line x1="30" y1="28" x2="28" y2="22"/>
                  <line x1="40" y1="24" x2="39" y2="17"/>
                  <line x1="50" y1="22" x2="50" y2="15"/>
                  <line x1="60" y1="24" x2="61" y2="17"/>
                  <line x1="70" y1="28" x2="72" y2="22"/>
                </g>
                {/* crisp eye outline */}
                <path d="M18 50 Q50 22 82 50 Q50 78 18 50 Z" fill="none" stroke="#d8cfff" strokeWidth="2" strokeLinejoin="round"/>
                {/* iris */}
                <circle cx="50" cy="50" r="14" fill="#6d63b8"/>
                <circle cx="50" cy="50" r="14" fill="none" stroke="#e8e6ff" strokeWidth="0.6" opacity="0.9"/>
                {/* graph edges */}
                <line x1="44" y1="46" x2="56" y2="46" stroke="#e8e6ff" strokeWidth="1" opacity="1"/>
                <line x1="44" y1="46" x2="50" y2="56" stroke="#e8e6ff" strokeWidth="1" opacity="1"/>
                <line x1="56" y1="46" x2="50" y2="56" stroke="#e8e6ff" strokeWidth="1" opacity="1"/>
                {/* graph nodes */}
                <circle cx="44" cy="46" r="2.8" fill="#c4b5fd"/>
                <circle cx="56" cy="46" r="2.8" fill="#a5e3ff"/>
                <circle cx="50" cy="56" r="2.8" fill="#d8b4fe"/>
              </svg>
            </motion.div>
            <div>
              <h1 className="text-2xl font-bold leading-none tracking-tight text-white"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                Planning Visualizer
              </h1>
              <p className="text-xs text-slate-500 font-medium tracking-[0.15em] uppercase mt-1">
                Classical AI Planning
              </p>
            </div>
          </div>

          {/* ── Middle: PDDL animation — flex-1 owns its own canvas ── */}
          <div className="relative flex-1 h-full overflow-hidden">
            <PDDLHeaderBackground />
          </div>



        </div>
      </header>

      <main className="container max-w-[1440px] py-8" style={{ position: "relative", zIndex: 1 }}>



        {/* ── Main layout ── */}
        <div className="flex flex-col lg:flex-row gap-6 items-start">

          {/* ── Sidebar ── */}
          <AnimatePresence mode="popLayout">
            {!isSidebarCollapsed && (
              <motion.div
                layout
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                transition={spring}
                className="w-full lg:w-[320px] lg:flex-shrink-0 flex flex-col gap-4"
              >

                {/* ── Unified Configuration Panel ── */}
                <motion.div
                  className="rounded-2xl border border-white/[0.08] bg-[#111E30] overflow-hidden"
                  style={{ boxShadow: "0 1px 0 rgba(255,255,255,0.05) inset, 0 8px 32px rgba(0,0,0,0.18)" }}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.32, ease: easeOut }}
                >
                  {/* Panel header bar */}
                  <div className="px-4 py-3 flex items-center gap-2 border-b border-white/[0.06]"
                    style={{ background: "rgba(255,255,255,0.02)" }}>
                    <span className="text-xs font-semibold tracking-[0.15em] uppercase text-slate-500"
                      style={{ fontFamily: "'JetBrains Mono', monospace" }}>Configure</span>
                    <div className="flex-1" />
                    {/* Step progress pips — live domain color for step 1 */}
                    <div className="flex items-center gap-1.5">
                      {[
                        { c: domainColors[selectedDomain]?.dotColor ?? "#22c55e", key: "d" },
                        { c: "#0EA5E9", key: "p" },
                        { c: "#8B5CF6", key: "s" },
                        { c: "#22C55E", key: "r" },
                      ].map(({ c, key }) => (
                        <div key={key} className="w-1.5 h-1.5 rounded-full transition-all duration-300"
                          style={{ background: c, opacity: 0.7 }} />
                      ))}
                    </div>
                  </div>

                  {/* ── Step 1: Domain ── */}
                  <div>
                    <button onClick={() => setIsDomainOpen(!isDomainOpen)}
                      className="w-full px-4 py-3.5 flex items-center gap-3 hover:bg-white/[0.03] transition-all duration-150">
                      {/* Colorized step badge */}
                      <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-all"
                        style={isCustomDomain
                          ? { background: "rgba(168,85,247,0.15)", border: "1px solid rgba(168,85,247,0.3)" }
                          : { background: domainColors[selectedDomain]?.iconBg ?? "rgba(34,197,94,0.15)", border: `1px solid ${domainColors[selectedDomain]?.selBorder ?? "rgba(34,197,94,0.3)"}` }}>
                        <span className="text-[11px] font-bold"
                          style={{ fontFamily: "'JetBrains Mono', monospace", color: isCustomDomain ? "#c084fc" : (domainColors[selectedDomain]?.iconColor ?? "#4ade80") }}>1</span>
                      </div>
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span className="text-sm font-semibold text-slate-200 flex-shrink-0"
                          style={{ fontFamily: "'JetBrains Mono', monospace" }}>Domain</span>
                        <motion.span
                          key={isCustomDomain ? "custom" : selectedDomain}
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="text-xs font-semibold px-2 py-0.5 rounded-full truncate"
                          style={isCustomDomain
                            ? { color: "#c084fc", background: "rgba(168,85,247,0.12)", border: "1px solid rgba(168,85,247,0.3)" }
                            : { color: domainColors[selectedDomain]?.nameColor ?? "#4ade80", background: domainColors[selectedDomain]?.selBg ?? "rgba(34,197,94,0.1)", border: `1px solid ${domainColors[selectedDomain]?.selBorder ?? "rgba(34,197,94,0.25)"}` }}
                        >
                          {isCustomDomain ? (customDomainName || "Custom") : currentDomain?.name}
                        </motion.span>
                      </div>
                      <motion.div animate={{ rotate: isDomainOpen ? 0 : -90 }} transition={{ duration: 0.18, ease: easeOut }}>
                        <ChevronDownIcon className="w-4 h-4 text-slate-600" />
                      </motion.div>
                    </button>

                    <CollapseSection open={isDomainOpen}>
                      <div className="px-3 pb-4 pt-2 border-t border-white/[0.04] space-y-3">
                        {/* Basic / Custom domain type toggle */}
                        <div className="flex items-center gap-0.5 bg-white/[0.04] rounded-lg p-0.5 border border-white/[0.06]">
                          {[
                            { id: "basic",  label: "Basic" },
                            { id: "custom", label: "Custom" },
                          ].map(t => (
                            <button
                              key={t.id}
                              onClick={() => {
                                if (t.id === "custom") {
                                  setIsCustomDomain(true);
                                  setSelectedDomain("");
                                  setIsDomainOpen(true);
                                  setRenderedStates([]); setPlan([]); setCurrentStateIndex(0); setPlannerInfo(null);
                                } else {
                                  setIsCustomDomain(false);
                                  setCustomDomainName(""); setCustomDomainFile(null);
                                  setCustomDomainText(""); setCustomProblemFile(null); setCustomProblemText("");
                                  setLlmTransformerCode(null); setTransformerError(null); setTransformerModelInfo(null);
                                  setRenderedStates([]); setPlan([]); setCurrentStateIndex(0); setPlannerInfo(null);
                                  setIsDomainOpen(true);
                                }
                              }}
                              className={`flex-1 px-3 py-2 rounded-md text-xs font-medium transition-all duration-150 ${
                                (t.id === "custom" ? isCustomDomain : !isCustomDomain)
                                  ? t.id === "custom"
                                    ? "bg-purple-600/80 text-white shadow-sm"
                                    : "bg-white/[0.08] text-slate-200 shadow-sm"
                                  : "text-slate-600 hover:text-slate-400"
                              }`}
                              style={{ fontFamily: "'JetBrains Mono', monospace" }}
                            >
                              {t.label}
                            </button>
                          ))}
                        </div>

                        {/* Basic: domain list */}
                        <AnimatePresence mode="wait">
                          {!isCustomDomain && (
                            <motion.div
                              key="basic-list"
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={{ duration: 0.2, ease: easeOut }}
                              className="overflow-hidden space-y-0.5"
                            >
                              <motion.div className="space-y-0.5" variants={listStagger} initial="initial" animate="animate">
                                {domains.map(domain => {
                                  const DomainIcon = domain.Icon;
                                  const sel = selectedDomain === domain.id;
                                  return (
                                    <motion.button
                                      key={domain.id}
                                      variants={listItem}
                                      transition={{ duration: 0.18, ease: easeOut }}
                                      onClick={() => { setSelectedDomain(domain.id); setIsCustomDomain(false); }}
                                      whileTap={{ scale: 0.98 }}
                                      whileHover={!sel ? { x: 2 } : undefined}
                                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all border"
                                      style={sel ? { background: domainColors[domain.id]?.selBg, borderColor: domainColors[domain.id]?.selBorder } : { borderColor: "transparent" }}
                                    >
                                      <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors"
                                        style={{ background: sel ? domainColors[domain.id]?.iconBg : "rgba(255,255,255,0.06)" }}>
                                        <span style={{ color: sel ? domainColors[domain.id]?.iconColor : "#64748B", display: "contents" }}>
                                          <DomainIcon className="w-5 h-5 transition-colors" />
                                        </span>
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <div className="text-sm font-medium leading-none transition-colors"
                                          style={{ fontFamily: "'JetBrains Mono', monospace", color: sel ? domainColors[domain.id]?.nameColor : "#CBD5E1" }}>
                                          {domain.name}
                                        </div>
                                        <div className="text-xs text-slate-500 truncate mt-0.5">{domain.description}</div>
                                      </div>
                                      {sel && (
                                        <motion.div
                                          layoutId="domain-sel-dot"
                                          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                                          style={{ background: domainColors[domain.id]?.dotColor, boxShadow: `0 0 8px ${domainColors[domain.id]?.dotGlow}` }}
                                        />
                                      )}
                                    </motion.button>
                                  );
                                })}
                              </motion.div>
                              <button
                                onClick={() => setShowDomainDefinition(true)}
                                className="w-full mt-1 px-3 py-2.5 text-xs font-medium text-slate-500 hover:text-slate-300 rounded-lg hover:bg-white/[0.04] transition-all duration-150 flex items-center justify-center gap-1.5">
                                <FileCodeIcon className="w-3 h-3" />
                                View Domain Definition
                              </button>
                            </motion.div>
                          )}

                          {/* Custom: Saved / Upload New sub-toggle + panels */}
                          {isCustomDomain && (
                            <motion.div
                              key="custom-panel"
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={{ duration: 0.2, ease: easeOut }}
                              className="overflow-hidden space-y-3"
                            >
                              {/* Sub-toggle: Saved / Upload New */}
                              <div className="flex gap-1 p-0.5 rounded-lg" style={{ background: "rgba(255,255,255,0.04)" }}>
                                {([{ id: "saved", label: "Saved Domains" }, { id: "new", label: "Upload New" }] as const).map(m => (
                                  <button key={m.id} onClick={() => {
                                    setCustomMode(m.id);
                                    if (m.id === "new") {
                                      setSelectedSavedDomainId(null);
                                      // Clear saved domain code when switching to new
                                      setLlmTransformerCode(null);
                                      setLlmRendererCode(null);
                                      setLlmError(null);
                                      setTransformerError(null);
                                    }
                                    if (m.id === "saved") {
                                      // Clear new domain code when switching to saved
                                      setLlmTransformerCode(null);
                                      setLlmRendererCode(null);
                                      setLlmError(null);
                                      setTransformerError(null);
                                    }
                                  }}
                                    className={`flex-1 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                                      customMode === m.id
                                        ? "bg-purple-500/20 text-purple-300 shadow-sm border border-purple-500/30"
                                        : "text-slate-500 hover:text-slate-400 border border-transparent"
                                    }`}
                                    style={{ fontFamily: "'JetBrains Mono', monospace" }}
                                  >
                                    {m.label}
                                  </button>
                                ))}
                              </div>

                              {/* Saved Domains List */}
                              <AnimatePresence mode="wait">
                                {customMode === "saved" && (
                                  <motion.div
                                    key="saved-list"
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: "auto" }}
                                    exit={{ opacity: 0, height: 0 }}
                                    transition={{ duration: 0.2, ease: easeOut }}
                                    className="overflow-hidden space-y-1"
                                  >
                                    {savedDomainsQuery.isLoading && (
                                      <div className="text-xs text-slate-500 text-center py-4">Loading saved domains...</div>
                                    )}
                                    {savedDomainsQuery.data && savedDomainsQuery.data.length === 0 && (
                                      <div className="text-center py-6 space-y-2">
                                        <div className="text-xs text-slate-500">No saved domains yet.</div>
                                        <div className="text-xs text-slate-600">Upload a new domain and it will be saved here automatically.</div>
                                      </div>
                                    )}
                                    {savedDomainsQuery.data?.map(sd => {
                                      const isSel = selectedSavedDomainId === sd.id;
                                      return (
                                        <motion.button
                                          key={sd.id}
                                          onClick={() => {
                                            setSelectedSavedDomainId(sd.id);
                                            setCustomDomainName(sd.domainName);
                                          }}
                                          whileTap={{ scale: 0.98 }}
                                          whileHover={!isSel ? { x: 2 } : undefined}
                                          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all border"
                                          style={isSel
                                            ? { background: "rgba(168,85,247,0.1)", borderColor: "rgba(168,85,247,0.35)" }
                                            : { borderColor: "transparent" }
                                          }
                                        >
                                          <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors"
                                            style={{ background: isSel ? "rgba(168,85,247,0.2)" : "rgba(255,255,255,0.06)" }}>
                                            <FileCodeIcon className={`w-5 h-5 ${isSel ? "text-purple-400" : "text-slate-500"}`} />
                                          </div>
                                          <div className="flex-1 min-w-0">
                                            <div className="text-sm font-medium leading-none transition-colors"
                                              style={{ fontFamily: "'JetBrains Mono', monospace", color: isSel ? "#E9D5FF" : "#CBD5E1" }}>
                                              {sd.displayName}
                                            </div>
                                            <div className="text-xs text-slate-500 mt-0.5">
                                              {sd.provider} &middot; {new Date(sd.createdAt).toLocaleDateString()}
                                            </div>
                                            {(sd.transformerHash || sd.rendererHash) && (
                                              <div className="flex gap-1 mt-1">
                                                {sd.transformerHash && (
                                                  <span
                                                    title={`Transformer hash: ${sd.transformerHash}`}
                                                    className="px-1.5 py-0.5 rounded bg-white/[0.04] text-slate-400 font-mono text-[10px]"
                                                  >
                                                    T:{sd.transformerHash.slice(0, 8)}
                                                  </span>
                                                )}
                                                {sd.rendererHash && (
                                                  <span
                                                    title={`Renderer hash: ${sd.rendererHash}`}
                                                    className="px-1.5 py-0.5 rounded bg-white/[0.04] text-slate-400 font-mono text-[10px]"
                                                  >
                                                    R:{sd.rendererHash.slice(0, 8)}
                                                  </span>
                                                )}
                                              </div>
                                            )}
                                          </div>
                                          {isSel && (
                                            <motion.div
                                              layoutId="saved-domain-dot"
                                              className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                                              style={{ background: "#A855F7", boxShadow: "0 0 8px rgba(168,85,247,0.7)" }}
                                            />
                                          )}
                                        </motion.button>
                                      );
                                    })}

                                    {/* When a saved domain is selected, show domain definition + problem upload */}
                                    <AnimatePresence>
                                      {selectedSavedDomainId && loadSavedDomainQuery.data && (
                                        <motion.div
                                          initial={{ opacity: 0, height: 0 }}
                                          animate={{ opacity: 1, height: "auto" }}
                                          exit={{ opacity: 0, height: 0 }}
                                          transition={{ duration: 0.2, ease: easeOut }}
                                          className="overflow-hidden space-y-3 pt-2"
                                        >
                                          {/* Domain Definition Preview */}
                                          <div>
                                            <label className="text-xs font-medium text-slate-400 block mb-1.5">Domain Definition</label>
                                            <div className="w-full h-28 text-xs font-mono bg-white/[0.04] border border-white/[0.08] rounded-lg p-2 overflow-auto text-slate-400">
                                              <pre className="whitespace-pre-wrap">{loadSavedDomainQuery.data.domainPddl}</pre>
                                            </div>
                                          </div>
                                          {/* Generated Code (transformer + renderer artifacts) */}
                                          <div>
                                            <button
                                              type="button"
                                              onClick={() => setShowGeneratedCode(v => !v)}
                                              className="flex items-center justify-between w-full text-xs font-medium text-slate-400 hover:text-slate-300 mb-1.5"
                                            >
                                              <span>Generated Code</span>
                                              <span className="font-mono text-[10px] text-slate-500">
                                                {showGeneratedCode ? "▾ hide" : "▸ show"}
                                              </span>
                                            </button>
                                            <AnimatePresence>
                                              {showGeneratedCode && (
                                                <motion.div
                                                  initial={{ opacity: 0, height: 0 }}
                                                  animate={{ opacity: 1, height: "auto" }}
                                                  exit={{ opacity: 0, height: 0 }}
                                                  transition={{ duration: 0.18, ease: easeOut }}
                                                  className="overflow-hidden space-y-2"
                                                >
                                                  {(["transformer", "renderer"] as const).map(kind => {
                                                    const code = kind === "transformer"
                                                      ? loadSavedDomainQuery.data.transformerCode
                                                      : loadSavedDomainQuery.data.rendererCode;
                                                    const hash = kind === "transformer"
                                                      ? loadSavedDomainQuery.data.transformerHash
                                                      : loadSavedDomainQuery.data.rendererHash;
                                                    return (
                                                      <div key={kind} className="bg-white/[0.04] border border-white/[0.08] rounded-lg p-2">
                                                        <div className="flex items-center gap-2 mb-1.5">
                                                          <span className="text-xs font-medium text-slate-300 capitalize">{kind}</span>
                                                          <span
                                                            title={hash || "(no hash)"}
                                                            className="font-mono text-[10px] text-slate-500 truncate flex-1 min-w-0"
                                                          >
                                                            {hash ? hash.slice(0, 16) + "…" : "(legacy, no hash)"}
                                                          </span>
                                                          <span className="font-mono text-[10px] text-slate-500 flex-shrink-0">
                                                            {formatBytes(code?.length || 0)}
                                                          </span>
                                                          <button
                                                            type="button"
                                                            onClick={() => { if (code) navigator.clipboard.writeText(code); }}
                                                            className="px-1.5 py-0.5 rounded text-[10px] font-mono text-slate-400 hover:text-slate-200 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08]"
                                                            title="Copy code to clipboard"
                                                          >
                                                            copy
                                                          </button>
                                                        </div>
                                                        <pre className="text-[10px] font-mono text-slate-400 whitespace-pre overflow-auto max-h-48 leading-relaxed">
                                                          {code || "(no code)"}
                                                        </pre>
                                                      </div>
                                                    );
                                                  })}
                                                </motion.div>
                                              )}
                                            </AnimatePresence>
                                          </div>
                                          {/* Problem PDDL */}
                                          <div>
                                            <label className="text-xs font-medium text-slate-400 block mb-1.5">Problem PDDL</label>
                                            <div className="flex gap-1 mb-2">
                                              {(["file", "text"] as const).map(m => (
                                                <button key={m} onClick={() => setCustomProblemInputMode(m)}
                                                  className="px-2.5 py-1 rounded-md text-xs font-medium transition-all"
                                                  style={{ background: customProblemInputMode === m ? "rgba(168,85,247,0.2)" : "rgba(255,255,255,0.05)", color: customProblemInputMode === m ? "#c084fc" : "#64748B", border: `1px solid ${customProblemInputMode === m ? "rgba(168,85,247,0.3)" : "transparent"}` }}>
                                                  {m === "file" ? "Upload File" : "Paste Text"}
                                                </button>
                                              ))}
                                            </div>
                                            {customProblemInputMode === "file" ? (
                                              <label className="flex flex-col items-center justify-center gap-2 px-3 py-4 rounded-xl border-2 border-dashed cursor-pointer transition-all hover:border-purple-500/40 hover:bg-white/[0.03]"
                                                style={{ borderColor: customProblemFile ? "rgba(168,85,247,0.4)" : "rgba(255,255,255,0.08)", background: customProblemFile ? "rgba(168,85,247,0.06)" : "transparent" }}>
                                                <span style={{ color: customProblemFile ? "#c084fc" : "#475569" }}><UploadIcon className="w-5 h-5" /></span>
                                                <span className="text-xs text-center" style={{ color: customProblemFile ? "#c084fc" : "#475569" }}>
                                                  {customProblemFile ? customProblemFile.name : "Click to upload problem.pddl"}
                                                </span>
                                                <input type="file" accept=".pddl,.txt" className="hidden"
                                                  onChange={e => setCustomProblemFile(e.target.files?.[0] || null)} />
                                              </label>
                                            ) : (
                                              <Textarea value={customProblemText} onChange={e => setCustomProblemText(e.target.value)}
                                                placeholder="(define (problem my-problem)&#10;  (:domain my-domain)&#10;  ...)"
                                                className="w-full h-28 text-xs font-mono resize-none bg-white/[0.04] border-white/[0.08] text-slate-300 placeholder-slate-600 focus:border-purple-500/30"
                                              />
                                            )}
                                          </div>
                                          {/* Info banner */}
                                          <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs" style={{ background: "rgba(168,85,247,0.08)", border: "1px solid rgba(168,85,247,0.15)" }}>
                                            <SparklesIcon className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />
                                            <span className="text-purple-300/80">Pre-trained renderer will be used. No LLM call needed.</span>
                                          </div>
                                        </motion.div>
                                      )}
                                    </AnimatePresence>
                                  </motion.div>
                                )}

                                {/* Upload New panel */}
                                {customMode === "new" && (
                                  <motion.div
                                    key="upload-new"
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: "auto" }}
                                    exit={{ opacity: 0, height: 0 }}
                                    transition={{ duration: 0.2, ease: easeOut }}
                                    className="overflow-hidden space-y-3"
                                  >
                              {/* LLM-only notice */}
                              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-purple-500/[0.08] border border-purple-500/20">
                                <SparklesIcon className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />
                                <span className="text-[11px] text-purple-300/80 leading-relaxed">
                                  LLM rendering is used automatically for custom domains.
                                </span>
              </div>
              {/* LLM Provider selector */}
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-500 flex-shrink-0">LLM Model</span>
                <div className="flex items-center gap-1 flex-1">
                  {[
                    { id: "claude", label: "Claude", active: "bg-orange-500/15 border-orange-500/30 text-orange-400" },
                    { id: "gemini", label: "Gemini", active: "bg-blue-500/15 border-blue-500/30 text-blue-400" },
                  ].map(m => (
                    <button key={m.id} onClick={() => setLlmProvider(m.id as any)}
                      className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors border ${
                        llmProvider === m.id ? m.active : "bg-white/[0.03] border-white/[0.07] text-slate-600 hover:text-slate-400 hover:border-white/[0.12]"
                      }`}>
                      {m.label}
                    </button>
                  ))}
                </div>
                              </div>
                              {/* Domain Name */}
                              <div>
                                <label className="text-xs font-medium text-slate-400 block mb-1.5">Domain Name</label>
                                <input
                                  type="text"
                                  value={customDomainName}
                                  onChange={e => setCustomDomainName(e.target.value)}
                                  placeholder="e.g. logistics, ferry, floortile..."
                                  className="w-full px-3 py-2 rounded-lg text-sm text-slate-200 placeholder-slate-600 border border-white/[0.08] bg-white/[0.04] focus:outline-none focus:border-purple-500/40 focus:bg-white/[0.06] transition-all"
                                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                                />
                              </div>
                              {/* Domain PDDL */}
                              <div>
                                <label className="text-xs font-medium text-slate-400 block mb-1.5">Domain PDDL</label>
                                <div className="flex gap-1 mb-2">
                                  {(["file", "text"] as const).map(m => (
                                    <button key={m} onClick={() => setCustomDomainInputMode(m)}
                                      className="px-2.5 py-1 rounded-md text-xs font-medium transition-all"
                                      style={{ background: customDomainInputMode === m ? "rgba(168,85,247,0.2)" : "rgba(255,255,255,0.05)", color: customDomainInputMode === m ? "#c084fc" : "#64748B", border: `1px solid ${customDomainInputMode === m ? "rgba(168,85,247,0.3)" : "transparent"}` }}>
                                      {m === "file" ? "Upload File" : "Paste Text"}
                                    </button>
                                  ))}
                                </div>
                                {customDomainInputMode === "file" ? (
                                  <label className="flex flex-col items-center justify-center gap-2 px-3 py-4 rounded-xl border-2 border-dashed cursor-pointer transition-all hover:border-purple-500/40 hover:bg-white/[0.03]"
                                    style={{ borderColor: customDomainFile ? "rgba(168,85,247,0.4)" : "rgba(255,255,255,0.08)", background: customDomainFile ? "rgba(168,85,247,0.06)" : "transparent" }}>
                                    <span style={{ color: customDomainFile ? "#c084fc" : "#475569" }}><UploadIcon className="w-5 h-5" /></span>
                                    <span className="text-xs text-center" style={{ color: customDomainFile ? "#c084fc" : "#475569" }}>
                                      {customDomainFile ? customDomainFile.name : "Click to upload domain.pddl"}
                                    </span>
                                    <input type="file" accept=".pddl,.txt" className="hidden"
                                      onChange={e => setCustomDomainFile(e.target.files?.[0] || null)} />
                                  </label>
                                ) : (
                                  <Textarea value={customDomainText} onChange={e => setCustomDomainText(e.target.value)}
                                    placeholder="(define (domain my-domain)&#10;  (:requirements :strips)&#10;  ...)"
                                    className="w-full h-28 text-xs font-mono resize-none bg-white/[0.04] border-white/[0.08] text-slate-300 placeholder-slate-600 focus:border-purple-500/30"
                                  />
                                )}
                              </div>
                              {/* Problem PDDL */}
                              <div>
                                <label className="text-xs font-medium text-slate-400 block mb-1.5">Problem PDDL</label>
                                <div className="flex gap-1 mb-2">
                                  {(["file", "text"] as const).map(m => (
                                    <button key={m} onClick={() => setCustomProblemInputMode(m)}
                                      className="px-2.5 py-1 rounded-md text-xs font-medium transition-all"
                                      style={{ background: customProblemInputMode === m ? "rgba(168,85,247,0.2)" : "rgba(255,255,255,0.05)", color: customProblemInputMode === m ? "#c084fc" : "#64748B", border: `1px solid ${customProblemInputMode === m ? "rgba(168,85,247,0.3)" : "transparent"}` }}>
                                      {m === "file" ? "Upload File" : "Paste Text"}
                                    </button>
                                  ))}
                                </div>
                                {customProblemInputMode === "file" ? (
                                  <label className="flex flex-col items-center justify-center gap-2 px-3 py-4 rounded-xl border-2 border-dashed cursor-pointer transition-all hover:border-purple-500/40 hover:bg-white/[0.03]"
                                    style={{ borderColor: customProblemFile ? "rgba(168,85,247,0.4)" : "rgba(255,255,255,0.08)", background: customProblemFile ? "rgba(168,85,247,0.06)" : "transparent" }}>
                                    <span style={{ color: customProblemFile ? "#c084fc" : "#475569" }}><UploadIcon className="w-5 h-5" /></span>
                                    <span className="text-xs text-center" style={{ color: customProblemFile ? "#c084fc" : "#475569" }}>
                                      {customProblemFile ? customProblemFile.name : "Click to upload problem.pddl"}
                                    </span>
                                    <input type="file" accept=".pddl,.txt" className="hidden"
                                      onChange={e => setCustomProblemFile(e.target.files?.[0] || null)} />
                                  </label>
                                ) : (
                                  <Textarea value={customProblemText} onChange={e => setCustomProblemText(e.target.value)}
                                    placeholder="(define (problem my-problem)&#10;  (:domain my-domain)&#10;  ...)"
                                    className="w-full h-28 text-xs font-mono resize-none bg-white/[0.04] border-white/[0.08] text-slate-300 placeholder-slate-600 focus:border-purple-500/30"
                                  />
                                )}
                              </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </CollapseSection>
                  </div>

                  {/* Divider */}
                  <div className="h-px mx-4" style={{ background: "linear-gradient(to right, transparent, rgba(255,255,255,0.06) 30%, rgba(255,255,255,0.06) 70%, transparent)" }} />

                  {/* ── Step 2: Problem (hidden when custom domain is selected) ── */}
                  <AnimatePresence>
                    {!isCustomDomain && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2, ease: easeOut }}
                        className="overflow-hidden"
                      >
                  {/* ── Step 2: Problem ── */}
                  <div>
                    <div className="px-4 py-3.5 flex items-center gap-3">
                      <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{ background: "rgba(14,165,233,0.15)", border: "1px solid rgba(14,165,233,0.3)" }}>
                        <span className="text-[11px] font-bold"
                          style={{ fontFamily: "'JetBrains Mono', monospace", color: "#38BDF8" }}>2</span>
                      </div>
                      <span className="text-sm font-semibold text-slate-200"
                        style={{ fontFamily: "'JetBrains Mono', monospace" }}>Problem</span>
                    </div>
                    <div className="px-4 pb-5 space-y-3">
                      <PillToggle
                        options={[{ id: "example", label: "Example" }, { id: "custom", label: "Custom" }]}
                        value={problemType}
                        onChange={v => setProblemType(v as any)}
                      />

                      <AnimatePresence mode="wait">
                        {problemType === "example" ? (
                          <motion.div key="ex" {...fadeInUp} transition={{ duration: 0.16, ease: easeOut }} className="space-y-3">
                            <div className="p-3 bg-green-500/[0.07] rounded-xl border border-green-500/[0.15]">
                              <p className="text-xs text-green-300/80 leading-relaxed">
                                Using default problem for <strong className="text-green-300">{currentDomain?.name}</strong>
                              </p>
                            </div>
                            <button onClick={() => setShowExampleProblem(true)}
                              className="w-full px-3 py-2.5 text-xs font-medium text-slate-500 hover:text-slate-300 rounded-lg hover:bg-white/[0.04] transition-all duration-150 flex items-center justify-center gap-1.5">
                              <FileCodeIcon className="w-3 h-3" />
                              View Example Problem
                            </button>
                          </motion.div>
                        ) : (
                          <motion.div key="cu" {...fadeInUp} transition={{ duration: 0.16, ease: easeOut }} className="space-y-3">
                            <PillToggle
                              options={[
                                { id: "file", label: <><UploadIcon className="w-3 h-3" />Upload</> },
                                { id: "text", label: <><FileCodeIcon className="w-3 h-3" />Paste</> },
                              ]}
                              value={inputMode}
                              onChange={v => { setInputMode(v as any); if (v === "file") setProblemText(""); else setProblemFile(null); }}
                            />
                            {inputMode === "file" ? (
                              <div className="relative">
                                <input type="file" accept=".pddl"
                                  onChange={e => setProblemFile(e.target.files?.[0] || null)}
                                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                                <div className={`border-2 border-dashed rounded-xl p-5 text-center transition-all ${
                                  problemFile
                                    ? "border-green-500/40 bg-green-500/[0.06]"
                                    : "border-white/[0.08] hover:border-green-500/30 hover:bg-green-500/[0.04]"
                                }`}>
                                  {problemFile ? (
                                    <><CheckCircleIcon className="w-6 h-6 text-green-500 mx-auto mb-1.5" />
                                    <p className="text-xs text-green-400 font-medium truncate px-2">{problemFile.name}</p></>
                                  ) : (
                                    <><UploadIcon className="w-6 h-6 text-slate-600 mx-auto mb-1.5" />
                                    <p className="text-xs text-slate-600">Drop .pddl file or click to browse</p></>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <div>
                                <Textarea
                                  value={problemText}
                                  onChange={e => setProblemText(e.target.value)}
                                  placeholder={"(define (problem ...)\n  (:domain ...)\n  ...\n)"}
                                  className="font-mono text-xs min-h-[260px] bg-white/[0.04] border-white/[0.08] text-slate-300 placeholder:text-slate-700 focus:border-green-500/40 rounded-xl resize-none"
                                />
                                {problemText && <p className="text-[11px] text-slate-500 mt-1.5">{problemText.split("\n").length} lines</p>}
                              </div>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Divider */}
                  <div className="h-px mx-4" style={{ background: "linear-gradient(to right, transparent, rgba(255,255,255,0.06) 30%, rgba(255,255,255,0.06) 70%, transparent)" }} />

                  {/* ── Step 3: Strategy ── */}
                  <div>
                    <button onClick={() => setIsStrategyOpen(!isStrategyOpen)}
                      className="w-full px-4 py-3.5 flex items-center gap-3 hover:bg-white/[0.03] transition-all duration-150">
                      <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{ background: "rgba(139,92,246,0.15)", border: "1px solid rgba(139,92,246,0.3)" }}>
                        <span className="text-[11px] font-bold"
                          style={{ fontFamily: "'JetBrains Mono', monospace", color: "#A78BFA" }}>3</span>
                      </div>
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span className="text-sm font-semibold text-slate-200 flex-shrink-0"
                          style={{ fontFamily: "'JetBrains Mono', monospace" }}>Strategy</span>
                        <span className="text-xs text-slate-500 truncate">{currentStrategy?.name}</span>
                      </div>
                      <motion.div animate={{ rotate: isStrategyOpen ? 0 : -90 }} transition={{ duration: 0.18, ease: easeOut }} className="flex-shrink-0">
                        <ChevronDownIcon className="w-4 h-4 text-slate-600" />
                      </motion.div>
                    </button>

                    <CollapseSection open={isStrategyOpen}>
                      <div className="px-3 pb-4 pt-1 border-t border-white/[0.04]">
                        <motion.div className="space-y-0.5" variants={listStagger} initial="initial" animate="animate">
                          {strategiesQuery.data?.map((strategy: SearchStrategy) => {
                            const sel = selectedStrategy === strategy.id;
                            return (
                              <motion.button
                                key={strategy.id}
                                variants={listItem}
                                transition={{ duration: 0.18, ease: easeOut }}
                                onClick={() => setSelectedStrategy(strategy.id)}
                                whileTap={{ scale: 0.98 }}
                                whileHover={!sel ? { x: 2 } : undefined}
                                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all ${
                                  sel ? "bg-green-500/10 border border-green-500/[0.22] shadow-sm shadow-green-500/5" : "border border-transparent hover:bg-white/[0.04] hover:border-white/[0.06]"
                                }`}
                              >
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className={`text-sm font-medium ${sel ? "text-green-300" : "text-slate-300"}`}>
                                      {strategy.name}
                                    </span>
                                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
                                      strategy.isOptimal ? "bg-purple-500/15 text-purple-400" : "bg-blue-500/15 text-blue-400"
                                    }`}>
                                      {strategy.isOptimal ? "Optimal" : "Satisficing"}
                                    </span>
                                    {getSpeedBadge(strategy.speed)}
                                  </div>
                                  <div className="text-xs text-slate-500 leading-relaxed mt-0.5">{strategy.description}</div>
                                  {strategy.whenToUse && (
                                    <div className="text-xs text-slate-600 leading-relaxed mt-0.5 italic">{strategy.whenToUse}</div>
                                  )}
                                </div>
                                {sel && <div className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0"
                                  style={{ boxShadow: "0 0 6px rgba(34,197,94,0.8)" }} />}
                              </motion.button>
                            );
                          })}
                        </motion.div>
                        {currentStrategy?.warning && (
                          <div className="mt-2 p-3 bg-amber-500/[0.08] border border-amber-500/20 rounded-xl flex items-start gap-2">
                            <AlertIcon className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                            <p className="text-xs text-amber-300/80 leading-relaxed">{currentStrategy.warning}</p>
                          </div>
                        )}
                      </div>
                    </CollapseSection>
                  </div>
                </motion.div>

                {/* ── Render Mode Panel (hidden for custom domains — LLM is automatic) ── */}
                <AnimatePresence>
                {!isCustomDomain && (
                <motion.div
                  key="render-mode-panel"
                  className="rounded-2xl border border-white/[0.08] bg-[#111E30] overflow-hidden"
                  style={{ boxShadow: "0 1px 0 rgba(255,255,255,0.05) inset, 0 8px 32px rgba(0,0,0,0.18)" }}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.25, ease: easeOut }}
                >
                  <button onClick={() => setIsRenderModeOpen(!isRenderModeOpen)}
                    className="w-full px-4 py-3.5 flex items-center gap-3 hover:bg-white/[0.03] transition-all duration-150">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.3)" }}>
                      <BrainIcon className="w-3.5 h-3.5 text-green-400" />
                    </div>
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className="text-sm font-semibold text-slate-200 flex-shrink-0"
                        style={{ fontFamily: "'JetBrains Mono', monospace" }}>Render Mode</span>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        renderMode === "llm"
                          ? "bg-green-500/15 text-green-400 border border-green-500/25"
                          : "bg-white/[0.08] text-slate-400 border border-white/[0.08]"
                      }`}>{renderMode === "llm" ? "LLM" : "Basic"}</span>
                    </div>
                    <motion.div animate={{ rotate: isRenderModeOpen ? 0 : -90 }} transition={{ duration: 0.18, ease: easeOut }}>
                      <ChevronDownIcon className="w-4 h-4 text-slate-600" />
                    </motion.div>
                  </button>
                  <CollapseSection open={isRenderModeOpen}>
                    <div className="px-4 pb-4 pt-1 border-t border-white/[0.04] space-y-3">
                      {/* Basic / LLM toggle */}
                      <div className="flex items-center gap-0.5 bg-white/[0.04] rounded-lg p-0.5 border border-white/[0.06]">
                        {[
                          { id: "basic", label: "Basic" },
                          { id: "llm",   label: "LLM" },
                        ].map(m => (
                          <button key={m.id} onClick={() => setRenderMode(m.id as any)}
                            className={`flex-1 px-3 py-2 rounded-md text-xs font-medium transition-all duration-150 ${
                              renderMode === m.id
                                ? m.id === "llm" ? "bg-green-600 text-white shadow-sm" : "bg-white/[0.08] text-slate-200 shadow-sm"
                                : "text-slate-600 hover:text-slate-400"
                            }`}>
                            {m.label}
                          </button>
                        ))}
                      </div>
                      {/* LLM options */}
                      <CollapseSection open={renderMode === "llm"}>
                        <div className="space-y-3">
                          {/* Model selector */}
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-slate-500 flex-shrink-0">Model</span>
                            <div className="flex items-center gap-1 flex-1">
                              {[
                                { id: "claude", label: "Claude", active: "bg-orange-500/15 border-orange-500/30 text-orange-400" },
                                { id: "gemini", label: "Gemini", active: "bg-blue-500/15 border-blue-500/30 text-blue-400" },
                              ].map(m => (
                                <button key={m.id} onClick={() => setLlmProvider(m.id as any)}
                                  className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors border ${
                                    llmProvider === m.id ? m.active : "bg-white/[0.03] border-white/[0.07] text-slate-600 hover:text-slate-400 hover:border-white/[0.12]"
                                  }`}>
                                  {m.label}
                                </button>
                              ))}
                            </div>
                          </div>
                          {/* Generate LLM renderer button */}
                          <button onClick={handleLlmGenerate} disabled={isLlmGenerating}
                            className={`w-full py-2 px-4 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-2 ${
                              isLlmGenerating ? "bg-green-500/10 text-green-400/50 cursor-wait" : "btn-primary-green text-[#0B1524]"
                            }`}>
                            {isLlmGenerating ? (
                              <><div className="w-3.5 h-3.5 border-2 border-green-500/30 border-t-green-500 rounded-full animate-spin" />Generating renderer...</>
                            ) : llmRendererCode ? (
                              <><RefreshIcon className="w-3 h-3" />Regenerate</>
                            ) : (
                              <><WandIcon className="w-3 h-3" />Generate LLM Renderer</>
                            )}
                          </button>
                          {/* Status indicators */}
                          {llmRendererCode && (
                            <div className="flex items-center gap-2 text-xs text-green-400 bg-green-500/8 px-3 py-2 rounded-lg border border-green-500/20">
                              <CheckCircleIcon className="w-3.5 h-3.5 flex-shrink-0" />
                              LLM renderer active{llmModelInfo && ` — ${llmModelInfo}`}
                            </div>
                          )}
                          {llmError && (
                            <div className="flex items-start gap-2 text-xs text-red-400 bg-red-500/8 px-3 py-2 rounded-lg border border-red-500/20">
                              <AlertIcon className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                              <span className="leading-relaxed">{llmError}</span>
                            </div>
                          )}
                        </div>
                      </CollapseSection>
                    </div>
                  </CollapseSection>
                </motion.div>
                )}
                </AnimatePresence>
                {/* ── Step 4: Generate ── */}
                <div>
                  <div className="flex items-center gap-2 mb-2 px-1">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.3)" }}>
                      <span className="text-[11px] font-bold text-green-400"
                        style={{ fontFamily: "'JetBrains Mono', monospace" }}>4</span>
                    </div>
                    <span className="text-xs text-slate-500 font-medium" style={{ fontFamily: "'JetBrains Mono', monospace" }}>Run</span>
                  </div>
                  <motion.button
                    onClick={handleGenerate}
                    disabled={uploadMutation.isPending || isProcessing}
                    whileTap={!isProcessing ? { scale: 0.98 } : undefined}
                    whileHover={!isProcessing ? { y: -1 } : undefined}
                    transition={{ duration: 0.15 }}
                    className={`w-full py-4 px-6 rounded-2xl font-semibold text-sm tracking-wide transition-all duration-200 ${
                      isProcessing
                        ? "bg-green-600/40 text-green-200/60 cursor-wait"
                        : "btn-primary-green text-[#0B1524]"
                    }`}
                    style={{ fontFamily: "'JetBrains Mono', monospace" }}
                  >
                  {isProcessing ? (
                    <span className="flex items-center justify-center gap-2.5">
                      <div className="w-4 h-4 border-2 border-green-200/30 border-t-green-200 rounded-full animate-spin" />
                      Processing... {formatTime(elapsedTime)}
                    </span>
                  ) : problemType === "custom" ? (
                    <span className="flex items-center justify-center gap-2">
                      <WandIcon className="w-4 h-4" />
                      Solve Problem
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      <PlayIcon className="w-4 h-4" />
                      Generate States
                    </span>
                  )}
                  </motion.button>
                </div>

                <AnimatePresence>
                  {isProcessing && currentStrategy?.isOptimal && elapsedTime > 30 && (
                    <motion.p {...fadeInUp} transition={{ duration: 0.2, ease: easeOut }}
                      className="text-xs text-amber-400/80 text-center leading-relaxed px-2">
                      Optimal search can take a while. Consider a satisficing strategy for faster results.
                    </motion.p>
                  )}
                </AnimatePresence>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Visualization Column ── */}
          <motion.div layout transition={spring} className="flex-1 min-w-0 w-full">

            {/* Sidebar toggle */}
            <div className="mb-4">
              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/[0.08] bg-white/[0.03] text-slate-400 hover:text-slate-200 hover:border-white/[0.14] hover:bg-white/[0.05] text-xs font-medium transition-all duration-150"
              >
                <MenuIcon className="w-4 h-4" />
                {isSidebarCollapsed ? "Show Options" : "Hide Options"}
              </motion.button>
            </div>

            {renderedStates.length > 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, ease: easeOut }}
                className="flex gap-5"
              >

                {/* Viz card */}
                <div className="relative rounded-2xl border border-white/[0.08] bg-[#111E30] overflow-hidden card-accent-top flex-1 min-w-0"
                  style={{ boxShadow: "0 1px 0 rgba(255,255,255,0.04) inset" }}>

                  {/* Processing scan beam */}
                  <AnimatePresence>
                    {isProcessing && <ScanBeam />}
                  </AnimatePresence>

                  {/* Success flash */}
                  <AnimatePresence>
                    {showSuccessFlash && (
                      <motion.div
                        className="absolute inset-0 pointer-events-none rounded-2xl"
                        style={{ background: "radial-gradient(ellipse at 50% 30%, rgba(34,197,94,0.18) 0%, transparent 65%)", zIndex: 3 }}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: [0, 1, 0] }}
                        transition={{ duration: 0.9, times: [0, 0.2, 1] }}
                      />
                    )}
                  </AnimatePresence>

                  {/* Card Header */}
                  <div className="px-6 py-4 border-b border-white/[0.05]">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-sm font-semibold text-slate-200"
                          style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                          Visualization
                        </h2>
                        <p className="text-xs text-slate-500 mt-1">
                          {isCustomDomain ? (customDomainName || "Custom Domain") : currentDomain?.name} &middot; {plan.length} {plan.length === 1 ? "action" : "actions"}
                        </p>
                      </div>
                      {/* Custom domain pipeline status badges */}
                      {isCustomDomain && renderedStates.length > 0 && (
                        <div className="flex items-center gap-2">
                          {/* Step 1: Transformer */}
                          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                            isTransformerGenerating
                              ? "bg-purple-500/10 text-purple-300 border-purple-500/25 animate-pulse"
                              : llmTransformerCode
                              ? "bg-purple-500/10 text-purple-400 border-purple-500/25"
                              : transformerError
                              ? "bg-red-500/10 text-red-400 border-red-500/20"
                              : "bg-white/[0.04] text-slate-500 border-white/[0.06]"
                          }`}>
                            {isTransformerGenerating ? (
                              <><motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} className="w-3 h-3 border border-purple-400 border-t-transparent rounded-full" /><span>Analyzing domain…</span></>
                            ) : llmTransformerCode ? (
                              <><CheckCircleIcon className="w-3 h-3" /><span>Transformer ready</span></>
                            ) : transformerError ? (
                              <><AlertIcon className="w-3 h-3" /><span>Transformer failed</span></>
                            ) : (
                              <><span className="w-3 h-3 rounded-full bg-slate-600" /><span>Transformer pending</span></>
                            )}
                          </div>
                          {/* Step 2: Canvas renderer */}
                          {(llmTransformerCode || isLlmGenerating || llmRendererCode) && (
                            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                              isLlmGenerating
                                ? "bg-green-500/10 text-green-300 border-green-500/25 animate-pulse"
                                : llmRendererCode
                                ? "bg-green-500/10 text-green-400 border-green-500/25"
                                : llmError
                                ? "bg-red-500/10 text-red-400 border-red-500/20"
                                : "bg-white/[0.04] text-slate-500 border-white/[0.06]"
                            }`}>
                              {isLlmGenerating ? (
                                <><motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} className="w-3 h-3 border border-green-400 border-t-transparent rounded-full" /><span>Drawing…</span></>
                              ) : llmRendererCode ? (
                                <><CheckCircleIcon className="w-3 h-3" /><span>Renderer ready</span></>
                              ) : llmError ? (
                                <><AlertIcon className="w-3 h-3" /><span>Renderer failed</span></>
                              ) : null}
                            </div>
                          )}
                        </div>
                      )}
                      {plannerInfo && (
                        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
                          plannerInfo.used_planner
                            ? "bg-green-500/10 text-green-400 border-green-500/25"
                            : "bg-amber-500/10 text-amber-400 border-amber-500/25"
                        }`}>
                          {plannerInfo.used_planner
                            ? <CheckCircleIcon className="w-3 h-3" />
                            : <AlertIcon       className="w-3 h-3" />}
                          {plannerInfo.info}
                        </div>
                      )}
                    </div>

                    {plannerInfo?.strategy && (
                      <div className="mt-2.5 flex items-center gap-2">
                        <span className="text-xs text-slate-500">Strategy:</span>
                        <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded-full ${
                          plannerInfo.strategy.isOptimal ? "bg-purple-500/15 text-purple-400" : "bg-blue-500/15 text-blue-400"
                        }`}>{plannerInfo.strategy.name}</span>
                        {getSpeedBadge(plannerInfo.strategy.speed)}
                      </div>
                    )}

                  </div>
                  {/* Canvas — replaced by a loading state while custom-domain LLM calls are in flight */}
                  <div className="p-4" style={{ maxHeight: "500px", overflow: "auto" }}>
                    {isCustomDomain && (isTransformerGenerating || isLlmGenerating) && !llmError && !transformerError ? (
                      <CustomDomainLoading
                        stage={isTransformerGenerating ? "transformer" : "renderer"}
                        domainName={customDomainName}
                      />
                    ) : (
                      <StateCanvas
                        state={renderedStates[currentStateIndex]}
                        isFirst={currentStateIndex === 0}
                        isLast={currentStateIndex === renderedStates.length - 1}
                        llmRendererCode={renderMode === "llm" && llmRendererCode ? llmRendererCode : undefined}
                        transformerCode={isCustomDomain && llmTransformerCode ? llmTransformerCode : undefined}
                        onLlmError={err => setLlmError(err)}
                      />
                    )}
                  </div>

                  {/* Controls */}
                  <div className="px-6 py-4 border-t border-white/[0.05] bg-black/[0.15] space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1 bg-white/[0.04] rounded-xl border border-white/[0.06] p-1">
                        <motion.button onClick={handlePrevious} disabled={currentStateIndex === 0}
                          whileTap={{ scale: 0.92 }}
                          className="p-2.5 rounded-lg hover:bg-white/[0.06] disabled:opacity-25 transition-all duration-150">
                          <SkipBackIcon className="w-4 h-4 text-slate-400" />
                        </motion.button>
                        {isPlaying ? (
                          <motion.button onClick={handlePause} whileTap={{ scale: 0.92 }}
                            className="p-2.5 rounded-lg bg-green-600 text-white hover:bg-green-500 transition-all duration-150">
                            <PauseIcon className="w-4 h-4" />
                          </motion.button>
                        ) : (
                          <motion.button onClick={handlePlay} disabled={currentStateIndex >= renderedStates.length - 1}
                            whileTap={{ scale: 0.92 }}
                            className="p-2.5 rounded-lg bg-green-600 text-white hover:bg-green-500 disabled:opacity-25 transition-all duration-150">
                            <PlayIcon className="w-4 h-4" />
                          </motion.button>
                        )}
                        <motion.button onClick={handleNext} disabled={currentStateIndex >= renderedStates.length - 1}
                          whileTap={{ scale: 0.92 }}
                          className="p-2.5 rounded-lg hover:bg-white/[0.06] disabled:opacity-25 transition-all duration-150">
                          <SkipForwardIcon className="w-4 h-4 text-slate-400" />
                        </motion.button>
                      </div>

                      <div className="flex-1 px-1">
                        <input type="range" min="0" max={renderedStates.length - 1} value={currentStateIndex}
                          onChange={e => setCurrentStateIndex(Number(e.target.value))}
                          className="w-full" />
                      </div>

                      <div className="text-xs font-medium text-slate-500 bg-white/[0.04] px-2.5 py-1.5 rounded-lg border border-white/[0.06]"
                        style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                        <AnimatedNumber value={currentStateIndex + 1} />
                        <span className="text-slate-700"> / {renderedStates.length}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-xs text-slate-500 font-medium">Speed</span>
                      <input type="range" min="200" max="2000" step="200"
                        value={2200 - playbackSpeed}
                        onChange={e => setPlaybackSpeed(2200 - Number(e.target.value))}
                        className="w-28" />
                      <span className="text-xs text-slate-500 font-medium tabular-nums"
                        style={{ fontFamily: "'JetBrains Mono', monospace" }}>{playbackSpeed}ms</span>
                    </div>
                  </div>

                </div>

                {/* Plan Steps — separate card (sidebar-collapsed mode) */}
                {plan.length > 0 && (
                  <div className="w-80 flex-shrink-0 rounded-2xl border border-white/[0.08] bg-[#111E30] overflow-hidden"
                    style={{ boxShadow: "0 1px 0 rgba(255,255,255,0.04) inset" }}>
                    <div className="px-4 py-3 border-b border-white/[0.05] bg-white/[0.02] flex items-center justify-between">
                      <h3 className="text-xs font-semibold text-slate-300 flex items-center gap-2"
                        style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                        <TerminalIcon className="w-3.5 h-3.5 text-green-500" />
                        Plan Steps
                      </h3>
                      <span className="text-xs text-slate-500 tabular-nums">{plan.length} actions</span>
                    </div>
                    <div ref={planStepsRef}
                      className="p-3 space-y-0.5 max-h-[600px] overflow-y-auto overscroll-contain"
                      style={{ scrollBehavior: "smooth" }}>
                      {plan.map((action, idx) => (
                        <motion.div key={idx}
                          initial={false}
                          animate={idx === currentStateIndex - 1 ? { backgroundColor: "rgba(34,197,94,0.08)" } : { backgroundColor: "transparent" }}
                          transition={{ duration: 0.2 }}
                          className={`text-xs px-3 py-2 rounded-lg transition-colors font-mono ${
                            idx === currentStateIndex - 1
                              ? "text-green-300 font-medium border-l-[2px] border-green-500"
                              : idx < currentStateIndex - 1
                              ? "text-slate-700"
                              : "text-slate-500 hover:bg-white/[0.03]"
                          }`}>
                          <span className={`mr-2 tabular-nums ${idx === currentStateIndex - 1 ? "text-green-600" : "text-slate-700"}`}>
                            {String(idx + 1).padStart(2, "0")}.
                          </span>
                          {action}
                        </motion.div>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>

            ) : (
              /* ── Empty State ── */
              <motion.div
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, ease: easeOut }}
                className="rounded-2xl border border-white/[0.08] bg-[#111E30]"
                style={{ boxShadow: "0 1px 0 rgba(255,255,255,0.04) inset" }}
              >
                <div className="py-24 px-10 flex flex-col items-center text-center">

                  {/* Animated planning tree */}
                  <div className="mb-4 w-full flex flex-col items-center gap-3">
                    <div className="relative">
                      <div className="absolute inset-0 -m-12 rounded-full pointer-events-none" style={{ background: "radial-gradient(ellipse at center, rgba(34,197,94,0.08) 0%, rgba(99,102,241,0.05) 50%, transparent 70%)" }} />
                      <PlanningGraph />
                    </div>
                    {/* Legend */}
                    <motion.div
                      className="flex items-center gap-4"
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      transition={{ delay: 1.1, duration: 0.4 }}
                    >
                      {[
                        { color: "#6366F1", label: "Start" },
                        { color: "rgba(226,232,240,0.5)", label: "State" },
                        { color: "#22C55E", label: "Goal" },
                      ].map(({ color, label }) => (
                        <div key={label} className="flex items-center gap-1.5">
                          <div className="w-3 h-3 rounded-full border border-white/20 flex-shrink-0"
                            style={{ background: color }} />
                          <span className="text-xs text-slate-500">{label}</span>
                        </div>
                      ))}
                    </motion.div>
                  </div>

                  <motion.h3
                    className="text-2xl font-semibold text-slate-100 mb-3"
                    style={{ fontFamily: "'JetBrains Mono', monospace" }}
                    initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.7, duration: 0.3, ease: easeOut }}
                  >
                    Ready to Visualize
                  </motion.h3>
                  <motion.p
                    className="text-sm text-slate-500 max-w-[340px] leading-relaxed"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    transition={{ delay: 0.85, duration: 0.3 }}
                  >
                    {problemType === "custom"
                      ? "Upload a PDDL problem file or paste your problem definition, then click Solve Problem"
                      : "Configure the domain and strategy, then click Generate States"}
                  </motion.p>

                  {/* Terminal hint with blinking cursor */}
                  <motion.div
                    className="mt-8 px-4 py-3 rounded-xl border border-white/[0.07] font-mono text-xs text-slate-500"
                    style={{ background: "rgba(11,21,36,0.7)" }}
                    initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 1.0, duration: 0.3, ease: easeOut }}
                  >
                    <span className="text-green-500">$</span>
                    {" "}planner --domain {selectedDomain} --run
                    <BlinkingCursor />
                  </motion.div>
                </div>
              </motion.div>
            )}
          </motion.div>
        </div>
      </main>

      <footer className="border-t border-white/[0.05] bg-[#0B1524]/80 mt-16" style={{ position: "relative", zIndex: 1 }}>
        <div className="container max-w-[1440px] py-5">
          <p className="text-center text-xs text-slate-600 tracking-wide font-mono">
            Planning Visualizer &middot; Built for AI Planning Education
          </p>
        </div>
      </footer>

      {/* ── Modals ── */}
      <AnimatePresence>
        {errorModal.show && (
          <ModalBackdrop onClose={() => setErrorModal({ show: false, title: "", message: "" })}>
            <div className="bg-[#111E30] rounded-2xl border border-white/[0.08] max-w-md w-full overflow-hidden"
              style={{ boxShadow: "0 25px 60px rgba(0,0,0,0.6), 0 1px 0 rgba(255,255,255,0.05) inset" }}>
              <div className={`px-6 py-4 border-b ${
                errorModal.errorType?.includes("mismatch")
                  ? "border-amber-500/20 bg-amber-500/[0.06]"
                  : "border-red-500/20 bg-red-500/[0.06]"
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      errorModal.errorType?.includes("mismatch") ? "bg-amber-500/15" : "bg-red-500/15"
                    }`}>
                      <AlertIcon className={`w-4 h-4 ${errorModal.errorType?.includes("mismatch") ? "text-amber-400" : "text-red-400"}`} />
                    </div>
                    <h3 className={`text-sm font-semibold ${errorModal.errorType?.includes("mismatch") ? "text-amber-300" : "text-red-300"}`}
                      style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                      {errorModal.title}
                    </h3>
                  </div>
                  <button onClick={() => setErrorModal({ show: false, title: "", message: "" })}
                    className="text-slate-500 hover:text-slate-200 transition-all duration-150 p-2 rounded-xl hover:bg-white/[0.08]">
                    <CloseIcon className="w-5 h-5" />
                  </button>
                </div>
              </div>
              <div className="px-6 py-5">
                <p className="text-sm text-slate-400 whitespace-pre-wrap leading-relaxed">{errorModal.message}</p>
                {errorModal.suggestedDomain && errorModal.suggestedDomainName && (
                  <div className="mt-4 p-4 bg-green-500/[0.07] rounded-xl border border-green-500/20">
                    <p className="text-xs text-green-300/70 font-medium mb-3">Would you like to switch to the suggested domain?</p>
                    <button
                      onClick={() => { setSelectedDomain(errorModal.suggestedDomain!); setErrorModal({ show: false, title: "", message: "" }); }}
                      className="w-full px-4 py-2.5 btn-primary-green text-[#0B1524] rounded-xl text-sm font-semibold">
                      Switch to {errorModal.suggestedDomainName}
                    </button>
                  </div>
                )}
              </div>
              <div className="px-6 py-4 border-t border-white/[0.05] bg-white/[0.02] flex justify-end">
                <button onClick={() => setErrorModal({ show: false, title: "", message: "" })}
                  className="px-5 py-2.5 text-sm text-slate-400 hover:text-slate-200 font-medium transition-all duration-150 rounded-xl hover:bg-white/[0.08]">
                  Close
                </button>
              </div>
            </div>
          </ModalBackdrop>
        )}
      </AnimatePresence>

      {/* "Domain already exists" — surfaces when an upload's PDDL hash
          matches one or more entries in the saved-domains library. The
          user picks a specific existing version to reuse, or generates a
          new versioned entry. Dismissing the modal cancels the action. */}
      <AnimatePresence>
        {duplicateModal.show && (
          <ModalBackdrop onClose={handleDismissDuplicateModal}>
            <div className="bg-[#111E30] rounded-2xl border border-white/[0.08] max-w-lg w-full overflow-hidden"
              style={{ boxShadow: "0 25px 60px rgba(0,0,0,0.6), 0 1px 0 rgba(255,255,255,0.05) inset" }}>
              <div className="px-6 py-4 border-b border-purple-500/20 bg-purple-500/[0.06]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-purple-500/15">
                      <SparklesIcon className="w-4 h-4 text-purple-400" />
                    </div>
                    <h3 className="text-sm font-semibold text-purple-300"
                      style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                      Domain already exists
                    </h3>
                  </div>
                  <button onClick={handleDismissDuplicateModal}
                    className="text-slate-500 hover:text-slate-200 transition-all duration-150 p-2 rounded-xl hover:bg-white/[0.08]">
                    <CloseIcon className="w-5 h-5" />
                  </button>
                </div>
              </div>
              <div className="px-6 py-5">
                <p className="text-sm text-slate-400 leading-relaxed mb-4">
                  Found <span className="text-slate-200 font-semibold">{duplicateModal.matches.length}</span>{" "}
                  existing version{duplicateModal.matches.length === 1 ? "" : "s"} of this PDDL in your library.
                  Pick one to reuse, or generate a new version.
                </p>
                <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                  {duplicateModal.matches.map(m => (
                    <button
                      key={m.id}
                      onClick={() => handleReuseExistingVersion(m.id)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all border border-transparent hover:border-purple-500/30 hover:bg-purple-500/[0.08]"
                    >
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 bg-white/[0.06]">
                        <FileCodeIcon className="w-5 h-5 text-slate-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium leading-none text-slate-200"
                          style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                          {m.displayName}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {m.provider} &middot; {new Date(m.createdAt).toLocaleDateString()}
                        </div>
                        {(m.transformerHash || m.rendererHash) && (
                          <div className="flex gap-1 mt-1">
                            {m.transformerHash && (
                              <span
                                title={`Transformer hash: ${m.transformerHash}`}
                                className="px-1.5 py-0.5 rounded bg-white/[0.04] text-slate-400 font-mono text-[10px]"
                              >
                                T:{m.transformerHash.slice(0, 8)}
                              </span>
                            )}
                            {m.rendererHash && (
                              <span
                                title={`Renderer hash: ${m.rendererHash}`}
                                className="px-1.5 py-0.5 rounded bg-white/[0.04] text-slate-400 font-mono text-[10px]"
                              >
                                R:{m.rendererHash.slice(0, 8)}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
              <div className="px-6 py-4 border-t border-white/[0.05] bg-white/[0.02] flex justify-between gap-3">
                <button
                  onClick={handleDismissDuplicateModal}
                  className="px-5 py-2.5 text-sm text-slate-400 hover:text-slate-200 font-medium transition-all duration-150 rounded-xl hover:bg-white/[0.08]"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateNewVersion}
                  className="px-5 py-2.5 text-sm font-semibold transition-all duration-150 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 text-purple-200 border border-purple-500/30"
                >
                  Create new version
                </button>
              </div>
            </div>
          </ModalBackdrop>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showExampleProblem && (
          <ModalBackdrop onClose={() => setShowExampleProblem(false)}>
            <div className="bg-[#111E30] rounded-2xl border border-white/[0.08] max-w-3xl w-full max-h-[80vh] overflow-hidden flex flex-col"
              style={{ boxShadow: "0 25px 60px rgba(0,0,0,0.6), 0 1px 0 rgba(255,255,255,0.05) inset" }}>
              <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-200" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                    Example Problem
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">{currentDomain?.name}</p>
                </div>
                <button onClick={() => setShowExampleProblem(false)}
                  aria-label="Close modal"
                  className="text-slate-500 hover:text-slate-200 transition-all duration-150 p-2 rounded-xl hover:bg-white/[0.08]">
                  <CloseIcon className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 overflow-y-auto flex-1">
                <pre className="text-xs font-mono bg-black/[0.3] text-green-300/80 p-4 rounded-xl border border-white/[0.05] whitespace-pre-wrap leading-relaxed">
                  {getDefaultProblem(selectedDomain)}
                </pre>
              </div>
              <div className="px-6 py-4 border-t border-white/[0.05] bg-white/[0.02] flex justify-end">
                <button onClick={() => setShowExampleProblem(false)}
                  className="px-5 py-2.5 bg-white/[0.06] hover:bg-white/[0.1] text-sm text-slate-300 font-medium rounded-xl transition-all duration-150 border border-white/[0.06] hover:border-white/[0.1]">
                  Close
                </button>
              </div>
            </div>
          </ModalBackdrop>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showDomainDefinition && (
          <ModalBackdrop onClose={() => setShowDomainDefinition(false)}>
            <div className="bg-[#111E30] rounded-2xl border border-white/[0.08] max-w-3xl w-full max-h-[80vh] overflow-hidden flex flex-col"
              style={{ boxShadow: "0 25px 60px rgba(0,0,0,0.6), 0 1px 0 rgba(255,255,255,0.05) inset" }}>
              <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-200" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                    Domain Definition
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">{currentDomain?.name}</p>
                </div>
                <button onClick={() => setShowDomainDefinition(false)}
                  aria-label="Close modal"
                  className="text-slate-500 hover:text-slate-200 transition-all duration-150 p-2 rounded-xl hover:bg-white/[0.08]">
                  <CloseIcon className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 overflow-y-auto flex-1">
                {domainDefinitionQuery.isLoading && (
                  <div className="flex items-center justify-center py-12">
                    <div className="w-7 h-7 border-2 border-green-500/30 border-t-green-500 rounded-full animate-spin" />
                  </div>
                )}
                {domainDefinitionQuery.error && (
                  <div className="p-4 bg-red-500/[0.08] border border-red-500/20 rounded-xl text-sm text-red-400">
                    Failed to load domain definition
                  </div>
                )}
                {domainDefinitionQuery.data && (
                  <pre className="text-xs font-mono bg-black/[0.3] text-green-300/80 p-4 rounded-xl border border-white/[0.05] whitespace-pre-wrap leading-relaxed">
                    {domainDefinitionQuery.data.content}
                  </pre>
                )}
              </div>
              <div className="px-6 py-4 border-t border-white/[0.05] bg-white/[0.02] flex justify-end">
                <button onClick={() => setShowDomainDefinition(false)}
                  className="px-5 py-2.5 bg-white/[0.06] hover:bg-white/[0.1] text-sm text-slate-300 font-medium rounded-xl transition-all duration-150 border border-white/[0.06] hover:border-white/[0.1]">
                  Close
                </button>
              </div>
            </div>
          </ModalBackdrop>
        )}
      </AnimatePresence>

    </div>
  );
}
