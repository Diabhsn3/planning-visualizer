import { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { StateCanvas } from "@/components/StateCanvas";
import { 
  Play, Pause, SkipForward, SkipBack, Upload, FileText, 
  AlertTriangle, Clock, Zap, ChevronDown, Settings, 
  Cpu, CheckCircle2, XCircle, Info, Sparkles
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
  const [selectedStrategy, setSelectedStrategy] = useState("lazy-greedy-ff");
  const [useCustomProblem, setUseCustomProblem] = useState(false);
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
  const playbackIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch search strategies from backend
  const strategiesQuery = trpc.visualizer.listStrategies.useQuery();

  const statusQuery = trpc.visualizer.checkStatus.useQuery(undefined, {
    enabled: showStatus,
  });

  const domains = [
    { id: "blocks-world", name: "Blocks World", description: "Classic block stacking problem", icon: "🧱" },
    { id: "gripper", name: "Gripper", description: "Robot gripper moving balls between rooms", icon: "🤖" },
    { id: "depot", name: "Depot", description: "Transporting packages via trucks and depots", icon: "📦" },
    { id: "hanoi", name: "Hanoi", description: "Moving disks between pegs (Tower of Hanoi)", icon: "🗼" },
    { id: "rovers", name: "Rovers", description: "Planetary exploration with rovers", icon: "🚀" },
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
      return `(define (problem depot-p1)
  (:domain depot)
  (:objects
    d1 - depot
    s1 - distributor
    t1 - truck
    c1 - package
  )
  (:init
    (at c1 d1)
    (at-truck t1 d1)
  )
  (:goal
    (and
      (at c1 s1)
    )
  )
)`;
    }

    if (domain === "hanoi") {
      return `(define (problem hanoi-default)
  (:domain hanoi)
  (:objects
    d1 d2 d3 - disk
    p1 p2 p3 - peg
  )
  (:init
    (on d1 p1)
    (on d2 p1)
    (on d3 p1)
  )
  (:goal
    (and
      (on d1 p3)
      (on d2 p3)
      (on d3 p3)
    )
  )
)`;
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

    return "";
  };

  const uploadMutation = trpc.visualizer.uploadAndGenerate.useMutation({
    onSuccess: (data) => {
      setIsProcessing(false);
      setRenderedStates(data.states);
      setPlan(data.plan);
      setCurrentStateIndex(0);
      setPlannerInfo({
        used_planner: data.used_planner || false,
        info: data.planner_info || "Unknown",
        strategy: data.search_strategy
      });
    },
    onError: (error) => {
      setIsProcessing(false);
      let errorMessage = error.message;
      if (errorMessage.toLowerCase().includes("timed out")) {
        if (currentStrategy?.isOptimal) {
          errorMessage += "\n\nTip: Try using a faster satisficing strategy like 'Lazy Greedy + FF' for quicker results.";
        }
      }
      alert(`Error: ${errorMessage}`);
    },
  });

  const handleGenerate = () => {
    setIsProcessing(true);
    
    if (useCustomProblem) {
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
          domainName: selectedDomain as "blocks-world" | "gripper" | "depot" | "hanoi" | "rovers",
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
        domainName: selectedDomain as "blocks-world" | "gripper" | "depot" | "hanoi" | "rovers",
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

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Configuration Panel */}
          <div className="lg:col-span-1 space-y-6">
            {/* Domain Selection Card */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100">
                <h2 className="text-base font-semibold text-slate-900">Domain</h2>
              </div>
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
              </div>
            </div>

            {/* Search Strategy Card */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100">
                <h2 className="text-base font-semibold text-slate-900">Search Strategy</h2>
              </div>
              <div className="p-4 space-y-4">
                <select
                  value={selectedStrategy}
                  onChange={(e) => setSelectedStrategy(e.target.value)}
                  className="w-full"
                >
                  {strategiesQuery.data?.map((strategy: SearchStrategy) => (
                    <option key={strategy.id} value={strategy.id}>
                      {strategy.name}
                    </option>
                  ))}
                </select>
                
                {currentStrategy && (
                  <div className="p-4 bg-slate-50 rounded-xl space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                        currentStrategy.isOptimal 
                          ? "bg-purple-100 text-purple-700" 
                          : "bg-blue-100 text-blue-700"
                      }`}>
                        {currentStrategy.isOptimal ? "Optimal" : "Satisficing"}
                      </span>
                      {getSpeedBadge(currentStrategy.speed)}
                    </div>
                    <p className="text-sm text-slate-600">{currentStrategy.description}</p>
                    <div className="flex items-start gap-2 text-xs text-slate-500">
                      <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                      <span>{currentStrategy.whenToUse}</span>
                    </div>
                  </div>
                )}

                {currentStrategy?.warning && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-800">{currentStrategy.warning}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Custom Problem Card */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useCustomProblem}
                    onChange={(e) => {
                      setUseCustomProblem(e.target.checked);
                      if (!e.target.checked) {
                        setProblemFile(null);
                        setProblemText("");
                      }
                    }}
                    className="w-5 h-5 rounded-md"
                  />
                  <span className="text-base font-semibold text-slate-900">Custom Problem</span>
                </label>
              </div>
              
              {useCustomProblem && (
                <div className="p-4 space-y-4 animate-fade-in">
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
                        className="font-mono text-sm min-h-[180px] bg-slate-50 border-slate-200 focus:border-indigo-500 focus:ring-indigo-500/20 rounded-xl"
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
              ) : useCustomProblem ? (
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

          {/* Visualization Panel */}
          <div className="lg:col-span-2">
            {renderedStates.length > 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden animate-fade-in">
                {/* Visualization Header */}
                <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-semibold text-slate-900">Visualization</h2>
                      <p className="text-sm text-slate-500 mt-0.5">
                        {currentDomain?.icon} {currentDomain?.name} • {plan.length} actions
                      </p>
                    </div>
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
                  <StateCanvas 
                    state={renderedStates[currentStateIndex]} 
                    isFirst={currentStateIndex === 0} 
                    isLast={currentStateIndex === renderedStates.length - 1}
                  />
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

                {/* Plan Steps */}
                {plan.length > 0 && (
                  <div className="px-6 py-4 border-t border-slate-100">
                    <h3 className="text-sm font-semibold text-slate-900 mb-3">
                      Plan Steps ({plan.length} actions)
                    </h3>
                    <div className="space-y-1 max-h-48 overflow-y-auto pr-2">
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
                  {useCustomProblem
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
    </div>
  );
}
