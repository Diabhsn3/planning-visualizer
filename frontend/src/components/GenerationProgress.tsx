import { useEffect, useState } from "react";

/**
 * Simplified Generation Progress Component for Naive LLM Approach
 * 
 * This is a simpler version that doesn't rely on backend progress tracking.
 * It just shows a loading state while the LLM is generating.
 */

interface GenerationProgressProps {
  isGenerating: boolean;
  onComplete?: () => void;
  onShowResult?: () => void;
}

export function GenerationProgress({ isGenerating, onComplete, onShowResult }: GenerationProgressProps) {
  const [elapsedTime, setElapsedTime] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  const [userDismissed, setUserDismissed] = useState(false);

  // Timer for elapsed time
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isGenerating) {
      setElapsedTime(0);
      setIsFinished(false);
      interval = setInterval(() => {
        setElapsedTime((prev) => prev + 1);
      }, 1000);
    } else if (elapsedTime > 0) {
      // Generation finished
      setIsFinished(true);
      if (onComplete) {
        onComplete();
      }
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isGenerating]);

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

  // Hide if not generating and not finished
  if (!isGenerating && !isFinished) {
    return null;
  }

  const handleShowResult = () => {
    setUserDismissed(true);
    if (onShowResult) {
      onShowResult();
    }
  };

  const getStatusColor = () => {
    if (isFinished) return "bg-green-500";
    return "bg-blue-500";
  };

  const getStatusIcon = () => {
    if (isFinished) return "✓";
    return "⟳";
  };

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm z-10 rounded-xl">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 max-w-lg w-full mx-4">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white ${getStatusColor()}`}>
            <span className={!isFinished ? "animate-spin" : ""}>
              {getStatusIcon()}
            </span>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white">
              {isFinished ? "Generation Complete" : "Generating Renderer"}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Naive LLM Approach
            </p>
          </div>
        </div>

        {/* Progress Indicator */}
        <div className="mb-4">
          <div className="flex justify-between text-sm text-gray-600 dark:text-gray-300 mb-1">
            <span>{isFinished ? "Complete!" : "Generating renderer code..."}</span>
            <span>{elapsedTime}s</span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${getStatusColor()} ${!isFinished ? 'animate-pulse' : ''}`}
              style={{ width: isFinished ? '100%' : '60%' }}
            />
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {isFinished ? "Renderer ready" : "Direct LLM call (no MCP tools)"}
          </div>
        </div>

        {/* Info Box */}
        {!isFinished && (
          <div className="bg-amber-50 dark:bg-amber-900/30 rounded-lg p-3 text-sm text-amber-700 dark:text-amber-300">
            <p className="font-medium mb-1">Naive LLM Mode</p>
            <p className="text-xs">
              This uses a simple prompt without MCP tools or validation.
              Results may vary in quality compared to the full MCP approach.
            </p>
          </div>
        )}

        {/* Success Message with Show Result Button */}
        {isFinished && (
          <div className="mt-4 space-y-3">
            <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg text-green-700 dark:text-green-300 text-sm">
              Renderer generated! Click below to view the visualization.
            </div>
            <button
              onClick={handleShowResult}
              className="w-full py-2 px-4 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors"
            >
              Show Visualization
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
