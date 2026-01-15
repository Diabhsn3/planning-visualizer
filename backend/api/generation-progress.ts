/**
 * Generation Progress Tracking
 * 
 * This module provides a simple way to track and report progress
 * during LLM renderer generation. It uses an in-memory store that
 * can be queried by the frontend via polling.
 */

export interface LogEntry {
  timestamp: number;
  source: string;  // e.g., "MCPClient", "LLMOrchestrator", "LLM Renderer"
  message: string;
  level: 'info' | 'success' | 'warning' | 'error';
}

export interface ProgressStep {
  step: number;
  totalSteps: number;
  message: string;
  timestamp: number;
}

export interface GenerationProgress {
  id: string;
  domainName: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  currentStep: number;
  totalSteps: number;
  percentage: number;
  currentMessage: string;
  logs: ProgressStep[];
  detailedLogs: LogEntry[];  // Full detailed logs like terminal output
  startTime: number;
  endTime?: number;
  error?: string;
}

// In-memory store for generation progress
// In a production app, you might use Redis or similar
const progressStore = new Map<string, GenerationProgress>();

// Initial estimate for total steps - will be updated dynamically
// The autonomous agentic loop can have variable iterations
const INITIAL_STEPS_ESTIMATE = 10;

/**
 * Create a new progress tracker for a generation session
 */
export function createProgress(id: string, domainName: string): GenerationProgress {
  const progress: GenerationProgress = {
    id,
    domainName,
    status: 'pending',
    currentStep: 0,
    totalSteps: INITIAL_STEPS_ESTIMATE,
    percentage: 0,
    currentMessage: 'Initializing...',
    logs: [],
    detailedLogs: [],
    startTime: Date.now(),
  };
  
  progressStore.set(id, progress);
  return progress;
}

/**
 * Add a detailed log entry (like terminal output)
 */
export function addDetailedLog(
  id: string,
  source: string,
  message: string,
  level: 'info' | 'success' | 'warning' | 'error' = 'info'
): void {
  const progress = progressStore.get(id);
  if (!progress) return;
  
  progress.detailedLogs.push({
    timestamp: Date.now(),
    source,
    message,
    level,
  });
  
  progressStore.set(id, progress);
}

/**
 * Update progress for a generation session
 */
export function updateProgress(
  id: string,
  step: number,
  message: string,
  status?: 'running' | 'completed' | 'error'
): void {
  const progress = progressStore.get(id);
  if (!progress) return;
  
  progress.currentStep = step;
  progress.currentMessage = message;
  
  // Dynamically adjust totalSteps if current step exceeds it
  // This handles the autonomous agentic loop which can have variable iterations
  if (step > progress.totalSteps) {
    progress.totalSteps = step + 2; // Always show some room ahead
  }
  
  progress.percentage = Math.round((step / progress.totalSteps) * 100);
  
  if (status) {
    progress.status = status;
  } else if (progress.status === 'pending') {
    progress.status = 'running';
  }
  
  progress.logs.push({
    step,
    totalSteps: progress.totalSteps,
    message,
    timestamp: Date.now(),
  });
  
  if (status === 'completed' || status === 'error') {
    progress.endTime = Date.now();
  }
  
  progressStore.set(id, progress);
}

/**
 * Mark a generation as complete
 */
export function completeProgress(id: string, success: boolean, error?: string): void {
  const progress = progressStore.get(id);
  if (!progress) return;
  
  progress.status = success ? 'completed' : 'error';
  progress.currentStep = progress.totalSteps;
  progress.percentage = 100;
  progress.currentMessage = success ? 'Generation complete!' : 'Generation failed';
  progress.endTime = Date.now();
  
  if (error) {
    progress.error = error;
  }
  
  progress.logs.push({
    step: progress.totalSteps,
    totalSteps: progress.totalSteps,
    message: success ? 'Generation complete!' : `Error: ${error}`,
    timestamp: Date.now(),
  });
  
  progressStore.set(id, progress);
}

/**
 * Get progress for a generation session
 */
export function getProgress(id: string): GenerationProgress | null {
  return progressStore.get(id) || null;
}

/**
 * Get the most recent progress (useful when only one generation at a time)
 */
export function getLatestProgress(): GenerationProgress | null {
  const entries = Array.from(progressStore.entries());
  if (entries.length === 0) return null;
  
  // Return the most recent one
  return entries.sort((a, b) => b[1].startTime - a[1].startTime)[0][1];
}

/**
 * Clean up old progress entries (older than 5 minutes)
 */
export function cleanupOldProgress(): void {
  const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
  
  const entries = Array.from(progressStore.entries());
  for (const [id, progress] of entries) {
    if (progress.endTime && progress.endTime < fiveMinutesAgo) {
      progressStore.delete(id);
    }
  }
}

/**
 * Generate a unique progress ID
 */
export function generateProgressId(): string {
  return `gen_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}
