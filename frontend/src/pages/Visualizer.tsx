import { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Textarea } from "@/components/ui/textarea";
import { StateCanvas } from "@/components/StateCanvas";
import { GenerationProgress } from "@/components/GenerationProgress";
import { 
  Play, Pause, SkipForward, SkipBack, Upload, FileText, 
  AlertTriangle, Clock, Zap, Settings, 
  Cpu, CheckCircle2, XCircle, Sparkles, ChevronDown, Trash2
} from "lucide-react";

// Search strategy type
interface SearchStrategy {
  id: string;
  name: string;
  description: string;
  isOptimal: boolean;
  speed: "fast" | "medium" | "slow";
  whenToUse: string;
  warning: string | null;
}

export default function Visualizer() {
  const [selectedDomain, setSelectedDomain] = useState("blocks-world");
  const [selectedStrategy, setSelectedStrategy] = useState("astar-lmcut");
  const [problemType, setProblemType] = useState<"example" | "custom">("example");
  const [inputMode, setInputMode] = useState<"file" | "text">("file");
  const [problemFile, setProblemFile] = useState<File | null>(null);
  const [problemText, setProblemText] = useState("");
  const [renderedStates, setRenderedStates] = useState<any[]>([]);
  const [plan, setPlan] = useState<string[]>([]);
  const [currentStateIndex, setCurrentStateIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1000);
  const [plannerInfo, setPlannerInfo] = useState<{used_planner: boolean, info: string, strategy?: any} | null>(null);
  const [showStatus, setShowStatus] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDomainOpen, setIsDomainOpen] = useState(true);
  const [isStrategyOpen, setIsStrategyOpen] = useState(false);
  const [showExampleProblem, setShowExampleProblem] = useState(false);
  const [showDomainDefinition, setShowDomainDefinition] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [visualizationMode, setVisualizationMode] = useState<"basic" | "llm">("basic");
  const [llmCode, setLlmCode] = useState<string | null>(null);
  const [llmError, setLlmError] = useState<string | null>(null);
  const [isLlmGenerating, setIsLlmGenerating] = useState(false);
  const playbackIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const planStepsRef = useRef<HTMLDivElement>(null);
  
  // Error modal state
  const [errorModal, setErrorModal] = useState<{
    show: boolean;
    title: string;
    message: string;
    errorType?: string;
    suggestedDomain?: string;
    suggestedDomainName?: string;
  }>({ show: false, title: "", message: "" });

  // Fetch search strategies from backend
  const strategiesQuery = trpc.visualizer.listStrategies.useQuery();

  const statusQuery = trpc.visualizer.checkStatus.useQuery(undefined, {
    enabled: showStatus,
  });

  const domainDefinitionQuery = trpc.visualizer.getDomainDefinition.useQuery(
    { domainName: selectedDomain as "blocks-world" | "gripper" | "depot" | "hanoi" | "rovers" | "satellite" },
    { enabled: showDomainDefinition }
  );

  const domains = [
    { id: "blocks-world", name: "Blocks World", description: "Classic block stacking problem", icon: "🧱" },
    { id: "gripper", name: "Gripper", description: "Robot gripper moving balls between rooms", icon: "🤖" },
    { id: "depot", name: "Depot", description: "Transporting packages via trucks and depots", icon: "📦" },
    { id: "hanoi", name: "Hanoi", description: "Moving disks between pegs (Tower of Hanoi)", icon: "🗼" },
    { id: "rovers", name: "Rovers", description: "Planetary exploration with rovers", icon: "🚀" },
    { id: "satellite", name: "Satellite", description: "Satellite imaging and data transmission", icon: "🛰️" },

  ];

  // Timer for elapsed time during processing
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isProcessing) {
      setElapsedTime(0);
      interval = setInterval(() => {
        setElapsedTime((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isProcessing]);

  // Cleanup playback interval on unmount
  useEffect(() => {
    return () => {
      if (playbackIntervalRef.current) {
        clearInterval(playbackIntervalRef.current);
      }
    };
  }, []);

  // Reset problem section when domain changes
  useEffect(() => {
    setProblemType("example");
    setProblemFile(null);
    setProblemText("");
    setInputMode("file");
  }, [selectedDomain]);

  // Auto-scroll plan steps to current action (within container only)
  useEffect(() => {
    if (planStepsRef.current && plan.length > 0 && currentStateIndex > 0) {
      const container = planStepsRef.current;
      const currentActionElement = container.children[currentStateIndex - 1] as HTMLElement;
      if (currentActionElement) {
        // Get element position relative to container
        const elementRect = currentActionElement.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        
        // Check if element is not fully visible
        const isAbove = elementRect.top < containerRect.top;
        const isBelow = elementRect.bottom > containerRect.bottom;
        
        if (isAbove || isBelow) {
          // Calculate scroll position (element offset from container top + current scroll position)
          const scrollOffset = currentActionElement.offsetTop - container.offsetTop;
          container.scrollTop = scrollOffset;
        }
      }
    }
  }, [currentStateIndex, plan.length]);

  // Get current strategy details
  const currentStrategy = strategiesQuery.data?.find(
    (s: SearchStrategy) => s.id === selectedStrategy
  ) as SearchStrategy | undefined;

  const getDefaultProblem = (domain: string): string => {
    if (domain === "blocks-world") {
      return `(define (problem bw-default)
  (:domain blocks-world)
  (:objects a b c - block)
  (:init
    (ontable a)
    (ontable b)
    (ontable c)
    (clear a)
    (clear b)
    (clear c)
    (handempty)
  )
  (:goal
    (and
      (on c b)
      (on b a)
    )
  )
)`;
    }

    if (domain === "gripper") {
      return `(define (problem gripper-default)
  (:domain gripper)
  (:objects
    rooma roomb - room
    ball1 ball2 - ball
    left right - gripper
  )
  (:init
    (at-robby rooma)
    (free left)
    (free right)
    (at ball1 rooma)
    (at ball2 rooma)
  )
  (:goal
    (and
      (at ball1 roomb)
      (at ball2 roomb)
    )
  )
)`;
    }

    if (domain === "depot") {
      return `(define (problem depot-simple)
  (:domain depot)

  (:objects
      d1 d2 - depot
      t1 - truck
      c1 c2 - crane
      pile1 pile2 - pile
      p1 p2 - package
  )

  (:init
      (at-truck t1 d1)

      (at-crane c1 d1)
      (empty-crane c1)
      (at-crane c2 d2)
      (empty-crane c2)

      (at-pile pile1 d1)
      (at-pile pile2 d2)

      (on-pile p2 pile1)
      (on p1 p2)

      (at p1 d1)
      (at p2 d1)

      (clear p1)
      (clear pile2)
  )

  (:goal
      (on-pile p2 pile2)
  )
)

`;
    }

    if (domain === "hanoi") {
      return `(define (problem hanoi-2-disks)
  (:domain hanoi)

  (:objects
    d1 d2 - disk
    a b c - peg
  )

  (:init
    ;; mark places
    (is-disk d1) (is-disk d2)
    (is-peg a) (is-peg b) (is-peg c)

    ;; size
    (smaller d1 d2)

    ;; initial stack: d1 on d2 on a
    (on d2 a)
    (on d1 d2)

    ;; clear facts
    (clear d1)
    (clear b)
    (clear c)
  )

  (:goal
    (and
      (on d2 c)
      (on d1 d2)
    )
  )
)
`;
    }

    if (domain === "rovers") {
      return `(define (problem rovers-default)
  (:domain rovers)
  (:objects
    r1 - rover
    w1 w2 - waypoint
    t1 - target
  )
  (:init
    (at-rover r1 w1)
    (connected w1 w2)
    (connected w2 w1)
    (at-target t1 w2)
  )
  (:goal
    (and
      (communicated t1)
    )
  )
)`;
    }
        if (domain === "satellite") {
      return `(define (problem satellite-default)
  (:domain satellite)

  (:objects
    s1 - satellite
    i1 - instrument
    t1 - target
    dcal d1 - direction
    g1 - groundstation
  )

  (:init
    ;; instrument mounted on satellite
    (onboard i1 s1)

    ;; instrument capabilities + calibration target
    (supports i1 t1)
    (calibration-target i1 t1)

    ;; REQUIRED: Link target to its direction
    (target-dir t1 d1)

    ;; initial orientation
    (pointing s1 dcal)

    ;; resources
    (power-avail s1)
    (storage-avail s1)

    ;; communication visibility
    (visible s1 g1)
  )

  (:goal
    (and
      (have-image t1)
    )
  )
)`;
    }


    return "";
  };

  // LLM cache query
  const checkCachedRendererQuery = trpc.visualizer.getCachedRenderer.useQuery(
    { domainName: selectedDomain },
    { enabled: false } // Manual refetch only
  );

  // Clear cache mutation
  const clearCacheMutation = trpc.visualizer.clearRendererCache.useMutation({
    onSuccess: () => {
      setLlmCode(null);
      setLlmError(null);
      console.log('[Visualizer] Cache cleared');
    },
  });

  // LLM renderer mutation
  const llmRendererMutation = trpc.visualizer.generateLLMRenderer.useMutation({
    onSuccess: (data: { success: boolean; typescript_code: string; error: string | null; saved_file: string | null; progress_id: string | null }) => {
      setIsLlmGenerating(false);
      if (data.success && data.typescript_code) {
        setLlmCode(data.typescript_code);
        setLlmError(null);
      } else {
        setLlmCode(null);
        setLlmError(data.error || "Failed to generate LLM renderer");
      }
    },
    onError: (error: any) => {
      setIsLlmGenerating(false);
      setLlmCode(null);
      setLlmError(error.message || "Failed to generate LLM renderer");
    },
  });

  const uploadMutation = trpc.visualizer.uploadAndGenerate.useMutation({
    onSuccess: (data: { states: any[]; plan: string[]; domain?: string; used_planner?: boolean; planner_info?: string; search_strategy?: any }) => {
      setIsProcessing(false);
      setRenderedStates(data.states);
      setPlan(data.plan);
      setCurrentStateIndex(0);
      setPlannerInfo({
        used_planner: data.used_planner || false,
        info: data.planner_info || "Unknown",
        strategy: data.search_strategy
      });
      
      // If LLM mode, check cache first then generate if needed
      if (visualizationMode === "llm" && data.states.length > 0) {
        const domainForLlm = data.domain || selectedDomain;
        
        // Check cache first
        checkCachedRendererQuery.refetch().then((result: { data?: { found: boolean; code: string | null } }) => {
          if (result.data?.found && result.data.code) {
            // Use cached renderer
            console.log('[Visualizer] Using cached LLM renderer');
            setLlmCode(result.data.code);
            setLlmError(null);
          } else {
            // No cache, generate new
            console.log('[Visualizer] No cached renderer, generating new');
            setIsLlmGenerating(true);
            setLlmCode(null);
            setLlmError(null);
            llmRendererMutation.mutate({
              domainName: domainForLlm,
              states: data.states,
            });
          }
        });
      }
    },
    onError: (error: any) => {
      setIsProcessing(false);
      
      // Try to parse the error for domain mismatch info
      let errorMessage = error.message || "An unknown error occurred";
      let errorType = "general";
      let suggestedDomain: string | undefined;
      let suggestedDomainName: string | undefined;
      let title = "Error";
      
      // Check if the error contains domain mismatch info (from tRPC error data)
      try {
        // tRPC errors sometimes include additional data
        const errorData = error.data?.error || error.data;
        if (errorData?.error_type === "domain_mismatch" || errorData?.error_type === "possible_domain_mismatch") {
          errorType = errorData.error_type;
          suggestedDomain = errorData.suggested_domain;
          suggestedDomainName = errorData.suggested_domain_name;
          errorMessage = errorData.error;
          title = "Domain Mismatch Detected";
        }
      } catch {
        // Ignore parsing errors
      }
      
      // Check message content for domain mismatch indicators
      if (errorMessage.toLowerCase().includes("different domain") || 
          errorMessage.toLowerCase().includes("domain mismatch")) {
        title = "Domain Mismatch Detected";
        errorType = "domain_mismatch";
      } else if (errorMessage.toLowerCase().includes("timed out")) {
        title = "Request Timed Out";
        if (currentStrategy?.isOptimal) {
          errorMessage += "\n\nTip: Try using a faster satisficing strategy like 'Lazy Greedy + FF' for quicker results.";
        }
      } else if (errorMessage.toLowerCase().includes("no solution")) {
        title = "No Solution Found";
      }
      
      setErrorModal({
        show: true,
        title,
        message: errorMessage,
        errorType,
        suggestedDomain,
        suggestedDomainName,
      });
    },
  });

  const handleGenerate = () => {
    setIsProcessing(true);
    
    if (problemType === "custom") {
      if (inputMode === "file" && !problemFile) {
        setIsProcessing(false);
        alert("Please select a problem file");
        return;
      }
      if (inputMode === "text" && !problemText.trim()) {
        setIsProcessing(false);
        alert("Please paste PDDL content");
        return;
      }

      const reader = new FileReader();
      const processContent = (content: string) => {
        uploadMutation.mutate({
          domainContent: "",
          problemContent: content,
          domainName: selectedDomain as "blocks-world" | "gripper" | "depot" | "hanoi" | "rovers" | "satellite" ,
          searchStrategy: selectedStrategy as any,
        });
      };

      if (inputMode === "file" && problemFile) {
        reader.onload = (e) => {
          const content = e.target?.result as string;
          processContent(content);
        };
        reader.readAsText(problemFile);
      } else if (inputMode === "text") {
        processContent(problemText);
      }
    } else {
      uploadMutation.mutate({
        domainContent: "",
        problemContent: getDefaultProblem(selectedDomain),
        domainName: selectedDomain as "blocks-world" | "gripper" | "depot" | "hanoi" | "rovers"  | "satellite",
        searchStrategy: selectedStrategy as any,
      });
    }
  };

  // Playback controls
  const handlePlay = () => {
    // Clear any existing interval first
    if (playbackIntervalRef.current) {
      clearInterval(playbackIntervalRef.current);
    }
    setIsPlaying(true);
    playbackIntervalRef.current = setInterval(() => {
      setCurrentStateIndex((prev) => {
        if (prev >= renderedStates.length - 1) {
          setIsPlaying(false);
          if (playbackIntervalRef.current) {
            clearInterval(playbackIntervalRef.current);
            playbackIntervalRef.current = null;
          }
          return prev;
        }
        return prev + 1;
      });
    }, playbackSpeed);
  };

  const handlePause = () => {
    setIsPlaying(false);
    if (playbackIntervalRef.current) {
      clearInterval(playbackIntervalRef.current);
      playbackIntervalRef.current = null;
    }
  };

  const handleNext = () => {
    setCurrentStateIndex((prev) => Math.min(prev + 1, renderedStates.length - 1));
  };

  const handlePrevious = () => {
    setCurrentStateIndex((prev) => Math.max(prev - 1, 0));
  };

  // Helper to get speed badge
  const getSpeedBadge = (speed: string) => {
    const config = {
      fast: { icon: Zap, bg: "bg-emerald-100", text: "text-emerald-700", label: "Fast" },
      medium: { icon: Clock, bg: "bg-amber-100", text: "text-amber-700", label: "Medium" },
      slow: { icon: AlertTriangle, bg: "bg-rose-100", text: "text-rose-700", label: "Slow" },
    }[speed] || { icon: Clock, bg: "bg-gray-100", text: "text-gray-700", label: speed };
    
    const Icon = config.icon;
    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
        <Icon className="w-3 h-3" />
        {config.label}
      </span>
    );
  };

  // Helper to format elapsed time
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  const currentDomain = domains.find(d => d.id === selectedDomain);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30">
      {/* Header */}
      <header className="border-b border-slate-200/60 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container max-w-7xl py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/25">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900">Planning Visualizer</h1>
                <p className="text-sm text-slate-500">Classical AI Planning Made Visual</p>
              </div>
            </div>
            <button
              onClick={() => setShowStatus(!showStatus)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                showStatus 
                  ? "bg-indigo-100 text-indigo-700" 
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              <Settings className="w-4 h-4" />
              System Status
            </button>
          </div>
        </div>
      </header>

      <main className="container max-w-7xl py-8">
        {/* System Status Panel */}
        {showStatus && (
          <div className="mb-8 animate-fade-in">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                  <Cpu className="w-5 h-5 text-indigo-500" />
                  System Status
                </h2>
              </div>
              <div className="p-6">
                {statusQuery.isLoading ? (
                  <div className="flex items-center gap-3 text-slate-500">
                    <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                    Checking system status...
                  </div>
                ) : statusQuery.data ? (
                  <div className="grid md:grid-cols-2 gap-6">
                    {/* Python Status */}
                    <div className={`p-4 rounded-xl border ${
                      statusQuery.data.python.available 
                        ? "bg-emerald-50/50 border-emerald-200" 
                        : "bg-rose-50/50 border-rose-200"
                    }`}>
                      <div className="flex items-start gap-3">
                        {statusQuery.data.python.available ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-500 mt-0.5" />
                        ) : (
                          <XCircle className="w-5 h-5 text-rose-500 mt-0.5" />
                        )}
                        <div className="flex-1">
                          <div className="font-semibold text-slate-900">
                            Python {statusQuery.data.python.available ? "Ready" : "Not Found"}
                          </div>
                          {statusQuery.data.python.available ? (
                            <div className="text-sm text-slate-600 mt-1">
                              Version {statusQuery.data.python.version}
                            </div>
                          ) : (
                            <div className="text-sm text-rose-600 mt-1">
                              Python 3.11+ required
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Fast Downward Status */}
                    <div className={`p-4 rounded-xl border ${
                      statusQuery.data.fastDownward.available 
                        ? "bg-emerald-50/50 border-emerald-200" 
                        : "bg-rose-50/50 border-rose-200"
                    }`}>
                      <div className="flex items-start gap-3">
                        {statusQuery.data.fastDownward.available ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-500 mt-0.5" />
                        ) : (
                          <XCircle className="w-5 h-5 text-rose-500 mt-0.5" />
                        )}
                        <div className="flex-1">
                          <div className="font-semibold text-slate-900">
                            Fast Downward {statusQuery.data.fastDownward.available ? "Ready" : "Not Built"}
                          </div>
                          {statusQuery.data.fastDownward.available ? (
                            <div className="text-sm text-slate-600 mt-1">Planner available</div>
                          ) : (
                            <div className="text-sm text-rose-600 mt-1">
                              Run: <code className="bg-rose-100 px-1.5 py-0.5 rounded text-xs">./build.py</code>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-rose-600">Failed to check system status</p>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-8 relative">
          {/* Sidebar Column */}
          <div className={`lg:col-span-1 transition-all duration-300 ${isSidebarCollapsed ? "" : ""}`}>
            {/* Sidebar Toggle Button */}
            <button
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className="fixed left-4 top-20 z-40 lg:relative lg:left-0 lg:top-0 lg:mb-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl px-4 py-3 shadow-lg transition-all flex items-center gap-2 font-medium w-fit"
            >
              <ChevronDown className={`w-5 h-5 transition-transform ${isSidebarCollapsed ? "rotate-90" : "-rotate-90"}`} />
              <span className="text-sm">{isSidebarCollapsed ? "Show Options" : "Hide Options"}</span>
            </button>

            {/* Configuration Panel */}
            <div className={`space-y-6 transition-all duration-300 ${isSidebarCollapsed ? "hidden" : ""}`}>
            {/* Domain Selection Card */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <button
                onClick={() => setIsDomainOpen(!isDomainOpen)}
                className="w-full px-6 py-4 border-b border-slate-100 flex items-center justify-between hover:bg-slate-50/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <h2 className="text-base font-semibold text-slate-900">Domain</h2>
                  <span className="text-sm text-indigo-600 font-medium">{currentDomain?.icon} {currentDomain?.name}</span>
                </div>
                <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${isDomainOpen ? "" : "-rotate-90"}`} />
              </button>
              {isDomainOpen && (
              <div className="p-4">
                <div className="space-y-2">
                  {domains.map((domain) => (
                    <button
                      key={domain.id}
                      onClick={() => setSelectedDomain(domain.id)}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all duration-200 ${
                        selectedDomain === domain.id
                          ? "bg-indigo-50 border-2 border-indigo-500 shadow-sm"
                          : "bg-slate-50 border-2 border-transparent hover:bg-slate-100"
                      }`}
                    >
                      <span className="text-2xl">{domain.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className={`font-medium ${selectedDomain === domain.id ? "text-indigo-900" : "text-slate-900"}`}>
                          {domain.name}
                        </div>
                        <div className="text-xs text-slate-500 truncate">{domain.description}</div>
                      </div>
                      {selectedDomain === domain.id && (
                        <CheckCircle2 className="w-5 h-5 text-indigo-500 flex-shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setShowDomainDefinition(true)}
                  className="w-full mt-3 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  <FileText className="w-4 h-4" />
                  View Domain Definition
                </button>
              </div>
              )}
            </div>

            {/* Problem Card */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100">
                <h2 className="text-base font-semibold text-slate-900">Problem</h2>
              </div>
              <div className="p-4 space-y-4">
                {/* Problem Type Radio Buttons */}
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="problemType"
                      checked={problemType === "example"}
                      onChange={() => setProblemType("example")}
                      className="w-4 h-4"
                    />
                    <span className="text-sm font-medium text-slate-700">Example Problem</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="problemType"
                      checked={problemType === "custom"}
                      onChange={() => setProblemType("custom")}
                      className="w-4 h-4"
                    />
                    <span className="text-sm font-medium text-slate-700">Custom Problem</span>
                  </label>
                </div>

                {problemType === "example" && (
                  <div className="space-y-3">
                    <div className="p-4 bg-indigo-50/50 rounded-xl border border-indigo-100">
                      <p className="text-sm text-indigo-900">
                        Using default example problem for <strong>{currentDomain?.name}</strong> domain
                      </p>
                    </div>
                    <button
                      onClick={() => setShowExampleProblem(true)}
                      className="w-full px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
                    >
                      <FileText className="w-4 h-4" />
                      View Example Problem
                    </button>
                  </div>
                )}
                
                {problemType === "custom" && (
                  <div className="space-y-4 animate-fade-in">
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setInputMode("file"); setProblemText(""); }}
                        className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                          inputMode === "file"
                            ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/25"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        }`}
                      >
                        <Upload className="w-4 h-4" />
                        Upload
                      </button>
                      <button
                        onClick={() => { setInputMode("text"); setProblemFile(null); }}
                        className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                          inputMode === "text"
                            ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/25"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        }`}
                      >
                        <FileText className="w-4 h-4" />
                        Paste
                      </button>
                    </div>

                    {inputMode === "file" && (
                      <div className="space-y-2">
                        <div className="relative">
                          <input
                            type="file"
                            accept=".pddl"
                            onChange={(e) => setProblemFile(e.target.files?.[0] || null)}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                          />
                          <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center hover:border-indigo-300 hover:bg-indigo-50/30 transition-all">
                            <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                            <p className="text-sm text-slate-600">
                              {problemFile ? problemFile.name : "Drop .pddl file or click to browse"}
                            </p>
                          </div>
                        </div>
                        {problemFile && (
                          <p className="text-xs text-emerald-600 flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            {problemFile.name}
                          </p>
                        )}
                      </div>
                    )}

                    {inputMode === "text" && (
                      <div className="space-y-2">
                        <Textarea
                          value={problemText}
                          onChange={(e) => setProblemText(e.target.value)}
                          placeholder="(define (problem ...)&#10;  (:domain ...)&#10;  ...&#10;)"
                          className="font-mono text-sm min-h-[320px] bg-slate-50 border-slate-200 focus:border-indigo-500 focus:ring-indigo-500/20 rounded-xl"
                        />
                        {problemText && (
                          <p className="text-xs text-slate-500">
                            {problemText.split("\n").length} lines
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Search Strategy Card */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <button
                onClick={() => setIsStrategyOpen(!isStrategyOpen)}
                className="w-full px-6 py-4 border-b border-slate-100 flex items-center justify-between hover:bg-slate-50/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <h2 className="text-base font-semibold text-slate-900">Search Strategy</h2>
                  <span className="text-sm text-indigo-600 font-medium">{currentStrategy?.name}</span>
                </div>
                <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${isStrategyOpen ? "" : "-rotate-90"}`} />
              </button>
              {isStrategyOpen && (
              <div className="p-4">
                <div className="space-y-2">
                  {strategiesQuery.data?.map((strategy: SearchStrategy) => (
                    <button
                      key={strategy.id}
                      onClick={() => setSelectedStrategy(strategy.id)}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all duration-200 ${
                        selectedStrategy === strategy.id
                          ? "bg-indigo-50 border-2 border-indigo-500 shadow-sm"
                          : "bg-slate-50 border-2 border-transparent hover:bg-slate-100"
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`font-medium ${selectedStrategy === strategy.id ? "text-indigo-900" : "text-slate-900"}`}>
                            {strategy.name}
                          </span>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            strategy.isOptimal 
                              ? "bg-purple-100 text-purple-700" 
                              : "bg-blue-100 text-blue-700"
                          }`}>
                            {strategy.isOptimal ? "Optimal" : "Satisficing"}
                          </span>
                          {getSpeedBadge(strategy.speed)}
                        </div>
                        <div className="text-xs text-slate-500 truncate mt-1">{strategy.description}</div>
                      </div>
                      {selectedStrategy === strategy.id && (
                        <CheckCircle2 className="w-5 h-5 text-indigo-500 flex-shrink-0" />
                      )}
                    </button>
                  ))}
                </div>

                {currentStrategy?.warning && (
                  <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-800">{currentStrategy.warning}</p>
                  </div>
                )}
              </div>
              )}
            </div>

            {/* Visualization Mode Card */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100">
                <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-purple-500" />
                  Visualization Mode
                </h2>
              </div>
              <div className="p-4 space-y-3">
                {/* Basic Visualizer */}
                <button
                  onClick={() => setVisualizationMode("basic")}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all duration-200 ${
                    visualizationMode === "basic"
                      ? "bg-indigo-50 border-2 border-indigo-500 shadow-sm"
                      : "bg-slate-50 border-2 border-transparent hover:bg-slate-100"
                  }`}
                >
                  <div className="w-8 h-8 rounded-lg bg-slate-200 flex items-center justify-center">
                    <Cpu className="w-4 h-4 text-slate-600" />
                  </div>
                  <div className="flex-1">
                    <div className={`font-medium ${visualizationMode === "basic" ? "text-indigo-900" : "text-slate-900"}`}>
                      Basic Visualizer
                    </div>
                    <div className="text-xs text-slate-500">Hand-crafted domain-specific renderers</div>
                  </div>
                  {visualizationMode === "basic" && (
                    <CheckCircle2 className="w-5 h-5 text-indigo-500" />
                  )}
                </button>

                {/* LLM-Based Visualizer */}
                <button
                  onClick={() => setVisualizationMode("llm")}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all duration-200 ${
                    visualizationMode === "llm"
                      ? "bg-purple-50 border-2 border-purple-500 shadow-sm"
                      : "bg-slate-50 border-2 border-transparent hover:bg-slate-100"
                  }`}
                >
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                    <Sparkles className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1">
                    <div className={`font-medium ${visualizationMode === "llm" ? "text-purple-900" : "text-slate-900"}`}>
                      LLM-Based Visualizer
                    </div>
                    <div className="text-xs text-slate-500">AI-generated rendering code</div>
                  </div>
                  {visualizationMode === "llm" && (
                    <CheckCircle2 className="w-5 h-5 text-purple-500" />
                  )}
                </button>

                {visualizationMode === "llm" && (
                  <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl">
                    <p className="text-xs text-purple-800">
                      <strong>Note:</strong> LLM mode generates fresh TypeScript code using AI.
                      This may take 30-60 seconds.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Generate Button */}
            <button
              onClick={handleGenerate}
              disabled={uploadMutation.isPending || isProcessing}
              className={`w-full py-4 px-6 rounded-2xl font-semibold text-lg transition-all duration-300 ${
                isProcessing
                  ? "bg-indigo-400 text-white cursor-wait"
                  : "bg-gradient-to-r from-indigo-500 to-purple-600 text-white hover:from-indigo-600 hover:to-purple-700 shadow-xl shadow-indigo-500/30 hover:shadow-2xl hover:shadow-indigo-500/40 hover:-translate-y-0.5 active:translate-y-0"
              }`}
            >
              {isProcessing ? (
                <span className="flex items-center justify-center gap-3">
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Processing... {formatTime(elapsedTime)}
                </span>
              ) : problemType === "custom" ? (
                <span className="flex items-center justify-center gap-2">
                  <Sparkles className="w-5 h-5" />
                  Solve Problem
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <Play className="w-5 h-5" />
                  Generate States
                </span>
              )}
            </button>

            {isProcessing && currentStrategy?.isOptimal && elapsedTime > 30 && (
              <p className="text-xs text-amber-600 text-center animate-fade-in">
                Optimal search can take a while. Consider a satisficing strategy for faster results.
              </p>
            )}
          </div>
          </div>

          {/* Visualization Panel */}
          <div className={`transition-all duration-300 ${isSidebarCollapsed ? "lg:col-span-3" : "lg:col-span-2"}`}>
            {renderedStates.length > 0 ? (
              <div className={`animate-fade-in ${isSidebarCollapsed ? "flex gap-4" : ""}`}>
              {/* Main Visualization Card */}
              <div className={`bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden ${isSidebarCollapsed ? "flex-1" : ""}`}>
                {/* Visualization Header */}
                <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-lg font-semibold text-slate-900">
                          {currentDomain?.icon} {currentDomain?.name} Visualization
                        </h2>
                        {visualizationMode === "llm" && (
                          <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-medium rounded-full flex items-center gap-1">
                            <Sparkles className="w-3 h-3" />
                            LLM Mode
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-slate-500 mt-0.5">
                        {plan.length} actions
                        {isLlmGenerating && " • Generating LLM renderer..."}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {/* Regenerate Button (LLM mode only) */}
                      {visualizationMode === "llm" && renderedStates.length > 0 && (
                        <button
                          onClick={() => {
                            // Force regenerate - bypass cache
                            setIsLlmGenerating(true);
                            setLlmCode(null);
                            setLlmError(null);
                            llmRendererMutation.mutate({
                              domainName: selectedDomain,
                              states: renderedStates,
                            });
                          }}
                          disabled={isLlmGenerating}
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                            isLlmGenerating
                              ? "bg-purple-100 text-purple-400 cursor-wait"
                              : "bg-purple-100 text-purple-700 hover:bg-purple-200"
                          }`}
                        >
                          {isLlmGenerating ? (
                            <>
                              <div className="w-4 h-4 border-2 border-purple-300 border-t-purple-600 rounded-full animate-spin" />
                              Generating...
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-4 h-4" />
                              Regenerate
                            </>
                          )}
                        </button>
                      )}
                      {/* Clear Cache Button (LLM mode only) */}
                      {visualizationMode === "llm" && (
                        <button
                          onClick={() => clearCacheMutation.mutate()}
                          disabled={clearCacheMutation.isPending}
                          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all"
                          title="Clear all cached LLM renderers"
                        >
                          <Trash2 className="w-4 h-4" />
                          {clearCacheMutation.isPending ? "Clearing..." : "Clear Cache"}
                        </button>
                      )}
                      {plannerInfo && (
                        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${
                          plannerInfo.used_planner 
                            ? "bg-emerald-100 text-emerald-700" 
                            : "bg-amber-100 text-amber-700"
                        }`}>
                          {plannerInfo.used_planner ? (
                            <CheckCircle2 className="w-4 h-4" />
                          ) : (
                            <AlertTriangle className="w-4 h-4" />
                          )}
                          {plannerInfo.info}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {plannerInfo?.strategy && (
                    <div className="mt-3 flex items-center gap-2">
                      <span className="text-xs text-slate-500">Strategy:</span>
                      <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                        plannerInfo.strategy.isOptimal 
                          ? "bg-purple-100 text-purple-700" 
                          : "bg-blue-100 text-blue-700"
                      }`}>
                        {plannerInfo.strategy.name}
                      </span>
                      {getSpeedBadge(plannerInfo.strategy.speed)}
                    </div>
                  )}
                </div>

                {/* Canvas */}
                <div className="p-6">
                  {/* LLM Error Display */}
                  {visualizationMode === "llm" && llmError && (
                    <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl">
                      <div className="flex items-start gap-2">
                        <XCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-red-800">LLM Generation Failed</p>
                          <p className="text-xs text-red-600 mt-1">{llmError}</p>
                          <p className="text-xs text-slate-500 mt-2">Falling back to basic renderer.</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* LLM Success Indicator */}
                  {visualizationMode === "llm" && llmCode && !isLlmGenerating && (
                    <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        <p className="text-xs text-emerald-700">LLM-generated renderer active</p>
                      </div>
                    </div>
                  )}

                  {/* Canvas with Progress Overlay */}
                  <div className="relative">
                    {/* LLM Generation Progress - Overlays only the canvas */}
                    {/* Show during generation AND after completion until user clicks Show Result */}
                    {visualizationMode === "llm" && (isLlmGenerating || llmCode) && (
                      <GenerationProgress 
                        isGenerating={isLlmGenerating}
                        onComplete={() => {
                          // Progress component will show completion state
                          // The actual llmCode update happens via the mutation
                        }}
                        onShowResult={() => {
                          // User clicked Show Result - component will dismiss itself
                          // The llmCode is already set, so visualization will show
                        }}
                      />
                    )}
                    
                    <StateCanvas 
                      state={renderedStates[currentStateIndex]} 
                      isFirst={currentStateIndex === 0} 
                      isLast={currentStateIndex === renderedStates.length - 1}
                      llmCode={visualizationMode === "llm" ? llmCode : null}
                    />
                  </div>
                </div>

                {/* Controls */}
                <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/30 space-y-4">
                  {/* Playback Controls */}
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1 bg-white rounded-xl border border-slate-200 p-1">
                      <button
                        onClick={handlePrevious}
                        disabled={currentStateIndex === 0}
                        className="p-2 rounded-lg hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        <SkipBack className="w-4 h-4 text-slate-600" />
                      </button>
                      {isPlaying ? (
                        <button
                          onClick={handlePause}
                          className="p-2 rounded-lg bg-indigo-500 text-white hover:bg-indigo-600 transition-colors"
                        >
                          <Pause className="w-4 h-4" />
                        </button>
                      ) : (
                        <button
                          onClick={handlePlay}
                          disabled={currentStateIndex >= renderedStates.length - 1}
                          className="p-2 rounded-lg bg-indigo-500 text-white hover:bg-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                          <Play className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={handleNext}
                        disabled={currentStateIndex >= renderedStates.length - 1}
                        className="p-2 rounded-lg hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        <SkipForward className="w-4 h-4 text-slate-600" />
                      </button>
                    </div>

                    <div className="flex-1 px-2">
                      <input
                        type="range"
                        min="0"
                        max={renderedStates.length - 1}
                        value={currentStateIndex}
                        onChange={(e) => setCurrentStateIndex(Number(e.target.value))}
                        className="w-full"
                      />
                    </div>

                    <div className="text-sm font-medium text-slate-600 bg-white px-3 py-1.5 rounded-lg border border-slate-200">
                      {currentStateIndex + 1} / {renderedStates.length}
                    </div>
                  </div>

                  {/* Speed Control */}
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-slate-500">Speed:</span>
                    <input
                      type="range"
                      min="200"
                      max="2000"
                      step="200"
                      value={2200 - playbackSpeed}
                      onChange={(e) => setPlaybackSpeed(2200 - Number(e.target.value))}
                      className="w-32"
                    />
                    <span className="text-sm text-slate-600 font-medium">{playbackSpeed}ms</span>
                  </div>
                </div>

                {/* Plan Steps - shown inside card when sidebar is open */}
                {plan.length > 0 && !isSidebarCollapsed && (
                  <div className="px-6 py-4 border-t border-slate-100">
                    <h3 className="text-sm font-semibold text-slate-900 mb-3">
                      Plan Steps ({plan.length} actions)
                    </h3>
                    <div ref={planStepsRef} className="space-y-1 max-h-80 overflow-y-auto overscroll-contain pr-2" style={{ scrollBehavior: 'smooth' }}>
                      {plan.map((action, idx) => (
                        <div
                          key={idx}
                          className={`text-sm px-3 py-2 rounded-lg transition-all ${
                            idx === currentStateIndex - 1
                              ? "bg-indigo-100 text-indigo-900 font-medium border-l-4 border-indigo-500"
                              : idx < currentStateIndex - 1
                              ? "text-slate-400"
                              : "text-slate-600 hover:bg-slate-50"
                          }`}
                        >
                          <span className="text-xs text-slate-400 mr-2">{idx + 1}.</span>
                          {action}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Plan Steps - shown as separate card beside visualization when sidebar is collapsed */}
              {plan.length > 0 && isSidebarCollapsed && (
                <div className="w-80 flex-shrink-0 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50">
                    <h3 className="text-sm font-semibold text-slate-900">
                      Plan Steps ({plan.length} actions)
                    </h3>
                  </div>
                  <div ref={planStepsRef} className="p-3 space-y-1 max-h-[600px] overflow-y-auto overscroll-contain" style={{ scrollBehavior: 'smooth' }}>
                    {plan.map((action, idx) => (
                      <div
                        key={idx}
                        className={`text-sm px-3 py-2 rounded-lg transition-all ${
                          idx === currentStateIndex - 1
                            ? "bg-indigo-100 text-indigo-900 font-medium border-l-4 border-indigo-500"
                            : idx < currentStateIndex - 1
                            ? "text-slate-400"
                            : "text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        <span className="text-xs text-slate-400 mr-2">{idx + 1}.</span>
                        {action}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 text-center">
                <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center">
                  <Sparkles className="w-10 h-10 text-indigo-500" />
                </div>
                <h3 className="text-xl font-semibold text-slate-900 mb-2">Ready to Visualize</h3>
                <p className="text-slate-500 max-w-sm mx-auto">
                  {problemType === "custom"
                    ? "Upload a PDDL problem file or paste your problem definition, then click 'Solve Problem'"
                    : "Select a domain and click 'Generate States' to see the planning visualization"}
                </p>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white/50 mt-12">
        <div className="container max-w-7xl py-6">
          <p className="text-center text-sm text-slate-500">
            Planning Visualizer • Built for AI Planning Education
          </p>
        </div>
      </footer>

      {/* Error Modal */}
      {errorModal.show && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
            {/* Modal Header */}
            <div className={`px-6 py-4 border-b ${
              errorModal.errorType === "domain_mismatch" || errorModal.errorType === "possible_domain_mismatch"
                ? "bg-amber-50 border-amber-200"
                : "bg-red-50 border-red-200"
            }`}>
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  errorModal.errorType === "domain_mismatch" || errorModal.errorType === "possible_domain_mismatch"
                    ? "bg-amber-100"
                    : "bg-red-100"
                }`}>
                  <AlertTriangle className={`w-5 h-5 ${
                    errorModal.errorType === "domain_mismatch" || errorModal.errorType === "possible_domain_mismatch"
                      ? "text-amber-600"
                      : "text-red-600"
                  }`} />
                </div>
                <h3 className={`text-lg font-semibold ${
                  errorModal.errorType === "domain_mismatch" || errorModal.errorType === "possible_domain_mismatch"
                    ? "text-amber-900"
                    : "text-red-900"
                }`}>
                  {errorModal.title}
                </h3>
              </div>
            </div>

            {/* Modal Body */}
            <div className="px-6 py-5">
              <p className="text-slate-700 whitespace-pre-wrap">{errorModal.message}</p>
              
              {/* Domain suggestion */}
              {errorModal.suggestedDomain && errorModal.suggestedDomainName && (
                <div className="mt-4 p-4 bg-indigo-50 rounded-xl border border-indigo-200">
                  <p className="text-sm text-indigo-900 font-medium mb-3">
                    Would you like to switch to the suggested domain?
                  </p>
                  <button
                    onClick={() => {
                      setSelectedDomain(errorModal.suggestedDomain!);
                      setErrorModal({ show: false, title: "", message: "" });
                    }}
                    className="w-full px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
                  >
                    <span>Switch to {errorModal.suggestedDomainName}</span>
                    <span className="text-indigo-200">→</span>
                  </button>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setErrorModal({ show: false, title: "", message: "" })}
                className="px-4 py-2 text-slate-600 hover:text-slate-900 font-medium transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Example Problem Modal */}
      {showExampleProblem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-fade-in p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[80vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">Example Problem - {currentDomain?.name}</h3>
              <button
                onClick={() => setShowExampleProblem(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1">
              <pre className="text-sm font-mono bg-slate-50 p-4 rounded-xl border border-slate-200 whitespace-pre-wrap">
                {getDefaultProblem(selectedDomain)}
              </pre>
            </div>
            <div className="px-6 py-4 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setShowExampleProblem(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-xl transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Domain Definition Modal */}
      {showDomainDefinition && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-fade-in p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[80vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">Domain Definition - {currentDomain?.name}</h3>
              <button
                onClick={() => setShowDomainDefinition(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1">
              {domainDefinitionQuery.isLoading && (
                <div className="flex items-center justify-center py-12">
                  <div className="w-8 h-8 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
                </div>
              )}
              {domainDefinitionQuery.error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-800 text-sm">
                  Failed to load domain definition
                </div>
              )}
              {domainDefinitionQuery.data && (
                <pre className="text-sm font-mono bg-slate-50 p-4 rounded-xl border border-slate-200 whitespace-pre-wrap">
                  {domainDefinitionQuery.data.content}
                </pre>
              )}
            </div>
            <div className="px-6 py-4 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setShowDomainDefinition(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-xl transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}