import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { StateCanvas } from "@/components/StateCanvas";
import { Play, Pause, SkipBack, SkipForward, ChevronLeft, ChevronRight, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";

export default function Visualizer() {
  const [selectedDomain, setSelectedDomain] = useState<string>("blocks-world");
  const [currentStateIndex, setCurrentStateIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1000); // ms per state
  const [problemFile, setProblemFile] = useState<File | null>(null);
  const [useCustomProblem, setUseCustomProblem] = useState(false);

  const { data: domains } = trpc.visualizer.listDomains.useQuery();
  const generateMutation = trpc.visualizer.generateStates.useMutation();
  const uploadMutation = trpc.visualizer.uploadAndGenerate.useMutation();

  const states = generateMutation.data?.states || uploadMutation.data?.states || [];
  const plan = generateMutation.data?.plan || uploadMutation.data?.plan || [];
  const currentState = states[currentStateIndex];
  const currentAction = currentStateIndex > 0 ? plan[currentStateIndex - 1] : null;

  const isGenerating = generateMutation.isPending || uploadMutation.isPending;

  // Auto-play functionality
  useEffect(() => {
    if (!isPlaying || states.length === 0) return;

    const interval = setInterval(() => {
      setCurrentStateIndex((prev) => {
        if (prev >= states.length - 1) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, playbackSpeed);

    return () => clearInterval(interval);
  }, [isPlaying, states.length, playbackSpeed]);

  const handleGenerate = async () => {
    setCurrentStateIndex(0);
    setIsPlaying(false);

    if (useCustomProblem) {
      if (!problemFile) {
        toast.error("Please select a problem file");
        return;
      }

      try {
        const problemContent = await problemFile.text();
        
        uploadMutation.mutate(
          {
            domainContent: "", // Will be loaded from server based on selectedDomain
            problemContent,
            domainName: selectedDomain,
          },
          {
            onSuccess: () => {
              toast.success("Problem solved and states generated!");
            },
            onError: (error) => {
              toast.error(`Failed to solve problem: ${error.message}`);
            },
          }
        );
      } catch (error) {
        toast.error("Failed to read problem file");
      }
    } else {
      generateMutation.mutate(
        { domain: selectedDomain as "blocks-world" | "gripper" },
        {
          onSuccess: () => {
            toast.success("States generated successfully!");
          },
          onError: (error) => {
            toast.error(`Failed to generate states: ${error.message}`);
          },
        }
      );
    }
  };

  const handlePlayPause = () => {
    if (states.length === 0) return;
    if (currentStateIndex >= states.length - 1) {
      setCurrentStateIndex(0);
    }
    setIsPlaying(!isPlaying);
  };

  const handleStepForward = () => {
    if (currentStateIndex < states.length - 1) {
      setCurrentStateIndex(currentStateIndex + 1);
      setIsPlaying(false);
    }
  };

  const handleStepBackward = () => {
    if (currentStateIndex > 0) {
      setCurrentStateIndex(currentStateIndex - 1);
      setIsPlaying(false);
    }
  };

  const handleReset = () => {
    setCurrentStateIndex(0);
    setIsPlaying(false);
  };

  const handleEnd = () => {
    setCurrentStateIndex(states.length - 1);
    setIsPlaying(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold text-gray-900">Planning Visualizer</h1>
          <p className="text-lg text-gray-600">
            Visualize classical planning algorithms with domain-specific renderers
          </p>
        </div>

        {/* Controls */}
        <Card>
          <CardHeader>
            <CardTitle>Configuration</CardTitle>
            <CardDescription>Select a domain and optionally upload a custom problem</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Domain</label>
                <Select value={selectedDomain} onValueChange={(value) => {
                  setSelectedDomain(value);
                  setProblemFile(null);
                }}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {domains?.map((domain) => (
                      <SelectItem key={domain.id} value={domain.id}>
                        {domain.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {domains && (
                  <p className="text-xs text-gray-600 mt-2">
                    {domains.find((d) => d.id === selectedDomain)?.description}
                  </p>
                )}
              </div>

              <div className="flex items-end">
                <Button
                  onClick={handleGenerate}
                  disabled={isGenerating || (useCustomProblem && !problemFile)}
                  size="lg"
                  className="w-full"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {useCustomProblem ? "Solving..." : "Generating..."}
                    </>
                  ) : (
                    useCustomProblem ? "Solve Problem" : "Generate States"
                  )}
                </Button>
              </div>
            </div>

            {/* Custom Problem Upload */}
            <div className="space-y-3 p-4 border border-gray-200 rounded-lg bg-gray-50">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="useCustomProblem"
                  checked={useCustomProblem}
                  onChange={(e) => {
                    setUseCustomProblem(e.target.checked);
                    if (!e.target.checked) {
                      setProblemFile(null);
                    }
                  }}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
                <label htmlFor="useCustomProblem" className="text-sm font-medium cursor-pointer">
                  Upload custom problem file
                </label>
              </div>

              {useCustomProblem && (
                <div className="space-y-2 pl-6">
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
                  <p className="text-xs text-gray-600">
                    Upload a problem file for the selected <strong>{domains?.find(d => d.id === selectedDomain)?.name}</strong> domain. 
                    The planner will solve it automatically.
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Visualization */}
        {states.length > 0 && currentState && (
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>State {currentStateIndex + 1} of {states.length}</CardTitle>
                  <CardDescription>
                    {currentAction ? `After action: ${currentAction}` : "Initial state"}
                  </CardDescription>
                </div>
                <div className="text-sm text-gray-600">
                  Domain: <span className="font-semibold">{generateMutation.data?.domain || uploadMutation.data?.domain}</span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Canvas */}
              <div className="flex justify-center">
                <StateCanvas state={currentState} width={800} height={500} />
              </div>

              {/* Timeline Slider */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Timeline</label>
                <Slider
                  value={[currentStateIndex]}
                  onValueChange={([value]) => {
                    setCurrentStateIndex(value);
                    setIsPlaying(false);
                  }}
                  max={states.length - 1}
                  step={1}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Initial</span>
                  <span>Goal</span>
                </div>
              </div>

              {/* Playback Controls */}
              <div className="flex justify-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleReset}
                  disabled={currentStateIndex === 0}
                >
                  <SkipBack className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleStepBackward}
                  disabled={currentStateIndex === 0}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="default"
                  size="icon"
                  onClick={handlePlayPause}
                  className="w-12 h-12"
                >
                  {isPlaying ? (
                    <Pause className="h-5 w-5" />
                  ) : (
                    <Play className="h-5 w-5" />
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleStepForward}
                  disabled={currentStateIndex === states.length - 1}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleEnd}
                  disabled={currentStateIndex === states.length - 1}
                >
                  <SkipForward className="h-4 w-4" />
                </Button>
              </div>

              {/* Speed Control */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Playback Speed</label>
                <Slider
                  value={[playbackSpeed]}
                  onValueChange={([value]) => setPlaybackSpeed(value)}
                  min={200}
                  max={2000}
                  step={100}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Fast (0.2s)</span>
                  <span>Slow (2s)</span>
                </div>
              </div>

              {/* Plan Display */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Plan ({plan.length} steps)</label>
                <div className="bg-gray-50 rounded-lg p-4 space-y-1 max-h-40 overflow-y-auto">
                  {plan.map((action: string, index: number) => (
                    <div
                      key={index}
                      className={`text-sm font-mono ${
                        index === currentStateIndex - 1
                          ? "text-blue-600 font-semibold"
                          : "text-gray-600"
                      }`}
                    >
                      {index + 1}. {action}
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Empty State */}
        {states.length === 0 && !isGenerating && (
          <Card>
            <CardContent className="py-12">
              <div className="text-center space-y-4">
                <div className="text-6xl">🎯</div>
                <h3 className="text-xl font-semibold text-gray-900">No States Generated Yet</h3>
                <p className="text-gray-600">
                  {useCustomProblem 
                    ? "Select a domain, upload your problem file, and click 'Solve Problem'"
                    : "Select a domain and click 'Generate States' to visualize planning"
                  }
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
