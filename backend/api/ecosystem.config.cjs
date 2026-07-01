// PM2 process definition for the Planning Visualizer backend.
//
// Why this file exists: the deploy script must START the server if it isn't
// running yet (fresh boot / first deploy) and RELOAD it if it is — a bare
// `pm2 restart <name>` does nothing when no process exists ("No process
// found"), which leaves the API down and the frontend getting HTML (502)
// instead of JSON. `pm2 startOrReload ecosystem.config.cjs` handles both.
//
// Run it from this directory (cwd = backend/api) so the bundled server's
// `dotenv/config` picks up backend/api/.env — that's where the real config
// lives (PORT, DATA_DIR, ADMIN_TOKEN, ANTHROPIC_API_KEY, GEMINI_API_KEY,
// PYTHON_CMD). Do NOT put secrets in this committed file.

module.exports = {
  apps: [
    {
      name: "planning-visualizer",
      script: "dist/index.js",
      cwd: __dirname, // backend/api — so process.cwd() finds ./.env

      // Single process ONLY. The NDJSON stores + in-memory id counters assume
      // one writer; clustering would corrupt/duplicate data.
      instances: 1,
      exec_mode: "fork",

      autorestart: true,
      max_restarts: 10,
      max_memory_restart: "600M",
      time: true, // timestamp log lines

      env: {
        NODE_ENV: "production",
        // Everything else (PORT, DATA_DIR, ADMIN_TOKEN, API keys, PYTHON_CMD)
        // is loaded from backend/api/.env by dotenv at startup.
      },
    },
  ],
};
