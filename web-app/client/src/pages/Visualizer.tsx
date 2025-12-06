import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { StateCanvas } from "@/components/StateCanvas";
import { Play, Pause, SkipForward, SkipBack, Upload, FileText } from "lucide-react";

export default function Visualizer() {
  const [selectedDomain, setSelectedDomain] = useState("blocks-world");
  const [useCustomProblem, setUseCustomProblem] = useState(false);
  const [inputMode, setInputMode] = useState<"file" | "text">("file");
  const [problemFile, setProblemFile] = useState<File | null>(null);
  const [problemText, setProblemText] = useState("");
  const [renderedStates, setRenderedStates] = useState<any[]>([]);
  const [plan, setPlan] = useState<string[]>([]);
  const [currentStateIndex, setCurrentStateIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1000);

  const domains = [
    { id: "blocks-world", name: "Blocks World", description: "Classic block stacking problem" },
    { id: "gripper", name: "Gripper", description: "Robot gripper moving balls between rooms" },
  ];

  const prebuiltStates = null;

  const uploadMutation = trpc.visualizer.uploadAndGenerate.useMutation({
    onSuccess: (data) => {
      setRenderedStates(data.states);
      setPlan(data.plan);
      setCurrentStateIndex(0);
    },
    onError: (error) => {
      alert(`Error: ${error.message}`);
    },
  });

  const handleGenerate = () => {
    if (useCustomProblem) {
      if (inputMode === "file" && !problemFile) {
        alert("Please select a problem file");
        return;
      }
      if (inputMode === "text" && !problemText.trim()) {
        alert("Please paste PDDL content");
        return;
      }

      const reader = new FileReader();
      const processContent = (content: string) => {
      uploadMutation.mutate({
        domainContent: "",
        problemContent: content,
        domainName: selectedDomain,
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
      // Load prebuilt states from backend
      alert("Please use custom problem mode for now");
    }  };

  const loadExample = () => {
    const examplePDDL = `(define (problem bw-example-1)
  (:domain blocks-world)

  (:objects
    a b c - block
  )

  (:init
    (ontable a)
    (ontable b)
    (on c a)
    (clear c)
    (clear b)
    (handempty)
  )

  (:goal
    (and
      (ontable a)
      (on b a)
      (on c b)
      (clear c)
    )
  )
)`;
    setProblemText(examplePDDL);
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8">
      <div className="container max-w-6xl">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Planning Visualizer</h1>
          <p className="text-gray-600">
            Visualize classical planning algorithms with domain-specific renderers
          </p>
        </div>

        {/* Configuration Panel */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Configuration</h2>
          <p className="text-sm text-gray-600 mb-4">
            Select a domain and optionally provide a custom problem
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

            {/* Generate Button */}
            <div className="flex items-end">
              <Button
                onClick={handleGenerate}
                disabled={uploadMutation.isPending}
                className="w-full h-12 text-lg"
              >
                {uploadMutation.isPending
                  ? "Processing..."
                  : useCustomProblem
                  ? "Solve Problem"
                  : "Generate States"}
              </Button>
            </div>
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
                      <Button variant="outline" size="sm" onClick={loadExample} type="button">
                        Load Example
                      </Button>
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
            <h2 className="text-xl font-semibold mb-4">Visualization</h2>

            {/* Canvas */}
            <div className="mb-6">
              <StateCanvas state={renderedStates[currentStateIndex]} />
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
                  <h3 className="text-sm font-semibold mb-2">Plan Steps:</h3>
                  <div className="space-y-1">
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
