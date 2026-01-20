/**
 * Training Data Collector
 * 
 * Saves successful renderer generations for future fine-tuning.
 * Data is stored in JSONL format, which is the standard for LLM fine-tuning.
 */

import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// Types
// ============================================================================

export interface TrainingExample {
  id: string;
  timestamp: string;
  domain: string;
  provider: string;
  model: string;
  
  // Input data
  input: {
    domainName: string;
    states: any[];
    stateCount: number;
  };
  
  // Output data
  output: {
    rendererCode: string;
    functionName: string;
  };
  
  // Metadata
  metadata: {
    usedMcp: boolean;
    generationTimeMs: number;
    codeLength: number;
    validated: boolean;
  };
}

export interface TrainingDataStats {
  totalExamples: number;
  byDomain: Record<string, number>;
  byProvider: Record<string, number>;
  lastUpdated: string;
}

// ============================================================================
// Training Data Collector
// ============================================================================

export class TrainingDataCollector {
  private dataDir: string;
  private dataFile: string;
  private statsFile: string;

  constructor(dataDir?: string) {
    // Default to a 'training_data' folder in the project root
    this.dataDir = dataDir || path.join(process.cwd(), '..', '..', 'training_data');
    this.dataFile = path.join(this.dataDir, 'successful_renderers.jsonl');
    this.statsFile = path.join(this.dataDir, 'stats.json');
    
    this.ensureDataDir();
  }

  private ensureDataDir(): void {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
      console.log(`[TrainingDataCollector] Created data directory: ${this.dataDir}`);
    }
  }

  /**
   * Save a successful renderer generation as a training example
   */
  async saveSuccessfulGeneration(params: {
    domain: string;
    states: any[];
    rendererCode: string;
    functionName: string;
    provider: string;
    model: string;
    usedMcp: boolean;
    generationTimeMs: number;
  }): Promise<string> {
    const id = this.generateId();
    
    const example: TrainingExample = {
      id,
      timestamp: new Date().toISOString(),
      domain: params.domain,
      provider: params.provider,
      model: params.model,
      input: {
        domainName: params.domain,
        states: params.states,
        stateCount: params.states.length,
      },
      output: {
        rendererCode: params.rendererCode,
        functionName: params.functionName,
      },
      metadata: {
        usedMcp: params.usedMcp,
        generationTimeMs: params.generationTimeMs,
        codeLength: params.rendererCode.length,
        validated: true,
      },
    };

    // Append to JSONL file
    const line = JSON.stringify(example) + '\n';
    fs.appendFileSync(this.dataFile, line, 'utf-8');

    // Update stats
    await this.updateStats(example);

    console.log(`[TrainingDataCollector] Saved training example: ${id} (domain: ${params.domain})`);
    return id;
  }

  /**
   * Update statistics file
   */
  private async updateStats(example: TrainingExample): Promise<void> {
    let stats: TrainingDataStats;

    if (fs.existsSync(this.statsFile)) {
      stats = JSON.parse(fs.readFileSync(this.statsFile, 'utf-8'));
    } else {
      stats = {
        totalExamples: 0,
        byDomain: {},
        byProvider: {},
        lastUpdated: '',
      };
    }

    stats.totalExamples++;
    stats.byDomain[example.domain] = (stats.byDomain[example.domain] || 0) + 1;
    stats.byProvider[example.provider] = (stats.byProvider[example.provider] || 0) + 1;
    stats.lastUpdated = new Date().toISOString();

    fs.writeFileSync(this.statsFile, JSON.stringify(stats, null, 2), 'utf-8');
  }

  /**
   * Get current statistics
   */
  getStats(): TrainingDataStats | null {
    if (!fs.existsSync(this.statsFile)) {
      return null;
    }
    return JSON.parse(fs.readFileSync(this.statsFile, 'utf-8'));
  }

  /**
   * Get all training examples
   */
  getAllExamples(): TrainingExample[] {
    if (!fs.existsSync(this.dataFile)) {
      return [];
    }

    const content = fs.readFileSync(this.dataFile, 'utf-8');
    const lines = content.trim().split('\n').filter(line => line.length > 0);
    
    return lines.map(line => JSON.parse(line));
  }

  /**
   * Get examples for a specific domain
   */
  getExamplesByDomain(domain: string): TrainingExample[] {
    return this.getAllExamples().filter(ex => ex.domain === domain);
  }

  /**
   * Export data in format suitable for fine-tuning
   */
  exportForFineTuning(outputPath?: string): string {
    const examples = this.getAllExamples();
    const exportPath = outputPath || path.join(this.dataDir, 'finetune_dataset.jsonl');

    const fineTuneData = examples.map(ex => ({
      // Format for instruction fine-tuning
      instruction: `Generate a JavaScript canvas renderer function for the "${ex.domain}" planning domain. The function should visualize the following states:\n\n${JSON.stringify(ex.input.states.slice(0, 2), null, 2)}${ex.input.states.length > 2 ? '\n... and more states' : ''}`,
      input: `Domain: ${ex.domain}\nNumber of states: ${ex.input.stateCount}`,
      output: ex.output.rendererCode,
    }));

    const content = fineTuneData.map(d => JSON.stringify(d)).join('\n');
    fs.writeFileSync(exportPath, content, 'utf-8');

    console.log(`[TrainingDataCollector] Exported ${examples.length} examples to: ${exportPath}`);
    return exportPath;
  }

  /**
   * Generate unique ID for training example
   */
  private generateId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `train_${timestamp}_${random}`;
  }

  /**
   * Get the path to the data directory
   */
  getDataDir(): string {
    return this.dataDir;
  }
}

// Singleton instance
let collectorInstance: TrainingDataCollector | null = null;

export function getTrainingDataCollector(): TrainingDataCollector {
  if (!collectorInstance) {
    collectorInstance = new TrainingDataCollector();
  }
  return collectorInstance;
}
