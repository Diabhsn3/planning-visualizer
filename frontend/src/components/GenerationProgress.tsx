import { useEffect, useState, useRef } from "react";
import { trpc } from "@/lib/trpc";

interface ProgressStep {
  step: number;
  totalSteps: number;
  message: string;
  timestamp: number;
}

interface DetailedLog {
  timestamp: number;
  source: string;
  message: string;
  level: "info" | "success" | "warning" | "error";
}

interface GenerationProgressData {
  id: string;
  domainName: string;
  status: "pending" | "running" | "completed" | "error";
  currentStep: number;
  totalSteps: number;
  percentage: number;
  currentMessage: string;
  logs: ProgressStep[];
  detailedLogs: DetailedLog[];
  startTime: number;
  endTime?: number;
  error?: string;
}

interface GenerationProgressProps {
  isGenerating: boolean;
  onComplete?: () => void;
  onShowResult?: () => void; // New callback for when user clicks "Show Result"
}

export function GenerationProgress({ isGenerating, onComplete, onShowResult }: GenerationProgressProps) {
  const [progress, setProgress] = useState<GenerationProgressData | null>(null);
  const [showLogs, setShowLogs] = useState(true); // Default to showing logs
  const [isFinished, setIsFinished] = useState(false); // Track if generation finished
  const [userDismissed, setUserDismissed] = useState(false); // Track if user clicked Show Result
  const logsContainerRef = useRef<HTMLDivElement>(null);

  // Poll for progress updates
  // Keep polling even after isGenerating becomes false to catch the final status
  const { data } = trpc.visualizer.getGenerationProgress.useQuery(
    { progressId: undefined },
    {
      enabled: !userDismissed, // Keep polling until user dismisses
      refetchInterval: (!isFinished || isGenerating) ? 300 : false, // Poll every 300ms until finished
    }
  );

  useEffect(() => {
    if (data?.found && data.progress) {
      const progressData = data.progress as GenerationProgressData;
      setProgress(progressData);
      
      // Check if generation is complete
      if (progressData.status === "completed" || progressData.status === "error") {
        setIsFinished(true);
        if (onComplete) {
          onComplete();
        }
      }
    }
  }, [data, onComplete]);

  // Auto-scroll logs to bottom (within container only, not the page)
  useEffect(() => {
    if (showLogs && logsContainerRef.current) {
      const container = logsContainerRef.current;
      container.scrollTop = container.scrollHeight;
    }
  }, [progress?.detailedLogs, showLogs]);

  // Reset state when starting new generation
  useEffect(() => {
    if (isGenerating) {
      setIsFinished(false);
      setUserDismissed(false);
    }
  }, [isGenerating]);

  // Hide component when user dismisses it
  if (userDismissed) {
    return null;
  }

  // Hide if not generating and no progress to show
  if (!isGenerating && !progress && !isFinished) {
    return null;
  }

  // Calculate dynamic percentage based on actual step count
  // Use the higher of currentStep or totalSteps to avoid >100%
  const actualTotalSteps = Math.max(progress?.currentStep || 0, progress?.totalSteps || 1);
  const dynamicPercentage = progress?.status === "completed" 
    ? 100 
    : Math.min(100, Math.round(((progress?.currentStep || 0) / actualTotalSteps) * 100));

  const getStatusColor = () => {
    switch (progress?.status) {
      case "completed":
        return "bg-green-500";
      case "error":
        return "bg-red-500";
      case "running":
        return "bg-blue-500";
      default:
        return "bg-gray-400";
    }
  };

  const getStatusIcon = () => {
    switch (progress?.status) {
      case "completed":
        return "✓";
      case "error":
        return "✕";
      case "running":
        return "⟳";
      default:
        return "○";
    }
  };

  const getLogColor = (level: string) => {
    switch (level) {
      case "success":
        return "text-green-400";
      case "warning":
        return "text-yellow-400";
      case "error":
        return "text-red-400";
      default:
        return "text-gray-300";
    }
  };

  const getSourceColor = (source: string) => {
    if (source.includes("MCPClient")) return "text-cyan-400";
    if (source.includes("LLMOrchestrator")) return "text-purple-400";
    if (source.includes("LLM Renderer")) return "text-blue-400";
    return "text-gray-400";
  };

  const handleShowResult = () => {
    setUserDismissed(true);
    if (onShowResult) {
      onShowResult();
    }
  };

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm z-10 rounded-xl">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 max-w-lg w-full mx-4">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white ${getStatusColor()}`}>
            <span className={progress?.status === "running" ? "animate-spin" : ""}>
              {getStatusIcon()}
            </span>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white">
              {progress?.status === "completed" ? "Generation Complete" : 
               progress?.status === "error" ? "Generation Failed" : 
               "Generating Renderer"}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {progress?.domainName || "..."}
            </p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-4">
          <div className="flex justify-between text-sm text-gray-600 dark:text-gray-300 mb-1">
            <span>{progress?.currentMessage || "Initializing..."}</span>
            <span>{dynamicPercentage}%</span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${getStatusColor()}`}
              style={{ width: `${dynamicPercentage}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
            <span>Step {progress?.currentStep || 0}{progress?.status !== "completed" ? ` (autonomous)` : ""}</span>
            {progress?.startTime && (
              <span>
                {progress.endTime 
                  ? `${Math.round((progress.endTime - progress.startTime) / 1000)}s total`
                  : `${Math.round((Date.now() - progress.startTime) / 1000)}s elapsed`
                }
              </span>
            )}
          </div>
        </div>

        {/* Log Toggle */}
        <button
          onClick={() => setShowLogs(!showLogs)}
          className="text-sm text-blue-600 dark:text-blue-400 hover:underline mb-2"
        >
          {showLogs ? "Hide logs" : "Show logs"}
        </button>

        {/* Detailed Logs - Terminal Style */}
        {showLogs && (
          <div 
            ref={logsContainerRef}
            className="bg-gray-900 rounded-lg p-3 max-h-48 overflow-y-auto font-mono text-xs"
          >
            {progress?.detailedLogs && progress.detailedLogs.length > 0 ? (
              progress.detailedLogs.map((log, index) => (
                <div
                  key={index}
                  className={`flex items-start gap-1 py-0.5 ${getLogColor(log.level)}`}
                >
                  <span className={`shrink-0 ${getSourceColor(log.source)}`}>
                    [{log.source}]
                  </span>
                  <span className="break-all">{log.message}</span>
                </div>
              ))
            ) : (
              // Fallback to simple logs if no detailed logs
              progress?.logs?.map((log, index) => (
                <div
                  key={index}
                  className="flex items-start gap-2 text-gray-300 py-0.5"
                >
                  <span className="text-gray-500 shrink-0">
                    [Step {log.step}]
                  </span>
                  <span>{log.message}</span>
                </div>
              ))
            )}

          </div>
        )}

        {/* Error Message */}
        {progress?.status === "error" && progress.error && (
          <div className="mt-4 p-3 bg-red-100 dark:bg-red-900/30 rounded-lg text-red-700 dark:text-red-300 text-sm">
            {progress.error}
          </div>
        )}

        {/* Success Message with Show Result Button */}
        {progress?.status === "completed" && (
          <div className="mt-4 space-y-3">
            <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg text-green-700 dark:text-green-300 text-sm">
              Renderer generated successfully! Click below to view the visualization.
            </div>
            <button
              onClick={handleShowResult}
              className="w-full py-2 px-4 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors"
            >
              Show Visualization
            </button>
          </div>
        )}

        {/* Error Dismiss Button */}
        {progress?.status === "error" && (
          <div className="mt-4">
            <button
              onClick={() => setUserDismissed(true)}
              className="w-full py-2 px-4 bg-gray-600 hover:bg-gray-700 text-white font-medium rounded-lg transition-colors"
            >
              Dismiss
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
