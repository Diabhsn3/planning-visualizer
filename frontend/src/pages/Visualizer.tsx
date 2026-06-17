import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { trpc } from "@/lib/trpc";
import { getSessionId } from "@/lib/session";
import { StateCanvas } from "@/components/StateCanvas";
import { usePlayback } from "@/hooks/usePlayback";
import { PlaybackControls } from "@/components/PlaybackControls";
import { CollapseSection } from "@/components/CollapseSection";
import { StrategyPicker, type SearchStrategy } from "@/components/StrategyPicker";
import { type RenderMode, type LlmProvider } from "@/components/RenderModePicker";
import { ErrorModal, type ErrorModalState } from "@/components/ErrorModal";
import { PddlViewerModal } from "@/components/PddlViewerModal";
import { DuplicateDomainModal, type DuplicateMatch } from "@/components/DuplicateDomainModal";
import { DeleteDomainModal } from "@/components/DeleteDomainModal";
import { DomainGrid, type Domain, type DomainColors } from "@/components/DomainGrid";
import { SavedDomainsList } from "@/components/SavedDomainsList";
import { CustomDomainUpload } from "@/components/CustomDomainUpload";
import { ProblemInput } from "@/components/ProblemInput";
import { SavedDomainDetail } from "@/components/SavedDomainDetail";
import { PlanStepsList } from "@/components/PlanStepsList";
import { Textarea } from "@/components/ui/textarea";
import { PillToggle } from "@/components/PillToggle";
import { easeOut, spring, fadeInUp } from "@/lib/animation";
import { FeedbackBox } from "@/components/FeedbackBox";
import { SusSurvey } from "@/components/SusSurvey";
import { useStudyMode } from "@/contexts/StudyModeContext";
import { VerifyStatus } from "@/components/VerifyStatus";
import { PDDLHeaderBackground } from "@/components/PDDLHeaderBackground";
import {
  PlayIcon,
  CheckCircleIcon,
  ChevronDownIcon, WandIcon,
  MenuIcon, TerminalIcon,
  CloseIcon, UploadIcon, FileCodeIcon,
  BlocksWorldIcon, GripperIcon, DepotIcon, HanoiIcon, RoverIcon, SatelliteIcon,
} from "@/components/Icons";

// (SearchStrategy type now lives in @/components/StrategyPicker — imported above.)

// (Animation tokens moved to @/lib/animation — imported above.)

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
// (AnimatedNumber moved into PlaybackControls — its only consumer.)

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
// ─── Collapsible wrapper ─────────────────────────────────────────────────────
// (CollapseSection moved to @/components/CollapseSection — imported above.)

// ─── Pill toggle ─────────────────────────────────────────────────────────────
// (PillToggle moved to @/components/PillToggle; ProblemInput owns the Step 2 UI.)

// ─── Modal backdrop ───────────────────────────────────────────────────────────
// (ModalBackdrop moved to @/components/ModalBackdrop — imported above.)

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
  const studyMode = useStudyMode();
  const [showSus, setShowSus] = useState(false);
  // Pilot telemetry: log client-side events (render crashes, etc.).
  const logEventMutation = trpc.events.logEvent.useMutation();
  const [selectedDomain, setSelectedDomain]     = useState("blocks-world");
  const [selectedStrategy, setSelectedStrategy] = useState("astar-lmcut");
  const [problemType, setProblemType]           = useState<"example" | "custom">("example");
  const [inputMode, setInputMode]               = useState<"file" | "text">("file");
  const [problemFile, setProblemFile]           = useState<File | null>(null);
  const [problemText, setProblemText]           = useState("");
  const [renderedStates, setRenderedStates]     = useState<any[]>([]);
  // Symbolic PDDL states (string[] per state) returned alongside the
  // enriched render states. Used as ground truth `s` for Phase 1 feedback
  // and Phase 2 verifier grading.
  const [rawStates, setRawStates]               = useState<string[][] | null>(null);
  const [predicateSchema, setPredicateSchema]   = useState<{ name: string; arg_types: string[] }[] | null>(null);
  const [pddlObjects, setPddlObjects]           = useState<{ name: string; type: string }[] | null>(null);
  // PDDL problem name from the planner. Null when running pre-baked
  // examples or before any plan has been generated.
  const [problemName, setProblemName]           = useState<string | null>(null);
  // sha256[:12] of the problem PDDL content. Stable across re-runs of
  // the same problem; lets us short-circuit auto-verify if the report
  // already has results for this (renderer, problem) tuple.
  const [problemHash, setProblemHash]           = useState<string | null>(null);
  const [plan, setPlan]                         = useState<string[]>([]);
  const [currentStateIndex, setCurrentStateIndex] = useState(0);
  // Bumped on every new plan load. Used as the StateCanvas `key` so a new plan
  // remounts the canvas (resetting its zoom/pan) while step navigation within
  // the same plan keeps the same instance (preserving the view).
  const [vizRunId, setVizRunId]                 = useState(0);
  const canvasContainerRef                        = useRef<HTMLDivElement>(null);
  // One runId per page session — groups verifier rows from the same
  // browser run so they can be filtered in the report later.
  const verifyRunIdRef                            = useRef<string>(
    `vfy-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
  );
  const {
    isPlaying,
    playbackSpeed,
    setPlaybackSpeed,
    play: handlePlay,
    pause: handlePause,
    next: handleNext,
    previous: handlePrevious,
    stop: stopPlayback,
  } = usePlayback({ totalStates: renderedStates.length, setCurrentStateIndex });
  // Planner metadata (used_planner / strategy) is captured on solve but no longer
  // surfaced on the setup page after the redesign; keep the setter for the data flow.
  const setPlannerInfo = useState<{ used_planner: boolean; info: string; strategy?: { id: string; name: string; isOptimal: boolean; speed: string } | null } | null>(null)[1];
  const [elapsedTime, setElapsedTime]           = useState(0);
  const [isProcessing, setIsProcessing]         = useState(false);
  // Per-solve id (one per Generate click) so Stop can cancel the exact
  // in-flight solve on the backend. cancelledRef suppresses the error modal
  // when a rejection is the result of our own cancel.
  const solveIdRef = useRef<string | null>(null);
  const cancelledRef = useRef(false);
  const [wizardStep, setWizardStep]             = useState(0);
  const [showExampleProblem, setShowExampleProblem]     = useState(false);
  const [showDomainDefinition, setShowDomainDefinition] = useState(false);
  const setShowSuccessFlash = useState(false)[1];
  // Fullscreen visualization mode — a full-window overlay (covers nav + footer)
  // entered automatically on a successful Generate. The diagram is centered on a
  // dark field with floating playback, plan steps, and study panels over it.
  const [isFullscreen, setIsFullscreen]                 = useState(false);
  const [showNewProblemPanel, setShowNewProblemPanel]   = useState(false);
  const [showFsPlanSteps, setShowFsPlanSteps]           = useState(true);
  // Live viewport size for the fullscreen canvas (so its background fills the
  // whole screen with the domain objects centered).
  const [fsSize, setFsSize] = useState(() => ({
    w: typeof window !== "undefined" ? window.innerWidth : 1280,
    h: typeof window !== "undefined" ? window.innerHeight : 800,
  }));

  const planStepsRef        = useRef<HTMLDivElement>(null);
  const usingSavedDomainRef = useRef(false);  // tracks if current upload is from a saved domain

  // LLM Renderer state
  const [renderMode, setRenderMode]           = useState<RenderMode>("basic");
  const [llmProvider, setLlmProvider]         = useState<LlmProvider>("claude");
  const [llmRendererCode, setLlmRendererCode] = useState<string | null>(null);
  const [isLlmGenerating, setIsLlmGenerating] = useState(false);
  const [llmError, setLlmError]               = useState<string | null>(null);
  // Setter kept (written by the custom-domain LLM flow) but the value is no
  // longer surfaced in basic mode since the Render Mode picker was removed.
  const [, setLlmModelInfo]                   = useState<string | null>(null);
  const [errorModal, setErrorModal] = useState<ErrorModalState>({ show: false, title: "", message: "" });

  // "Domain already exists" modal — surfaces when an upload's PDDL hash
  // matches one or more entries in the saved-domains library. Lets the
  // user pick a specific existing version to reuse, or proceed with a
  // fresh LLM generation that creates a new versioned entry.
  const [duplicateModal, setDuplicateModal] = useState<{
    show: boolean;
    matches: DuplicateMatch[];
    /** PDDL the user just submitted — used if they pick "Create new". */
    pendingDomainPddl: string;
  }>({ show: false, matches: [], pendingDomainPddl: "" });

  // Delete-saved-domain confirmation modal.
  const [deleteConfirmModal, setDeleteConfirmModal] = useState<{
    show: boolean;
    id: number | null;
    displayName: string;
  }>({ show: false, id: null, displayName: "" });
  // Custom Domain state
  const [isCustomDomain, setIsCustomDomain]         = useState(false);
  const [customDomainName, setCustomDomainName]     = useState("");
  const [customMode, setCustomMode]                 = useState<"saved" | "new">("saved");
  const [selectedSavedDomainId, setSelectedSavedDomainId] = useState<number | null>(null);
  const [savedDomainsListOpen, setSavedDomainsListOpen] = useState(false);
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
  // Auto-verify state. Results live in a per-state map keyed by the same
  // (renderer × transformer × stateIndex) triple used for dedup, so when
  // the user scrubs back to a state they already saw they see THAT
  // state's saved result — not a fresh "Verifying…" and not whichever
  // other state's result happens to be the most recent.
  type VerifyEntry =
    | { status: "pending" }
    | {
        status: "done";
        result: { precision: number | null; recall: number | null; parseFailure: boolean; cacheHit: boolean };
      }
    | { status: "error"; error: string };
  const verifiedKeysRef = useRef<Set<string>>(new Set());
  const [verifyByKey, setVerifyByKey] = useState<Map<string, VerifyEntry>>(new Map());

  // Hook-level callbacks (NOT per-call) so every concurrent mutation's
  // result lands in the map. Per-call options on `.mutate(input, opts)`
  // only fire for the most-recent call in flight, which dropped results
  // when the user clicked Next mid-verification.
  const verifyAutoMutation = trpc.verifier.verifyState.useMutation({
    onSuccess: (data, variables) => {
      const key = `${variables.rendererHash ?? "norend"}-${variables.transformerHash ?? "notrans"}-${variables.stateIndex}`;
      setVerifyByKey((m) =>
        new Map(m).set(key, {
          status: "done",
          result: {
            precision: data.precision,
            recall: data.recall,
            parseFailure: data.parseFailure,
            cacheHit: data.cacheHit,
          },
        })
      );
    },
    onError: (error, variables) => {
      const key = `${variables.rendererHash ?? "norend"}-${variables.transformerHash ?? "notrans"}-${variables.stateIndex}`;
      setVerifyByKey((m) =>
        new Map(m).set(key, {
          status: "error",
          error: error.message || "verification failed",
        })
      );
    },
  });

  const strategiesQuery      = trpc.visualizer.listStrategies.useQuery();
  const savedDomainsQuery    = trpc.visualizer.listSavedDomains.useQuery(undefined, { enabled: isCustomDomain, staleTime: 30000, refetchOnWindowFocus: false, refetchOnMount: false, retry: 1 });
  const loadSavedDomainQuery = trpc.visualizer.loadSavedDomain.useQuery(
    { id: selectedSavedDomainId! }, { enabled: !!selectedSavedDomainId, staleTime: 60000, refetchOnWindowFocus: false, refetchOnMount: false, retry: 1 }
  );

  // Re-runs of the same trajectory (same renderer + same problem) reuse
  // the prior session's results. We fetch the existing per-state map
  // once on plan-load and hydrate `verifyByKey` from it before the
  // auto-verify effect fires. Disabled until the planner has emitted
  // problemHash — pre-2.4 plans return null and produce no hits.
  const trajectoryRendererHash = loadSavedDomainQuery.data?.rendererHash ?? null;
  const trajectoryTransformerHash = loadSavedDomainQuery.data?.transformerHash ?? null;
  const trajectoryProviderRaw = loadSavedDomainQuery.data?.provider ?? null;
  const trajectoryNormalizedProvider: "claude" | "gemini" | null =
    trajectoryProviderRaw
      ? trajectoryProviderRaw.toLowerCase().includes("gemini")
        ? "gemini"
        : trajectoryProviderRaw.toLowerCase().includes("claude")
          ? "claude"
          : null
      : null;
  const trajectoryRenderMethod: "basic" | "claude" | "gemini" =
    !isCustomDomain && renderMode === "basic"
      ? "basic"
      : trajectoryNormalizedProvider ?? llmProvider;
  const existingResultsQuery = trpc.verifier.existingResultsForTrajectory.useQuery(
    {
      renderMethod: trajectoryRenderMethod,
      domainName: isCustomDomain ? (customDomainName || "custom") : selectedDomain,
      problemHash,
      savedDomainId: selectedSavedDomainId,
      transformerHash: trajectoryTransformerHash,
      rendererHash: trajectoryRendererHash,
    },
    {
      enabled: !!problemHash && renderedStates.length > 0,
      staleTime: 5_000,
      refetchOnWindowFocus: false,
    }
  );

  // Hydrate verifyByKey + dedup set from the prefetched map. The keys
  // here use the SAME format as the auto-verify useEffect so the effect
  // sees these as "already verified" and skips.
  useEffect(() => {
    const map = existingResultsQuery.data;
    if (!map) return;
    const rh = trajectoryRendererHash;
    const th = trajectoryTransformerHash;
    setVerifyByKey((prev) => {
      const next = new Map(prev);
      for (const [stateIndexStr, rawDigest] of Object.entries(map)) {
        const digest = rawDigest as {
          precision: number | null;
          recall: number | null;
          parseFailure: boolean;
          tp: number; fp: number; fn: number;
        };
        const idx = Number(stateIndexStr);
        const key = `${rh ?? "norend"}-${th ?? "notrans"}-${idx}`;
        if (verifiedKeysRef.current.has(key)) continue;
        verifiedKeysRef.current.add(key);
        next.set(key, {
          status: "done",
          result: {
            precision: digest.precision,
            recall: digest.recall,
            parseFailure: digest.parseFailure,
            cacheHit: true, // prior-run reuse — surface the "cached" badge
          },
        });
      }
      return next;
    });
  }, [existingResultsQuery.data, trajectoryRendererHash, trajectoryTransformerHash]);

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

  const deleteSavedDomainMutation = trpc.visualizer.deleteSavedDomain.useMutation({
    onSuccess: (data) => {
      console.log("[SavedDomains] Deleted id=" + data.id);
      savedDomainsQuery.refetch();
      // If the user just deleted the currently-selected domain, clear
      // the selection so the detail panel doesn't try to show a missing entry.
      if (selectedSavedDomainId === data.id) {
        setSelectedSavedDomainId(null);
        setLlmTransformerCode(null);
        setLlmRendererCode(null);
      }
    },
    onError: (err) => {
      console.error("[SavedDomains] Failed to delete:", err.message);
      setErrorModal({
        show: true,
        title: "Delete failed",
        message: err.message || "Could not delete the saved domain.",
      });
    },
  });

  const handleConfirmDeleteSavedDomain = () => {
    if (deleteConfirmModal.id != null) {
      deleteSavedDomainMutation.mutate({ id: deleteConfirmModal.id });
    }
    setDeleteConfirmModal({ show: false, id: null, displayName: "" });
  };
  const domainDefinitionQuery = trpc.visualizer.getDomainDefinition.useQuery(
    { domainName: selectedDomain as any }, { enabled: showDomainDefinition }
  );

  const domains: Domain[] = [
    { id: "blocks-world", name: "Blocks World",  description: "Classic block stacking",              Icon: BlocksWorldIcon },
    { id: "gripper",      name: "Gripper",        description: "Robot gripper moving balls",          Icon: GripperIcon     },
    { id: "depot",        name: "Depot",          description: "Truck & crane depot logistics",       Icon: DepotIcon       },
    { id: "hanoi",        name: "Hanoi",          description: "Tower of Hanoi disk puzzle",          Icon: HanoiIcon       },
    { id: "rovers",       name: "Rovers",         description: "Planetary exploration mission",       Icon: RoverIcon       },
    { id: "satellite",    name: "Satellite",      description: "Orbital imaging & transmission",      Icon: SatelliteIcon   },
  ];

  const domainColors: DomainColors = {
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

  // (Autoplay is owned by the usePlayback hook above.)

  useEffect(() => {
    // Only run when switching TO a real basic domain. An empty selectedDomain
    // is the marker for "Custom mode" — handled by the Custom button itself.
    if (!selectedDomain) return;

    // Form-input resets are fine — these are UI inputs that need to match
    // the new domain context. We DO NOT clear renderedStates / plan /
    // currentStateIndex / plannerInfo here: per user request, the canvas
    // should keep showing the previous run until they explicitly click
    // Generate. Only the Generate handlers (uploadMutation /
    // uploadCustomMutation onSuccess) replace those.
    setProblemType("example"); setProblemFile(null); setProblemText(""); setInputMode("file");
    stopPlayback();
    // Reset custom domain state when switching to a built-in domain
    if (isCustomDomain) {
      setIsCustomDomain(false); setCustomDomainName(""); setCustomDomainFile(null);
      setCustomDomainText(""); setCustomProblemFile(null); setCustomProblemText("");
      setLlmTransformerCode(null); setTransformerError(null); setTransformerModelInfo(null);
    }
  }, [selectedDomain]);

  useEffect(() => {
    if (planStepsRef.current && plan.length > 0) {
      const container = planStepsRef.current;
      if (currentStateIndex === 0) {
        container.scrollTop = 0;
      } else {
        // +1 because children[0] is the "State 0" initial-state row
        const el = container.children[currentStateIndex] as HTMLElement;
        if (el) {
          const elRect = el.getBoundingClientRect(), cRect = container.getBoundingClientRect();
          if (elRect.top < cRect.top || elRect.bottom > cRect.bottom)
            container.scrollTop = el.offsetTop - container.offsetTop;
        }
      }
    }
  }, [currentStateIndex, plan.length]);

  // Auto-verify every NEW state view: fires `verifyState` the first time
  // the user sees each (renderer × transformer × stateIndex) triple this
  // session. Scrubbing back to an already-seen state does NOT re-fire.
  // Skipped for pre-baked examples (no rawStates/schema/objects).
  useEffect(() => {
    if (!rawStates || !predicateSchema || !pddlObjects) return;
    if (renderedStates.length === 0) return;
    // Hold off while anything is still running. This prevents auto-verify
    // (a Claude vision call) from competing with transformer/renderer
    // generation for the org's rate limit — concurrent load was throttling
    // the renderer past its timeout. It also guarantees we only ever grade
    // the FINAL rendered image, never a basic/intermediate one.
    if (isProcessing || isTransformerGenerating || isLlmGenerating || llmError || transformerError) return;
    // For any LLM-rendered visualization (custom domain, or built-in in LLM
    // render mode) wait until the renderer code is actually in place.
    const needsLlmRender = isCustomDomain || renderMode === "llm";
    if (needsLlmRender && !llmRendererCode) return;
    const rendererHash = loadSavedDomainQuery.data?.rendererHash ?? null;
    const transformerHash = loadSavedDomainQuery.data?.transformerHash ?? null;
    const key = `${rendererHash ?? "norend"}-${transformerHash ?? "notrans"}-${currentStateIndex}`;
    if (verifiedKeysRef.current.has(key)) return;
    const canvas = canvasContainerRef.current?.querySelector("canvas");
    if (!canvas) return;
    const dataUrl = canvas.toDataURL("image/png");
    if (!dataUrl) return;
    verifiedKeysRef.current.add(key);
    setVerifyByKey((m) => new Map(m).set(key, { status: "pending" }));
    // Classify the visualization method for top-level report grouping.
    // "basic" iff this is a built-in domain in basic-render-mode (the
    // renderer is the hardcoded canvas, no LLM involvement). Otherwise
    // the row is attributed to whichever provider produced the code —
    // and when a saved domain is loaded, that's the SAVED provider, not
    // whatever the user's dropdown happens to show. Otherwise loading a
    // Gemini-generated domain while "Claude" is selected would tag the
    // rows as Claude.
    const savedProviderRaw = loadSavedDomainQuery.data?.provider ?? null;
    const normalizeProvider = (s: string | null): "claude" | "gemini" | null => {
      if (!s) return null;
      const lower = s.toLowerCase();
      if (lower.includes("gemini")) return "gemini";
      if (lower.includes("claude")) return "claude";
      return null;
    };
    const effectiveProvider: "claude" | "gemini" =
      normalizeProvider(savedProviderRaw) ?? llmProvider;
    const renderMethod: "basic" | "claude" | "gemini" =
      !isCustomDomain && renderMode === "basic" ? "basic" : effectiveProvider;
    const savedDomainDisplayName =
      loadSavedDomainQuery.data?.displayName ?? null;
    verifyAutoMutation.mutate({
      pngBase64: dataUrl,
      expected: rawStates[currentStateIndex] ?? [],
      predicateSchema,
      objects: pddlObjects,
      runId: verifyRunIdRef.current,
      runKind: "verify",
      domainName: isCustomDomain ? (customDomainName || "custom") : selectedDomain,
      problem: problemName,
      problemHash,
      renderMethod,
      savedDomainDisplayName,
      isCustomDomain,
      savedDomainId: selectedSavedDomainId,
      transformerHash,
      rendererHash,
      llmProvider: effectiveProvider,
      stateIndex: currentStateIndex,
      totalStates: renderedStates.length,
      forceRefresh: false,
    });
    // verifyAutoMutation is stable across renders — omit from deps to
    // avoid double-firing when react-query updates its internal state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    currentStateIndex,
    rawStates,
    predicateSchema,
    pddlObjects,
    problemName,
    problemHash,
    renderedStates.length,
    isProcessing,
    isTransformerGenerating,
    isLlmGenerating,
    llmRendererCode,
    llmError,
    transformerError,
    isCustomDomain,
    customDomainName,
    selectedDomain,
    selectedSavedDomainId,
    llmProvider,
    renderMode,
    loadSavedDomainQuery.data?.rendererHash,
    loadSavedDomainQuery.data?.transformerHash,
    loadSavedDomainQuery.data?.displayName,
    loadSavedDomainQuery.data?.provider,
  ]);

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
      // Stop/Change-Domain was hit mid-solve — ignore this late result so it
      // can't pull the user back into the visualize page.
      if (cancelledRef.current) { cancelledRef.current = false; return; }
      setIsProcessing(false);
      setRenderedStates(data.states);
      setRawStates(data.raw_states ?? null);
      setPredicateSchema(data.predicate_schema ?? null);
      setPddlObjects(data.objects ?? null);
      setProblemName(data.problem ?? null);
      setProblemHash(data.problem_hash ?? null);
      setPlan(data.plan);
      setCurrentStateIndex(0);
      setVizRunId((n) => n + 1); // new plan → remount canvas (reset zoom/pan)
      setPlannerInfo({ used_planner: data.used_planner || false, info: data.planner_info || "Unknown", strategy: data.search_strategy });
      // New plan → fresh dedup set and a fresh runId so this run's rows
      // group together in the verifier report.
      verifiedKeysRef.current = new Set();
      verifyRunIdRef.current = `vfy-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
      setVerifyByKey(new Map());
      // Success flash
      setShowSuccessFlash(true);
      setTimeout(() => setShowSuccessFlash(false), 900);
      // Hand the whole window over to the visualization.
      setIsFullscreen(true);
    },
    onError: (error: any) => {
      setIsProcessing(false);
      // Solve was cancelled by the user (Stop) — the backend rejects with
      // "CANCELLED". Don't surface the error modal for an intentional cancel.
      if (cancelledRef.current || error?.message === "CANCELLED") {
        cancelledRef.current = false;
        return;
      }
      // A failed first generation has no states to show — drop back to the
      // options page so the error modal isn't stranded over a blank overlay.
      if (renderedStates.length === 0) setIsFullscreen(false);
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
      // Stop/Change-Domain was hit mid-pipeline — ignore this late renderer
      // result so we don't apply the code OR auto-save the domain after the
      // user bailed back to the options page.
      if (cancelledRef.current) { cancelledRef.current = false; return; }
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
    onError: (error: any) => {
      setIsLlmGenerating(false);
      if (cancelledRef.current) { cancelledRef.current = false; return; }
      setLlmError(error.message || "Failed to generate LLM renderer");
    },
  });


  useEffect(() => { setLlmRendererCode(null); setLlmError(null); setLlmModelInfo(null); }, [selectedDomain]);
  // Custom domain upload mutation
  const uploadCustomMutation = trpc.visualizer.uploadAndGenerateCustom.useMutation({
    onSuccess: (data) => {
      // Stop/Change-Domain was hit mid-solve — ignore this late result.
      if (cancelledRef.current) { cancelledRef.current = false; return; }
      setIsProcessing(false);
      setRenderedStates(data.states);
      setRawStates(data.raw_states ?? null);
      setPredicateSchema(data.predicate_schema ?? null);
      setPddlObjects(data.objects ?? null);
      setProblemName(data.problem ?? null);
      setProblemHash(data.problem_hash ?? null);
      setPlan(data.plan);
      setCurrentStateIndex(0);
      setVizRunId((n) => n + 1); // new plan → remount canvas (reset zoom/pan)
      setPlannerInfo({ used_planner: data.used_planner || false, info: data.planner_info || "Unknown", strategy: data.search_strategy });
      verifiedKeysRef.current = new Set();
      verifyRunIdRef.current = `vfy-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
      setVerifyByKey(new Map());
      setShowSuccessFlash(true);
      setTimeout(() => setShowSuccessFlash(false), 900);
      // Hand the whole window over to the visualization. For the new-domain
      // flow the canvas shows the LLM loading state first, then the diagram.
      setIsFullscreen(true);
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
      if (cancelledRef.current || error?.message === "CANCELLED") {
        cancelledRef.current = false;
        return;
      }
      if (renderedStates.length === 0) setIsFullscreen(false);
      // First-upload simplicity gate: a brand-new domain's starter problem was
      // too large/complex. Show a friendly "start smaller" message rather than
      // a generic error.
      const msg: string = error?.message || "";
      if (msg.startsWith("TOO_COMPLEX::")) {
        setErrorModal({
          show: true,
          title: "Start with a smaller problem",
          message: msg.slice("TOO_COMPLEX::".length),
        });
        return;
      }
      setErrorModal({ show: true, title: "Error", message: error.message || "Failed to solve custom problem" });
    },
  });
  // LLM Transformer mutation
  const llmTransformerMutation = trpc.visualizer.llmGenerateTransformer.useMutation({
    onSuccess: (data) => {
      setIsTransformerGenerating(false);
      // Stop/Change-Domain was hit mid-pipeline — ignore so we never kick off
      // the renderer stage (Stage 2) after the user bailed.
      if (cancelledRef.current) { cancelledRef.current = false; return; }
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
              sessionId: getSessionId(),
            });
          });
        }
      }
    },
    onError: (error: any) => {
      setIsTransformerGenerating(false);
      if (cancelledRef.current) { cancelledRef.current = false; return; }
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
        sessionId: getSessionId(),
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
      sessionId: getSessionId(),
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
      // Built-in domains always use the basic renderer (no render-mode picker),
      // so clear any "llm" mode left over from a prior custom-domain session.
      setRenderMode("basic");
    }
  }, [isCustomDomain]);

  const cancelSolveMutation = trpc.visualizer.cancelSolve.useMutation();

  // True whenever a solve is in flight — used to lock config controls and
  // the sidebar toggle so the user can't change inputs or hide Stop mid-solve.
  const isBusy = isProcessing || uploadMutation.isPending || uploadCustomMutation.isPending;

  // Stop an in-flight solve: tell the backend to kill the planner tree, drop
  // the processing state immediately, and reset the mutations. The upload
  // mutation then rejects with "CANCELLED" — onError suppresses the modal.
  const handleStop = () => {
    cancelledRef.current = true;
    if (solveIdRef.current) {
      cancelSolveMutation.mutate({ solveId: solveIdRef.current });
    }
    setIsProcessing(false);
    uploadMutation.reset();
    uploadCustomMutation.reset();
  };

  const handleGenerate = () => {
    setIsProcessing(true);
    // Switch to the visualize page immediately so the solving animation, the
    // duplicate-domain modal, and the transformer/renderer stages all play out
    // on the fullscreen page (reverted below if input validation fails).
    setIsFullscreen(true);
    cancelledRef.current = false;
    solveIdRef.current = crypto.randomUUID();
    // Always scroll the page to the top when the user hits Generate.
    //
    // Why two scrolls + instant behavior: the saved-domain branch (and
    // others) fires several setState calls right after this point
    // (setLlmTransformerCode, setLlmRendererCode, setRenderMode, plus
    // the mutation kickoff). React re-renders during smooth-scroll
    // animations cancel them in Chrome, so a single
    // `behavior: "smooth"` call sometimes silently does nothing.
    //
    // - First call: instant, runs synchronously before the upcoming
    //   state updates.
    // - rAF call: re-asserts after the current render cycle commits, in
    //   case the page height changed enough to leave us mid-scroll.
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    });
    // Custom domain flow
    if (isCustomDomain) {
      const hasProblem = customProblemInputMode === "file" ? !!customProblemFile : !!customProblemText.trim();
      if (!hasProblem) { setIsProcessing(false); setIsFullscreen(false); alert("Please provide the problem PDDL file"); return; }

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
            sessionId: getSessionId(),
            solveId: solveIdRef.current ?? undefined,
          });
        };
        run();
        return;
      }

      // Upload New flow: requires both domain.pddl and problem.pddl
      const hasDomain = customDomainInputMode === "file" ? !!customDomainFile : !!customDomainText.trim();
      if (!customDomainName.trim()) { setIsProcessing(false); setIsFullscreen(false); alert("Please enter a domain name"); return; }
      if (!hasDomain) { setIsProcessing(false); setIsFullscreen(false); alert("Please provide the domain PDDL file"); return; }
      const run = async () => {
        const domainContent = customDomainInputMode === "file" && customDomainFile
          ? await readFile(customDomainFile) : customDomainText;
        const problemContent = customProblemInputMode === "file" && customProblemFile
          ? await readFile(customProblemFile) : customProblemText;
        uploadCustomMutation.mutate({
          domainContent, problemContent,
          domainName: customDomainName.trim(),
          searchStrategy: selectedStrategy as any,
          sessionId: getSessionId(),
          solveId: solveIdRef.current ?? undefined,
        });
      };
      run();
      return;
    }
    // Standard domain flow
    if (problemType === "custom") {
      if (inputMode === "file" && !problemFile) { setIsProcessing(false); setIsFullscreen(false); alert("Please select a problem file"); return; }
      if (inputMode === "text" && !problemText.trim()) { setIsProcessing(false); setIsFullscreen(false); alert("Please paste PDDL content"); return; }
      const reader = new FileReader();
      const process = (content: string) =>
        uploadMutation.mutate({ domainContent: "", problemContent: content, domainName: selectedDomain as any, searchStrategy: selectedStrategy as any, sessionId: getSessionId(), solveId: solveIdRef.current ?? undefined });
      if (inputMode === "file" && problemFile) { reader.onload = (e) => process(e.target?.result as string); reader.readAsText(problemFile); }
      else if (inputMode === "text") process(problemText);
    } else {
      uploadMutation.mutate({ domainContent: "", problemContent: getDefaultProblem(selectedDomain), domainName: selectedDomain as any, searchStrategy: selectedStrategy as any, sessionId: getSessionId(), solveId: solveIdRef.current ?? undefined });
    }
  };

  // ── Two-page model: options page (sidebar) + visualize page (fullscreen) ─────
  // "Change Domain" leaves the visualize page and returns to a clean options
  // page (no states shown — just like first opening the app), so the user can
  // pick a different domain/problem and Generate again.
  const changeDomain = useCallback(() => {
    // Abort any in-flight solve so a late success can't pull us back in.
    cancelledRef.current = true;
    if (solveIdRef.current) cancelSolveMutation.mutate({ solveId: solveIdRef.current });
    uploadMutation.reset();
    uploadCustomMutation.reset();
    // Abort the two-phase LLM pipeline (transformer → renderer). The mutation
    // guards (cancelledRef) drop any in-flight stage result so it can't apply
    // code or auto-save the domain; these resets clear the client state so the
    // options page comes back exactly as it was — nothing persisted/changed.
    llmTransformerMutation.reset();
    llmGenerateMutation.reset();
    usingSavedDomainRef.current = false;
    setLlmTransformerCode(null);
    setLlmRendererCode(null);
    setTransformerError(null);
    setLlmError(null);
    setTransformerModelInfo(null);
    setLlmModelInfo(null);
    setIsProcessing(false);
    setIsTransformerGenerating(false);
    setIsLlmGenerating(false);
    setIsFullscreen(false);
    setShowNewProblemPanel(false);
    stopPlayback();
    setRenderedStates([]);
    setPlan([]);
    setCurrentStateIndex(0);
    setPlannerInfo(null);
    setRawStates(null);
    setPredicateSchema(null);
    setPddlObjects(null);
    setProblemName(null);
    setProblemHash(null);
    setWizardStep(0); // back to the first wizard step (pick a domain)
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [stopPlayback, cancelSolveMutation, uploadMutation, uploadCustomMutation, llmTransformerMutation, llmGenerateMutation]);

  const handleSelectStep = (i: number) => {
    setCurrentStateIndex(i);
    stopPlayback();
  };

  // Open the "new problem, same domain" panel. For built-in domains the panel
  // only shows the upload/paste UI, so force problemType to "custom".
  const openNewProblemPanel = () => {
    if (!isCustomDomain) setProblemType("custom");
    setShowNewProblemPanel(true);
  };

  const submitNewProblem = () => {
    setShowNewProblemPanel(false);
    handleGenerate(); // reuses selectedDomain/isCustomDomain unchanged
  };

  // Lock body scroll while the visualize page owns the window. Depends ONLY on
  // isFullscreen so it runs/cleans up exactly once per fullscreen session —
  // mixing in changeDomain/showNewProblemPanel would re-run it mid-generation
  // and corrupt the captured overflow value (leaving scroll locked after exit).
  useEffect(() => {
    if (!isFullscreen) return;
    document.body.style.overflow = "hidden";
    // Restore to the app default ("") — this effect is the only writer of
    // body overflow, so an unconditional reset can't be corrupted by a stale
    // captured value.
    return () => { document.body.style.overflow = ""; };
  }, [isFullscreen]);

  // Keep the fullscreen canvas sized to the viewport.
  useEffect(() => {
    if (!isFullscreen) return;
    const onResize = () => setFsSize({ w: window.innerWidth, h: window.innerHeight });
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [isFullscreen]);

  // Escape closes the new-problem panel first, then leaves the visualize page.
  useEffect(() => {
    if (!isFullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (showNewProblemPanel) { setShowNewProblemPanel(false); return; }
      changeDomain();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isFullscreen, showNewProblemPanel, changeDomain]);

  // True once a plan is loaded and no LLM stage / error is in flight — the
  // canvas, feedback box and verify status are all live. Shared by the normal
  // card and the fullscreen overlay.
  const canvasReady = renderedStates.length > 0 && !isProcessing && !isTransformerGenerating && !isLlmGenerating && !llmError && !transformerError;

  // onLlmError handler shared by both StateCanvas instances (normal + overlay).
  const handleCanvasLlmError = useCallback((err: string) => {
    setLlmError(err);
    logEventMutation.mutate({
      sessionId: getSessionId(),
      type: "render_crash",
      data: {
        domain: isCustomDomain ? customDomainName : selectedDomain,
        isCustomDomain,
        stateIndex: currentStateIndex,
        renderMethod: renderMode,
        error: String(err).slice(0, 500),
      },
    });
  }, [isCustomDomain, customDomainName, selectedDomain, currentStateIndex, renderMode, logEventMutation]);

  // FeedbackBox + VerifyStatus rendered identically in the card and the overlay.
  const renderFeedbackBox = (compact = false) => (
    <FeedbackBox
      compact={compact}
      context={{
        domainName: isCustomDomain ? (customDomainName || "custom") : selectedDomain,
        isCustomDomain,
        savedDomainId: selectedSavedDomainId,
        transformerHash: loadSavedDomainQuery.data?.transformerHash ?? null,
        rendererHash: loadSavedDomainQuery.data?.rendererHash ?? null,
        llmProvider,
        problemHash,
        stateIndex: currentStateIndex,
        totalStates: renderedStates.length,
        // Prefer raw PDDL predicates as ground truth (Phase 2 canonical form).
        // Fall back to the enriched render state for pre-baked examples.
        symbolicState: rawStates?.[currentStateIndex] ?? renderedStates[currentStateIndex],
      }}
      getImageDataUrl={() => {
        const canvas = canvasContainerRef.current?.querySelector("canvas");
        return canvas ? canvas.toDataURL("image/png") : null;
      }}
    />
  );

  const renderVerifyStatus = () => {
    const rh = loadSavedDomainQuery.data?.rendererHash ?? null;
    const th = loadSavedDomainQuery.data?.transformerHash ?? null;
    const currentKey = `${rh ?? "norend"}-${th ?? "notrans"}-${currentStateIndex}`;
    const entry = verifyByKey.get(currentKey) ?? null;
    return (
      <VerifyStatus
        applicable={!!(rawStates && predicateSchema && pddlObjects)}
        entry={entry}
        stateIndex={currentStateIndex}
      />
    );
  };

  // Playback handlers (handlePlay/handlePause/handleNext/handlePrevious/
  // stopPlayback) come from the usePlayback hook above.

  // (getSpeedBadge replaced by the <SpeedBadge> component — imported above.)

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60); const sec = s % 60;
    return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
  };

  const currentDomain = domains.find(d => d.id === selectedDomain);

  // ── Wizard step model ───────────────────────────────────────────────────
  // Per-step validity mirrors handleGenerate's own checks so the stepper marks
  // and the Generate gate can never disagree.
  const builtinProblemValid =
    problemType === "example" || (inputMode === "file" ? !!problemFile : !!problemText.trim());
  const customProblemValid =
    customProblemInputMode === "file" ? !!customProblemFile : !!customProblemText.trim();
  const savedDomainValid =
    customMode === "saved" && !!selectedSavedDomainId && !!loadSavedDomainQuery.data;
  const newDomainValid =
    customMode === "new" &&
    !!customDomainName.trim() &&
    (customDomainInputMode === "file" ? !!customDomainFile : !!customDomainText.trim());
  const domainStepValid = isCustomDomain
    ? (customMode === "saved" ? savedDomainValid : newDomainValid)
    : true;
  const customStep1Valid = domainStepValid && customProblemValid;
  const canGenerate = isCustomDomain ? customStep1Valid : builtinProblemValid;

  // Built-in domains get a standalone Problem step; custom domains bundle the
  // problem into their domain components, so step 1 covers both ("Domain & Problem").
  const problemSummary =
    problemType === "example"
      ? "Example problem"
      : inputMode === "file"
      ? (problemFile?.name ?? "Upload a file")
      : (problemText.trim() ? "Pasted PDDL" : "Paste PDDL");
  const wizardSteps = isCustomDomain
    ? [
        { key: "domainProblem", label: "Domain & Problem", summary: customDomainName || "Custom", valid: customStep1Valid },
        { key: "strategy", label: "Strategy", summary: currentStrategy?.name ?? selectedStrategy, valid: true },
      ]
    : [
        { key: "domain", label: "Domain", summary: currentDomain?.name ?? selectedDomain, valid: true },
        { key: "problem", label: "Problem", summary: problemSummary, valid: builtinProblemValid },
        { key: "strategy", label: "Strategy", summary: currentStrategy?.name ?? selectedStrategy, valid: true },
      ];
  const safeStep = Math.min(wizardStep, wizardSteps.length - 1);
  const activeStep = wizardSteps[safeStep];

  // Switching Basic↔Custom changes step 1's content and the problem pipeline,
  // so walk the user back to the first step.
  useEffect(() => { setWizardStep(0); }, [isCustomDomain]);

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

          {/* ── Study Mode: participant banner + end-session control ── */}
          {studyMode.active && (
            <div className="flex items-center gap-3 mr-4 flex-shrink-0">
              <span
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-500/15 ring-1 ring-purple-400/30 text-[11px] text-purple-200 whitespace-nowrap"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
                Study mode · {studyMode.intake?.participantId}
              </span>
              <button
                type="button"
                onClick={() => setShowSus(true)}
                className="px-3 py-1.5 text-[11px] font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 transition-colors whitespace-nowrap"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                End session &amp; take survey
              </button>
            </div>
          )}

          <a
            href="/verifier"
            className="text-xs text-slate-400 hover:text-slate-200 underline underline-offset-2 mr-4 whitespace-nowrap"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            Verifier →
          </a>

        </div>
      </header>

      {/* ── Study Mode: SUS questionnaire ── */}
      {studyMode.active && studyMode.startedAt && studyMode.intake && (
        <SusSurvey
          open={showSus}
          intake={studyMode.intake}
          startedAt={studyMode.startedAt}
          onClose={() => setShowSus(false)}
          onFinished={() => {
            setShowSus(false);
            studyMode.endSession();
          }}
        />
      )}

      <main className="container max-w-[1440px] py-8" style={{ position: "relative", zIndex: 1 }}>



        {/* ── Setup wizard (the options page) ── */}
        <div className="flex flex-col gap-5">

          <AnimatePresence mode="popLayout">
            {(
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 12 }}
                transition={spring}
                className="w-full flex flex-col gap-5"
              >

                {/* ── Decoration band: the planning-graph hero (kept as ambient art) ── */}
                <div className="relative flex flex-col items-center gap-3 pt-1 pb-1 pointer-events-none select-none" aria-hidden="true">
                  <div className="relative opacity-30">
                    <div className="absolute inset-0 -m-12 rounded-full" style={{ background: "radial-gradient(ellipse at center, rgba(34,197,94,0.08) 0%, rgba(99,102,241,0.05) 50%, transparent 70%)" }} />
                    <PlanningGraph />
                  </div>
                  <div className="px-4 py-2 rounded-xl border border-white/[0.07] font-mono text-xs text-slate-500" style={{ background: "rgba(11,21,36,0.7)" }}>
                    <span className="text-green-500">$</span> planner --domain {isCustomDomain ? (customDomainName || "custom") : selectedDomain} --run<BlinkingCursor />
                  </div>
                </div>

                {/* ── Stepper bar ── */}
                <div className="flex items-stretch gap-2">
                  {wizardSteps.map((step, i) => {
                    const isActive = i === safeStep;
                    const isDone = step.valid && !isActive;
                    return (
                      <button
                        key={step.key}
                        type="button"
                        onClick={() => setWizardStep(i)}
                        disabled={isBusy}
                        className={`flex-1 min-w-0 flex items-center gap-3 px-4 py-3 rounded-2xl border text-left transition-all duration-150 disabled:cursor-not-allowed ${
                          isActive
                            ? "bg-[#111E30] border-white/[0.14]"
                            : "bg-[#0E1A2B] border-white/[0.06] hover:border-white/[0.12]"
                        }`}
                        style={isActive ? { boxShadow: "0 1px 0 rgba(255,255,255,0.05) inset, 0 8px 32px rgba(0,0,0,0.18)" } : undefined}
                      >
                        <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-all"
                          style={isActive
                            ? { background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.35)" }
                            : { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                          {isDone
                            ? <CheckCircleIcon className="w-4 h-4 text-green-400" />
                            : <span className={`text-[11px] font-bold ${isActive ? "text-green-300" : "text-slate-500"}`} style={{ fontFamily: "'JetBrains Mono', monospace" }}>{i + 1}</span>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className={`text-sm font-semibold truncate ${isActive ? "text-slate-100" : "text-slate-400"}`} style={{ fontFamily: "'JetBrains Mono', monospace" }}>{step.label}</div>
                          <div className="text-xs text-slate-500 truncate">{step.summary}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* ── Stage panel (active step's content) ── */}
                <div
                  className={`rounded-2xl border border-white/[0.08] bg-[#111E30] overflow-hidden transition-opacity duration-200 ${isBusy ? "opacity-60 pointer-events-none select-none" : ""}`}
                  aria-busy={isBusy}
                  style={{ boxShadow: "0 1px 0 rgba(255,255,255,0.05) inset, 0 8px 32px rgba(0,0,0,0.18)" }}
                >
                  <div className="p-5 min-h-[460px]" style={{ maxHeight: "calc(100vh - 380px)", overflow: "auto" }}>
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={activeStep.key}
                        initial={{ opacity: 0, x: 12 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -12 }}
                        transition={{ duration: 0.2, ease: easeOut }}
                      >
                        {/* ── Step: Domain (also Problem, for custom domains) ── */}
                        {(activeStep.key === "domain" || activeStep.key === "domainProblem") && (
                          <div className="space-y-4">
                            {/* Basic / Custom domain type toggle */}
                            <div className="flex items-center gap-0.5 bg-white/[0.04] rounded-lg p-0.5 border border-white/[0.06] max-w-[320px]">
                              {[
                                { id: "basic",  label: "Basic" },
                                { id: "custom", label: "Custom" },
                              ].map(t => (
                                <button
                                  key={t.id}
                                  onClick={() => {
                                    // Switching type only resets the form/mode state — the
                                    // wizard step reset is handled by an effect on isCustomDomain.
                                    if (t.id === "custom") {
                                      setIsCustomDomain(true);
                                      setSelectedDomain("");
                                    } else {
                                      setIsCustomDomain(false);
                                      setCustomDomainName(""); setCustomDomainFile(null);
                                      setCustomDomainText(""); setCustomProblemFile(null); setCustomProblemText("");
                                      setLlmTransformerCode(null); setTransformerError(null); setTransformerModelInfo(null);
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
                            {!isCustomDomain && (
                              <div className="max-w-[760px]">
                                <DomainGrid
                                  domains={domains}
                                  selectedDomain={selectedDomain}
                                  domainColors={domainColors}
                                  onSelect={(id) => { setSelectedDomain(id); setIsCustomDomain(false); }}
                                  onViewDefinition={() => setShowDomainDefinition(true)}
                                />
                              </div>
                            )}

                            {/* Custom: Saved / Upload New — two columns at full width */}
                            {isCustomDomain && (
                              <div className="flex flex-col lg:flex-row gap-6 items-start">
                                <div className="w-full lg:w-[360px] lg:flex-shrink-0 space-y-3">
                                  {/* Sub-toggle: Saved / Upload New */}
                                  <div className="flex gap-1 p-0.5 rounded-lg" style={{ background: "rgba(255,255,255,0.04)" }}>
                                    {([{ id: "saved", label: "Saved Domains" }, { id: "new", label: "Upload New" }] as const).map(m => (
                                      <button key={m.id} onClick={() => {
                                        setCustomMode(m.id);
                                        if (m.id === "new") {
                                          setSelectedSavedDomainId(null);
                                          setLlmTransformerCode(null);
                                          setLlmRendererCode(null);
                                          setLlmError(null);
                                          setTransformerError(null);
                                        }
                                        if (m.id === "saved") {
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

                                  {/* Saved Domains list */}
                                  {customMode === "saved" && (
                                    <div className="space-y-1">
                                      <button
                                        type="button"
                                        onClick={() => setSavedDomainsListOpen(o => !o)}
                                        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left hover:bg-white/[0.03] transition-colors"
                                      >
                                        <motion.div animate={{ rotate: savedDomainsListOpen ? 0 : -90 }} transition={{ duration: 0.18, ease: easeOut }}>
                                          <ChevronDownIcon className="w-4 h-4 text-slate-600" />
                                        </motion.div>
                                        <span className="text-xs font-semibold text-slate-400" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                                          Saved domains
                                        </span>
                                        {savedDomainsQuery.data && savedDomainsQuery.data.length > 0 && (
                                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-white/[0.06] text-slate-500">
                                            {savedDomainsQuery.data.length}
                                          </span>
                                        )}
                                      </button>
                                      <CollapseSection open={savedDomainsListOpen}>
                                        <SavedDomainsList
                                          savedDomains={savedDomainsQuery.data}
                                          isLoading={savedDomainsQuery.isLoading}
                                          selectedSavedDomainId={selectedSavedDomainId}
                                          onSelect={(sd) => {
                                            setSelectedSavedDomainId(sd.id);
                                            setCustomDomainName(sd.domainName);
                                          }}
                                          onDelete={(sd) => setDeleteConfirmModal({
                                            show: true,
                                            id: sd.id,
                                            displayName: sd.displayName,
                                          })}
                                        />
                                      </CollapseSection>
                                    </div>
                                  )}
                                </div>

                                {/* Right column: detail / upload form */}
                                <div className="flex-1 min-w-0 w-full max-w-[640px]">
                                  {customMode === "saved" && selectedSavedDomainId && loadSavedDomainQuery.data && (
                                    <SavedDomainDetail
                                      domainPddl={loadSavedDomainQuery.data.domainPddl}
                                      transformerCode={loadSavedDomainQuery.data.transformerCode}
                                      rendererCode={loadSavedDomainQuery.data.rendererCode}
                                      transformerHash={loadSavedDomainQuery.data.transformerHash}
                                      rendererHash={loadSavedDomainQuery.data.rendererHash}
                                      showGeneratedCode={showGeneratedCode}
                                      onToggleGeneratedCode={() => setShowGeneratedCode(v => !v)}
                                      problemInputMode={customProblemInputMode}
                                      onProblemInputModeChange={setCustomProblemInputMode}
                                      problemFile={customProblemFile}
                                      onProblemFileChange={setCustomProblemFile}
                                      problemText={customProblemText}
                                      onProblemTextChange={setCustomProblemText}
                                    />
                                  )}
                                  {customMode === "saved" && !selectedSavedDomainId && (
                                    <div className="min-h-[200px] flex items-center justify-center text-center px-6 py-10 rounded-xl border border-dashed border-white/[0.08] text-sm text-slate-500">
                                      Select a saved domain to load its renderer, then add a problem.
                                    </div>
                                  )}
                                  {customMode === "new" && (
                                    <CustomDomainUpload
                                      llmProvider={llmProvider}
                                      onProviderChange={setLlmProvider}
                                      domainName={customDomainName}
                                      onDomainNameChange={setCustomDomainName}
                                      domainInputMode={customDomainInputMode}
                                      onDomainInputModeChange={setCustomDomainInputMode}
                                      domainFile={customDomainFile}
                                      onDomainFileChange={setCustomDomainFile}
                                      domainText={customDomainText}
                                      onDomainTextChange={setCustomDomainText}
                                      problemInputMode={customProblemInputMode}
                                      onProblemInputModeChange={setCustomProblemInputMode}
                                      problemFile={customProblemFile}
                                      onProblemFileChange={setCustomProblemFile}
                                      problemText={customProblemText}
                                      onProblemTextChange={setCustomProblemText}
                                    />
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* ── Step: Problem (built-in domains only) ── */}
                        {activeStep.key === "problem" && (
                          <div className="max-w-[760px]">
                            <ProblemInput
                              domainName={currentDomain?.name}
                              problemType={problemType}
                              onProblemTypeChange={setProblemType}
                              inputMode={inputMode}
                              onInputModeChange={setInputMode}
                              problemFile={problemFile}
                              onProblemFileChange={setProblemFile}
                              problemText={problemText}
                              onProblemTextChange={setProblemText}
                              onViewExample={() => setShowExampleProblem(true)}
                            />
                          </div>
                        )}

                        {/* ── Step: Strategy ── */}
                        {activeStep.key === "strategy" && (
                          <div className="max-w-[760px]">
                            <StrategyPicker
                              isOpen={true}
                              onToggle={() => {}}
                              strategies={strategiesQuery.data}
                              selectedStrategy={selectedStrategy}
                              onSelect={setSelectedStrategy}
                              currentStrategy={currentStrategy}
                            />
                          </div>
                        )}
                      </motion.div>
                    </AnimatePresence>
                  </div>
                </div>

                {/* ── Action bar (Back / Next / Generate) ── */}
                <div className={`flex items-center gap-3 flex-wrap transition-opacity duration-200 ${isBusy ? "opacity-60 pointer-events-none select-none" : ""}`}>
                  <button
                    type="button"
                    onClick={() => setWizardStep(s => Math.max(0, s - 1))}
                    disabled={safeStep === 0}
                    className="py-3 px-5 rounded-2xl font-semibold text-sm tracking-wide border border-white/[0.08] text-slate-300 hover:bg-white/[0.04] disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200"
                    style={{ fontFamily: "'JetBrains Mono', monospace" }}
                  >
                    Back
                  </button>
                  {safeStep < wizardSteps.length - 1 && (
                    <button
                      type="button"
                      onClick={() => setWizardStep(s => Math.min(wizardSteps.length - 1, s + 1))}
                      disabled={!activeStep.valid}
                      className="py-3 px-5 rounded-2xl font-semibold text-sm tracking-wide border border-white/[0.08] text-slate-200 hover:bg-white/[0.04] disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200"
                      style={{ fontFamily: "'JetBrains Mono', monospace" }}
                    >
                      Next
                    </button>
                  )}
                  <div className="flex-1" />
                  {!canGenerate && !isProcessing && (
                    <span className="text-xs text-slate-600 hidden sm:block" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                      {isCustomDomain ? "Pick a domain and add a problem" : "Add a problem to continue"}
                    </span>
                  )}
                  {/* Stop — halts the in-flight solve (kills the planner). */}
                  {isProcessing && (
                    <motion.button
                      onClick={handleStop}
                      whileTap={{ scale: 0.98 }}
                      whileHover={{ y: -1 }}
                      transition={{ duration: 0.15 }}
                      className="py-3 px-6 rounded-2xl font-semibold text-sm tracking-wide bg-red-600/90 hover:bg-red-600 text-white transition-all duration-200 flex items-center justify-center gap-2"
                      style={{ fontFamily: "'JetBrains Mono', monospace" }}
                    >
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
                      Stop
                    </motion.button>
                  )}
                  <motion.button
                    onClick={handleGenerate}
                    disabled={!canGenerate || isBusy}
                    whileTap={!isProcessing && canGenerate ? { scale: 0.98 } : undefined}
                    whileHover={!isProcessing && canGenerate ? { y: -1 } : undefined}
                    transition={{ duration: 0.15 }}
                    className={`py-4 px-8 rounded-2xl font-semibold text-sm tracking-wide transition-all duration-200 ${
                      isProcessing
                        ? "bg-green-600/40 text-green-200/60 cursor-wait"
                        : !canGenerate
                        ? "bg-white/[0.05] text-slate-600 cursor-not-allowed"
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

        </div>
      </main>

      <footer className="border-t border-white/[0.05] bg-[#0B1524]/80 mt-16" style={{ position: "relative", zIndex: 1 }}>
        <div className="container max-w-[1440px] py-5">
          <p className="text-center text-xs text-slate-600 tracking-wide font-mono">
            Planning Visualizer &middot; Built for AI Planning Education
          </p>
        </div>
      </footer>

      {/* ── Fullscreen visualization overlay ──────────────────────────────────
          Portaled to <body> so it escapes the page stacking context. z-45 sits
          above the header (40) but below ModalBackdrop (50), so existing modals
          (errors, duplicate-domain, example viewer) still render above it. */}
      {isFullscreen && (renderedStates.length > 0 || isProcessing || isTransformerGenerating || isLlmGenerating) && createPortal(
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          transition={{ duration: 0.25, ease: easeOut }}
          className="fixed inset-0 bg-[#0B1524]"
          style={{
            zIndex: 45,
            backgroundImage: "radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        >
          {/* (1) Drawing surface — the canvas fills the whole screen (its
              background is the backdrop; domain objects stay centered). While
              solving / building the visualizer, a centered animation + Stop
              replaces it. */}
          {isProcessing ? (
            <div className="absolute inset-0 flex items-center justify-center p-8">
              <div className="flex flex-col items-center gap-7 text-center">
                <div className="relative w-20 h-20">
                  <div className="absolute inset-0 rounded-full border-2 border-green-200/15" />
                  <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-green-400 animate-spin" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-slate-100" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                    {isCustomDomain || problemType === "custom" ? "Solving problem" : "Generating states"}
                  </h3>
                  <p className="text-xs text-slate-500 mt-2 font-mono">Running the planner… {formatTime(elapsedTime)}</p>
                  {currentStrategy?.isOptimal && elapsedTime > 30 && (
                    <p className="text-xs text-amber-400/80 mt-2 max-w-sm mx-auto leading-relaxed">
                      Optimal search can take a while. Consider a satisficing strategy for faster results.
                    </p>
                  )}
                </div>
                <button
                  onClick={changeDomain}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm bg-red-600/90 hover:bg-red-600 text-white transition-all duration-150"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
                  Stop
                </button>
              </div>
            </div>
          ) : (isTransformerGenerating || isLlmGenerating) && !llmError && !transformerError ? (
            <div className="absolute inset-0 flex items-center justify-center p-8">
              <div className="flex flex-col items-center gap-5">
                <CustomDomainLoading
                  stage={isTransformerGenerating ? "transformer" : "renderer"}
                  domainName={isCustomDomain ? customDomainName : selectedDomain}
                />
                <button
                  onClick={changeDomain}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/[0.1] bg-white/[0.04] text-slate-300 text-xs font-medium hover:text-white hover:border-white/[0.18] transition-all duration-150"
                >
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
                  Stop
                </button>
              </div>
            </div>
          ) : renderedStates.length > 0 ? (
            <div ref={canvasContainerRef} className="absolute inset-0">
              <StateCanvas
                key={vizRunId}
                state={renderedStates[currentStateIndex]}
                width={fsSize.w}
                height={fsSize.h}
                fillContainer
                isFirst={currentStateIndex === 0}
                isLast={currentStateIndex === renderedStates.length - 1}
                llmRendererCode={renderMode === "llm" && llmRendererCode ? llmRendererCode : undefined}
                transformerCode={isCustomDomain && llmTransformerCode ? llmTransformerCode : undefined}
                onLlmError={handleCanvasLlmError}
              />
            </div>
          ) : null}

          {/* (2) Floating top toolbar — actions appear once the canvas is ready;
              during generation only the domain label shows (Stop lives on the
              loader). */}
          <div className="absolute top-4 left-4 right-4 flex items-center justify-between gap-3 pointer-events-none">
            <div className="flex items-center gap-2 pointer-events-auto">
              {canvasReady && (
                <>
                  <button
                    onClick={changeDomain}
                    title="Back to options — choose a different domain or problem"
                    className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-white/[0.08] bg-[#111E30]/85 backdrop-blur-md text-slate-300 text-xs font-medium hover:text-white hover:border-white/[0.16] transition-all duration-150"
                  >
                    <MenuIcon className="w-4 h-4" /> Change Domain
                  </button>
                  <button
                    onClick={openNewProblemPanel}
                    disabled={isBusy}
                    title="Solve a new problem for the same domain"
                    className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-white/[0.08] bg-[#111E30]/85 backdrop-blur-md text-slate-300 text-xs font-medium hover:text-white hover:border-white/[0.16] transition-all duration-150 disabled:opacity-40"
                  >
                    <UploadIcon className="w-4 h-4" /> New Problem
                  </button>
                </>
              )}
              <span className="px-3 py-2 rounded-xl border border-white/[0.06] bg-[#111E30]/70 backdrop-blur-md text-xs text-slate-400 font-mono">
                {isCustomDomain ? (customDomainName || "Custom") : currentDomain?.name}
              </span>
            </div>
            {canvasReady && (
              <div className="flex items-center gap-2 pointer-events-auto">
                <button
                  onClick={() => setShowFsPlanSteps(s => !s)}
                  className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-white/[0.08] bg-[#111E30]/85 backdrop-blur-md text-slate-300 text-xs font-medium hover:text-white hover:border-white/[0.16] transition-all duration-150"
                >
                  <TerminalIcon className="w-4 h-4" /> {showFsPlanSteps ? "Hide" : "Show"} Steps
                </button>
                <button
                  onClick={changeDomain}
                  title="Back to options (Esc)"
                  className="flex items-center justify-center p-2 rounded-xl border border-white/[0.08] bg-[#111E30]/85 backdrop-blur-md text-slate-300 hover:text-white hover:border-white/[0.16] transition-all duration-150"
                >
                  <CloseIcon className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* (3) Floating playback bar (bottom-center) */}
          {canvasReady && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 rounded-2xl border border-white/[0.08] bg-[#111E30]/85 backdrop-blur-md shadow-2xl overflow-hidden w-[min(680px,92vw)]">
              <PlaybackControls
                currentStateIndex={currentStateIndex}
                totalStates={renderedStates.length}
                isPlaying={isPlaying}
                playbackSpeed={playbackSpeed}
                onPrevious={handlePrevious}
                onPlay={handlePlay}
                onPause={handlePause}
                onNext={handleNext}
                onSeek={setCurrentStateIndex}
                onSpeedChange={setPlaybackSpeed}
              />
            </div>
          )}

          {/* (4) Floating plan steps (right) */}
          <AnimatePresence>
            {showFsPlanSteps && canvasReady && plan.length > 0 && (
              <motion.div
                initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 16 }}
                transition={spring}
                className="absolute top-20 right-4 bottom-28"
              >
                <PlanStepsList
                  variant="floating"
                  plan={plan}
                  currentStateIndex={currentStateIndex}
                  onSelectIndex={handleSelectStep}
                  listRef={planStepsRef}
                  className="h-full"
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* (5) Feedback — bottom-left of the playback bar (always shown),
              a wide short bar matching the playback bar's height. */}
          {canvasReady && (
            <div className="absolute left-4 bottom-6 w-[620px] max-w-[calc(50vw-360px)] pointer-events-auto rounded-2xl border border-white/[0.08] bg-[#111E30]/95 backdrop-blur-md shadow-2xl overflow-hidden">
              {renderFeedbackBox(true)}
            </div>
          )}

          {/* (6) Verify status — bottom-right of the playback bar */}
          {canvasReady && (
            <div className="absolute right-4 bottom-6 w-[320px] max-w-[26vw] pointer-events-auto rounded-2xl border border-white/[0.08] bg-[#111E30]/85 backdrop-blur-md shadow-2xl overflow-hidden">
              {renderVerifyStatus()}
            </div>
          )}

          {/* (7) New-problem (same-domain) mini-panel */}
          <AnimatePresence>
            {showNewProblemPanel && (
              <motion.div
                initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}
                transition={spring}
                className="absolute top-20 left-1/2 -translate-x-1/2 w-[440px] max-w-[92vw] max-h-[72vh] overflow-auto rounded-2xl border border-white/[0.1] bg-[#111E30]/[0.97] backdrop-blur-xl shadow-2xl"
              >
                <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between sticky top-0 bg-[#111E30]/[0.97] backdrop-blur-xl z-10">
                  <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2"
                    style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                    <UploadIcon className="w-4 h-4 text-green-500" />
                    New Problem &middot; {isCustomDomain ? (customDomainName || "Custom") : currentDomain?.name}
                  </h3>
                  <button onClick={() => setShowNewProblemPanel(false)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06] transition-all">
                    <CloseIcon className="w-4 h-4" />
                  </button>
                </div>

                {isCustomDomain ? (
                  <div className="px-4 py-4 space-y-3">
                    <p className="text-xs text-slate-500">Provide a new problem PDDL for <strong className="text-slate-300">{customDomainName || "this domain"}</strong>. The existing renderer is reused.</p>
                    <PillToggle<"file" | "text">
                      options={[
                        { id: "file", label: <><UploadIcon className="w-3 h-3" />Upload</> },
                        { id: "text", label: <><FileCodeIcon className="w-3 h-3" />Paste</> },
                      ]}
                      value={customProblemInputMode}
                      onChange={v => { setCustomProblemInputMode(v); if (v === "file") setCustomProblemText(""); else setCustomProblemFile(null); }}
                    />
                    {customProblemInputMode === "file" ? (
                      <div className="relative">
                        <input type="file" accept=".pddl"
                          onChange={e => setCustomProblemFile(e.target.files?.[0] || null)}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                        <div className={`border-2 border-dashed rounded-xl p-5 text-center transition-all ${
                          customProblemFile
                            ? "border-green-500/40 bg-green-500/[0.06]"
                            : "border-white/[0.08] hover:border-green-500/30 hover:bg-green-500/[0.04]"
                        }`}>
                          {customProblemFile ? (
                            <><CheckCircleIcon className="w-6 h-6 text-green-500 mx-auto mb-1.5" />
                            <p className="text-xs text-green-400 font-medium truncate px-2">{customProblemFile.name}</p></>
                          ) : (
                            <><UploadIcon className="w-6 h-6 text-slate-600 mx-auto mb-1.5" />
                            <p className="text-xs text-slate-600">Drop .pddl file or click to browse</p></>
                          )}
                        </div>
                      </div>
                    ) : (
                      <Textarea
                        value={customProblemText}
                        onChange={e => setCustomProblemText(e.target.value)}
                        placeholder={"(define (problem ...)\n  (:domain ...)\n  ...\n)"}
                        className="font-mono text-xs min-h-[220px] bg-white/[0.04] border-white/[0.08] text-slate-300 placeholder:text-slate-700 focus:border-green-500/40 rounded-xl resize-none"
                      />
                    )}
                  </div>
                ) : (
                  <ProblemInput
                    domainName={currentDomain?.name}
                    problemType={problemType}
                    onProblemTypeChange={setProblemType}
                    inputMode={inputMode}
                    onInputModeChange={setInputMode}
                    problemFile={problemFile}
                    onProblemFileChange={setProblemFile}
                    problemText={problemText}
                    onProblemTextChange={setProblemText}
                    onViewExample={() => setShowExampleProblem(true)}
                  />
                )}

                <div className="px-4 py-3 border-t border-white/[0.06] sticky bottom-0 bg-[#111E30]/[0.97] backdrop-blur-xl">
                  <button onClick={submitNewProblem} disabled={isBusy}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-green-600 text-white text-sm font-semibold hover:bg-green-500 disabled:opacity-40 transition-all duration-150">
                    <WandIcon className="w-4 h-4" />
                    {isProcessing ? "Processing…" : "Generate"}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>,
        document.body
      )}

      {/* ── Modals ── */}
      <ErrorModal
        state={errorModal}
        onClose={() => setErrorModal({ show: false, title: "", message: "" })}
        onSwitchDomain={(d) => { setSelectedDomain(d); setErrorModal({ show: false, title: "", message: "" }); }}
      />

      {/* "Domain already exists" — surfaces when an upload's PDDL hash
          matches one or more entries in the saved-domains library. The
          user picks a specific existing version to reuse, or generates a
          new versioned entry. Dismissing the modal cancels the action. */}
      <DuplicateDomainModal
        show={duplicateModal.show}
        matches={duplicateModal.matches}
        onDismiss={handleDismissDuplicateModal}
        onReuse={handleReuseExistingVersion}
        onCreateNew={handleCreateNewVersion}
      />

      {/* Delete-saved-domain confirmation. Mirrors errorModal styling
          but with a red action button — destructive operations should
          look distinct from informational ones. */}
      <DeleteDomainModal
        show={deleteConfirmModal.show}
        displayName={deleteConfirmModal.displayName}
        isDeleting={deleteSavedDomainMutation.isPending}
        onCancel={() => setDeleteConfirmModal({ show: false, id: null, displayName: "" })}
        onConfirm={handleConfirmDeleteSavedDomain}
      />

      <PddlViewerModal
        show={showExampleProblem}
        onClose={() => setShowExampleProblem(false)}
        title="Example Problem"
        subtitle={currentDomain?.name}
      >
        <pre className="text-xs font-mono bg-black/[0.3] text-green-300/80 p-4 rounded-xl border border-white/[0.05] whitespace-pre-wrap leading-relaxed">
          {getDefaultProblem(selectedDomain)}
        </pre>
      </PddlViewerModal>

      <PddlViewerModal
        show={showDomainDefinition}
        onClose={() => setShowDomainDefinition(false)}
        title="Domain Definition"
        subtitle={currentDomain?.name}
      >
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
      </PddlViewerModal>

    </div>
  );
}
