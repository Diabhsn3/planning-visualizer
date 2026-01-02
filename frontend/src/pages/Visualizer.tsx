import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { StateCanvas } from "@/components/StateCanvas";
import { Play, Pause, SkipForward, SkipBack, Upload, FileText, AlertTriangle, Clock, Zap } from "lucide-react";

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

  // Fetch search strategies from backend
  const strategiesQuery = trpc.visualizer.listStrategies.useQuery();

  const statusQuery = trpc.visualizer.checkStatus.useQuery(undefined, {
    enabled: showStatus,
  });

  const domains = [
    { id: "blocks-world", name: "Blocks World", description: "Classic block stacking problem" },
    { id: "gripper", name: "Gripper", description: "Robot gripper moving balls between rooms" },
    { id: "depot", name: "Depot", description: "Transporting packages via trucks and depots" },
    { id: "hanoi", name: "Hanoi", description: "Moving disks between pegs (Tower of Hanoi)" },
    { id: "rovers", name: "Rovers", description: "Planetary exploration with rovers, waypoints and targets" },
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
      // Check if it's a timeout error and provide helpful message
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
          domainName: selectedDomain as any,
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
      // Use default problem for the selected domain
      uploadMutation.mutate({
        domainContent: "",
        problemContent: getDefaultProblem(selectedDomain),
        domainName: selectedDomain as any,
        searchStrategy: selectedStrategy as any,
      });
    }
  };

  // Playback controls
  const handlePlay = () => {
    setIsPlaying(true);
    const interval = setInterval(() => {
      setCurrentStateIndex((prev) => {
        if (prev >= renderedStates.length - 1) {
          setIsPlaying(false);
          clearInterval(interval);
          return prev;
        }
        return prev + 1;
      });
    }, playbackSpeed);
  };

  const handlePause = () => {
    setIsPlaying(false);
  };

  const handleNext = () => {
    setCurrentStateIndex((prev) => Math.min(prev + 1, renderedStates.length - 1));
  };

  const handlePrevious = () => {
    setCurrentStateIndex((prev) => Math.max(prev - 1, 0));
  };

  // Helper to get speed icon
  const getSpeedIcon = (speed: string) => {
    switch (speed) {
      case "fast":
        return <Zap className="w-4 h-4 text-green-500" />;
      case "medium":
        return <Clock className="w-4 h-4 text-yellow-500" />;
      case "slow":
        return <AlertTriangle className="w-4 h-4 text-red-500" />;
      default:
        return null;
    }
  };

  // Helper to format elapsed time
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8">
      <div className="container max-w-6xl">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Planning Visualizer</h1>
          <p className="text-gray-600">
            Visualize classical planning algorithms with domain-specific renderers
          </p>
          <button
            onClick={() => setShowStatus(!showStatus)}
            className="mt-2 text-sm text-blue-600 hover:text-blue-800 underline"
          >
            {showStatus ? "Hide" : "Show"} System Status
          </button>
        </div>

        {/* System Status Panel */}
        {showStatus && (
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">System Status</h2>
            {statusQuery.isLoading ? (
              <p className="text-gray-600">Checking system status...</p>
            ) : statusQuery.data ? (
              <div className="space-y-4">
                {/* Python Status */}
                <div className="flex items-start gap-3">
                  <div className={`mt-1 w-3 h-3 rounded-full ${
                    statusQuery.data.python.available ? "bg-green-500" : "bg-red-500"
                  }`} />
                  <div className="flex-1">
                    <div className="font-medium">
                      Python {statusQuery.data.python.available ? "Available" : "Not Found"}
                    </div>
                    {statusQuery.data.python.available && (
                      <div className="text-sm text-gray-600">
                        Version: {statusQuery.data.python.version}<br />
                        Command: {statusQuery.data.python.command}
                      </div>
                    )}
                    {!statusQuery.data.python.available && (
                      <div className="text-sm text-red-600">
                        Python 3.11+ not found. Please install Python and configure PYTHON_CMD in .env
                      </div>
                    )}
                  </div>
                </div>

                {/* Fast Downward Status */}
                <div className="flex items-start gap-3">
                  <div className={`mt-1 w-3 h-3 rounded-full ${
                    statusQuery.data.fastDownward.available ? "bg-green-500" : "bg-red-500"
                  }`} />
                  <div className="flex-1">
                    <div className="font-medium">
                      Fast Downward {statusQuery.data.fastDownward.available ? "Available" : "Not Found"}
                    </div>
                    {statusQuery.data.fastDownward.available && (
                      <div className="text-sm text-gray-600">
                        Path: {statusQuery.data.fastDownward.path}
                      </div>
                    )}
                    {!statusQuery.data.fastDownward.available && (
                      <div className="text-sm text-red-600">
                        Fast Downward not built. Please run:<br />
                        <code className="bg-gray-100 px-2 py-1 rounded mt-1 inline-block">
                          cd planning-tools/downward && ./build.py
                        </code>
                      </div>
                    )}
                  </div>
                </div>

                {/* Overall Status */}
                {statusQuery.data.python.available && statusQuery.data.fastDownward.available && (
                  <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-md">
                    <p className="text-sm text-green-800">
                      ✓ All systems ready! You can solve custom PDDL problems with Fast Downward.
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-red-600">Failed to check system status</p>
            )}
          </div>
        )}

        {/* Configuration Panel */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Configuration</h2>
          <p className="text-sm text-gray-600 mb-4">
            Select a domain, search strategy, and optionally provide a custom problem
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Domain Selection */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Domain</label>
              <select
                value={selectedDomain}
                onChange={(e) => setSelectedDomain(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {domains?.map((domain: any) => (
                  <option key={domain.id} value={domain.id}>
                    {domain.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500">
                {domains?.find((d) => d.id === selectedDomain)?.description}
              </p>
            </div>

            {/* Search Strategy Selection */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Search Strategy</label>
              <select
                value={selectedStrategy}
                onChange={(e) => setSelectedStrategy(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {strategiesQuery.data?.map((strategy: SearchStrategy) => (
                  <option key={strategy.id} value={strategy.id}>
                    {strategy.name}
                  </option>
                ))}
              </select>
              
              {/* Strategy Details */}
              {currentStrategy && (
                <div className="mt-2 p-3 bg-gray-50 rounded-md border border-gray-200">
                  <div className="flex items-center gap-2 mb-1">
                    {getSpeedIcon(currentStrategy.speed)}
                    <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                      currentStrategy.isOptimal 
                        ? "bg-purple-100 text-purple-700" 
                        : "bg-blue-100 text-blue-700"
                    }`}>
                      {currentStrategy.isOptimal ? "Optimal" : "Satisficing"}
                    </span>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                      currentStrategy.speed === "fast" 
                        ? "bg-green-100 text-green-700"
                        : currentStrategy.speed === "medium"
                        ? "bg-yellow-100 text-yellow-700"
                        : "bg-red-100 text-red-700"
                    }`}>
                      {currentStrategy.speed.charAt(0).toUpperCase() + currentStrategy.speed.slice(1)}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 mb-1">{currentStrategy.description}</p>
                  <p className="text-xs text-gray-500 italic">When to use: {currentStrategy.whenToUse}</p>
                </div>
              )}
            </div>
          </div>

          {/* Warning for slow strategies */}
          {currentStrategy?.warning && (
            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-md flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-amber-800">{currentStrategy.warning}</p>
            </div>
          )}

          {/* Generate Button */}
          <div className="mt-6">
            <Button
              onClick={handleGenerate}
              disabled={uploadMutation.isPending || isProcessing}
              className="w-full h-12 text-lg"
            >
              {isProcessing ? (
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  <span>Processing... ({formatTime(elapsedTime)})</span>
                </div>
              ) : useCustomProblem ? (
                "Solve Problem"
              ) : (
                "Generate States"
              )}
            </Button>
            
            {/* Processing indicator with time */}
            {isProcessing && (
              <div className="mt-2 text-center">
                <p className="text-sm text-gray-600">
                  Using: <strong>{currentStrategy?.name || selectedStrategy}</strong>
                </p>
                {currentStrategy?.isOptimal && elapsedTime > 30 && (
                  <p className="text-xs text-amber-600 mt-1">
                    Optimal search can take a while for complex problems. Consider using a satisficing strategy for faster results.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Custom Problem Section */}
          <div className="mt-6">
            <div className="flex items-center gap-2 mb-4">
              <input
                type="checkbox"
                id="useCustomProblem"
                checked={useCustomProblem}
                onChange={(e) => {
                  setUseCustomProblem(e.target.checked);
                  if (!e.target.checked) {
                    setProblemFile(null);
                    setProblemText("");
                  }
                }}
                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
              />
              <label htmlFor="useCustomProblem" className="text-sm font-medium cursor-pointer">
                Use custom problem
              </label>
            </div>

            {useCustomProblem && (
              <div className="space-y-4 pl-6 border-l-2 border-blue-200">
                {/* Input Mode Toggle */}
                <div className="flex gap-4">
                  <button
                    onClick={() => {
                      setInputMode("file");
                      setProblemText("");
                    }}
                    className={`flex items-center gap-2 px-4 py-2 rounded-md transition-colors ${
                      inputMode === "file"
                        ? "bg-blue-600 text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    <Upload className="w-4 h-4" />
                    Upload File
                  </button>
                  <button
                    onClick={() => {
                      setInputMode("text");
                      setProblemFile(null);
                    }}
                    className={`flex items-center gap-2 px-4 py-2 rounded-md transition-colors ${
                      inputMode === "text"
                        ? "bg-blue-600 text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    <FileText className="w-4 h-4" />
                    Paste Text
                  </button>
                </div>

                {/* File Upload Mode */}
                {inputMode === "file" && (
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Problem File (.pddl)
                    </label>
                    <input
                      type="file"
                      accept=".pddl"
                      onChange={(e) => setProblemFile(e.target.files?.[0] || null)}
                      className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700 cursor-pointer"
                    />
                    {problemFile && (
                      <p className="text-xs text-green-600 flex items-center gap-1">
                        <span>✓</span> {problemFile.name}
                      </p>
                    )}
                  </div>
                )}

                {/* Text Input Mode */}
                {inputMode === "text" && (
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <label className="block text-sm font-medium text-gray-700">
                        PDDL Problem Content
                      </label>
                    </div>
                    <Textarea
                      value={problemText}
                      onChange={(e) => setProblemText(e.target.value)}
                      placeholder="Paste your PDDL problem definition here..."
                      className="font-mono text-sm min-h-[200px]"
                    />
                    {problemText && (
                      <p className="text-xs text-gray-600">
                        {problemText.split("\\n").length} lines
                      </p>
                    )}
                  </div>
                )}

                <p className="text-xs text-gray-600">
                  Provide a problem for the selected{" "}
                  <strong>{domains?.find((d: any) => d.id === selectedDomain)?.name}</strong> domain. The
                  planner will solve it automatically.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Visualization Panel */}
        {renderedStates.length > 0 ? (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Visualization</h2>
              {plannerInfo && (
                <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                  plannerInfo.used_planner 
                    ? "bg-green-100 text-green-800" 
                    : "bg-yellow-100 text-yellow-800"
                }`}>
                  {plannerInfo.used_planner ? "✓" : "⚠"} {plannerInfo.info}
                </div>
              )}
            </div>
            
            {/* Strategy info badge */}
            {plannerInfo?.strategy && (
              <div className="mb-4 flex items-center gap-2">
                <span className="text-sm text-gray-600">Strategy used:</span>
                <span className={`text-xs font-medium px-2 py-1 rounded ${
                  plannerInfo.strategy.isOptimal 
                    ? "bg-purple-100 text-purple-700" 
                    : "bg-blue-100 text-blue-700"
                }`}>
                  {plannerInfo.strategy.name}
                </span>
                <span className={`text-xs font-medium px-2 py-1 rounded ${
                  plannerInfo.strategy.speed === "fast" 
                    ? "bg-green-100 text-green-700"
                    : plannerInfo.strategy.speed === "medium"
                    ? "bg-yellow-100 text-yellow-700"
                    : "bg-red-100 text-red-700"
                }`}>
                  {plannerInfo.strategy.speed}
                </span>
              </div>
            )}
            
            {!plannerInfo?.used_planner && (
              <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                <p className="text-sm text-yellow-800">
                  <strong>Warning:</strong> Fast Downward planner not available. Using fallback plan that may not match your problem.
                  Please build Fast Downward locally.
                </p>
              </div>
            )}

            {/* Canvas */}
            <div className="mb-6">
              <StateCanvas state={renderedStates[currentStateIndex]} isFirst={currentStateIndex === 0} isLast={currentStateIndex === renderedStates.length - 1}/>
            </div>

            {/* Controls */}
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <Button onClick={handlePrevious} disabled={currentStateIndex === 0} size="sm">
                  <SkipBack className="w-4 h-4" />
                </Button>
                {isPlaying ? (
                  <Button onClick={handlePause} size="sm">
                    <Pause className="w-4 h-4 mr-2" />
                    Pause
                  </Button>
                ) : (
                  <Button
                    onClick={handlePlay}
                    disabled={currentStateIndex >= renderedStates.length - 1}
                    size="sm"
                  >
                    <Play className="w-4 h-4 mr-2" />
                    Play
                  </Button>
                )}
                <Button
                  onClick={handleNext}
                  disabled={currentStateIndex >= renderedStates.length - 1}
                  size="sm"
                >
                  <SkipForward className="w-4 h-4" />
                </Button>

                <div className="flex-1">
                  <input
                    type="range"
                    min="0"
                    max={renderedStates.length - 1}
                    value={currentStateIndex}
                    onChange={(e) => setCurrentStateIndex(Number(e.target.value))}
                    className="w-full"
                  />
                </div>

                <span className="text-sm text-gray-600">
                  State {currentStateIndex + 1} / {renderedStates.length}
                </span>
              </div>

              {/* Speed Control */}
              <div className="flex items-center gap-4">
                <label className="text-sm text-gray-700">Speed:</label>
                <input
                  type="range"
                  min="500"
                  max="3000"
                  step="500"
                  value={playbackSpeed}
                  onChange={(e) => setPlaybackSpeed(Number(e.target.value))}
                  className="w-32"
                />
                <span className="text-sm text-gray-600">{playbackSpeed}ms</span>
              </div>

              {/* Plan Steps */}
              {plan.length > 0 && (
                <div className="mt-4">
                  <h3 className="text-sm font-semibold mb-2">Plan Steps ({plan.length} actions):</h3>
                  <div className="space-y-1 max-h-64 overflow-y-auto">
                    {plan.map((action, idx) => (
                      <div
                        key={idx}
                        className={`text-sm px-3 py-1 rounded ${
                          idx === currentStateIndex - 1
                            ? "bg-blue-100 text-blue-900 font-semibold"
                            : "text-gray-700"
                        }`}
                      >
                        {idx + 1}. {action}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-lg p-12 text-center">
            <div className="text-6xl mb-4">🎯</div>
            <h3 className="text-xl font-semibold text-gray-800 mb-2">No States Generated Yet</h3>
            <p className="text-gray-600">
              {useCustomProblem
                ? "Select a domain, upload a problem file, and click 'Solve Problem'"
                : "Select a domain and click 'Generate States' to visualize planning"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
