import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence, useMotionValue, useMotionValueEvent, animate as motionAnimate } from "framer-motion";
import { trpc } from "@/lib/trpc";
import { Textarea } from "@/components/ui/textarea";
import { StateCanvas } from "@/components/StateCanvas";
import {
  PlayIcon, PauseIcon, SkipForwardIcon, SkipBackIcon,
  UploadIcon, FileCodeIcon, AlertIcon, ClockIcon, ZapIcon,
  SettingsIcon, CpuIcon, CheckCircleIcon, XCircleIcon,
  ChevronDownIcon, WandIcon, RefreshIcon, BrainIcon,
  TrashIcon, HistoryIcon, MenuIcon, CloseIcon, TerminalIcon,
  BlocksWorldIcon, GripperIcon, DepotIcon, HanoiIcon, RoverIcon, SatelliteIcon,
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
    <svg viewBox="0 0 320 200" className="w-full max-w-sm"
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
  <div className="flex bg-white/[0.05] rounded-lg p-0.5 border border-white/[0.06]">
    {options.map(o => (
      <button key={o.id} onClick={() => onChange(o.id)}
        className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-md text-xs font-medium transition-all duration-150 ${
          value === o.id ? "bg-white/[0.08] text-slate-100 shadow-sm" : "text-slate-500 hover:text-slate-300"
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
  const [showStatus, setShowStatus]             = useState(false);
  const [elapsedTime, setElapsedTime]           = useState(0);
  const [isProcessing, setIsProcessing]         = useState(false);
  const [isDomainOpen, setIsDomainOpen]         = useState(true);
  const [isStrategyOpen, setIsStrategyOpen]     = useState(false);
  const [showExampleProblem, setShowExampleProblem]     = useState(false);
  const [showDomainDefinition, setShowDomainDefinition] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed]     = useState(false);
  const [showSuccessFlash, setShowSuccessFlash]         = useState(false);

  const playbackIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const planStepsRef        = useRef<HTMLDivElement>(null);

  // LLM Renderer state
  const [renderMode, setRenderMode]           = useState<"basic" | "llm">("basic");
  const [llmProvider, setLlmProvider]         = useState<"claude" | "gemini">("claude");
  const [llmRendererCode, setLlmRendererCode] = useState<string | null>(null);
  const [isLlmGenerating, setIsLlmGenerating] = useState(false);
  const [llmError, setLlmError]               = useState<string | null>(null);
  const [llmModelInfo, setLlmModelInfo]       = useState<string | null>(null);
  const [showCachedRenderers, setShowCachedRenderers] = useState(false);
  const [selectedCachedFile, setSelectedCachedFile]   = useState<string | null>(null);

  const [errorModal, setErrorModal] = useState<{
    show: boolean; title: string; message: string;
    errorType?: string; suggestedDomain?: string; suggestedDomainName?: string;
  }>({ show: false, title: "", message: "" });

  const strategiesQuery      = trpc.visualizer.listStrategies.useQuery();
  const statusQuery          = trpc.visualizer.checkStatus.useQuery(undefined, { enabled: showStatus });
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
    setProblemType("example"); setProblemFile(null); setProblemText(""); setInputMode("file");
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
        setSelectedCachedFile(data.savedFile || null);
        cachedRenderersQuery.refetch();
      }
    },
    onError: (error: any) => { setIsLlmGenerating(false); setLlmError(error.message || "Failed to generate LLM renderer"); },
  });

  const cachedRenderersQuery = trpc.visualizer.llmListCachedRenderers.useQuery(
    { domain: selectedDomain }, { enabled: renderMode === "llm" }
  );

  const deleteCachedMutation = trpc.visualizer.llmDeleteCachedRenderer.useMutation({
    onSuccess: () => cachedRenderersQuery.refetch(),
  });

  const handleLlmGenerate = () => {
    if (renderedStates.length === 0) { setLlmError("Generate states first, then switch to LLM mode."); return; }
    setIsLlmGenerating(true); setLlmError(null); setLlmRendererCode(null); setSelectedCachedFile(null);
    llmGenerateMutation.mutate({ domainName: selectedDomain, states: renderedStates.slice(0, 3), provider: llmProvider });
  };

  const handleLoadCachedRenderer = async (filename: string) => {
    try {
      setLlmError(null);
      const res  = await fetch(`/api/trpc/visualizer.llmLoadCachedRenderer?input=${encodeURIComponent(JSON.stringify({ json: { filename } }))}`);
      const json = await res.json();
      const data = json?.result?.data?.json;
      if (data?.code) {
        setLlmRendererCode(data.code); setSelectedCachedFile(filename);
        const parts = filename.replace('.ts','').split('_');
        setLlmModelInfo(`Cached (${parts.length >= 2 ? parts[parts.length - 2] : 'unknown'})`);
      } else setLlmError("Failed to load cached renderer");
    } catch (e: any) { setLlmError(e.message || "Failed to load cached renderer"); }
  };

  const handleDeleteCachedRenderer = (filename: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (selectedCachedFile === filename) { setLlmRendererCode(null); setSelectedCachedFile(null); setLlmModelInfo(null); }
    deleteCachedMutation.mutate({ filename });
  };

  useEffect(() => { setLlmRendererCode(null); setLlmError(null); setLlmModelInfo(null); setSelectedCachedFile(null); }, [selectedDomain]);
  useEffect(() => { if (renderMode === "llm") cachedRenderersQuery.refetch(); }, [renderMode, selectedDomain]);

  const handleGenerate = () => {
    setIsProcessing(true);
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
      <header className="border-b border-white/[0.06] bg-[#0B1524]/90 backdrop-blur-md sticky top-0"
        style={{ zIndex: 40 }}>
        <div className="container max-w-7xl py-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* Logo mark */}
              <motion.div
                className="w-8 h-8 rounded-lg bg-green-500 flex items-center justify-center flex-shrink-0"
                style={{ boxShadow: "0 0 0 1px rgba(34,197,94,0.5), 0 4px 16px rgba(34,197,94,0.3)" }}
                animate={{ boxShadow: [
                  "0 0 0 1px rgba(34,197,94,0.5), 0 4px 16px rgba(34,197,94,0.3)",
                  "0 0 0 3px rgba(34,197,94,0.15), 0 4px 24px rgba(34,197,94,0.45)",
                  "0 0 0 1px rgba(34,197,94,0.5), 0 4px 16px rgba(34,197,94,0.3)",
                ]}}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              >
                <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4">
                  <path d="M2 4h12M2 8h8M2 12h10" stroke="#0B1524" strokeWidth="1.75" strokeLinecap="round" />
                </svg>
              </motion.div>
              <div>
                <h1 className="text-[15px] font-semibold leading-none tracking-tight"
                  style={{ fontFamily: "'JetBrains Mono', monospace", background: "linear-gradient(90deg, #ffffff 0%, #86efac 60%, #4ade80 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
                  Planning Visualizer
                </h1>
                <p className="text-[10px] text-slate-500 font-medium tracking-[0.18em] uppercase mt-0.5">
                  Classical AI Planning
                </p>
              </div>
            </div>

            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => setShowStatus(!showStatus)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium border transition-colors ${
                showStatus
                  ? "bg-green-500/10 text-green-400 border-green-500/25"
                  : "bg-white/[0.04] text-slate-400 border-white/[0.08] hover:text-slate-200 hover:border-white/[0.14]"
              }`}
            >
              <SettingsIcon className="w-3.5 h-3.5" />
              System Status
            </motion.button>
          </div>
        </div>
      </header>

      <main className="container max-w-7xl py-8" style={{ position: "relative", zIndex: 1 }}>

        {/* ── System Status Panel ── */}
        <AnimatePresence>
          {showStatus && (
            <motion.div {...fadeInUp} transition={{ duration: 0.22, ease: easeOut }} className="mb-6">
              <div className="rounded-2xl border border-white/[0.07] bg-[#111E30] overflow-hidden"
                style={{ boxShadow: "0 1px 0 rgba(255,255,255,0.04) inset" }}>
                <div className="px-6 py-4 border-b border-white/[0.05] bg-white/[0.02]">
                  <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                    <CpuIcon className="w-4 h-4 text-green-500" />
                    System Status
                  </h2>
                </div>
                <div className="p-6">
                  {statusQuery.isLoading ? (
                    <div className="flex items-center gap-3 text-sm text-slate-500">
                      <div className="w-4 h-4 border-2 border-green-500/30 border-t-green-500 rounded-full animate-spin" />
                      Checking system status...
                    </div>
                  ) : statusQuery.data ? (
                    <div className="grid md:grid-cols-2 gap-4">
                      {[
                        { label: "Python", ok: statusQuery.data.python.available, detail: statusQuery.data.python.available ? `Version ${statusQuery.data.python.version}` : "Python 3.11+ required" },
                        { label: "Fast Downward", ok: statusQuery.data.fastDownward.available, detail: statusQuery.data.fastDownward.available ? "Planner available" : "./build.py", isCode: !statusQuery.data.fastDownward.available },
                      ].map(({ label, ok, detail, isCode }) => (
                        <div key={label} className={`p-4 rounded-xl border flex items-start gap-3 ${ok ? "bg-green-500/8 border-green-500/20" : "bg-red-500/8 border-red-500/20"}`}>
                          {ok
                            ? <CheckCircleIcon className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                            : <XCircleIcon    className="w-4 h-4 text-red-400  mt-0.5 flex-shrink-0" />}
                          <div>
                            <div className="text-sm font-semibold text-slate-200">{label} {ok ? "Ready" : "Not Found"}</div>
                            <div className={`text-xs mt-0.5 ${ok ? "text-slate-500" : "text-red-400"}`}>
                              {isCode
                                ? <code className="bg-red-500/15 px-1.5 py-0.5 rounded font-mono">{detail}</code>
                                : detail}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-red-400">Failed to check system status</p>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

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
                className="w-full lg:w-[300px] lg:flex-shrink-0 flex flex-col gap-4"
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
                  <div className="px-4 py-2.5 flex items-center gap-2 border-b border-white/[0.05]"
                    style={{ background: "rgba(11,21,36,0.6)" }}>
                    <SettingsIcon className="w-3 h-3 text-slate-600" />
                    <span className="text-[10px] font-semibold tracking-[0.15em] uppercase text-slate-600"
                      style={{ fontFamily: "'JetBrains Mono', monospace" }}>Configure</span>
                    <div className="flex-1" />
                    {/* Step progress pips */}
                    <div className="flex items-center gap-1">
                      {[
                        domainColors[selectedDomain]?.dotColor ?? "#22c55e",
                        "#0EA5E9",
                        "#8B5CF6",
                      ].map((c, i) => (
                        <div key={i} className="w-1.5 h-1.5 rounded-full"
                          style={{ background: c, boxShadow: `0 0 4px ${c}` }} />
                      ))}
                    </div>
                  </div>

                  {/* ── Step 1: Domain ── */}
                  <div>
                    <button onClick={() => setIsDomainOpen(!isDomainOpen)}
                      className="w-full px-4 py-3.5 flex items-center gap-3 hover:bg-white/[0.025] transition-colors">
                      {/* Step badge */}
                      <div className="w-5 h-5 rounded-full border border-white/[0.1] flex items-center justify-center flex-shrink-0"
                        style={{ background: "rgba(255,255,255,0.04)" }}>
                        <span className="text-[9px] font-bold text-slate-500"
                          style={{ fontFamily: "'JetBrains Mono', monospace" }}>1</span>
                      </div>
                      {/* Domain color bar */}
                      <div className="w-1 h-5 rounded-full flex-shrink-0 transition-all"
                        style={{ background: `linear-gradient(to bottom, ${domainColors[selectedDomain]?.iconColor ?? "#4ade80"}, ${domainColors[selectedDomain]?.dotColor ?? "#22c55e"})` }} />
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span className="text-sm font-semibold text-slate-200 flex-shrink-0"
                          style={{ fontFamily: "'JetBrains Mono', monospace" }}>Domain</span>
                        <motion.span
                          key={selectedDomain}
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="text-xs font-semibold px-2 py-0.5 rounded-full truncate"
                          style={{ color: domainColors[selectedDomain]?.nameColor ?? "#4ade80", background: domainColors[selectedDomain]?.selBg ?? "rgba(34,197,94,0.1)", border: `1px solid ${domainColors[selectedDomain]?.selBorder ?? "rgba(34,197,94,0.25)"}` }}
                        >
                          {currentDomain?.name}
                        </motion.span>
                      </div>
                      <motion.div animate={{ rotate: isDomainOpen ? 0 : -90 }} transition={{ duration: 0.18, ease: easeOut }}>
                        <ChevronDownIcon className="w-4 h-4 text-slate-600" />
                      </motion.div>
                    </button>

                    <CollapseSection open={isDomainOpen}>
                      <div className="px-3 pb-4 pt-1 border-t border-white/[0.04]">
                        <motion.div className="space-y-0.5" variants={listStagger} initial="initial" animate="animate">
                          {domains.map(domain => {
                            const DomainIcon = domain.Icon;
                            const sel = selectedDomain === domain.id;
                            return (
                              <motion.button
                                key={domain.id}
                                variants={listItem}
                                transition={{ duration: 0.18, ease: easeOut }}
                                onClick={() => setSelectedDomain(domain.id)}
                                whileTap={{ scale: 0.98 }}
                                whileHover={!sel ? { x: 2 } : undefined}
                                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all border"
                                style={sel ? { background: domainColors[domain.id]?.selBg, borderColor: domainColors[domain.id]?.selBorder } : { borderColor: "transparent" }}
                              >
                                <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors"
                                  style={{ background: sel ? domainColors[domain.id]?.iconBg : "rgba(255,255,255,0.06)" }}>
                                  <span style={{ color: sel ? domainColors[domain.id]?.iconColor : "#64748B", display: "contents" }}>
                                    <DomainIcon className="w-3.5 h-3.5 transition-colors" />
                                  </span>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm font-medium leading-none transition-colors"
                                    style={{ fontFamily: "'JetBrains Mono', monospace", color: sel ? domainColors[domain.id]?.nameColor : "#CBD5E1" }}>
                                    {domain.name}
                                  </div>
                                  <div className="text-[11px] text-slate-600 truncate mt-0.5">{domain.description}</div>
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
                          className="w-full mt-2 px-3 py-2 text-[11px] font-medium text-slate-600 hover:text-slate-400 rounded-lg hover:bg-white/[0.04] transition-colors flex items-center justify-center gap-1.5">
                          <FileCodeIcon className="w-3 h-3" />
                          View Domain Definition
                        </button>
                      </div>
                    </CollapseSection>
                  </div>

                  {/* Divider */}
                  <div className="h-px mx-4" style={{ background: "linear-gradient(to right, transparent, rgba(255,255,255,0.06) 30%, rgba(255,255,255,0.06) 70%, transparent)" }} />

                  {/* ── Step 2: Problem ── */}
                  <div>
                    <div className="px-4 py-3.5 flex items-center gap-3">
                      <div className="w-5 h-5 rounded-full border border-white/[0.1] flex items-center justify-center flex-shrink-0"
                        style={{ background: "rgba(255,255,255,0.04)" }}>
                        <span className="text-[9px] font-bold text-slate-500"
                          style={{ fontFamily: "'JetBrains Mono', monospace" }}>2</span>
                      </div>
                      <div className="w-1 h-5 rounded-full flex-shrink-0"
                        style={{ background: "linear-gradient(to bottom, #38BDF8, #0369A1)" }} />
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
                              className="w-full px-3 py-2 text-[11px] font-medium text-slate-600 hover:text-slate-400 rounded-lg hover:bg-white/[0.04] transition-colors flex items-center justify-center gap-1.5">
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
                                {problemText && <p className="text-[10px] text-slate-600 mt-1.5">{problemText.split("\n").length} lines</p>}
                              </div>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="h-px mx-4" style={{ background: "linear-gradient(to right, transparent, rgba(255,255,255,0.06) 30%, rgba(255,255,255,0.06) 70%, transparent)" }} />

                  {/* ── Step 3: Strategy ── */}
                  <div>
                    <button onClick={() => setIsStrategyOpen(!isStrategyOpen)}
                      className="w-full px-4 py-3.5 flex items-center gap-3 hover:bg-white/[0.025] transition-colors">
                      <div className="w-5 h-5 rounded-full border border-white/[0.1] flex items-center justify-center flex-shrink-0"
                        style={{ background: "rgba(255,255,255,0.04)" }}>
                        <span className="text-[9px] font-bold text-slate-500"
                          style={{ fontFamily: "'JetBrains Mono', monospace" }}>3</span>
                      </div>
                      <div className="w-1 h-5 rounded-full flex-shrink-0"
                        style={{ background: "linear-gradient(to bottom, #A78BFA, #6D28D9)" }} />
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
                                  sel ? "bg-green-500/10 border border-green-500/[0.22]" : "border border-transparent hover:bg-white/[0.04]"
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
                                  <div className="text-[11px] text-slate-600 truncate mt-0.5">{strategy.description}</div>
                                </div>
                                {sel && <div className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0"
                                  style={{ boxShadow: "0 0 6px rgba(34,197,94,0.8)" }} />}
                              </motion.button>
                            );
                          })}
                        </motion.div>
                        {currentStrategy?.warning && (
                          <div className="mt-2 p-3 bg-amber-500/[0.08] border border-amber-500/20 rounded-xl flex items-start gap-2">
                            <AlertIcon className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
                            <p className="text-[11px] text-amber-300/70 leading-relaxed">{currentStrategy.warning}</p>
                          </div>
                        )}
                      </div>
                    </CollapseSection>
                  </div>
                </motion.div>

                {/* ── Step 4: Generate ── */}
                <div className="flex items-stretch gap-3 px-1">
                  {/* Connector line + step 4 badge */}
                  <div className="flex flex-col items-center pt-1 pb-1">
                    <div className="w-px flex-1 mb-1" style={{ background: "linear-gradient(to bottom, rgba(255,255,255,0.07), transparent)" }} />
                    <div className="w-5 h-5 rounded-full border border-white/[0.1] flex items-center justify-center flex-shrink-0"
                      style={{ background: "rgba(255,255,255,0.04)" }}>
                      <span className="text-[9px] font-bold text-slate-500"
                        style={{ fontFamily: "'JetBrains Mono', monospace" }}>4</span>
                    </div>
                  </div>
                  <div className="flex-1 pb-0.5">
                    <p className="text-[10px] text-slate-600 mb-2 font-medium" style={{ fontFamily: "'JetBrains Mono', monospace" }}>Run</p>
                    <motion.button
                      onClick={handleGenerate}
                      disabled={uploadMutation.isPending || isProcessing}
                      whileTap={!isProcessing ? { scale: 0.98 } : undefined}
                      whileHover={!isProcessing ? { y: -1 } : undefined}
                      transition={{ duration: 0.15 }}
                      className={`w-full py-4 px-6 rounded-2xl font-bold text-sm transition-all duration-200 ${
                        isProcessing
                          ? "bg-green-600/40 text-green-200/60 cursor-wait"
                          : "btn-primary-green text-[#0B1524]"
                      }`}
                      style={{ fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.04em" }}
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
                </div>

                <AnimatePresence>
                  {isProcessing && currentStrategy?.isOptimal && elapsedTime > 30 && (
                    <motion.p {...fadeInUp} transition={{ duration: 0.2, ease: easeOut }}
                      className="text-[11px] text-amber-400/70 text-center leading-relaxed px-2">
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
                className="flex items-center gap-2 px-3 py-2 rounded-lg border border-white/[0.08] bg-white/[0.03] text-slate-500 hover:text-slate-300 hover:border-white/[0.14] text-xs font-medium transition-colors"
              >
                <MenuIcon className="w-3.5 h-3.5" />
                {isSidebarCollapsed ? "Show Options" : "Hide Options"}
              </motion.button>
            </div>

            {renderedStates.length > 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, ease: easeOut }}
                className={isSidebarCollapsed ? "flex gap-5" : ""}
              >

                {/* Viz card */}
                <div className={`relative rounded-2xl border border-white/[0.07] bg-[#111E30] overflow-hidden card-accent-top ${isSidebarCollapsed ? "flex-1" : ""}`}
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
                        <p className="text-[11px] text-slate-600 mt-0.5">
                          {currentDomain?.name} &middot; {plan.length} {plan.length === 1 ? "action" : "actions"}
                        </p>
                      </div>
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
                        <span className="text-[10px] text-slate-600">Strategy:</span>
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                          plannerInfo.strategy.isOptimal ? "bg-purple-500/15 text-purple-400" : "bg-blue-500/15 text-blue-400"
                        }`}>{plannerInfo.strategy.name}</span>
                        {getSpeedBadge(plannerInfo.strategy.speed)}
                      </div>
                    )}

                    {/* Render Mode */}
                    <div className="mt-4 p-3 bg-white/[0.03] rounded-xl border border-white/[0.05]">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <BrainIcon className="w-3.5 h-3.5 text-green-500" />
                          <span className="text-xs font-medium text-slate-400">Render Mode</span>
                        </div>
                        <div className="flex items-center gap-0.5 bg-white/[0.04] rounded-lg p-0.5 border border-white/[0.06]">
                          {[
                            { id: "basic", label: "Basic" },
                            { id: "llm",   label: "LLM",   active: true },
                          ].map(m => (
                            <button key={m.id} onClick={() => setRenderMode(m.id as any)}
                              className={`px-3 py-1.5 rounded-md text-[11px] font-medium transition-all duration-150 ${
                                renderMode === m.id
                                  ? m.active ? "bg-green-600 text-white shadow-sm" : "bg-white/[0.08] text-slate-200 shadow-sm"
                                  : "text-slate-600 hover:text-slate-400"
                              }`}>
                              {m.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <CollapseSection open={renderMode === "llm"}>
                        <div className="mt-3 space-y-3">
                          <div className="flex items-center gap-3">
                            <span className="text-[11px] text-slate-600 flex-shrink-0">Model</span>
                            <div className="flex items-center gap-1 flex-1">
                              {[
                                { id: "claude", label: "Claude", active: "bg-orange-500/15 border-orange-500/30 text-orange-400" },
                                { id: "gemini", label: "Gemini", active: "bg-blue-500/15 border-blue-500/30 text-blue-400" },
                              ].map(m => (
                                <button key={m.id} onClick={() => setLlmProvider(m.id as any)}
                                  className={`flex-1 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors border ${
                                    llmProvider === m.id ? m.active : "bg-white/[0.03] border-white/[0.07] text-slate-600 hover:text-slate-400 hover:border-white/[0.12]"
                                  }`}>
                                  {m.label}
                                </button>
                              ))}
                            </div>
                          </div>

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

                          {llmRendererCode && (
                            <div className="flex items-center gap-1.5 text-[11px] text-green-400 bg-green-500/8 px-3 py-2 rounded-lg border border-green-500/20">
                              <CheckCircleIcon className="w-3 h-3 flex-shrink-0" />
                              LLM renderer active{llmModelInfo && ` — ${llmModelInfo}`}
                            </div>
                          )}
                          {llmError && (
                            <div className="flex items-start gap-1.5 text-[11px] text-red-400 bg-red-500/8 px-3 py-2 rounded-lg border border-red-500/20">
                              <AlertIcon className="w-3 h-3 mt-0.5 flex-shrink-0" />
                              <span className="leading-relaxed">{llmError}</span>
                            </div>
                          )}

                          {/* Cached Renderers */}
                          <div className="border border-white/[0.06] rounded-lg overflow-hidden">
                            <button onClick={() => setShowCachedRenderers(!showCachedRenderers)}
                              className="w-full flex items-center justify-between px-3 py-2 bg-white/[0.03] hover:bg-white/[0.05] transition-colors">
                              <div className="flex items-center gap-2 text-[11px] font-medium text-slate-500">
                                <HistoryIcon className="w-3 h-3" />
                                Cached Renderers
                                {(cachedRenderersQuery.data?.length ?? 0) > 0 && (
                                  <span className="bg-white/[0.08] text-slate-400 px-1.5 py-0.5 rounded-full text-[10px]">
                                    {cachedRenderersQuery.data?.length}
                                  </span>
                                )}
                              </div>
                              <motion.div animate={{ rotate: showCachedRenderers ? 0 : -90 }} transition={{ duration: 0.16 }}>
                                <ChevronDownIcon className="w-3 h-3 text-slate-600" />
                              </motion.div>
                            </button>
                            <CollapseSection open={showCachedRenderers}>
                              <div className="max-h-48 overflow-y-auto">
                                {cachedRenderersQuery.isLoading ? (
                                  <div className="px-3 py-4 text-center text-[11px] text-slate-600">Loading cached renderers...</div>
                                ) : !cachedRenderersQuery.data?.length ? (
                                  <div className="px-3 py-4 text-center text-[11px] text-slate-600 leading-relaxed">No cached renderers for this domain.</div>
                                ) : (
                                  <div className="divide-y divide-white/[0.04]">
                                    {cachedRenderersQuery.data.map((r: any) => (
                                      <div key={r.filename} onClick={() => handleLoadCachedRenderer(r.filename)}
                                        className={`flex items-center justify-between px-3 py-2 cursor-pointer transition-colors ${
                                          selectedCachedFile === r.filename
                                            ? "bg-green-500/8 border-l-2 border-green-500"
                                            : "hover:bg-white/[0.03] border-l-2 border-transparent"
                                        }`}>
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center gap-1.5">
                                            <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${r.provider === 'claude' ? 'bg-orange-500/15 text-orange-400' : 'bg-blue-500/15 text-blue-400'}`}>
                                              {r.provider}
                                            </span>
                                            <span className="text-[10px] text-slate-600">
                                              {new Date(r.timestamp).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                          </div>
                                        </div>
                                        <button onClick={e => handleDeleteCachedRenderer(r.filename, e)}
                                          className="p-1 rounded hover:bg-red-500/15 text-slate-700 hover:text-red-400 transition-colors ml-2 flex-shrink-0">
                                          <TrashIcon className="w-3 h-3" />
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </CollapseSection>
                          </div>
                        </div>
                      </CollapseSection>
                    </div>
                  </div>

                  {/* Canvas */}
                  <div className="p-6">
                    <StateCanvas
                      state={renderedStates[currentStateIndex]}
                      isFirst={currentStateIndex === 0}
                      isLast={currentStateIndex === renderedStates.length - 1}
                      llmRendererCode={renderMode === "llm" && llmRendererCode ? llmRendererCode : undefined}
                      onLlmError={err => setLlmError(err)}
                    />
                  </div>

                  {/* Controls */}
                  <div className="px-6 py-4 border-t border-white/[0.05] bg-black/[0.15] space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-0.5 bg-white/[0.04] rounded-xl border border-white/[0.06] p-1">
                        <motion.button onClick={handlePrevious} disabled={currentStateIndex === 0}
                          whileTap={{ scale: 0.92 }}
                          className="p-2 rounded-lg hover:bg-white/[0.06] disabled:opacity-25 transition-colors">
                          <SkipBackIcon className="w-3.5 h-3.5 text-slate-400" />
                        </motion.button>
                        {isPlaying ? (
                          <motion.button onClick={handlePause} whileTap={{ scale: 0.92 }}
                            className="p-2 rounded-lg bg-green-600 text-white hover:bg-green-500 transition-colors">
                            <PauseIcon className="w-3.5 h-3.5" />
                          </motion.button>
                        ) : (
                          <motion.button onClick={handlePlay} disabled={currentStateIndex >= renderedStates.length - 1}
                            whileTap={{ scale: 0.92 }}
                            className="p-2 rounded-lg bg-green-600 text-white hover:bg-green-500 disabled:opacity-25 transition-colors">
                            <PlayIcon className="w-3.5 h-3.5" />
                          </motion.button>
                        )}
                        <motion.button onClick={handleNext} disabled={currentStateIndex >= renderedStates.length - 1}
                          whileTap={{ scale: 0.92 }}
                          className="p-2 rounded-lg hover:bg-white/[0.06] disabled:opacity-25 transition-colors">
                          <SkipForwardIcon className="w-3.5 h-3.5 text-slate-400" />
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

                    <div className="flex items-center gap-4">
                      <span className="text-[11px] text-slate-600">Speed</span>
                      <input type="range" min="200" max="2000" step="200"
                        value={2200 - playbackSpeed}
                        onChange={e => setPlaybackSpeed(2200 - Number(e.target.value))}
                        className="w-28" />
                      <span className="text-[11px] text-slate-600 font-medium tabular-nums"
                        style={{ fontFamily: "'JetBrains Mono', monospace" }}>{playbackSpeed}ms</span>
                    </div>
                  </div>

                  {/* Plan Steps — inside card (normal mode) */}
                  {plan.length > 0 && !isSidebarCollapsed && (
                    <div className="px-6 py-4 border-t border-white/[0.05]">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-xs font-semibold text-slate-400 flex items-center gap-1.5"
                          style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                          <TerminalIcon className="w-3 h-3 text-green-500" />
                          Plan Steps
                        </h3>
                        <span className="text-[10px] text-slate-600 tabular-nums">{plan.length} actions</span>
                      </div>
                      <div ref={planStepsRef}
                        className="space-y-0.5 max-h-64 overflow-y-auto overscroll-contain pr-1"
                        style={{ scrollBehavior: "smooth" }}>
                        {plan.map((action, idx) => (
                          <motion.div key={idx}
                            initial={false}
                            animate={idx === currentStateIndex - 1 ? { backgroundColor: "rgba(34,197,94,0.08)" } : { backgroundColor: "transparent" }}
                            transition={{ duration: 0.2 }}
                            className={`text-[11px] px-3 py-1.5 rounded-lg transition-colors font-mono ${
                              idx === currentStateIndex - 1
                                ? "text-green-300 font-medium border-l-[2px] border-green-500 active-plan-step"
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
                </div>

                {/* Plan Steps — separate card (sidebar-collapsed mode) */}
                {plan.length > 0 && isSidebarCollapsed && (
                  <div className="w-72 flex-shrink-0 rounded-2xl border border-white/[0.07] bg-[#111E30] overflow-hidden"
                    style={{ boxShadow: "0 1px 0 rgba(255,255,255,0.04) inset" }}>
                    <div className="px-4 py-3 border-b border-white/[0.05] bg-white/[0.02] flex items-center justify-between">
                      <h3 className="text-xs font-semibold text-slate-400 flex items-center gap-1.5"
                        style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                        <TerminalIcon className="w-3 h-3 text-green-500" />
                        Plan Steps
                      </h3>
                      <span className="text-[10px] text-slate-600 tabular-nums">{plan.length} actions</span>
                    </div>
                    <div ref={planStepsRef}
                      className="p-3 space-y-0.5 max-h-[600px] overflow-y-auto overscroll-contain"
                      style={{ scrollBehavior: "smooth" }}>
                      {plan.map((action, idx) => (
                        <motion.div key={idx}
                          initial={false}
                          animate={idx === currentStateIndex - 1 ? { backgroundColor: "rgba(34,197,94,0.08)" } : { backgroundColor: "transparent" }}
                          transition={{ duration: 0.2 }}
                          className={`text-[11px] px-3 py-1.5 rounded-lg transition-colors font-mono ${
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
                className="rounded-2xl border border-white/[0.07] bg-[#111E30]"
                style={{ boxShadow: "0 1px 0 rgba(255,255,255,0.04) inset" }}
              >
                <div className="py-20 px-8 flex flex-col items-center text-center">

                  {/* Animated planning tree */}
                  <div className="mb-4 w-full flex flex-col items-center gap-3">
                    <div className="relative">
                      <div className="absolute inset-0 -m-8 rounded-full pointer-events-none" style={{ background: "radial-gradient(ellipse at center, rgba(34,197,94,0.08) 0%, rgba(99,102,241,0.05) 50%, transparent 70%)" }} />
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
                          <div className="w-2.5 h-2.5 rounded-full border border-white/20 flex-shrink-0"
                            style={{ background: color }} />
                          <span className="text-[10px] text-slate-600">{label}</span>
                        </div>
                      ))}
                    </motion.div>
                  </div>

                  <motion.h3
                    className="text-base font-semibold text-slate-200 mb-2"
                    style={{ fontFamily: "'JetBrains Mono', monospace" }}
                    initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.7, duration: 0.3, ease: easeOut }}
                  >
                    Ready to Visualize
                  </motion.h3>
                  <motion.p
                    className="text-sm text-slate-600 max-w-xs leading-relaxed"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    transition={{ delay: 0.85, duration: 0.3 }}
                  >
                    {problemType === "custom"
                      ? "Upload a PDDL problem file or paste your problem definition, then click Solve Problem"
                      : "Select a domain and click Generate States to see the planning visualization"}
                  </motion.p>

                  {/* Terminal hint with blinking cursor */}
                  <motion.div
                    className="mt-6 px-4 py-2.5 bg-white/[0.03] rounded-xl border border-white/[0.05] font-mono text-xs text-slate-600"
                    initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 1.0, duration: 0.3, ease: easeOut }}
                  >
                    <span className="text-green-600">$</span>
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
        <div className="container max-w-7xl py-5">
          <p className="text-center text-[11px] text-slate-700 tracking-wide font-mono">
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
                    className="text-slate-600 hover:text-slate-300 transition-colors p-1 rounded-lg hover:bg-white/[0.06]">
                    <CloseIcon className="w-4 h-4" />
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
                  className="px-4 py-2 text-sm text-slate-500 hover:text-slate-200 font-medium transition-colors rounded-lg hover:bg-white/[0.06]">
                  Close
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
                  <p className="text-[11px] text-slate-600 mt-0.5">{currentDomain?.name}</p>
                </div>
                <button onClick={() => setShowExampleProblem(false)}
                  className="text-slate-600 hover:text-slate-300 transition-colors p-1 rounded-lg hover:bg-white/[0.06]">
                  <CloseIcon className="w-4 h-4" />
                </button>
              </div>
              <div className="p-6 overflow-y-auto flex-1">
                <pre className="text-xs font-mono bg-black/[0.3] text-green-300/80 p-4 rounded-xl border border-white/[0.05] whitespace-pre-wrap leading-relaxed">
                  {getDefaultProblem(selectedDomain)}
                </pre>
              </div>
              <div className="px-6 py-4 border-t border-white/[0.05] bg-white/[0.02] flex justify-end">
                <button onClick={() => setShowExampleProblem(false)}
                  className="px-4 py-2 bg-white/[0.06] hover:bg-white/[0.09] text-sm text-slate-300 font-medium rounded-xl transition-colors">
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
                  <p className="text-[11px] text-slate-600 mt-0.5">{currentDomain?.name}</p>
                </div>
                <button onClick={() => setShowDomainDefinition(false)}
                  className="text-slate-600 hover:text-slate-300 transition-colors p-1 rounded-lg hover:bg-white/[0.06]">
                  <CloseIcon className="w-4 h-4" />
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
                  className="px-4 py-2 bg-white/[0.06] hover:bg-white/[0.09] text-sm text-slate-300 font-medium rounded-xl transition-colors">
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
