import {
  motion,
  AnimatePresence,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  animate as motionAnimate,
} from "framer-motion";
import { useLocation } from "wouter";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { PDDLHeaderBackground } from "@/components/PDDLHeaderBackground";
import { useStudyMode, type StudyIntake } from "@/contexts/StudyModeContext";

// Shared cubic-bezier — mirrors the one used in Visualizer.tsx so motion
// across the two pages feels like the same product.
const easeOut: [number, number, number, number] = [0.23, 1, 0.32, 1];

// ─── Scroll-progress hairline ────────────────────────────────────────────────
const ScrollProgress = () => {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 140,
    damping: 24,
    mass: 0.35,
  });
  return (
    <motion.div
      className="fixed top-0 left-0 right-0 h-[2px] z-50 origin-left pointer-events-none"
      style={{
        scaleX,
        background:
          "linear-gradient(90deg, #22c55e 0%, #a78bfa 50%, #7dd3fc 100%)",
        boxShadow: "0 0 12px rgba(34,197,94,0.55)",
      }}
    />
  );
};

// ─── Sticky mini-nav (fades in once the hero scrolls past) ───────────────────
const StickyNav = ({ onOpen }: { onOpen: () => void }) => {
  const { scrollY } = useScroll();
  const opacity = useTransform(scrollY, [200, 360], [0, 1]);
  const y = useTransform(scrollY, [200, 360], [-12, 0]);
  return (
    <motion.div
      style={{ opacity, y }}
      className="fixed top-3 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 px-4 py-2 rounded-full
                 bg-[#0F1A2E]/80 backdrop-blur-md ring-1 ring-white/[0.06] shadow-lg shadow-black/30"
    >
      <img src="/app-icon.svg" alt="" width={22} height={22} className="opacity-95" />
      <span
        className="text-[10px] uppercase tracking-[0.28em] text-slate-300"
        style={{ fontFamily: "'JetBrains Mono', monospace" }}
      >
        Planning Visualizer
      </span>
      <button
        onClick={onOpen}
        className="ml-1 text-xs font-semibold text-emerald-300 hover:text-emerald-200 transition-colors"
      >
        Open →
      </button>
    </motion.div>
  );
};

// ─── Brand emblem with orbital particles ─────────────────────────────────────
const BrandMark = ({ size = 108 }: { size?: number }) => {
  // Three small dots orbiting the brand on staggered phases. The mark itself
  // gets a pulsing radial halo behind it.
  const orbit = (r: number, phase: number, color: string, dur: number) => (
    <motion.div
      className="absolute inset-0"
      style={{ animation: `none` }}
      animate={{ rotate: 360 }}
      transition={{ duration: dur, repeat: Infinity, ease: "linear", delay: phase }}
    >
      <div
        className="absolute top-1/2 left-1/2"
        style={{
          width: 4,
          height: 4,
          background: color,
          borderRadius: 999,
          transform: `translate(${r}px, -2px)`,
          boxShadow: `0 0 8px ${color}`,
        }}
      />
    </motion.div>
  );
  return (
    <div className="relative" style={{ width: size, height: size }}>
      {/* halo */}
      <motion.div
        className="absolute inset-[-22px] rounded-full pointer-events-none"
        style={{
          background:
            "radial-gradient(circle, rgba(167,139,250,0.38) 0%, rgba(125,211,252,0.14) 45%, transparent 75%)",
        }}
        animate={{ scale: [1, 1.18, 1], opacity: [0.55, 1, 0.55] }}
        transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
      />
      {/* orbital ring (faint) */}
      <div
        className="absolute inset-[-14px] rounded-full pointer-events-none"
        style={{ border: "1px dashed rgba(167,139,250,0.22)" }}
      />
      {/* orbiting dots */}
      <div className="absolute inset-[-14px]">
        {orbit(size / 2 + 14, 0, "#a78bfa", 8.5)}
        {orbit(size / 2 + 14, 2.8, "#7dd3fc", 11)}
        {orbit(size / 2 + 14, 5.6, "#d8b4fe", 9.5)}
      </div>
      <img
        src="/app-icon.svg"
        alt="Planning Visualizer"
        width={size}
        height={size}
        className="relative z-10 drop-shadow-[0_0_18px_rgba(139,92,246,0.4)]"
      />
    </div>
  );
};

// ─── Eyebrow typing effect ───────────────────────────────────────────────────
const TypingEyebrow = ({
  text, delay = 0, disabled,
}: { text: string; delay?: number; disabled: boolean }) => {
  const [shown, setShown] = useState(disabled ? text.length : 0);
  useEffect(() => {
    if (disabled) return;
    let cancelled = false;
    const start = performance.now() + delay * 1000;
    let raf = 0;
    const speed = 32; // ms per char
    const tick = (t: number) => {
      if (cancelled) return;
      const elapsed = t - start;
      if (elapsed < 0) {
        raf = requestAnimationFrame(tick);
        return;
      }
      const i = Math.min(text.length, Math.floor(elapsed / speed));
      setShown(i);
      if (i < text.length) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [text, delay, disabled]);
  return (
    <span
      className="text-[11px] uppercase tracking-[0.32em] text-purple-300/85"
      style={{ fontFamily: "'JetBrains Mono', monospace" }}
    >
      {text.slice(0, shown)}
      {!disabled && shown < text.length && (
        <motion.span
          className="inline-block w-[6px] h-[1.05em] ml-[2px] align-middle"
          style={{ background: "#a78bfa", verticalAlign: "-2px" }}
          animate={{ opacity: [1, 0, 1] }}
          transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }}
        />
      )}
    </span>
  );
};

// ─── Per-word headline reveal ────────────────────────────────────────────────
const RevealHeadline = ({ disabled }: { disabled: boolean }) => {
  const words = ["See", "the", "plan,"];
  const wordsAccent = ["not", "just", "the", "code."];
  const baseTransition = (i: number) => ({
    duration: disabled ? 0.2 : 0.55,
    ease: easeOut,
    delay: disabled ? 0 : 0.42 + i * 0.06,
  });
  let idx = 0;
  return (
    <h1
      className="mt-5 font-semibold tracking-tight text-slate-50"
      style={{ fontSize: "clamp(2.25rem, 5.4vw, 3.5rem)", lineHeight: 1.05 }}
    >
      {words.map((w) => {
        const i = idx++;
        return (
          <motion.span
            key={`a-${i}`}
            initial={{ opacity: 0, y: disabled ? 0 : 14, x: disabled ? 0 : -4 }}
            animate={{ opacity: 1, y: 0, x: 0 }}
            transition={baseTransition(i)}
            className="inline-block mr-[0.3em]"
          >
            {w}
          </motion.span>
        );
      })}
      <span className="text-purple-300">
        {wordsAccent.map((w) => {
          const i = idx++;
          return (
            <motion.span
              key={`b-${i}`}
              initial={{ opacity: 0, y: disabled ? 0 : 14, x: disabled ? 0 : -4 }}
              animate={{ opacity: 1, y: 0, x: 0 }}
              transition={baseTransition(i)}
              className="inline-block mr-[0.3em]"
            >
              {w}
            </motion.span>
          );
        })}
      </span>
    </h1>
  );
};

// ─── Count-up number ─────────────────────────────────────────────────────────
const CountUp = ({
  to, suffix = "", duration = 1.4, disabled,
}: { to: number; suffix?: string; duration?: number; disabled: boolean }) => {
  const [v, setV] = useState(disabled ? to : 0);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);
  useEffect(() => {
    if (disabled) return;
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !started.current) {
          started.current = true;
          const ctrl = motionAnimate(0, to, {
            duration,
            ease: easeOut,
            onUpdate: (latest) => setV(Math.round(latest)),
          });
          io.disconnect();
          return () => ctrl.stop();
        }
      },
      { threshold: 0.6 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [to, duration, disabled]);
  return (
    <span ref={ref}>
      {v}
      {suffix}
    </span>
  );
};

// ─── Stat strip ──────────────────────────────────────────────────────────────
const StatStrip = ({ disabled }: { disabled: boolean }) => {
  const stats = [
    { value: 5, suffix: "", label: "Built-in domains", tint: "#a78bfa" },
    { value: 6, suffix: "", label: "Search strategies", tint: "#7dd3fc" },
    { value: 2, suffix: "", label: "LLM providers", tint: "#d8b4fe" },
    { value: 100, suffix: "%", label: "Open-source planner", tint: "#22c55e" },
  ];
  return (
    <section className="relative px-6 pt-4 pb-8">
      <div className="max-w-5xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-px rounded-2xl overflow-hidden ring-1 ring-white/[0.06] bg-[#0F1A2E]/40 backdrop-blur-sm">
        {stats.map((s, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.5, ease: easeOut, delay: i * 0.08 }}
            className="px-6 py-7 bg-[#0B1524]/85 text-center relative"
          >
            <div
              className="absolute inset-x-6 -top-px h-px"
              style={{ background: `linear-gradient(90deg, transparent, ${s.tint}55, transparent)` }}
            />
            <div
              className="text-3xl sm:text-4xl font-semibold tabular-nums tracking-tight"
              style={{ color: s.tint, fontFamily: "'JetBrains Mono', monospace" }}
            >
              <CountUp to={s.value} suffix={s.suffix} disabled={disabled} />
            </div>
            <div
              className="mt-2 text-[10px] uppercase tracking-[0.28em] text-slate-500"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              {s.label}
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
};

// ─── Domain chips strip ──────────────────────────────────────────────────────
const DomainChips = () => {
  const domains = [
    { name: "Blocks World", color: "#8b7fd8" },
    { name: "Gripper", color: "#7dd3fc" },
    { name: "Depot", color: "#d8b4fe" },
    { name: "Hanoi", color: "#fbcfe8" },
    { name: "Rovers", color: "#22c55e" },
  ];
  return (
    <section className="relative py-10 px-6">
      <div className="max-w-5xl mx-auto">
        <div
          className="text-[10px] uppercase tracking-[0.32em] text-slate-500 text-center mb-6"
          style={{ fontFamily: "'JetBrains Mono', monospace" }}
        >
          Ships with
        </div>
        <div className="flex flex-wrap justify-center gap-2.5">
          {domains.map((d, i) => (
            <motion.div
              key={d.name}
              initial={{ opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.45, ease: easeOut, delay: i * 0.06 }}
              whileHover={{ y: -2 }}
              className="group relative flex items-center gap-2 px-3.5 py-1.5 rounded-full
                         bg-[#111E30]/60 ring-1 ring-white/[0.06] text-xs text-slate-300
                         transition-colors hover:bg-[#111E30]/90 hover:ring-white/[0.12]"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              <motion.span
                className="block w-1.5 h-1.5 rounded-full"
                style={{ background: d.color, boxShadow: `0 0 6px ${d.color}` }}
                animate={{ opacity: [0.55, 1, 0.55] }}
                transition={{
                  duration: 2.2, repeat: Infinity, ease: "easeInOut", delay: i * 0.3,
                }}
              />
              {d.name}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

// ─── How-it-works card icons ────────────────────────────────────────────────

// 1 · animated stack of three blocks settling into a tower
const BlockStackIcon = () => {
  const blocks = [
    { color: "#b794f4", topColor: "#d0b4ff", sideColor: "#8e6dc8", delay: 0.0 },
    { color: "#6d8cf0", topColor: "#8ba6ff", sideColor: "#4e6cc2", delay: 0.45 },
    { color: "#8b7fd8", topColor: "#a89cee", sideColor: "#6d63b8", delay: 0.9 },
  ];
  const baseY = [62, 44, 26];
  return (
    <svg viewBox="0 0 96 96" className="w-full h-full" overflow="visible">
      <defs>
        <linearGradient id="bsGround" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stopColor="rgba(42,38,80,0)" />
          <stop offset="50%" stopColor="rgba(42,38,80,0.6)" />
          <stop offset="100%" stopColor="rgba(42,38,80,0)" />
        </linearGradient>
      </defs>
      <rect x="14" y="82" width="68" height="2" fill="url(#bsGround)" rx="1" />
      {blocks.map((b, i) => (
        <motion.g
          key={i}
          initial={{ y: -28, opacity: 0 }}
          animate={{ y: [-28, 0, 0, -28], opacity: [0, 1, 1, 0] }}
          transition={{
            duration: 4.2, repeat: Infinity, ease: easeOut,
            times: [0, 0.18, 0.85, 1], delay: b.delay,
          }}
        >
          <rect x="32" y={baseY[i]} width="32" height="16" fill={b.sideColor} rx="1.5" />
          <rect x="32" y={baseY[i]} width="32" height="3" fill={b.topColor} rx="1.5" />
          <rect x="32" y={baseY[i] + 3} width="32" height="13" fill={b.color} />
          <rect
            x="32.5" y={baseY[i] + 0.5}
            width="31" height="15"
            fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="0.6" rx="1"
          />
        </motion.g>
      ))}
    </svg>
  );
};

// 2 · search-tree node graph that pulses outward from a root
const SearchGraphIcon = () => {
  const edges = [
    { x1: 48, y1: 26, x2: 28, y2: 52, delay: 0.2 },
    { x1: 48, y1: 26, x2: 68, y2: 52, delay: 0.2 },
    { x1: 28, y1: 52, x2: 18, y2: 76, delay: 0.7 },
    { x1: 28, y1: 52, x2: 38, y2: 76, delay: 0.7 },
    { x1: 68, y1: 52, x2: 58, y2: 76, delay: 1.2 },
    { x1: 68, y1: 52, x2: 78, y2: 76, delay: 1.2 },
  ];
  const nodes = [
    { cx: 48, cy: 26, color: "#22C55E", delay: 0.0 },
    { cx: 28, cy: 52, color: "#a78bfa", delay: 0.35 },
    { cx: 68, cy: 52, color: "#7dd3fc", delay: 0.35 },
    { cx: 18, cy: 76, color: "#d8b4fe", delay: 0.85 },
    { cx: 38, cy: 76, color: "#d8b4fe", delay: 0.85 },
    { cx: 58, cy: 76, color: "#d8b4fe", delay: 0.85 },
    { cx: 78, cy: 76, color: "#d8b4fe", delay: 0.85 },
  ];
  return (
    <svg viewBox="0 0 96 96" className="w-full h-full" overflow="visible">
      {edges.map((e, i) => (
        <motion.line
          key={i}
          x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2}
          stroke="rgba(167,139,250,0.45)" strokeWidth="1.2" strokeLinecap="round"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: [0, 1, 1, 0], opacity: [0, 0.85, 0.85, 0] }}
          transition={{
            duration: 4.0, repeat: Infinity, ease: "easeInOut",
            times: [0, 0.35, 0.85, 1], delay: e.delay,
          }}
        />
      ))}
      {nodes.map((n, i) => (
        <motion.circle
          key={i}
          cx={n.cx} cy={n.cy} r="4.5"
          fill={n.color}
          initial={{ opacity: 0, scale: 0.4 }}
          animate={{ opacity: [0, 1, 1, 0], scale: [0.4, 1.2, 1, 0.6] }}
          transition={{
            duration: 4.0, repeat: Infinity, ease: easeOut,
            times: [0, 0.25, 0.85, 1], delay: n.delay,
          }}
          style={{ transformOrigin: `${n.cx}px ${n.cy}px` }}
        />
      ))}
    </svg>
  );
};

// 3 · playback bar with a dot that scrubs and tick marks for each plan step
const PlaybackIcon = () => {
  const ticks = [16, 28, 40, 52, 64, 76];
  return (
    <svg viewBox="0 0 96 96" className="w-full h-full" overflow="visible">
      <rect x="10" y="18" width="76" height="42" rx="3"
        fill="rgba(17,30,48,0.6)"
        stroke="rgba(125,211,252,0.25)" strokeWidth="1" />
      <rect x="22" y="40" width="14" height="14" fill="#b794f4" rx="1" />
      <rect x="22" y="26" width="14" height="14" fill="#6d8cf0" rx="1" />
      <rect x="46" y="40" width="14" height="14" fill="#8b7fd8" rx="1" />
      <motion.rect
        y="22" width="6" height="36"
        fill="rgba(167,139,250,0.18)"
        animate={{ x: [12, 80, 12] }}
        transition={{ duration: 3.6, repeat: Infinity, ease: "easeInOut" }}
      />
      <rect x="14" y="74" width="68" height="2" rx="1" fill="rgba(255,255,255,0.08)" />
      {ticks.map((tx, i) => (
        <rect key={i} x={tx} y="71" width="1" height="8"
          fill="rgba(255,255,255,0.15)" rx="0.5" />
      ))}
      <motion.rect
        x="14" y="74" height="2" rx="1"
        fill="#22C55E"
        animate={{ width: [0, 68, 68, 0] }}
        transition={{
          duration: 3.6, repeat: Infinity, ease: "easeInOut",
          times: [0, 0.6, 0.85, 1],
        }}
      />
      <motion.circle
        cy="75" r="3"
        fill="#22C55E"
        animate={{ cx: [14, 82, 82, 14] }}
        transition={{
          duration: 3.6, repeat: Infinity, ease: "easeInOut",
          times: [0, 0.6, 0.85, 1],
        }}
        style={{ filter: "drop-shadow(0 0 6px rgba(34,197,94,0.55))" }}
      />
    </svg>
  );
};

// ─── Card primitive ─────────────────────────────────────────────────────────
const Step = ({
  n, title, body, IconCmp, delay, accent,
}: {
  n: string;
  title: string;
  body: string;
  IconCmp: React.ComponentType;
  delay: number;
  accent: string;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 24 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: "-80px" }}
    transition={{ duration: 0.55, ease: easeOut, delay }}
    whileHover={{ y: -4 }}
    className="group relative rounded-2xl p-7 ring-1 ring-white/[0.06] bg-[#111E30]/60 backdrop-blur-sm
               transition-colors hover:ring-white/[0.12] hover:bg-[#111E30]/85 overflow-hidden"
  >
    {/* top-edge accent line — fades in when card enters */}
    <motion.div
      initial={{ scaleX: 0, opacity: 0 }}
      whileInView={{ scaleX: 1, opacity: 1 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.7, ease: easeOut, delay: delay + 0.25 }}
      className="absolute top-0 left-6 right-6 h-px origin-left"
      style={{ background: `linear-gradient(90deg, ${accent}, transparent 80%)` }}
    />

    {/* corner glow on hover */}
    <div
      className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
      style={{
        background:
          "radial-gradient(circle at 30% 0%, rgba(167,139,250,0.12) 0%, transparent 60%)",
      }}
    />

    <div className="relative w-20 h-20 mb-6">
      <IconCmp />
    </div>
    <div
      className="text-[11px] uppercase tracking-[0.22em] mb-2"
      style={{ color: accent, fontFamily: "'JetBrains Mono', monospace" }}
    >
      {n}
    </div>
    <h3 className="text-lg font-semibold text-slate-100 tracking-tight mb-2">
      {title}
    </h3>
    <p className="text-sm text-slate-400 leading-relaxed">{body}</p>

    {/* hover-revealed Open hint */}
    <div className="mt-5 h-5 overflow-hidden">
      <div
        className="flex items-center gap-1.5 text-xs font-medium translate-y-2 opacity-0
                   group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300"
        style={{ color: accent }}
      >
        <span>Open</span>
        <span className="transition-transform duration-200 group-hover:translate-x-1">→</span>
      </div>
    </div>
  </motion.div>
);

// ─── Page ───────────────────────────────────────────────────────────────────
export default function Welcome() {
  const [, navigate] = useLocation();
  const reduceMotion = useReducedMotion() ?? false;
  const go = () => navigate("/visualizer");

  // ── Study-mode session start (facilitator) ────────────────────────────────
  const { startSession } = useStudyMode();
  const [showStudyPrompt, setShowStudyPrompt] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const [intake, setIntake] = useState<StudyIntake>({
    participantId: "",
    profile: null,
    studyDate: today,
    facilitator: "",
    noteTaker: "",
    mode: null,
  });
  const setIntakeField = <K extends keyof StudyIntake>(k: K, v: StudyIntake[K]) =>
    setIntake((prev) => ({ ...prev, [k]: v }));
  const beginStudy = () => {
    if (!intake.participantId.trim()) return;
    startSession(intake);
    setShowStudyPrompt(false);
    navigate("/visualizer");
  };

  // Enter / ⌘K opens the visualizer from anywhere on the welcome page
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName ?? "";
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (
        e.key === "Enter" ||
        (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey))
      ) {
        e.preventDefault();
        navigate("/visualizer");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate]);

  // entrance stagger — disabled to a single quick fade when the user prefers
  // reduced motion.
  const stagger = (i: number) => ({
    initial: { opacity: 0, y: reduceMotion ? 0 : 8 },
    animate: { opacity: 1, y: 0 },
    transition: {
      duration: reduceMotion ? 0.2 : 0.42,
      ease: easeOut,
      delay: reduceMotion ? 0 : 0.05 + i * 0.075,
    },
  });

  return (
    <div className="min-h-screen w-full bg-[#0B1524] text-slate-100 overflow-x-hidden">
      <ScrollProgress />
      <StickyNav onOpen={go} />

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      {/*
        Single full-bleed PDDL canvas in welcome-hero mode draws:
          • dissolving PDDL code on the far LEFT
          • blocks-world animation, vertically centred, on the far RIGHT
          • particle bubbles flying continuously from code → blocks so they
            stay visible THROUGH the centre column
        The summary content is layered on top in the middle. The two
        translucent column-edge masks keep the code and blocks reading as
        anchored to their sides without hiding the in-flight particles.
      */}
      <section className="relative min-h-screen overflow-hidden">
        {/* Full-bleed animated backdrop */}
        <div className="absolute inset-0 pointer-events-none">
          <PDDLHeaderBackground view="welcome-hero" />
        </div>

        {/* radial glow that anchors the centre column. Stops short before
            the side columns so particles, code, and blocks stay vivid. */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 32% 48% at 50% 44%, rgba(167,139,250,0.18) 0%, rgba(11,21,36,0) 72%)",
          }}
        />

        {/* hair-thin vignette so the bottom fades into the next section */}
        <div
          className="absolute inset-x-0 bottom-0 h-40 pointer-events-none z-20"
          style={{
            background:
              "linear-gradient(to bottom, rgba(11,21,36,0) 0%, rgba(11,21,36,0.85) 70%, #0B1524 100%)",
          }}
        />

        {/* Mono column labels — sit on top of the canvas, hidden on small screens */}
        <div
          className="hidden lg:block absolute top-7 left-7 text-[9px] uppercase tracking-[0.32em] text-slate-600 z-10"
          style={{ fontFamily: "'JetBrains Mono', monospace" }}
        >
          ◌ Domain · Problem
        </div>
        <div
          className="hidden lg:block absolute top-7 right-7 text-[9px] uppercase tracking-[0.32em] text-slate-600 z-10"
          style={{ fontFamily: "'JetBrains Mono', monospace" }}
        >
          Plan · Playback ◌
        </div>

        {/* Centred summary — overlays the canvas. Width is capped so the
            code on the left and the blocks on the right are never covered. */}
        <div className="relative z-10 min-h-screen flex items-center justify-center px-6 py-20">
          <div className="flex flex-col items-center text-center max-w-[540px]">
            <motion.div {...stagger(0)}>
              <BrandMark size={140} />
            </motion.div>

            <motion.div {...stagger(1)} className="mt-7">
              <TypingEyebrow text="PDDL · CLASSICAL PLANNING" delay={0.4} disabled={reduceMotion} />
            </motion.div>

            <RevealHeadline disabled={reduceMotion} />

            <motion.p
              {...stagger(6)}
              className="mt-6 max-w-[52ch] text-base text-slate-400 leading-relaxed"
            >
              Write or upload a PDDL domain and problem. Watch a real planner
              solve it, then play every action back step-by-step on an animated
              canvas. For custom domains, an LLM auto-generates the renderer —
              so you never wire up draw code.
            </motion.p>

            <motion.div
              {...stagger(7)}
              className="mt-9 flex flex-col sm:flex-row items-center gap-3"
            >
              <Button
                size="lg"
                onClick={go}
                className="group relative overflow-hidden"
              >
                <span className="relative z-10">Open the visualizer</span>
                <span className="relative z-10 transition-transform duration-200 group-hover:translate-x-1">→</span>
                <motion.span
                  aria-hidden
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background:
                      "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.18) 50%, transparent 100%)",
                  }}
                  animate={reduceMotion ? undefined : { x: ["-100%", "200%"] }}
                  transition={{
                    duration: 2.4, repeat: Infinity, ease: "linear", repeatDelay: 1.6,
                  }}
                />
              </Button>
              <Button
                size="lg"
                variant="ghost"
                onClick={go}
                className="text-slate-300 hover:text-slate-100"
              >
                See an example
              </Button>
            </motion.div>

            {/* keyboard hint */}
            <motion.div
              {...stagger(8)}
              className="mt-6 flex items-center gap-2 text-[10px] uppercase tracking-[0.28em] text-slate-500"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              <span>Press</span>
              <kbd className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-md
                            bg-[#0F1A2E] ring-1 ring-white/[0.08] text-[10px] text-slate-200 tracking-normal">
                ↵
              </kbd>
              <span>to open</span>
            </motion.div>

            <motion.button
              {...stagger(9)}
              type="button"
              onClick={() => setShowStudyPrompt(true)}
              className="mt-8 text-[10px] uppercase tracking-[0.28em] text-slate-500 hover:text-purple-300 transition-colors underline underline-offset-4 decoration-dotted"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              ◔ Start study session
            </motion.button>

            <motion.div
              {...stagger(10)}
              className="mt-10 text-[10px] uppercase tracking-[0.28em] text-slate-600"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              Built for AI planning research · v1
            </motion.div>
          </div>
        </div>

        {/* scroll hint */}
        <motion.div
          className="absolute bottom-7 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5 text-slate-500 z-30"
          animate={reduceMotion ? undefined : { y: [0, 6, 0], opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
        >
          <span
            className="text-[9px] uppercase tracking-[0.32em]"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            scroll
          </span>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path
              d="M3 5l4 4 4-4"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </motion.div>
      </section>

      {/* ── STAT STRIP ───────────────────────────────────────────────────── */}
      <StatStrip disabled={reduceMotion} />

      {/* ── HOW IT WORKS ─────────────────────────────────────────────────── */}
      <section className="relative py-24 px-6">
        <motion.div
          initial={{ scaleX: 0, opacity: 0 }}
          whileInView={{ scaleX: 1, opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, ease: easeOut }}
          className="absolute top-0 left-1/2 -translate-x-1/2 h-px w-[min(560px,80%)] origin-center"
          style={{
            background:
              "linear-gradient(90deg, transparent 0%, rgba(167,139,250,0.35) 50%, transparent 100%)",
          }}
        />

        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.55, ease: easeOut }}
            className="mb-14 text-center"
          >
            <div
              className="text-[11px] uppercase tracking-[0.32em] text-purple-300/85 mb-3"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              How it works
            </div>
            <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-slate-100">
              Three steps from problem to playback.
            </h2>
          </motion.div>

          <div className="grid gap-6 md:grid-cols-3">
            <Step
              n="01 · Pick"
              title="Choose a domain"
              body="Start with Blocks World, Gripper, Depot, Hanoi, or Rovers — or paste your own PDDL domain and problem."
              IconCmp={BlockStackIcon}
              delay={0}
              accent="#a78bfa"
            />
            <Step
              n="02 · Plan"
              title="Run a real planner"
              body="Fast Downward solves it with the search strategy you pick — A* with LM-Cut, lazy greedy, weighted A*, and more."
              IconCmp={SearchGraphIcon}
              delay={0.12}
              accent="#7dd3fc"
            />
            <Step
              n="03 · Watch"
              title="Animate the plan"
              body="Scrub, pause, and replay every action on a canvas. Custom domains get a renderer auto-generated by Claude or Gemini."
              IconCmp={PlaybackIcon}
              delay={0.24}
              accent="#22c55e"
            />
          </div>
        </div>
      </section>

      {/* ── DOMAIN CHIPS ─────────────────────────────────────────────────── */}
      <DomainChips />

      {/* ── CLOSING CTA ──────────────────────────────────────────────────── */}
      <section className="relative py-24 px-6">
        <motion.div
          initial={{ scaleX: 0, opacity: 0 }}
          whileInView={{ scaleX: 1, opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, ease: easeOut }}
          className="absolute top-0 left-1/2 -translate-x-1/2 h-px w-[min(560px,80%)] origin-center"
          style={{
            background:
              "linear-gradient(90deg, transparent 0%, rgba(125,211,252,0.32) 50%, transparent 100%)",
          }}
        />

        {/* faint radial glow framing the CTA card */}
        <div
          className="absolute inset-x-0 top-12 mx-auto h-72 w-[min(720px,90%)] pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse at 50% 30%, rgba(34,197,94,0.10) 0%, transparent 60%)",
          }}
        />

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.55, ease: easeOut }}
          className="relative max-w-2xl mx-auto text-center"
        >
          <div
            className="text-[11px] uppercase tracking-[0.32em] text-purple-300/85 mb-4"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            Ready?
          </div>
          <h3 className="text-2xl sm:text-3xl font-semibold tracking-tight text-slate-100 mb-7">
            Drop in a domain — let's see it move.
          </h3>
          <Button size="xl" onClick={go} className="group">
            <span>Open the visualizer</span>
            <span className="transition-transform duration-200 group-hover:translate-x-1">→</span>
          </Button>
          <p
            className="mt-6 text-[11px] text-slate-600"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            localhost:5173/visualizer
          </p>
        </motion.div>
      </section>

      {/* ── STUDY-SESSION INTAKE FORM ─────────────────────────────────────── */}
      <AnimatePresence>
        {showStudyPrompt && (
          <motion.div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              onClick={() => setShowStudyPrompt(false)}
            />
            <motion.div
              className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-white/[0.08] bg-[#0F1A2E] p-7 shadow-2xl"
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 4 }}
              transition={{ type: "spring", stiffness: 380, damping: 34 }}
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              <div className="text-[10px] uppercase tracking-[0.28em] text-purple-300/85 mb-2">
                Study session
              </div>
              <h3 className="text-lg font-semibold text-slate-100" style={{ fontFamily: "inherit" }}>
                Participant intake
              </h3>
              <p className="mt-1 text-xs text-slate-400">
                Filled by the facilitator. Saved with the SUS survey at the end.
              </p>

              <div className="mt-5 space-y-4 text-sm">
                {/* Participant ID */}
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Participant ID *</label>
                  <input
                    type="text"
                    autoFocus
                    value={intake.participantId}
                    onChange={(e) => setIntakeField("participantId", e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") beginStudy(); }}
                    placeholder="e.g. P-07"
                    className="w-full px-3 py-2 text-sm bg-white/[0.04] border border-white/[0.1] rounded-lg text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-purple-400/50"
                  />
                </div>

                {/* Profile */}
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1.5">Profile</label>
                  <div className="grid grid-cols-2 gap-2">
                    {([
                      { v: "lab_researcher", label: "Lab researcher" },
                      { v: "cs_student", label: "CS student (no PDDL)" },
                    ] as const).map((opt) => (
                      <button
                        key={opt.v}
                        type="button"
                        onClick={() => setIntakeField("profile", intake.profile === opt.v ? null : opt.v)}
                        className={`px-3 py-2 rounded-lg border text-xs transition-colors ${
                          intake.profile === opt.v
                            ? "border-emerald-400/60 bg-emerald-500/15 text-emerald-200"
                            : "border-white/[0.08] bg-white/[0.02] text-slate-400 hover:bg-white/[0.06]"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Date + Mode */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Date</label>
                    <input
                      type="date"
                      value={intake.studyDate}
                      onChange={(e) => setIntakeField("studyDate", e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-white/[0.04] border border-white/[0.1] rounded-lg text-slate-100 focus:outline-none focus:border-purple-400/50 [color-scheme:dark]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1.5">Mode</label>
                    <div className="grid grid-cols-2 gap-2">
                      {([
                        { v: "in_person", label: "In-person" },
                        { v: "remote", label: "Remote" },
                      ] as const).map((opt) => (
                        <button
                          key={opt.v}
                          type="button"
                          onClick={() => setIntakeField("mode", intake.mode === opt.v ? null : opt.v)}
                          className={`px-2 py-2 rounded-lg border text-xs transition-colors ${
                            intake.mode === opt.v
                              ? "border-emerald-400/60 bg-emerald-500/15 text-emerald-200"
                              : "border-white/[0.08] bg-white/[0.02] text-slate-400 hover:bg-white/[0.06]"
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Facilitator + Note-taker */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Facilitator</label>
                    <input
                      type="text"
                      value={intake.facilitator}
                      onChange={(e) => setIntakeField("facilitator", e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-white/[0.04] border border-white/[0.1] rounded-lg text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-purple-400/50"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Note-taker</label>
                    <input
                      type="text"
                      value={intake.noteTaker}
                      onChange={(e) => setIntakeField("noteTaker", e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-white/[0.04] border border-white/[0.1] rounded-lg text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-purple-400/50"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-6 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => navigate("/study-results")}
                  className="text-[11px] text-slate-500 hover:text-purple-300 underline underline-offset-2 transition-colors"
                >
                  View all results →
                </button>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setShowStudyPrompt(false)}
                    className="px-4 py-2 text-xs font-medium rounded-lg text-slate-400 hover:text-slate-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={beginStudy}
                    disabled={!intake.participantId.trim()}
                    className="px-5 py-2 text-xs font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    Begin session →
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
