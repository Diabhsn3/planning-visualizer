/**
 * Generation Progress Tracking
 * Tracks the progress of LLM renderer generation for frontend display.
 */

export interface GenerationStep {
  id: string;
  label: string;
  status: "pending" | "running" | "completed" | "failed";
  startTime?: number;
  endTime?: number;
  error?: string;
}

export interface GenerationProgress {
  sessionId: string;
  domainName: string;
  steps: GenerationStep[];
  currentStepIndex: number;
  overallStatus: "pending" | "running" | "completed" | "failed";
  startTime: number;
  endTime?: number;
}

// In-memory storage for progress (could be Redis in production)
const progressStore = new Map<string, GenerationProgress>();

/**
 * Create a new generation progress tracker
 */
export function createProgress(sessionId: string, domainName: string): GenerationProgress {
  const progress: GenerationProgress = {
    sessionId,
    domainName,
    steps: [
      { id: "connect", label: "Connecting to MCP server", status: "pending" },
      { id: "prompts", label: "Generating prompts", status: "pending" },
      { id: "llm", label: "Calling Claude API", status: "pending" },
      { id: "clean", label: "Cleaning generated code", status: "pending" },
      { id: "validate", label: "Validating renderer", status: "pending" },
      { id: "save", label: "Saving renderer", status: "pending" },
    ],
    currentStepIndex: 0,
    overallStatus: "pending",
    startTime: Date.now(),
  };
  
  progressStore.set(sessionId, progress);
  return progress;
}

/**
 * Update progress for a specific step
 */
export function updateProgress(
  sessionId: string,
  stepId: string,
  status: GenerationStep["status"],
  error?: string
): GenerationProgress | null {
  const progress = progressStore.get(sessionId);
  if (!progress) return null;
  
  const stepIndex = progress.steps.findIndex(s => s.id === stepId);
  if (stepIndex === -1) return progress;
  
  const step = progress.steps[stepIndex];
  step.status = status;
  
  if (status === "running") {
    step.startTime = Date.now();
    progress.currentStepIndex = stepIndex;
    progress.overallStatus = "running";
  } else if (status === "completed") {
    step.endTime = Date.now();
  } else if (status === "failed") {
    step.endTime = Date.now();
    step.error = error;
    progress.overallStatus = "failed";
    progress.endTime = Date.now();
  }
  
  // Check if all steps completed
  if (progress.steps.every(s => s.status === "completed")) {
    progress.overallStatus = "completed";
    progress.endTime = Date.now();
  }
  
  return progress;
}

/**
 * Get progress for a session
 */
export function getProgress(sessionId: string): GenerationProgress | null {
  return progressStore.get(sessionId) || null;
}

/**
 * Delete progress for a session
 */
export function deleteProgress(sessionId: string): void {
  progressStore.delete(sessionId);
}

/**
 * Get all active sessions
 */
export function getActiveSessions(): string[] {
  return Array.from(progressStore.keys()).filter(id => {
    const progress = progressStore.get(id);
    return progress && progress.overallStatus === "running";
  });
}