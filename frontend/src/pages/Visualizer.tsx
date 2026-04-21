import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { trpc } from "@/lib/trpc";
import { Textarea } from "@/components/ui/textarea";
import { StateCanvas } from "@/components/StateCanvas";
import {
  Play, Pause, SkipForward, SkipBack, Upload, FileText,
  AlertTriangle, Clock, Zap, Settings,
  Cpu, CheckCircle2, XCircle, ChevronDown,
  Wand2, RefreshCw, Brain, Trash2, History,
  Layers, Hand, Package, BarChart3, Compass, Globe,
  Menu, X, Terminal,
} from "lucide-react";

interface SearchStrategy {
  id: string;
  name: string;
  description: string;
  isOptimal: boolean;
  speed: "fast" | "medium" | "slow";
  whenToUse: string;
  warning: string | null;
}

// Easing + animation constants
const easeOut: [number, number, number, number] = [0.23, 1, 0.32, 1];
const springConfig = { type: "spring", stiffness: 380, damping: 34 } as const;

const fadeInUp = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit:    { opacity: 0, y: -4 },
};

const modalContent = {
  initial: { opacity: 0, scale: 0.96, y: 8 },
  animate: { opacity: 1, scale: 1,    y: 0 },
  exit:    { opacity: 0, scale: 0.96, y: 4 },
};

const listStagger = {
  animate: { transition: { staggerChildren: 0.04, delayChildren: 0.02 } },
};

const listItem = {
  initial: { opacity: 0, x: -8 },
  animate: { opacity: 1, x: 0 },
};

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
  const [plannerInfo, setPlannerInfo]           = useState<{used_planner: boolean; info: string; strategy?: any} | null>(null);
  const [showStatus, setShowStatus]             = useState(false);
  const [elapsedTime, setElapsedTime]           = useState(0);
  const [isProcessing, setIsProcessing]         = useState(false);
  const [isDomainOpen, setIsDomainOpen]         = useState(true);
  const [isStrategyOpen, setIsStrategyOpen]     = useState(false);
  const [showExampleProblem, setShowExampleProblem]     = useState(false);
  const [showDomainDefinition, setShowDomainDefinition] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed]     = useState(false);
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

  const strategiesQuery = trpc.visualizer.listStrategies.useQuery();
  const statusQuery = trpc.visualizer.checkStatus.useQuery(undefined, { enabled: showStatus });
  const domainDefinitionQuery = trpc.visualizer.getDomainDefinition.useQuery(
    { domainName: selectedDomain as any },
    { enabled: showDomainDefinition }
  );

  const domains = [
    { id: "blocks-world", name: "Blocks World",  description: "Classic block stacking problem",              Icon: Layers   },
    { id: "gripper",      name: "Gripper",        description: "Robot gripper moving balls between rooms",    Icon: Hand     },
    { id: "depot",        name: "Depot",          description: "Transporting packages via trucks and depots", Icon: Package  },
    { id: "hanoi",        name: "Hanoi",          description: "Moving disks between pegs (Tower of Hanoi)",  Icon: BarChart3},
    { id: "rovers",       name: "Rovers",         description: "Planetary exploration with rovers",           Icon: Compass  },
    { id: "satellite",    name: "Satellite",      description: "Satellite imaging and data transmission",     Icon: Globe    },
  ];

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
    setProblemType("example");
    setProblemFile(null);
    setProblemText("");
    setInputMode("file");
  }, [selectedDomain]);

  useEffect(() => {
    if (planStepsRef.current && plan.length > 0 && currentStateIndex > 0) {
      const container = planStepsRef.current;
      const el = container.children[currentStateIndex - 1] as HTMLElement;
      if (el) {
        const elRect  = el.getBoundingClientRect();
        const cRect   = container.getBoundingClientRect();
        if (elRect.top < cRect.top || elRect.bottom > cRect.bottom) {
          container.scrollTop = el.offsetTop - container.offsetTop;
        }
      }
    }
  }, [currentStateIndex, plan.length]);

  const currentStrategy = strategiesQuery.data?.find((s: SearchStrategy) => s.id === selectedStrategy) as SearchStrategy | undefined;

  const getDefaultProblem = (domain: string): string => {
    if (domain === "blocks-world") return `(define (problem bw-default)
  (:domain blocks-world)
  (:objects a b c - block)
  (:init
    (ontable a) (ontable b) (ontable c)
    (clear a) (clear b) (clear c)
    (handempty)
  )
  (:goal (and (on c b) (on b a)))
)`;
    if (domain === "gripper") return `(define (problem gripper-default)
  (:domain gripper)
  (:objects rooma roomb - room  ball1 ball2 - ball  left right - gripper)
  (:init
    (at-robby rooma) (free left) (free right)
    (at ball1 rooma) (at ball2 rooma)
  )
  (:goal (and (at ball1 roomb) (at ball2 roomb)))
)`;
    if (domain === "depot") return `(define (problem depot-simple)
  (:domain depot)
  (:objects d1 d2 - depot  t1 - truck  c1 c2 - crane  pile1 pile2 - pile  p1 p2 - package)
  (:init
    (at-truck t1 d1) (at-crane c1 d1) (empty-crane c1) (at-crane c2 d2) (empty-crane c2)
    (at-pile pile1 d1) (at-pile pile2 d2) (on-pile p2 pile1) (on p1 p2)
    (at p1 d1) (at p2 d1) (clear p1) (clear pile2)
  )
  (:goal (on-pile p2 pile2))
)`;
    if (domain === "hanoi") return `(define (problem hanoi-2-disks)
  (:domain hanoi)
  (:objects d1 d2 - disk  a b c - peg)
  (:init
    (is-disk d1) (is-disk d2) (is-peg a) (is-peg b) (is-peg c)
    (smaller d1 d2) (on d2 a) (on d1 d2)
    (clear d1) (clear b) (clear c)
  )
  (:goal (and (on d2 c) (on d1 d2)))
)`;
    if (domain === "rovers") return `(define (problem rovers-default)
  (:domain rovers)
  (:objects r1 - rover  w1 w2 - waypoint  t1 - target)
  (:init
    (at-rover r1 w1) (connected w1 w2) (connected w2 w1) (at-target t1 w2)
  )
  (:goal (and (communicated t1)))
)`;
    if (domain === "satellite") return `(define (problem satellite-default)
  (:domain satellite)
  (:objects s1 - satellite  i1 - instrument  t1 - target  dcal d1 - direction  g1 - groundstation)
  (:init
    (onboard i1 s1) (supports i1 t1) (calibration-target i1 t1) (target-dir t1 d1)
    (pointing s1 dcal) (power-avail s1) (storage-avail s1) (visible s1 g1)
  )
  (:goal (and (have-image t1)))
)`;
    return "";
  };

  const uploadMutation = trpc.visualizer.uploadAndGenerate.useMutation({
    onSuccess: (data) => {
      setIsProcessing(false);
      setRenderedStates(data.states);
      setPlan(data.plan);
      setCurrentStateIndex(0);
      setPlannerInfo({ used_planner: data.used_planner || false, info: data.planner_info || "Unknown", strategy: data.search_strategy });
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
      const res = await fetch(`/api/trpc/visualizer.llmLoadCachedRenderer?input=${encodeURIComponent(JSON.stringify({ json: { filename } }))}`);
      const json = await res.json();
      const data = json?.result?.data?.json;
      if (data?.code) {
        setLlmRendererCode(data.code); setSelectedCachedFile(filename);
        const parts = filename.replace('.ts', '').split('_');
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
      const process = (content: string) => uploadMutation.mutate({ domainContent: "", problemContent: content, domainName: selectedDomain as any, searchStrategy: selectedStrategy as any });
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
      fast:   { icon: Zap,           bg: "bg-green-500/15",  text: "text-green-400",  label: "Fast"   },
      medium: { icon: Clock,         bg: "bg-amber-500/15",  text: "text-amber-400",  label: "Medium" },
      slow:   { icon: AlertTriangle, bg: "bg-red-500/15",    text: "text-red-400",    label: "Slow"   },
    }[speed] || { icon: Clock, bg: "bg-white/8", text: "text-slate-400", label: speed };
    const Icon = map.icon;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${map.bg} ${map.text}`}>
        <Icon className="w-2.5 h-2.5" />{map.label}
      </span>
    );
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60), s = seconds % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  };

  const currentDomain = domains.find(d => d.id === selectedDomain);

  // ─── Shared modal wrapper ──────────────────────────────────────────────────
  const ModalBackdrop = ({ children, onClose }: { children: React.ReactNode; onClose: () => void }) => (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      onClick={onClose}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
    >
      <motion.div
        {...modalContent}
        transition={{ type: "spring", stiffness: 350, damping: 28 }}
        onClick={e => e.stopPropagation()}
      >
        {children}
      </motion.div>
    </motion.div>
  );

  // ─── Collapsible section wrapper ─────────────────────────────────────────
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

  // ─── Pill toggle ────────────────────────────────────────────────────────
  const PillToggle = ({
    options, value, onChange
  }: { options: { id: string; label: React.ReactNode }[]; value: string; onChange: (v: string) => void }) => (
    <div className="flex bg-white/[0.05] rounded-lg p-0.5 border border-white/[0.06]">
      {options.map(o => (
        <button
          key={o.id} onClick={() => onChange(o.id)}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-md text-xs font-medium transition-all duration-150 ${
            value === o.id ? "bg-white/[0.08] text-slate-100 shadow-sm" : "text-slate-500 hover:text-slate-300"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0B1524] bg-grid">

      {/* ── Header ── */}
      <header className="border-b border-white/[0.06] bg-[#0B1524]/90 backdrop-blur-md sticky top-0 z-50">
        <div className="container max-w-7xl py-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-green-500 flex items-center justify-center shadow-lg shadow-green-500/30 flex-shrink-0">
                <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4">
                  <path d="M2 4h12M2 8h8M2 12h10" stroke="#0B1524" strokeWidth="1.75" strokeLinecap="round" />
                </svg>
              </div>
              <div>
                <h1
                  className="text-[15px] font-semibold text-white leading-none tracking-tight"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                >
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
              <Settings className="w-3.5 h-3.5" />
              System Status
            </motion.button>
          </div>
        </div>
      </header>

      <main className="container max-w-7xl py-8">

        {/* ── System Status Panel ── */}
        <AnimatePresence>
          {showStatus && (
            <motion.div {...fadeInUp} transition={{ duration: 0.22, ease: easeOut }} className="mb-6">
              <div className="rounded-2xl border border-white/[0.07] bg-[#111E30] overflow-hidden" style={{ boxShadow: "0 1px 0 rgba(255,255,255,0.04) inset" }}>
                <div className="px-6 py-4 border-b border-white/[0.05] bg-white/[0.02]">
                  <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-green-500" />
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
                          {ok ? <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" /> : <XCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />}
                          <div>
                            <div className="text-sm font-semibold text-slate-200">{label} {ok ? "Ready" : "Not Found"}</div>
                            <div className={`text-xs mt-0.5 ${ok ? "text-slate-500" : "text-red-400"}`}>
                              {isCode ? <code className="bg-red-500/15 px-1.5 py-0.5 rounded font-mono">{detail}</code> : detail}
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
                transition={springConfig}
                className="w-full lg:w-[300px] lg:flex-shrink-0 space-y-3"
              >

                {/* Domain Card */}
                <div
                  className="rounded-2xl border border-white/[0.07] bg-[#111E30] overflow-hidden"
                  style={{ boxShadow: "0 1px 0 rgba(255,255,255,0.04) inset" }}
                >
                  <button
                    onClick={() => setIsDomainOpen(!isDomainOpen)}
                    className="w-full px-5 py-3.5 flex items-center justify-between hover:bg-white/[0.03] transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-sm font-semibold text-slate-200" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                        Domain
                      </span>
                      <span className="text-xs text-green-400 font-medium">{currentDomain?.name}</span>
                    </div>
                    <motion.div animate={{ rotate: isDomainOpen ? 0 : -90 }} transition={{ duration: 0.18, ease: easeOut }}>
                      <ChevronDown className="w-4 h-4 text-slate-600" />
                    </motion.div>
                  </button>

                  <CollapseSection open={isDomainOpen}>
                    <div className="px-3 pb-3 pt-1 border-t border-white/[0.05]">
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
                              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all ${
                                sel
                                  ? "bg-green-500/10 border border-green-500/[0.22]"
                                  : "border border-transparent hover:bg-white/[0.04]"
                              }`}
                            >
                              <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${sel ? "bg-green-500/20" : "bg-white/[0.06]"}`}>
                                <DomainIcon className={`w-3.5 h-3.5 transition-colors ${sel ? "text-green-400" : "text-slate-500"}`} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div
                                  className={`text-sm font-medium leading-none ${sel ? "text-green-300" : "text-slate-300"}`}
                                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                                >
                                  {domain.name}
                                </div>
                                <div className="text-[11px] text-slate-600 truncate mt-0.5">{domain.description}</div>
                              </div>
                              {sel && (
                                <motion.div
                                  layoutId="domain-sel-dot"
                                  className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0"
                                  style={{ boxShadow: "0 0 6px rgba(34,197,94,0.7)" }}
                                />
                              )}
                            </motion.button>
                          );
                        })}
                      </motion.div>
                      <button
                        onClick={() => setShowDomainDefinition(true)}
                        className="w-full mt-2 px-3 py-2 text-[11px] font-medium text-slate-600 hover:text-slate-400 rounded-lg hover:bg-white/[0.04] transition-colors flex items-center justify-center gap-1.5"
                      >
                        <FileText className="w-3 h-3" />
                        View Domain Definition
                      </button>
                    </div>
                  </CollapseSection>
                </div>

                {/* Problem Card */}
                <div className="rounded-2xl border border-white/[0.07] bg-[#111E30] overflow-hidden" style={{ boxShadow: "0 1px 0 rgba(255,255,255,0.04) inset" }}>
                  <div className="px-5 py-3.5 border-b border-white/[0.05]">
                    <h2 className="text-sm font-semibold text-slate-200" style={{ fontFamily: "'JetBrains Mono', monospace" }}>Problem</h2>
                  </div>
                  <div className="p-4 space-y-3">
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
                          <button
                            onClick={() => setShowExampleProblem(true)}
                            className="w-full px-3 py-2 text-[11px] font-medium text-slate-600 hover:text-slate-400 rounded-lg hover:bg-white/[0.04] transition-colors flex items-center justify-center gap-1.5"
                          >
                            <FileText className="w-3 h-3" />
                            View Example Problem
                          </button>
                        </motion.div>
                      ) : (
                        <motion.div key="cu" {...fadeInUp} transition={{ duration: 0.16, ease: easeOut }} className="space-y-3">
                          <PillToggle
                            options={[
                              { id: "file", label: <><Upload className="w-3 h-3" />Upload</> },
                              { id: "text", label: <><FileText className="w-3 h-3" />Paste</> },
                            ]}
                            value={inputMode}
                            onChange={v => { setInputMode(v as any); if (v === "file") setProblemText(""); else setProblemFile(null); }}
                          />
                          {inputMode === "file" ? (
                            <div className="relative">
                              <input
                                type="file" accept=".pddl"
                                onChange={e => setProblemFile(e.target.files?.[0] || null)}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                              />
                              <div className={`border-2 border-dashed rounded-xl p-5 text-center transition-all ${
                                problemFile
                                  ? "border-green-500/40 bg-green-500/[0.06]"
                                  : "border-white/[0.08] hover:border-green-500/30 hover:bg-green-500/[0.04]"
                              }`}>
                                {problemFile ? (
                                  <><CheckCircle2 className="w-6 h-6 text-green-500 mx-auto mb-1.5" />
                                  <p className="text-xs text-green-400 font-medium truncate px-2">{problemFile.name}</p></>
                                ) : (
                                  <><Upload className="w-6 h-6 text-slate-600 mx-auto mb-1.5" />
                                  <p className="text-xs text-slate-600">Drop .pddl file or click to browse</p></>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div>
                              <Textarea
                                value={problemText}
                                onChange={e => setProblemText(e.target.value)}
                                placeholder="(define (problem ...)&#10;  (:domain ...)&#10;  ...&#10;)"
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

                {/* Strategy Card */}
                <div className="rounded-2xl border border-white/[0.07] bg-[#111E30] overflow-hidden" style={{ boxShadow: "0 1px 0 rgba(255,255,255,0.04) inset" }}>
                  <button
                    onClick={() => setIsStrategyOpen(!isStrategyOpen)}
                    className="w-full px-5 py-3.5 flex items-center justify-between hover:bg-white/[0.03] transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="text-sm font-semibold text-slate-200 flex-shrink-0" style={{ fontFamily: "'JetBrains Mono', monospace" }}>Strategy</span>
                      <span className="text-xs text-slate-500 truncate">{currentStrategy?.name}</span>
                    </div>
                    <motion.div animate={{ rotate: isStrategyOpen ? 0 : -90 }} transition={{ duration: 0.18, ease: easeOut }} className="flex-shrink-0 ml-2">
                      <ChevronDown className="w-4 h-4 text-slate-600" />
                    </motion.div>
                  </button>

                  <CollapseSection open={isStrategyOpen}>
                    <div className="px-3 pb-3 pt-1 border-t border-white/[0.05]">
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
                              {sel && <div className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" style={{ boxShadow: "0 0 6px rgba(34,197,94,0.7)" }} />}
                            </motion.button>
                          );
                        })}
                      </motion.div>
                      {currentStrategy?.warning && (
                        <div className="mt-2 p-3 bg-amber-500/[0.08] border border-amber-500/20 rounded-xl flex items-start gap-2">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
                          <p className="text-[11px] text-amber-300/70 leading-relaxed">{currentStrategy.warning}</p>
                        </div>
                      )}
                    </div>
                  </CollapseSection>
                </div>

                {/* Generate Button */}
                <motion.button
                  onClick={handleGenerate}
                  disabled={uploadMutation.isPending || isProcessing}
                  whileTap={!isProcessing ? { scale: 0.98 } : undefined}
                  whileHover={!isProcessing ? { y: -1 } : undefined}
                  transition={{ duration: 0.15 }}
                  className={`w-full py-3.5 px-6 rounded-2xl font-semibold text-sm transition-all duration-200 ${
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
                      <Wand2 className="w-4 h-4" />
                      Solve Problem
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      <Play className="w-4 h-4" />
                      Generate States
                    </span>
                  )}
                </motion.button>

                <AnimatePresence>
                  {isProcessing && currentStrategy?.isOptimal && elapsedTime > 30 && (
                    <motion.p {...fadeInUp} transition={{ duration: 0.2, ease: easeOut }}
                      className="text-[11px] text-amber-400/70 text-center leading-relaxed"
                    >
                      Optimal search can take a while. Consider a satisficing strategy for faster results.
                    </motion.p>
                  )}
                </AnimatePresence>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Visualization Column ── */}
          <motion.div layout transition={springConfig} className="flex-1 min-w-0 w-full">

            {/* Sidebar toggle */}
            <div className="mb-4">
              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg border border-white/[0.08] bg-white/[0.03] text-slate-500 hover:text-slate-300 hover:border-white/[0.14] text-xs font-medium transition-colors"
              >
                <Menu className="w-3.5 h-3.5" />
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
                <div
                  className={`rounded-2xl border border-white/[0.07] bg-[#111E30] overflow-hidden ${isSidebarCollapsed ? "flex-1" : ""}`}
                  style={{ boxShadow: "0 1px 0 rgba(255,255,255,0.04) inset" }}
                >

                  {/* Card Header */}
                  <div className="px-6 py-4 border-b border-white/[0.05]">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-sm font-semibold text-slate-200" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
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
                          {plannerInfo.used_planner ? <CheckCircle2 className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
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
                          <Brain className="w-3.5 h-3.5 text-green-500" />
                          <span className="text-xs font-medium text-slate-400">Render Mode</span>
                        </div>
                        <div className="flex items-center gap-0.5 bg-white/[0.04] rounded-lg p-0.5 border border-white/[0.06]">
                          <button
                            onClick={() => setRenderMode("basic")}
                            className={`px-3 py-1.5 rounded-md text-[11px] font-medium transition-all duration-150 ${
                              renderMode === "basic" ? "bg-white/[0.08] text-slate-200 shadow-sm" : "text-slate-600 hover:text-slate-400"
                            }`}
                          >Basic</button>
                          <button
                            onClick={() => setRenderMode("llm")}
                            className={`px-3 py-1.5 rounded-md text-[11px] font-medium transition-all duration-150 ${
                              renderMode === "llm" ? "bg-green-600 text-white shadow-sm" : "text-slate-600 hover:text-slate-400"
                            }`}
                          >LLM</button>
                        </div>
                      </div>

                      <CollapseSection open={renderMode === "llm"}>
                        <div className="mt-3 space-y-3">
                          {/* Model selector */}
                          <div className="flex items-center gap-3">
                            <span className="text-[11px] text-slate-600 flex-shrink-0">Model</span>
                            <div className="flex items-center gap-1 flex-1">
                              {[
                                { id: "claude", label: "Claude", active: "bg-orange-500/15 border-orange-500/30 text-orange-400" },
                                { id: "gemini", label: "Gemini", active: "bg-blue-500/15 border-blue-500/30 text-blue-400" },
                              ].map(m => (
                                <button
                                  key={m.id} onClick={() => setLlmProvider(m.id as any)}
                                  className={`flex-1 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors border ${
                                    llmProvider === m.id ? m.active : "bg-white/[0.03] border-white/[0.07] text-slate-600 hover:text-slate-400 hover:border-white/[0.12]"
                                  }`}
                                >{m.label}</button>
                              ))}
                            </div>
                          </div>

                          {/* Generate */}
                          <button
                            onClick={handleLlmGenerate}
                            disabled={isLlmGenerating}
                            className={`w-full py-2 px-4 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-2 ${
                              isLlmGenerating
                                ? "bg-green-500/10 text-green-400/50 cursor-wait"
                                : "btn-primary-green text-[#0B1524]"
                            }`}
                          >
                            {isLlmGenerating ? (
                              <><div className="w-3.5 h-3.5 border-2 border-green-500/30 border-t-green-500 rounded-full animate-spin" />Generating renderer...</>
                            ) : llmRendererCode ? (
                              <><RefreshCw className="w-3 h-3" />Regenerate</>
                            ) : (
                              <><Wand2 className="w-3 h-3" />Generate LLM Renderer</>
                            )}
                          </button>

                          {llmRendererCode && (
                            <div className="flex items-center gap-1.5 text-[11px] text-green-400 bg-green-500/8 px-3 py-2 rounded-lg border border-green-500/20">
                              <CheckCircle2 className="w-3 h-3 flex-shrink-0" />
                              LLM renderer active{llmModelInfo && ` — ${llmModelInfo}`}
                            </div>
                          )}
                          {llmError && (
                            <div className="flex items-start gap-1.5 text-[11px] text-red-400 bg-red-500/8 px-3 py-2 rounded-lg border border-red-500/20">
                              <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                              <span className="leading-relaxed">{llmError}</span>
                            </div>
                          )}

                          {/* Cached Renderers */}
                          <div className="border border-white/[0.06] rounded-lg overflow-hidden">
                            <button
                              onClick={() => setShowCachedRenderers(!showCachedRenderers)}
                              className="w-full flex items-center justify-between px-3 py-2 bg-white/[0.03] hover:bg-white/[0.05] transition-colors"
                            >
                              <div className="flex items-center gap-2 text-[11px] font-medium text-slate-500">
                                <History className="w-3 h-3" />
                                Cached Renderers
                                {(cachedRenderersQuery.data?.length ?? 0) > 0 && (
                                  <span className="bg-white/[0.08] text-slate-400 px-1.5 py-0.5 rounded-full text-[10px]">
                                    {cachedRenderersQuery.data?.length}
                                  </span>
                                )}
                              </div>
                              <motion.div animate={{ rotate: showCachedRenderers ? 0 : -90 }} transition={{ duration: 0.16 }}>
                                <ChevronDown className="w-3 h-3 text-slate-600" />
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
                                      <div
                                        key={r.filename}
                                        onClick={() => handleLoadCachedRenderer(r.filename)}
                                        className={`flex items-center justify-between px-3 py-2 cursor-pointer transition-colors ${
                                          selectedCachedFile === r.filename
                                            ? "bg-green-500/8 border-l-2 border-green-500"
                                            : "hover:bg-white/[0.03] border-l-2 border-transparent"
                                        }`}
                                      >
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
                                        <button
                                          onClick={e => handleDeleteCachedRenderer(r.filename, e)}
                                          className="p-1 rounded hover:bg-red-500/15 text-slate-700 hover:text-red-400 transition-colors ml-2 flex-shrink-0"
                                        >
                                          <Trash2 className="w-3 h-3" />
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
                        <button onClick={handlePrevious} disabled={currentStateIndex === 0}
                          className="p-2 rounded-lg hover:bg-white/[0.06] disabled:opacity-25 transition-colors">
                          <SkipBack className="w-3.5 h-3.5 text-slate-400" />
                        </button>
                        {isPlaying ? (
                          <button onClick={handlePause} className="p-2 rounded-lg bg-green-600 text-white hover:bg-green-500 transition-colors">
                            <Pause className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <button onClick={handlePlay} disabled={currentStateIndex >= renderedStates.length - 1}
                            className="p-2 rounded-lg bg-green-600 text-white hover:bg-green-500 disabled:opacity-25 transition-colors">
                            <Play className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button onClick={handleNext} disabled={currentStateIndex >= renderedStates.length - 1}
                          className="p-2 rounded-lg hover:bg-white/[0.06] disabled:opacity-25 transition-colors">
                          <SkipForward className="w-3.5 h-3.5 text-slate-400" />
                        </button>
                      </div>

                      <div className="flex-1 px-1">
                        <input
                          type="range" min="0" max={renderedStates.length - 1} value={currentStateIndex}
                          onChange={e => setCurrentStateIndex(Number(e.target.value))}
                          className="w-full"
                        />
                      </div>

                      <div className="text-xs font-medium text-slate-500 bg-white/[0.04] px-2.5 py-1.5 rounded-lg border border-white/[0.06] tabular-nums"
                        style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                        {currentStateIndex + 1} / {renderedStates.length}
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <span className="text-[11px] text-slate-600">Speed</span>
                      <input
                        type="range" min="200" max="2000" step="200"
                        value={2200 - playbackSpeed}
                        onChange={e => setPlaybackSpeed(2200 - Number(e.target.value))}
                        className="w-28"
                      />
                      <span className="text-[11px] text-slate-600 font-medium tabular-nums"
                        style={{ fontFamily: "'JetBrains Mono', monospace" }}>{playbackSpeed}ms</span>
                    </div>
                  </div>

                  {/* Plan Steps — inside card */}
                  {plan.length > 0 && !isSidebarCollapsed && (
                    <div className="px-6 py-4 border-t border-white/[0.05]">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-xs font-semibold text-slate-400 flex items-center gap-1.5"
                          style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                          <Terminal className="w-3 h-3 text-green-500" />
                          Plan Steps
                        </h3>
                        <span className="text-[10px] text-slate-600 tabular-nums">{plan.length} actions</span>
                      </div>
                      <div
                        ref={planStepsRef}
                        className="space-y-0.5 max-h-64 overflow-y-auto overscroll-contain pr-1"
                        style={{ scrollBehavior: 'smooth' }}
                      >
                        {plan.map((action, idx) => (
                          <div
                            key={idx}
                            className={`text-[11px] px-3 py-1.5 rounded-lg transition-colors font-mono ${
                              idx === currentStateIndex - 1
                                ? "bg-green-500/[0.1] text-green-300 font-medium border-l-[2px] border-green-500"
                                : idx < currentStateIndex - 1
                                ? "text-slate-700"
                                : "text-slate-500 hover:bg-white/[0.03]"
                            }`}
                          >
                            <span className={`mr-2 tabular-nums ${idx === currentStateIndex - 1 ? "text-green-600" : "text-slate-700"}`}>
                              {String(idx + 1).padStart(2, '0')}.
                            </span>
                            {action}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Plan Steps — separate card when sidebar collapsed */}
                {plan.length > 0 && isSidebarCollapsed && (
                  <div
                    className="w-72 flex-shrink-0 rounded-2xl border border-white/[0.07] bg-[#111E30] overflow-hidden"
                    style={{ boxShadow: "0 1px 0 rgba(255,255,255,0.04) inset" }}
                  >
                    <div className="px-4 py-3 border-b border-white/[0.05] bg-white/[0.02] flex items-center justify-between">
                      <h3 className="text-xs font-semibold text-slate-400 flex items-center gap-1.5"
                        style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                        <Terminal className="w-3 h-3 text-green-500" />
                        Plan Steps
                      </h3>
                      <span className="text-[10px] text-slate-600 tabular-nums">{plan.length} actions</span>
                    </div>
                    <div
                      ref={planStepsRef}
                      className="p-3 space-y-0.5 max-h-[600px] overflow-y-auto overscroll-contain"
                      style={{ scrollBehavior: 'smooth' }}
                    >
                      {plan.map((action, idx) => (
                        <div
                          key={idx}
                          className={`text-[11px] px-3 py-1.5 rounded-lg transition-colors font-mono ${
                            idx === currentStateIndex - 1
                              ? "bg-green-500/[0.1] text-green-300 font-medium border-l-[2px] border-green-500"
                              : idx < currentStateIndex - 1
                              ? "text-slate-700"
                              : "text-slate-500 hover:bg-white/[0.03]"
                          }`}
                        >
                          <span className={`mr-2 tabular-nums ${idx === currentStateIndex - 1 ? "text-green-600" : "text-slate-700"}`}>
                            {String(idx + 1).padStart(2, '0')}.
                          </span>
                          {action}
                        </div>
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
                <div className="py-24 px-8 flex flex-col items-center text-center">
                  <div className="relative mb-10">
                    <motion.div
                      className="absolute -inset-6 rounded-full border border-green-500/20"
                      animate={{ scale: [1, 1.08, 1], opacity: [0.4, 0.1, 0.4] }}
                      transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                    />
                    <motion.div
                      className="absolute -inset-11 rounded-full border border-green-500/10"
                      animate={{ scale: [1, 1.12, 1], opacity: [0.25, 0.05, 0.25] }}
                      transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
                    />
                    <div className="relative w-20 h-20 rounded-2xl bg-green-500/[0.08] border border-green-500/[0.18] flex items-center justify-center"
                      style={{ boxShadow: "0 0 30px rgba(34,197,94,0.08)" }}>
                      <svg viewBox="0 0 24 24" fill="none" className="w-9 h-9 text-green-500">
                        <path d="M3 6h18M3 12h12M3 18h15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                      </svg>
                    </div>
                  </div>

                  <h3
                    className="text-base font-semibold text-slate-200 mb-2"
                    style={{ fontFamily: "'JetBrains Mono', monospace" }}
                  >
                    Ready to Visualize
                  </h3>
                  <p className="text-sm text-slate-600 max-w-xs leading-relaxed">
                    {problemType === "custom"
                      ? "Upload a PDDL problem file or paste your problem definition, then click Solve Problem"
                      : "Select a domain and click Generate States to see the planning visualization"}
                  </p>

                  {/* Prompt hint */}
                  <div className="mt-6 px-4 py-2.5 bg-white/[0.03] rounded-xl border border-white/[0.05] font-mono text-xs text-slate-600">
                    <span className="text-green-600">$</span> planner --domain {selectedDomain} --run
                  </div>
                </div>
              </motion.div>
            )}
          </motion.div>
        </div>
      </main>

      <footer className="border-t border-white/[0.05] bg-[#0B1524]/80 mt-16">
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
            <div
              className="bg-[#111E30] rounded-2xl border border-white/[0.08] max-w-md w-full overflow-hidden"
              style={{ boxShadow: "0 25px 60px rgba(0,0,0,0.6), 0 1px 0 rgba(255,255,255,0.05) inset" }}
            >
              <div className={`px-6 py-4 border-b ${
                errorModal.errorType === "domain_mismatch" || errorModal.errorType === "possible_domain_mismatch"
                  ? "border-amber-500/20 bg-amber-500/[0.06]"
                  : "border-red-500/20 bg-red-500/[0.06]"
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      errorModal.errorType?.includes("mismatch") ? "bg-amber-500/15" : "bg-red-500/15"
                    }`}>
                      <AlertTriangle className={`w-4 h-4 ${errorModal.errorType?.includes("mismatch") ? "text-amber-400" : "text-red-400"}`} />
                    </div>
                    <h3 className={`text-sm font-semibold ${errorModal.errorType?.includes("mismatch") ? "text-amber-300" : "text-red-300"}`}
                      style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                      {errorModal.title}
                    </h3>
                  </div>
                  <button
                    onClick={() => setErrorModal({ show: false, title: "", message: "" })}
                    className="text-slate-600 hover:text-slate-300 transition-colors p-1 rounded-lg hover:bg-white/[0.06]"
                  >
                    <X className="w-4 h-4" />
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
                      className="w-full px-4 py-2.5 btn-primary-green text-[#0B1524] rounded-xl text-sm font-semibold"
                    >Switch to {errorModal.suggestedDomainName}</button>
                  </div>
                )}
              </div>
              <div className="px-6 py-4 border-t border-white/[0.05] bg-white/[0.02] flex justify-end">
                <button
                  onClick={() => setErrorModal({ show: false, title: "", message: "" })}
                  className="px-4 py-2 text-sm text-slate-500 hover:text-slate-200 font-medium transition-colors rounded-lg hover:bg-white/[0.06]"
                >
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
            <div
              className="bg-[#111E30] rounded-2xl border border-white/[0.08] max-w-3xl w-full max-h-[80vh] overflow-hidden flex flex-col"
              style={{ boxShadow: "0 25px 60px rgba(0,0,0,0.6), 0 1px 0 rgba(255,255,255,0.05) inset" }}
            >
              <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-200" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                    Example Problem
                  </h3>
                  <p className="text-[11px] text-slate-600 mt-0.5">{currentDomain?.name}</p>
                </div>
                <button onClick={() => setShowExampleProblem(false)} className="text-slate-600 hover:text-slate-300 transition-colors p-1 rounded-lg hover:bg-white/[0.06]">
                  <X className="w-4 h-4" />
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
            <div
              className="bg-[#111E30] rounded-2xl border border-white/[0.08] max-w-3xl w-full max-h-[80vh] overflow-hidden flex flex-col"
              style={{ boxShadow: "0 25px 60px rgba(0,0,0,0.6), 0 1px 0 rgba(255,255,255,0.05) inset" }}
            >
              <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-200" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                    Domain Definition
                  </h3>
                  <p className="text-[11px] text-slate-600 mt-0.5">{currentDomain?.name}</p>
                </div>
                <button onClick={() => setShowDomainDefinition(false)} className="text-slate-600 hover:text-slate-300 transition-colors p-1 rounded-lg hover:bg-white/[0.06]">
                  <X className="w-4 h-4" />
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
