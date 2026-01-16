import { publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { readFile, writeFile, mkdir, unlink } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { exec } from "child_process";
import { promisify } from "util";
import { generateLLMRenderer, checkLLMRendererStatus, getCachedRenderer, clearRendererCache, getGenerationProgress } from "./llm-renderer.js";
import { generateDirectLLMRenderer } from "./direct-llm-renderer.js";

const execAsync = promisify(exec);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, "data");

// Detect Python executable
function getPythonCommand(): string {
  // Check environment variable first
  if (process.env.PYTHON_CMD) {
    console.log('[Python Detection] Using PYTHON_CMD from environment:', process.env.PYTHON_CMD);
    return process.env.PYTHON_CMD;
  }
  
  // Try common Python paths (prioritize python3 over python3.11 for broader compatibility)
  const pythonCandidates = [
    'python3',
    'python',
    'python3.11',
    'python3.12',
    '/usr/bin/python3',
    '/usr/local/bin/python3',
    '/usr/bin/python3.11',
    '/usr/local/bin/python3.11',
  ];
  
  console.log('[Python Detection] Searching for Python executable...');
  
  for (const cmd of pythonCandidates) {
    try {
      const { execSync } = require('child_process');
      const version = execSync(`${cmd} --version 2>&1`, { 
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe']
      }).trim();
      console.log(`[Python Detection] Found: ${cmd} (${version})`);
      return cmd;
    } catch (error) {
      // Command not found, try next
    }
  }
  
  console.warn('[Python Detection] No Python found, defaulting to "python3"');
  return 'python3';
}

// ################# Determines the command we will use to run the Planner script.
const PYTHON_CMD = getPythonCommand();
console.log('[Python Detection] Using Python command:', PYTHON_CMD);

// Domain configurations - use absolute paths based on file location
// Handle both development (running from source) and production (running from dist)
function resolvePlannerDir(): string {
  // __dirname will be:
  // - Development: /path/to/planning-visualizer/backend/api
  // - Production: /path/to/planning-visualizer/backend/api/dist
  
  // Check if we're in dist folder
  if (__dirname.endsWith('/dist') || __dirname.endsWith('\\dist')) {
    // Production: dist -> api -> planner (within backend)
    // dist is inside api, so go up twice to get to backend, then into planner
    return path.join(__dirname, '../../planner');
  } else {
    // Development: api -> planner (within backend)
    return path.join(__dirname, '../planner');
  }
}

function resolvePlanningToolsDir(): string {
  if (__dirname.endsWith('/dist') || __dirname.endsWith('\\dist')) {
    // Production: dist -> api -> backend -> project root -> planning-tools
    return path.join(__dirname, '../../../planning-tools');
  } else {
    // Development: api -> backend -> project root -> planning-tools
    return path.join(__dirname, '../../planning-tools');
  }
}

const PLANNER_DIR = resolvePlannerDir();
const PLANNING_TOOLS_DIR = resolvePlanningToolsDir();

console.log('[Path Resolution] __dirname:', __dirname);
console.log('[Path Resolution] PLANNER_DIR:', PLANNER_DIR);
console.log('[Path Resolution] PLANNING_TOOLS_DIR:', PLANNING_TOOLS_DIR);

const DOMAIN_CONFIGS = {
  "blocks-world": {
    name: "Blocks World",
    description: "Classic block stacking problem",
    domainFile: path.join(PLANNER_DIR, "domains/blocks_world/domain.pddl"),
  },

  "gripper": {
    name: "Gripper",
    description: "Robot with grippers moving balls between rooms",
    domainFile: path.join(PLANNER_DIR, "domains/gripper/domain.pddl"),
  },

  "depot": {
    name: "Depot",
    description: "Trucks deliver packages between depots and distributors",
    domainFile: path.join(PLANNER_DIR, "domains/depot/domain.pddl"),
  },

  "hanoi": {
    name: "Hanoi",
    description: "Moving disks between pegs (Tower of Hanoi)",
    domainFile: path.join(PLANNER_DIR, "domains/hanoi/domain.pddl"),
  },
  "rovers": {
    name: "Rovers",
    description: "Planetary rovers navigating between waypoints and collecting images",
    domainFile: path.join(PLANNER_DIR, "domains/rovers/domain.pddl"),
  },
    "satellite": {
    name: "Satellite",
    description: "Satellites calibrate instruments, take images, and transmit them",
    domainFile: path.join(PLANNER_DIR, "domains/satellite/domain.pddl"),
  },
};

// Whitelist of valid search strategy IDs (must match backend/planner/search_strategies.py)
const VALID_STRATEGY_IDS = [
  "astar-lmcut",
  "astar-blind", 
  "astar-hmax",
  "greedy-ff",
  "lazy-greedy-ff",
  "greedy-add",
  "lama-first",
  "greedy-cea",
  "wastar-ff-3",
  "wastar-lmcut-2",
] as const;

export const visualizerRouter = router({
  /**
   * Generate states for pre-built examples
   */
  generateStates: publicProcedure
    .input(
      z.object({
        domain: z.enum(["blocks-world", "gripper", "depot", "hanoi", "rovers", "satellite"]),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const dataFile = path.join(
          DATA_DIR,
          `${input.domain.replace("-", "_")}_rendered.json`
        );
        const data = JSON.parse(await readFile(dataFile, "utf-8"));

        // Extract plan from states
        const plan: string[] = [];
        for (let i = 1; i < data.states.length; i++) {
          const action = data.states[i].metadata?.action;
          if (action) {
            plan.push(action);
          }
        }

        return {
          success: true,
          domain: input.domain,
          problem: "example",
          plan,
          num_states: data.states.length,
          states: data.states,
        };
      } catch (error) {
        console.error("Error generating states:", error);
        throw new Error(
          error instanceof Error
            ? error.message
            : "Failed to generate states"
        );
      }
    }),

  /**
   * Upload custom problem file and solve with planner
   */
  uploadAndGenerate: publicProcedure
    .input(
      z.object({
        domainContent: z.string(),
        problemContent: z.string(),
        domainName: z.enum(["blocks-world", "gripper", "depot", "hanoi", "rovers", "satellite"]),
        searchStrategy: z.enum(VALID_STRATEGY_IDS).optional().default("lazy-greedy-ff"),
      })
    )
    .mutation(async ({ input }) => {
      console.log('[uploadAndGenerate] Starting with domain:', input.domainName);
      console.log('[uploadAndGenerate] Search strategy:', input.searchStrategy);
      console.log('[uploadAndGenerate] Problem content length:', input.problemContent.length);
      
      let domainPath: string = "";
      let problemPath: string = "";
      
      try {
        // Create uploads directory
        const uploadsDir = path.join(__dirname, "uploads");
        await mkdir(uploadsDir, { recursive: true });

        const timestamp = Date.now();

        // If domainContent is empty, use the domain file from repository
        if (!input.domainContent || input.domainContent.trim() === "") {
          // Use existing domain file
          const domainConfig = DOMAIN_CONFIGS[input.domainName as keyof typeof DOMAIN_CONFIGS];
          if (!domainConfig) {
            throw new Error(`Unknown domain: ${input.domainName}`);
          }
          domainPath = domainConfig.domainFile; // Already absolute path
        } else {
          // Save uploaded domain file
          domainPath = path.join(uploadsDir, `domain_${timestamp}.pddl`);
          await writeFile(domainPath, input.domainContent, "utf-8");
        }

        // Save problem file
        problemPath = path.join(uploadsDir, `problem_${timestamp}.pddl`);
        await writeFile(problemPath, input.problemContent, "utf-8");

        // Run Python pipeline with planner and search strategy
        const pythonScript = path.join(PLANNER_DIR, "visualizer_api.py");

        console.log('[uploadAndGenerate] Running Python script...');
        console.log('[uploadAndGenerate] Using Python command:', PYTHON_CMD);
        
        // Pass search strategy as 4th argument
        const { stdout, stderr } = await execAsync(
          `"${PYTHON_CMD}" "${pythonScript}" "${domainPath}" "${problemPath}" "${input.domainName}" "${input.searchStrategy}"`,
          {
            maxBuffer: 50 * 1024 * 1024, // 50 MB to handle large plans (1000+ actions)
            timeout: 2400000, // 40 minute timeout for planner (Python default is 1800s/30min + buffer)
            env: {
              ...process.env,
              PYTHONPATH: '', // Clear PYTHONPATH to prevent Python 3.13 imports
              PYTHONHOME: '', // Clear PYTHONHOME as well
            },
          }
        );
        console.log('[uploadAndGenerate] Python script completed');
        console.log('[uploadAndGenerate] stdout length:', stdout.length);
        console.log('[uploadAndGenerate] stderr:', stderr || 'none');

        if (stderr && !stdout) {
          throw new Error(`Python error: ${stderr}`);
        }

        // Parse JSON output
        console.log('[uploadAndGenerate] Parsing JSON output...');
        const data = JSON.parse(stdout);
        console.log('[uploadAndGenerate] JSON parsed successfully, success:', data.success);

        if (!data.success) {
          throw new Error(data.error || "Failed to solve problem");
        }

        // Clean up uploaded files after successful processing
        try {
          console.log('[uploadAndGenerate] Cleaning up uploaded files...');
          await unlink(problemPath);
          console.log('[uploadAndGenerate] Deleted problem file:', problemPath);
          
          // Only delete domain file if it was uploaded (not using repository domain)
          if (input.domainContent && input.domainContent.trim() !== "") {
            await unlink(domainPath);
            console.log('[uploadAndGenerate] Deleted domain file:', domainPath);
          }
        } catch (cleanupError) {
          console.warn('[uploadAndGenerate] Failed to clean up files:', cleanupError);
          // Don't throw error for cleanup failures - the main operation succeeded
        }

        return {
          success: true,
          domain: data.domain,
          problem: data.problem,
          plan: data.plan,
          num_states: data.num_states,
          states: data.states,
          used_planner: data.used_planner,
          planner_info: data.planner_info,
          search_strategy: data.search_strategy,
        };
      } catch (error) {
        // Clean up files even on error
        try {
          if (problemPath) {
            await unlink(problemPath).catch(() => {});
          }
          if (domainPath && input.domainContent && input.domainContent.trim() !== "") {
            await unlink(domainPath).catch(() => {});
          }
        } catch {
          // Ignore cleanup errors in error handler
        }
        console.error('[uploadAndGenerate] Error:', error);
        console.error('[uploadAndGenerate] Error stack:', error instanceof Error ? error.stack : 'No stack');
        throw new Error(
          error instanceof Error
            ? error.message
            : "Failed to process uploaded files"
        );
      }
    }),

  /**
   * Get list of available domains
   */
  listDomains: publicProcedure.query(() => {
    return Object.entries(DOMAIN_CONFIGS).map(([id, config]) => ({
      id,
      name: config.name,
      description: config.description,
    }));
  }),

  /**
   * Get list of available search strategies
   */
  listStrategies: publicProcedure.query(async () => {
    try {
      const pythonScript = path.join(PLANNER_DIR, "visualizer_api.py");
      const { stdout } = await execAsync(
        `"${PYTHON_CMD}" "${pythonScript}" list-strategies`,
        {
          timeout: 10000,
          env: {
            ...process.env,
            PYTHONPATH: '',
            PYTHONHOME: '',
          },
        }
      );
      
      const data = JSON.parse(stdout);
      if (data.success) {
        return data.strategies;
      }
      throw new Error("Failed to get strategies");
    } catch (error) {
      console.error('[listStrategies] Error:', error);
      // Return hardcoded fallback if Python fails
      return [
        {
          id: "lazy-greedy-ff",
          name: "Lazy Greedy + FF (Very Fast)",
          description: "Lazy evaluation greedy search - fastest option",
          isOptimal: false,
          speed: "fast",
          whenToUse: "When speed is the priority and plan quality is secondary",
          warning: null,
        },
        {
          id: "greedy-ff",
          name: "Greedy Best-First + FF (Fast)",
          description: "Fast satisficing search using FF heuristic",
          isOptimal: false,
          speed: "fast",
          whenToUse: "Best for quick results on medium to large problems",
          warning: null,
        },
        {
          id: "astar-lmcut",
          name: "A* + LM-cut (Optimal)",
          description: "Optimal search using A* with landmark-cut heuristic",
          isOptimal: true,
          speed: "slow",
          whenToUse: "When you need the shortest possible plan and can wait",
          warning: "⚠️ Optimal search can be very slow for large problems (10+ objects). Consider using a satisficing strategy for faster results.",
        },
      ];
    }
  }),

  /**
   * Check system status (Python, Fast Downward availability)
   */
  checkStatus: publicProcedure.query(async () => {
    const status = {
      python: { available: false, version: "", command: PYTHON_CMD },
      fastDownward: { available: false, path: "" },
    };

    try {
      // Check Python
      const { stdout: pythonVersion } = await execAsync(`"${PYTHON_CMD}" --version`);
      status.python.available = true;
      status.python.version = pythonVersion.trim();
    } catch (error) {
      status.python.available = false;
    }

    try {
      // Check Fast Downward
      const fdPath = path.join(PLANNING_TOOLS_DIR, "downward/fast-downward.py");
      const { stdout } = await execAsync(`"${PYTHON_CMD}" "${fdPath}" --help`, { timeout: 5000 });
      if (stdout.includes("Fast Downward")) {
        status.fastDownward.available = true;
        status.fastDownward.path = fdPath;
      }
    } catch (error) {
      // Try alternative path (repository root)
      try {
        const altFdPath = path.join(__dirname, "../../planning-tools/downward/fast-downward.py");
        const { stdout } = await execAsync(`"${PYTHON_CMD}" "${altFdPath}" --help`, { timeout: 5000 });
        if (stdout.includes("Fast Downward")) {
          status.fastDownward.available = true;
          status.fastDownward.path = altFdPath;
        }
      } catch {
        status.fastDownward.available = false;
      }
    }

    return status;
  }),

  /**
   * Get domain definition text for a specific domain
   */
  getDomainDefinition: publicProcedure
    .input(z.object({
      domainName: z.enum(["blocks-world", "gripper", "depot", "hanoi", "rovers", "satellite"]),
    }))
    .query(async ({ input }) => {
      const domainConfig = DOMAIN_CONFIGS[input.domainName];
      if (!domainConfig) {
        throw new Error(`Domain ${input.domainName} not found`);
      }

      try {
        const domainContent = await readFile(domainConfig.domainFile, "utf-8");
        return {
          domainName: input.domainName,
          content: domainContent,
        };
      } catch (error) {
        console.error(`[getDomainDefinition] Error reading domain file:`, error);
        throw new Error(`Failed to read domain file for ${input.domainName}`);
      }
    }),

  /**
   * Generate TypeScript renderer using LLM
   * NO CACHING - always generates fresh code
   * 
   * @param useMcp - If true, uses MCP-based generation with tools and validation.
   *                 If false, uses direct LLM generation with simple prompts.
   */
  generateLLMRenderer: publicProcedure
    .input(
      z.object({
        domainName: z.string(),
        states: z.array(z.any()),
        styleHints: z.string().optional(),
        useMcp: z.boolean().optional().default(true),
      })
    )
    .mutation(async ({ input }) => {
      console.log('[generateLLMRenderer] Starting for domain:', input.domainName);
      console.log('[generateLLMRenderer] Number of states:', input.states.length);
      console.log('[generateLLMRenderer] Using MCP:', input.useMcp);
      
      if (input.useMcp) {
        // Use MCP-based generation with tools and validation
        const result = await generateLLMRenderer({
          domain_name: input.domainName,
          states: input.states,
          style_hints: input.styleHints,
        });
        
        console.log('[generateLLMRenderer] MCP Result success:', result.success);
        if (!result.success) {
          console.error('[generateLLMRenderer] Error:', result.error);
        }
        if (result.saved_file) {
          console.log('[generateLLMRenderer] Saved:', result.saved_file);
        }
        
        return {
          success: result.success,
          typescript_code: result.typescript_code,
          error: result.error,
          saved_file: result.saved_file || null,
          progress_id: result.progress_id || null,
        };
      } else {
        // Use direct LLM generation without MCP
        const result = await generateDirectLLMRenderer({
          domain_name: input.domainName,
          states: input.states,
          style_hints: input.styleHints,
        });
        
        console.log('[generateLLMRenderer] Direct Result success:', result.success);
        if (!result.success) {
          console.error('[generateLLMRenderer] Error:', result.error);
        }
        if (result.saved_file) {
          console.log('[generateLLMRenderer] Saved:', result.saved_file);
        }
        
        return {
          success: result.success,
          typescript_code: result.typescript_code,
          error: result.error,
          saved_file: result.saved_file || null,
          progress_id: null, // Direct approach doesn't use progress tracking
        };
      }
    }),

  /**
   * Check LLM renderer availability
   */
  checkLLMStatus: publicProcedure.query(async () => {
    return await checkLLMRendererStatus();
  }),

  /**
   * Get cached renderer for a domain
   */
  getCachedRenderer: publicProcedure
    .input(z.object({ domainName: z.string() }))
    .query(({ input }) => {
      console.log('[getCachedRenderer] Looking for cached renderer for:', input.domainName);
      const cached = getCachedRenderer(input.domainName);
      if (cached) {
        console.log('[getCachedRenderer] Found cached renderer:', cached.filename);
        return {
          found: true,
          code: cached.code,
          filename: cached.filename
        };
      }
      console.log('[getCachedRenderer] No cached renderer found');
      return {
        found: false,
        code: null,
        filename: null
      };
    }),

  /**
   * Clear all cached renderers
   */
  clearRendererCache: publicProcedure.mutation(async () => {
    console.log('[clearRendererCache] Clearing all cached renderers');
    const result = clearRendererCache();
    console.log('[clearRendererCache] Result:', result);
    return result;
  }),

  /**
   * Get generation progress
   * Used for polling during LLM renderer generation
   */
  getGenerationProgress: publicProcedure
    .input(z.object({ progressId: z.string().optional() }))
    .query(({ input }) => {
      const progress = getGenerationProgress(input.progressId);
      if (!progress) {
        return {
          found: false,
          progress: null
        };
      }
      return {
        found: true,
        progress: {
          id: progress.id,
          domainName: progress.domainName,
          status: progress.status,
          currentStep: progress.currentStep,
          totalSteps: progress.totalSteps,
          percentage: progress.percentage,
          currentMessage: progress.currentMessage,
          logs: progress.logs,
          detailedLogs: progress.detailedLogs || [],
          startTime: progress.startTime,
          endTime: progress.endTime,
          error: progress.error,
        }
      };
    }),
});
