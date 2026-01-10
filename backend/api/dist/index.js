var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});

// _core/index.ts
import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";

// shared/const.ts
var COOKIE_NAME = "app_session_id";
var ONE_YEAR_MS = 1e3 * 60 * 60 * 24 * 365;
var UNAUTHED_ERR_MSG = "Please login (10001)";
var NOT_ADMIN_ERR_MSG = "You do not have required permission (10002)";

// _core/cookies.ts
function isSecureRequest(req) {
  if (req.protocol === "https") return true;
  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;
  const protoList = Array.isArray(forwardedProto) ? forwardedProto : forwardedProto.split(",");
  return protoList.some((proto) => proto.trim().toLowerCase() === "https");
}
function getSessionCookieOptions(req) {
  return {
    httpOnly: true,
    path: "/",
    sameSite: "none",
    secure: isSecureRequest(req)
  };
}

// _core/systemRouter.ts
import { z } from "zod";

// _core/trpc.ts
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
var t = initTRPC.context().create({
  transformer: superjson
});
var router = t.router;
var publicProcedure = t.procedure;
var requireUser = t.middleware(async (opts) => {
  const { ctx, next } = opts;
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user
    }
  });
});
var protectedProcedure = t.procedure.use(requireUser);
var adminProcedure = t.procedure.use(
  t.middleware(async (opts) => {
    const { ctx, next } = opts;
    if (!ctx.user) {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }
    return next({
      ctx: {
        ...ctx,
        user: ctx.user
      }
    });
  })
);

// _core/systemRouter.ts
var systemRouter = router({
  health: publicProcedure.input(
    z.object({
      timestamp: z.number().min(0, "timestamp cannot be negative")
    })
  ).query(() => ({
    ok: true
  }))
});

// visualizer.ts
import { z as z2 } from "zod";
import { readFile, writeFile, mkdir, unlink } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { exec } from "child_process";
import { promisify } from "util";
var execAsync = promisify(exec);
var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);
var DATA_DIR = path.join(__dirname, "data");
function getPythonCommand() {
  if (process.env.PYTHON_CMD) {
    console.log("[Python Detection] Using PYTHON_CMD from environment:", process.env.PYTHON_CMD);
    return process.env.PYTHON_CMD;
  }
  const pythonCandidates = [
    "python3",
    "python",
    "python3.11",
    "python3.12",
    "/usr/bin/python3",
    "/usr/local/bin/python3",
    "/usr/bin/python3.11",
    "/usr/local/bin/python3.11"
  ];
  console.log("[Python Detection] Searching for Python executable...");
  for (const cmd of pythonCandidates) {
    try {
      const { execSync } = __require("child_process");
      const version = execSync(`${cmd} --version 2>&1`, {
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"]
      }).trim();
      console.log(`[Python Detection] Found: ${cmd} (${version})`);
      return cmd;
    } catch (error) {
    }
  }
  console.warn('[Python Detection] No Python found, defaulting to "python3"');
  return "python3";
}
var PYTHON_CMD = getPythonCommand();
console.log("[Python Detection] Using Python command:", PYTHON_CMD);
function resolvePlannerDir() {
  if (__dirname.endsWith("/dist") || __dirname.endsWith("\\dist")) {
    return path.join(__dirname, "../../planner");
  } else {
    return path.join(__dirname, "../planner");
  }
}
function resolvePlanningToolsDir() {
  if (__dirname.endsWith("/dist") || __dirname.endsWith("\\dist")) {
    return path.join(__dirname, "../../../planning-tools");
  } else {
    return path.join(__dirname, "../../planning-tools");
  }
}
var PLANNER_DIR = resolvePlannerDir();
var PLANNING_TOOLS_DIR = resolvePlanningToolsDir();
console.log("[Path Resolution] __dirname:", __dirname);
console.log("[Path Resolution] PLANNER_DIR:", PLANNER_DIR);
console.log("[Path Resolution] PLANNING_TOOLS_DIR:", PLANNING_TOOLS_DIR);
var DOMAIN_CONFIGS = {
  "blocks-world": {
    name: "Blocks World",
    description: "Classic block stacking problem",
    domainFile: path.join(PLANNER_DIR, "domains/blocks_world/domain.pddl")
  },
  "gripper": {
    name: "Gripper",
    description: "Robot with grippers moving balls between rooms",
    domainFile: path.join(PLANNER_DIR, "domains/gripper/domain.pddl")
  },
  "depot": {
    name: "Depot",
    description: "Trucks deliver packages between depots and distributors",
    domainFile: path.join(PLANNER_DIR, "domains/depot/domain.pddl")
  },
  "hanoi": {
    name: "Hanoi",
    description: "Moving disks between pegs (Tower of Hanoi)",
    domainFile: path.join(PLANNER_DIR, "domains/hanoi/domain.pddl")
  },
  "rovers": {
    name: "Rovers",
    description: "Planetary rovers navigating between waypoints and collecting images",
    domainFile: path.join(PLANNER_DIR, "domains/rovers/domain.pddl")
  }
};
var VALID_STRATEGY_IDS = [
  "astar-lmcut",
  "astar-blind",
  "astar-hmax",
  "greedy-ff",
  "lazy-greedy-ff",
  "greedy-add",
  "lama-first",
  "greedy-cea",
  "wastar-ff-3",
  "wastar-lmcut-2"
];
var visualizerRouter = router({
  /**
   * Generate states for pre-built examples
   */
  generateStates: publicProcedure.input(
    z2.object({
      domain: z2.enum(["blocks-world", "gripper", "depot", "hanoi", "rovers"])
    })
  ).mutation(async ({ input }) => {
    try {
      const dataFile = path.join(
        DATA_DIR,
        `${input.domain.replace("-", "_")}_rendered.json`
      );
      const data = JSON.parse(await readFile(dataFile, "utf-8"));
      const plan = [];
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
        states: data.states
      };
    } catch (error) {
      console.error("Error generating states:", error);
      throw new Error(
        error instanceof Error ? error.message : "Failed to generate states"
      );
    }
  }),
  /**
   * Upload custom problem file and solve with planner
   */
  uploadAndGenerate: publicProcedure.input(
    z2.object({
      domainContent: z2.string(),
      problemContent: z2.string(),
      domainName: z2.enum(["blocks-world", "gripper", "depot", "hanoi", "rovers"]),
      searchStrategy: z2.enum(VALID_STRATEGY_IDS).optional().default("lazy-greedy-ff")
    })
  ).mutation(async ({ input }) => {
    console.log("[uploadAndGenerate] Starting with domain:", input.domainName);
    console.log("[uploadAndGenerate] Search strategy:", input.searchStrategy);
    console.log("[uploadAndGenerate] Problem content length:", input.problemContent.length);
    let domainPath = "";
    let problemPath = "";
    try {
      const uploadsDir = path.join(__dirname, "uploads");
      await mkdir(uploadsDir, { recursive: true });
      const timestamp = Date.now();
      if (!input.domainContent || input.domainContent.trim() === "") {
        const domainConfig = DOMAIN_CONFIGS[input.domainName];
        if (!domainConfig) {
          throw new Error(`Unknown domain: ${input.domainName}`);
        }
        domainPath = domainConfig.domainFile;
      } else {
        domainPath = path.join(uploadsDir, `domain_${timestamp}.pddl`);
        await writeFile(domainPath, input.domainContent, "utf-8");
      }
      problemPath = path.join(uploadsDir, `problem_${timestamp}.pddl`);
      await writeFile(problemPath, input.problemContent, "utf-8");
      const pythonScript = path.join(PLANNER_DIR, "visualizer_api.py");
      console.log("[uploadAndGenerate] Running Python script...");
      console.log("[uploadAndGenerate] Using Python command:", PYTHON_CMD);
      const { stdout, stderr } = await execAsync(
        `"${PYTHON_CMD}" "${pythonScript}" "${domainPath}" "${problemPath}" "${input.domainName}" "${input.searchStrategy}"`,
        {
          maxBuffer: 50 * 1024 * 1024,
          // 50 MB to handle large plans (1000+ actions)
          timeout: 24e5,
          // 40 minute timeout for planner (Python default is 1800s/30min + buffer)
          env: {
            ...process.env,
            PYTHONPATH: "",
            // Clear PYTHONPATH to prevent Python 3.13 imports
            PYTHONHOME: ""
            // Clear PYTHONHOME as well
          }
        }
      );
      console.log("[uploadAndGenerate] Python script completed");
      console.log("[uploadAndGenerate] stdout length:", stdout.length);
      console.log("[uploadAndGenerate] stderr:", stderr || "none");
      if (stderr && !stdout) {
        throw new Error(`Python error: ${stderr}`);
      }
      console.log("[uploadAndGenerate] Parsing JSON output...");
      const data = JSON.parse(stdout);
      console.log("[uploadAndGenerate] JSON parsed successfully, success:", data.success);
      if (!data.success) {
        throw new Error(data.error || "Failed to solve problem");
      }
      try {
        console.log("[uploadAndGenerate] Cleaning up uploaded files...");
        await unlink(problemPath);
        console.log("[uploadAndGenerate] Deleted problem file:", problemPath);
        if (input.domainContent && input.domainContent.trim() !== "") {
          await unlink(domainPath);
          console.log("[uploadAndGenerate] Deleted domain file:", domainPath);
        }
      } catch (cleanupError) {
        console.warn("[uploadAndGenerate] Failed to clean up files:", cleanupError);
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
        search_strategy: data.search_strategy
      };
    } catch (error) {
      try {
        if (problemPath) {
          await unlink(problemPath).catch(() => {
          });
        }
        if (domainPath && input.domainContent && input.domainContent.trim() !== "") {
          await unlink(domainPath).catch(() => {
          });
        }
      } catch {
      }
      console.error("[uploadAndGenerate] Error:", error);
      console.error("[uploadAndGenerate] Error stack:", error instanceof Error ? error.stack : "No stack");
      throw new Error(
        error instanceof Error ? error.message : "Failed to process uploaded files"
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
      description: config.description
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
          timeout: 1e4,
          env: {
            ...process.env,
            PYTHONPATH: "",
            PYTHONHOME: ""
          }
        }
      );
      const data = JSON.parse(stdout);
      if (data.success) {
        return data.strategies;
      }
      throw new Error("Failed to get strategies");
    } catch (error) {
      console.error("[listStrategies] Error:", error);
      return [
        {
          id: "lazy-greedy-ff",
          name: "Lazy Greedy + FF (Very Fast)",
          description: "Lazy evaluation greedy search - fastest option",
          isOptimal: false,
          speed: "fast",
          whenToUse: "When speed is the priority and plan quality is secondary",
          warning: null
        },
        {
          id: "greedy-ff",
          name: "Greedy Best-First + FF (Fast)",
          description: "Fast satisficing search using FF heuristic",
          isOptimal: false,
          speed: "fast",
          whenToUse: "Best for quick results on medium to large problems",
          warning: null
        },
        {
          id: "astar-lmcut",
          name: "A* + LM-cut (Optimal)",
          description: "Optimal search using A* with landmark-cut heuristic",
          isOptimal: true,
          speed: "slow",
          whenToUse: "When you need the shortest possible plan and can wait",
          warning: "\u26A0\uFE0F Optimal search can be very slow for large problems (10+ objects). Consider using a satisficing strategy for faster results."
        }
      ];
    }
  }),
  /**
   * Check system status (Python, Fast Downward availability)
   */
  checkStatus: publicProcedure.query(async () => {
    const status = {
      python: { available: false, version: "", command: PYTHON_CMD },
      fastDownward: { available: false, path: "" }
    };
    try {
      const { stdout: pythonVersion } = await execAsync(`"${PYTHON_CMD}" --version`);
      status.python.available = true;
      status.python.version = pythonVersion.trim();
    } catch (error) {
      status.python.available = false;
    }
    try {
      const fdPath = path.join(PLANNING_TOOLS_DIR, "downward/fast-downward.py");
      const { stdout } = await execAsync(`"${PYTHON_CMD}" "${fdPath}" --help`, { timeout: 5e3 });
      if (stdout.includes("Fast Downward")) {
        status.fastDownward.available = true;
        status.fastDownward.path = fdPath;
      }
    } catch (error) {
      try {
        const altFdPath = path.join(__dirname, "../../planning-tools/downward/fast-downward.py");
        const { stdout } = await execAsync(`"${PYTHON_CMD}" "${altFdPath}" --help`, { timeout: 5e3 });
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
  getDomainDefinition: publicProcedure.input(z2.object({
    domainName: z2.enum(["blocks-world", "gripper", "depot", "hanoi", "rovers"])
  })).query(async ({ input }) => {
    const domainConfig = DOMAIN_CONFIGS[input.domainName];
    if (!domainConfig) {
      throw new Error(`Domain ${input.domainName} not found`);
    }
    try {
      const domainContent = await readFile(domainConfig.domainFile, "utf-8");
      return {
        domainName: input.domainName,
        content: domainContent
      };
    } catch (error) {
      console.error(`[getDomainDefinition] Error reading domain file:`, error);
      throw new Error(`Failed to read domain file for ${input.domainName}`);
    }
  })
});

// routers.ts
var appRouter = router({
  system: systemRouter,
  visualizer: visualizerRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true
      };
    })
  })
  // TODO: add feature routers here, e.g.
  // todo: router({
  //   list: protectedProcedure.query(({ ctx }) =>
  //     db.getUserTodos(ctx.user.id)
  //   ),
  // }),
});

// _core/context.ts
async function createContext(opts) {
  return {
    req: opts.req,
    res: opts.res,
    user: null
  };
}

// _core/index.ts
function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}
async function findAvailablePort(startPort = 3e3) {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}
async function startServer() {
  const app = express();
  const server = createServer(app);
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext
    })
  );
  const preferredPort = parseInt(process.env.PORT || "4000");
  const port = await findAvailablePort(preferredPort);
  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }
  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}
startServer().catch(console.error);
