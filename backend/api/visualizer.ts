import { publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { readFile, writeFile, mkdir, unlink } from "fs/promises";
import { generateRenderer, type LLMProvider } from "./llm-renderer";
import { generateTransformer } from "./llm-domain-interpreter";
import { listSavedDomains, getSavedDomain, saveDomain, findSavedDomainByPddl, findAllSavedDomainsByPddl, deleteSavedDomain } from "./saved-domains";
import { saveBasicRenderer, findBasicRenderer } from "./basic-renderer-cache";
import { logEventSafe } from "./events";
import path from "path";
import { fileURLToPath } from "url";
import { randomUUID } from "crypto";
import { exec, spawn, type ChildProcess } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

/**
 * Run the planner in its OWN detached process group and reproduce the parts of
 * execFile we relied on — utf-8 buffering, a maxBuffer cap, and a timeout-kill —
 * plus the error shape (`killed`/`signal`/`stdout`/`stderr`) the solve catch
 * blocks inspect. execFile can't set `detached`, but cancelSolve needs the group
 * so `process.kill(-pid, "SIGTERM")` can take down the whole tree (python3 +
 * Fast Downward) rather than orphaning the grandchild. POSIX-only, matching the
 * cancelSolve group-kill (the planner only runs on the Linux/macOS lab server).
 */
function runPlannerDetached(
  cmd: string,
  args: string[],
  opts: { maxBuffer: number; timeout: number; env: NodeJS.ProcessEnv },
): Promise<{ stdout: string; stderr: string }> & { child: ChildProcess } {
  const child = spawn(cmd, args, {
    detached: true,
    env: opts.env,
    stdio: ["ignore", "pipe", "pipe"],
  });

  const promise = new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    let stdout = "";
    let stderr = "";
    let settled = false;
    let killedByTimeout = false;

    const killGroup = (signal: NodeJS.Signals) => {
      try {
        if (child.pid) process.kill(-child.pid, signal);
        else child.kill(signal);
      } catch {
        child.kill(signal);
      }
    };

    const settle = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn();
    };

    const timer = setTimeout(() => {
      killedByTimeout = true;
      killGroup("SIGTERM");
    }, opts.timeout);

    const onChunk = (which: "out" | "err") => (buf: Buffer) => {
      if (which === "out") stdout += buf.toString("utf8");
      else stderr += buf.toString("utf8");
      if (stdout.length + stderr.length > opts.maxBuffer) {
        killGroup("SIGTERM");
        settle(() => reject(new Error(`Planner output exceeded maxBuffer (${opts.maxBuffer} bytes)`)));
      }
    };
    child.stdout?.on("data", onChunk("out"));
    child.stderr?.on("data", onChunk("err"));

    child.on("error", (err) => settle(() => reject(err)));

    child.on("close", (code, signal) => {
      settle(() => {
        if (code === 0 && !signal) {
          resolve({ stdout, stderr });
          return;
        }
        // Non-zero exit, or killed by signal (cancel / timeout). Mirror the
        // execFile error shape so the catch blocks classify it correctly.
        const err = new Error(
          `Planner exited with ${signal ? `signal ${signal}` : `code ${code}`}`
        ) as Error & {
          killed: boolean;
          signal: NodeJS.Signals | null;
          code: number | null;
          stdout: string;
          stderr: string;
        };
        err.killed = killedByTimeout || signal != null;
        err.signal = signal ?? (killedByTimeout ? "SIGTERM" : null);
        err.code = code;
        err.stdout = stdout;
        err.stderr = stderr;
        reject(err);
      });
    });
  });

  return Object.assign(promise, { child });
}

// In-flight planner subprocesses, keyed by the per-solve `solveId` the
// frontend generates. cancelSolve looks a child up here and SIGTERMs its
// process group. `cancelledSolves` lets the solve mutation recognize that
// its rejection was a user cancel (vs a real failure) and surface a benign
// "CANCELLED" error. This is a single-process Express server, so a module
// map is shared across the solve and cancel requests.
const runningSolves = new Map<string, ChildProcess>();
const cancelledSolves = new Set<string>();

// Node-side hard kill for the planner subprocess. Defaults to the Python-side
// PLANNER_TIMEOUT (seconds) + a 10-minute buffer so Node never kills the planner
// before Python's own timeout fires. Override directly with NODE_PLANNER_TIMEOUT_MS.
const PLANNER_NODE_TIMEOUT_MS = (() => {
  const explicit = process.env.NODE_PLANNER_TIMEOUT_MS;
  if (explicit) return parseInt(explicit, 10);
  const pyTimeoutSec = parseInt(process.env.PLANNER_TIMEOUT ?? "1800", 10);
  return (pyTimeoutSec + 600) * 1000;
})();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
  "greedy-ff",
  "lazy-greedy-ff",
  "greedy-add",
  "lama-first",
  "greedy-cea",
] as const;

export const visualizerRouter = router({
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
        sessionId: z.string().optional(),
        solveId: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      console.log('[uploadAndGenerate] Starting with domain:', input.domainName);
      console.log('[uploadAndGenerate] Search strategy:', input.searchStrategy);
      console.log('[uploadAndGenerate] Problem content length:', input.problemContent.length);

      const startedAt = Date.now();
      const sessionId = input.sessionId ?? null;
      let outcomeLogged = false;

      let domainPath: string = "";
      let problemPath: string = "";

      try {
        // Create uploads directory
        const uploadsDir = path.join(__dirname, "uploads");
        await mkdir(uploadsDir, { recursive: true });

        // Unique per-request token (uuid) so simultaneous uploads never
        // collide on a shared filename in the uploads dir.
        const timestamp = `${Date.now()}_${randomUUID()}`;

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
        // execFile (argv array, no shell) so domain/problem/strategy args are
        // passed literally — no shell parsing/injection surface.
        // detached:true puts the planner in its own process group so a cancel
        // can SIGTERM the whole tree (python3 + Fast Downward). We await the
        // promise (never unref) so stdout/stderr/timeout behave as before.
        const plannerProc = runPlannerDetached(
          PYTHON_CMD,
          [pythonScript, domainPath, problemPath, input.domainName, input.searchStrategy],
          {
            maxBuffer: 50 * 1024 * 1024, // 50 MB to handle large plans (1000+ actions)
            timeout: PLANNER_NODE_TIMEOUT_MS,
            env: {
              ...process.env,
              PYTHONPATH: '', // Clear PYTHONPATH to prevent Python 3.13 imports
              PYTHONHOME: '', // Clear PYTHONHOME as well
            },
          }
        );
        if (input.solveId) runningSolves.set(input.solveId, plannerProc.child);
        const { stdout, stderr } = await plannerProc;
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

        if (Array.isArray(data.generation_warnings) && data.generation_warnings.length > 0) {
          console.warn('[uploadAndGenerate] state-gen warnings:', data.generation_warnings.length, data.generation_warnings.slice(0, 5));
        }

        if (!data.success) {
          await logEventSafe({
            clientId: ctx.clientId,
            sessionId,
            type: "solve_attempt",
            data: {
              success: false,
              custom: false,
              domain: input.domainName,
              searchStrategy: input.searchStrategy,
              errorType: data.error_type ?? "planner_failure",
              durationMs: Date.now() - startedAt,
            },
          });
          outcomeLogged = true;
          throw new Error(data.error || "Failed to solve problem");
        }

        await logEventSafe({
          clientId: ctx.clientId,
          sessionId,
          type: "solve_attempt",
          data: {
            success: true,
            custom: false,
            domain: input.domainName,
            searchStrategy: input.searchStrategy,
            numStates: data.num_states ?? null,
            durationMs: Date.now() - startedAt,
          },
        });
        outcomeLogged = true;

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
          raw_states: data.raw_states ?? null,
          predicate_schema: data.predicate_schema ?? null,
          objects: data.objects ?? null,
          problem_hash: data.problem_hash ?? null,
          generation_warnings: data.generation_warnings ?? [],
          used_planner: data.used_planner,
          planner_info: data.planner_info,
          search_strategy: data.search_strategy,
        };
      } catch (error) {
        // Was this a user cancel (cancelSolve killed the planner group)?
        // Either we flagged the solveId, or the rejection carries the SIGTERM
        // we sent. Surface a benign, recognizable error instead of a failure.
        const wasCancelled =
          (input.solveId != null && cancelledSolves.has(input.solveId)) ||
          ((error as any)?.killed === true && (error as any)?.signal === "SIGTERM");
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
        if (!outcomeLogged) {
          await logEventSafe({
            clientId: ctx.clientId,
            sessionId,
            type: "solve_attempt",
            data: {
              success: false,
              custom: false,
              domain: input.domainName,
              searchStrategy: input.searchStrategy,
              errorType: wasCancelled ? "cancelled" : "exception",
              durationMs: Date.now() - startedAt,
            },
          });
        }
        throw new Error(
          wasCancelled
            ? "CANCELLED"
            : error instanceof Error
            ? error.message
            : "Failed to process uploaded files"
        );
      } finally {
        if (input.solveId) {
          runningSolves.delete(input.solveId);
          cancelledSolves.delete(input.solveId);
        }
      }
    }),

  /**
   * Upload a fully custom domain + problem file and solve with planner.
   * Unlike uploadAndGenerate, this accepts any domain name and requires
   * the domain PDDL content to be provided. The DefaultRenderer handles
   * state generation for unknown domains.
   */
  uploadAndGenerateCustom: publicProcedure
    .input(
      z.object({
        domainContent: z.string().min(1, "Domain PDDL content is required"),
        problemContent: z.string().min(1, "Problem PDDL content is required"),
        domainName: z.string().min(1, "Domain name is required"),
        searchStrategy: z.enum(VALID_STRATEGY_IDS).optional().default("lazy-greedy-ff"),
        sessionId: z.string().optional(),
        solveId: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      console.log('[uploadAndGenerateCustom] Starting with custom domain:', input.domainName);
      console.log('[uploadAndGenerateCustom] Search strategy:', input.searchStrategy);

      const startedAt = Date.now();
      const sessionId = input.sessionId ?? null;
      let outcomeLogged = false;

      let domainPath: string = "";
      let problemPath: string = "";

      try {
        const uploadsDir = path.join(__dirname, "uploads");
        await mkdir(uploadsDir, { recursive: true });
        // Unique per-request token (uuid) to avoid simultaneous-upload collisions.
        const timestamp = `${Date.now()}_${randomUUID()}`;

        domainPath = path.join(uploadsDir, `custom_domain_${timestamp}.pddl`);
        problemPath = path.join(uploadsDir, `custom_problem_${timestamp}.pddl`);
        await writeFile(domainPath, input.domainContent, "utf-8");
        await writeFile(problemPath, input.problemContent, "utf-8");

        const pythonScript = path.join(PLANNER_DIR, "visualizer_api.py");
        console.log('[uploadAndGenerateCustom] Running Python script...');

        // Pass "custom" as domain_name to skip domain mismatch detection.
        // execFile (argv array, no shell) — no shell injection surface.
        // detached:true → own process group so cancelSolve can kill the tree.
        const plannerProc = runPlannerDetached(
          PYTHON_CMD,
          [pythonScript, domainPath, problemPath, "custom", input.searchStrategy],
          {
            maxBuffer: 50 * 1024 * 1024,
            timeout: PLANNER_NODE_TIMEOUT_MS,
            env: {
              ...process.env,
              PYTHONPATH: '',
              PYTHONHOME: '',
            },
          }
        );
        if (input.solveId) runningSolves.set(input.solveId, plannerProc.child);
        const { stdout, stderr } = await plannerProc;

        console.log('[uploadAndGenerateCustom] Python script completed');
        if (stderr && !stdout) {
          throw new Error(`Python error: ${stderr}`);
        }

        const data = JSON.parse(stdout);
        if (Array.isArray(data.generation_warnings) && data.generation_warnings.length > 0) {
          console.warn('[uploadAndGenerateCustom] state-gen warnings:', data.generation_warnings.length, data.generation_warnings.slice(0, 5));
        }
        if (!data.success) {
          await logEventSafe({
            clientId: ctx.clientId,
            sessionId,
            type: "solve_attempt",
            data: {
              success: false,
              custom: true,
              domain: input.domainName,
              searchStrategy: input.searchStrategy,
              errorType: data.error_type ?? "planner_failure",
              durationMs: Date.now() - startedAt,
            },
          });
          outcomeLogged = true;
          throw new Error(data.error || "Failed to solve custom problem");
        }

        await logEventSafe({
          clientId: ctx.clientId,
          sessionId,
          type: "solve_attempt",
          data: {
            success: true,
            custom: true,
            domain: input.domainName,
            searchStrategy: input.searchStrategy,
            numStates: data.num_states ?? null,
            durationMs: Date.now() - startedAt,
          },
        });
        outcomeLogged = true;

        try {
          await unlink(domainPath);
          await unlink(problemPath);
        } catch { /* ignore cleanup errors */ }

        return {
          success: true,
          domain: data.domain,
          problem: data.problem,
          plan: data.plan,
          num_states: data.num_states,
          states: data.states,
          raw_states: data.raw_states ?? null,
          predicate_schema: data.predicate_schema ?? null,
          objects: data.objects ?? null,
          problem_hash: data.problem_hash ?? null,
          generation_warnings: data.generation_warnings ?? [],
          used_planner: data.used_planner,
          planner_info: data.planner_info,
          search_strategy: data.search_strategy,
        };
      } catch (error) {
        const wasCancelled =
          (input.solveId != null && cancelledSolves.has(input.solveId)) ||
          ((error as any)?.killed === true && (error as any)?.signal === "SIGTERM");
        try {
          if (domainPath) await unlink(domainPath).catch(() => {});
          if (problemPath) await unlink(problemPath).catch(() => {});
        } catch { /* ignore */ }
        console.error('[uploadAndGenerateCustom] Error:', error);
        if (!outcomeLogged) {
          await logEventSafe({
            clientId: ctx.clientId,
            sessionId,
            type: "solve_attempt",
            data: {
              success: false,
              custom: true,
              domain: input.domainName,
              searchStrategy: input.searchStrategy,
              errorType: wasCancelled ? "cancelled" : "exception",
              durationMs: Date.now() - startedAt,
            },
          });
        }
        throw new Error(
          wasCancelled
            ? "CANCELLED"
            : error instanceof Error
            ? error.message
            : "Failed to process custom domain files"
        );
      } finally {
        if (input.solveId) {
          runningSolves.delete(input.solveId);
          cancelledSolves.delete(input.solveId);
        }
      }
    }),

  /**
   * Cancel an in-flight solve. The frontend passes the same per-solve
   * `solveId` it sent to uploadAndGenerate(Custom); we look up that solve's
   * child process and SIGTERM its entire process group (python3 + the Fast
   * Downward search child), freeing the box immediately. The killed planner
   * makes the original mutation reject; that path recognizes the cancel and
   * surfaces a benign "CANCELLED" error.
   */
  cancelSolve: publicProcedure
    .input(z.object({ solveId: z.string() }))
    .mutation(async ({ input }) => {
      const child = runningSolves.get(input.solveId);
      if (!child || !child.pid) {
        // Already finished (or never registered) between request and cancel.
        return { cancelled: false };
      }
      cancelledSolves.add(input.solveId);
      try {
        // Negative pid → signal the whole process group from detached:true.
        process.kill(-child.pid, "SIGTERM");
      } catch {
        // ESRCH: the process exited between the lookup and the kill. Benign.
      }
      runningSolves.delete(input.solveId);
      return { cancelled: true };
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

  // ==================== LLM RENDERER ENDPOINTS ====================

  /**
   * Generate a Canvas renderer using an LLM (Claude or Gemini).
   * Accepts domain name, PDDL domain text, transformer code, and the LLM provider.
   * No sample states needed — the LLM reads the transformer code to understand the enriched state structure.
   * Returns the generated TypeScript code.
   */
  llmGenerateRenderer: publicProcedure
    .input(
      z.object({
        domainName: z.string(),
        states: z.array(z.any()),
        domainPddl: z.string(),
        transformerCode: z.string(),
        provider: z.enum(["claude", "gemini"]),
        sessionId: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      console.log("[Stage 2 - Renderer] ========================================");
      console.log("[Stage 2 - Renderer] Starting canvas renderer generation");
      console.log("[Stage 2 - Renderer] Domain:", input.domainName);
      console.log("[Stage 2 - Renderer] Provider:", input.provider);
      console.log("[Stage 2 - Renderer] Sample enriched states:", input.states.length);
      console.log("[Stage 2 - Renderer] PDDL domain length:", input.domainPddl.length);
      console.log("[Stage 2 - Renderer] Transformer code length:", input.transformerCode.length);

      const llmStartedAt = Date.now();
      const result = await generateRenderer({
        domainName: input.domainName,
        states: input.states,
        domainPddl: input.domainPddl,
        transformerCode: input.transformerCode,
        provider: input.provider as LLMProvider,
      });

      await logEventSafe({
        clientId: ctx.clientId,
        sessionId: input.sessionId ?? null,
        type: "llm_call",
        data: {
          kind: "renderer",
          provider: input.provider,
          domain: input.domainName,
          success: result.success,
          errorType: result.success ? null : (result.error ?? "llm_failure"),
          durationMs: Date.now() - llmStartedAt,
        },
      });

      if (!result.success) {
        console.error("[Stage 2 - Renderer] FAILED:", result.error);
        throw new Error(result.error || "LLM generation failed");
      }
      console.log("[Stage 2 - Renderer] SUCCESS - Code length:", result.code?.length || 0);

      // Persist basic-domain LLM renderers in the shared artifact store so
      // they can be recalled later. The custom-domain flow has its own
      // persistence path (saveDomainToLibrary), which is signaled by a
      // non-empty transformerCode — we skip the basic cache in that case
      // to avoid double-bookkeeping.
      if (result.code && input.transformerCode === "") {
        try {
          const persisted = await saveBasicRenderer(
            input.domainName,
            input.provider,
            result.code
          );
          console.log(
            `[Stage 2 - Renderer] Cached as basic renderer (hash=${persisted.artifactHash.slice(0, 12)}…, reused=${persisted.reused})`
          );
        } catch (err) {
          console.warn("[Stage 2 - Renderer] Failed to persist basic renderer:", err);
        }
      }

      console.log("[Stage 2 - Renderer] ========================================");
      return result;
    }),

  /**
   * Look up a cached LLM-generated renderer for a basic (built-in) domain
   * by (domain, provider). Returns the hydrated code if one was previously
   * generated, or null. The frontend calls this BEFORE invoking the LLM
   * so a cache hit short-circuits the call.
   */
  lookupBasicRenderer: publicProcedure
    .input(
      z.object({
        domain: z.string(),
        provider: z.enum(["claude", "gemini"]),
      })
    )
    .query(async ({ input }) => {
      const hit = await findBasicRenderer(input.domain, input.provider);
      if (hit) {
        console.log(
          `[lookupBasicRenderer] HIT — (${input.domain}, ${input.provider}) → ${hit.artifactHash.slice(0, 12)}…`
        );
      } else {
        console.log(
          `[lookupBasicRenderer] MISS — no cached renderer for (${input.domain}, ${input.provider})`
        );
      }
      return hit;
    }),

  // ==================== PDDL DOMAIN INTERPRETER ====================

  /**
   * Generate a TypeScript state transformer for a custom PDDL domain.
   * Accepts the domain name, full PDDL domain text, and the LLM provider.
   * Accepts sample states from the example problem + PDDL domain text.
   * Returns the generated and transpiled JavaScript transformer code.
   */
  llmGenerateTransformer: publicProcedure
    .input(
      z.object({
        domainName: z.string(),
        domainPddl: z.string(),
        sampleStates: z.array(z.any()),
        provider: z.enum(["claude", "gemini"]),
        sessionId: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      console.log("[llmGenerateTransformer] Starting for domain:", input.domainName);
      console.log("[llmGenerateTransformer] Provider:", input.provider);
      console.log("[llmGenerateTransformer] PDDL length:", input.domainPddl.length);
      console.log("[llmGenerateTransformer] Sample states:", input.sampleStates.length);

      const llmStartedAt = Date.now();
      const result = await generateTransformer({
        domainName: input.domainName,
        domainPddl: input.domainPddl,
        sampleStates: input.sampleStates,
        provider: input.provider as LLMProvider,
      });

      await logEventSafe({
        clientId: ctx.clientId,
        sessionId: input.sessionId ?? null,
        type: "llm_call",
        data: {
          kind: "transformer",
          provider: input.provider,
          domain: input.domainName,
          success: result.success,
          errorType: result.success ? null : (result.error ?? "llm_failure"),
          durationMs: Date.now() - llmStartedAt,
        },
      });

      if (!result.success) {
        throw new Error(result.error || "LLM transformer generation failed");
      }
      return result;
    }),


  // ==================== SAVED DOMAINS LIBRARY ====================

  /**
   * List all saved custom domains (metadata only).
   */
  listSavedDomains: publicProcedure
    .query(async () => {
      console.log("[listSavedDomains] Fetching saved domains library");
      const domains = await listSavedDomains();
      console.log(`[listSavedDomains] Found ${domains.length} saved domains`);
      return domains;
    }),

  /**
   * Load a saved domain by ID (full data including transformer + renderer code).
   */
  loadSavedDomain: publicProcedure
    .input(
      z.object({
        id: z.number(),
      })
    )
    .query(async ({ input }) => {
      console.log(`[loadSavedDomain] Loading domain id=${input.id}`);
      const domain = await getSavedDomain(input.id);
      if (!domain) {
        throw new Error(`Saved domain not found: id=${input.id}`);
      }
      console.log(`[loadSavedDomain] Loaded: ${domain.displayName}`);
      return domain;
    }),

  /**
   * Look up saved domains by the hash of an uploaded PDDL.
   *
   * Returns:
   *   - `matches`: lightweight metadata for ALL saved entries with the same
   *     pddlHash, newest-first. The frontend uses this to render rows in
   *     the "duplicate detected" modal so the user can pick a specific
   *     version to reuse.
   *   - `latest`: the newest match with code hydrated, or null. Provided
   *     for callers that just want the most-recent version without an
   *     extra round-trip through getSavedDomain.
   */
  lookupSavedDomainByPddl: publicProcedure
    .input(
      z.object({
        domainPddl: z.string(),
      })
    )
    .query(async ({ input }) => {
      const matches = await findAllSavedDomainsByPddl(input.domainPddl);
      const latest = matches.length > 0
        ? await findSavedDomainByPddl(input.domainPddl)
        : null;
      if (matches.length > 0) {
        console.log(
          `[lookupSavedDomainByPddl] HIT — ${matches.length} match(es); latest "${matches[0].displayName}" (id=${matches[0].id})`
        );
      } else {
        console.log("[lookupSavedDomainByPddl] MISS — no cached domain");
      }
      return { matches, latest };
    }),

  /**
   * Save a custom domain to the library after successful LLM generation.
   * Called automatically after both transformer and renderer are generated.
   */
  saveDomainToLibrary: publicProcedure
    .input(
      z.object({
        domainName: z.string(),
        domainPddl: z.string(),
        transformerCode: z.string(),
        rendererCode: z.string(),
        provider: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      console.log(`[saveDomainToLibrary] Saving domain: ${input.domainName}`);
      const saved = await saveDomain({
        domainName: input.domainName,
        domainPddl: input.domainPddl,
        transformerCode: input.transformerCode,
        rendererCode: input.rendererCode,
        provider: input.provider,
      });
      console.log(`[saveDomainToLibrary] Saved as: ${saved.displayName} (id=${saved.id})`);
      return saved;
    }),

  /**
   * Remove a saved domain from the library by ID. Note that the
   * underlying artifact files in `data/artifacts/` are intentionally
   * left in place — they're content-addressed and may be shared with
   * other entries (or with the basic-renderer cache).
   */
  deleteSavedDomain: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      console.log(`[deleteSavedDomain] Deleting domain id=${input.id}`);
      const removed = await deleteSavedDomain(input.id);
      if (!removed) {
        throw new Error(`Saved domain not found: id=${input.id}`);
      }
      return { success: true, id: input.id };
    }),
});
