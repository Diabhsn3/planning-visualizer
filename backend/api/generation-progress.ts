/**
 * Generation Progress Tracking
 * 
 * Simple progress tracking for LLM generation.
 * This is a simplified version for the naive LLM approach.
 */

export interface DetailedLog {
  timestamp: string;
  source: string;
  message: string;
  level: 'info' | 'success' | 'warning' | 'error';
}

export interface GenerationProgress {
  id: string;
  domain: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  currentStep: number;
  currentMessage: string;
  startTime: string;
  endTime?: string;
  success?: boolean;
  error?: string;
  detailedLogs: DetailedLog[];
}

// In-memory progress store
const progressStore: Map<string, GenerationProgress> = new Map();

/**
 * Generate a unique progress ID
 */
export function generateProgressId(): string {
  return `prog_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Create a new progress entry
 */
export function createProgress(id: string, domain: string): GenerationProgress {
  const progress: GenerationProgress = {
    id,
    domain,
    status: 'pending',
    currentStep: 0,
    currentMessage: 'Initializing...',
    startTime: new Date().toISOString(),
    detailedLogs: []
  };
  progressStore.set(id, progress);
  return progress;
}

/**
 * Update progress
 */
export function updateProgress(
  id: string,
  step: number,
  message: string,
  status: 'pending' | 'running' | 'completed' | 'error' = 'running'
): void {
  const progress = progressStore.get(id);
  if (progress) {
    progress.currentStep = step;
    progress.currentMessage = message;
    progress.status = status;
  }
}

/**
 * Add a detailed log entry
 */
export function addDetailedLog(
  id: string,
  source: string,
  message: string,
  level: 'info' | 'success' | 'warning' | 'error' = 'info'
): void {
  const progress = progressStore.get(id);
  if (progress) {
    progress.detailedLogs.push({
      timestamp: new Date().toISOString(),
      source,
      message,
      level
    });
  }
}

/**
 * Complete progress
 */
export function completeProgress(id: string, success: boolean, error?: string): void {
  const progress = progressStore.get(id);
  if (progress) {
    progress.status = success ? 'completed' : 'error';
    progress.success = success;
    progress.error = error;
    progress.endTime = new Date().toISOString();
  }
}

/**
 * Get progress by ID
 */
export function getProgress(id: string): GenerationProgress | undefined {
  return progressStore.get(id);
}

/**
 * Get latest progress
 */
export function getLatestProgress(): GenerationProgress | undefined {
  const entries = Array.from(progressStore.values());
  if (entries.length === 0) return undefined;
  return entries[entries.length - 1];
}

/**
 * Clean up old progress entries (keep last 10)
 */
export function cleanupOldProgress(): void {
  const entries = Array.from(progressStore.entries());
  if (entries.length > 10) {
    const toRemove = entries.slice(0, entries.length - 10);
    for (const [id] of toRemove) {
      progressStore.delete(id);
    }
  }
}
