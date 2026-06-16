import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import path from "path";
import { existsSync } from "fs";
import { fileURLToPath } from "url";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { DATA_DIR } from "../ndjson-store";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// DATA_DIR (incl. the DATA_DIR env override) is resolved in ndjson-store, so
// the static image routes below serve from the same folder the stores write to.
// Vite removed - frontend runs separately

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
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
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  // Static feedback images (PNGs written by the feedback router)
  app.use(
    "/api/feedback-images",
    express.static(path.join(DATA_DIR, "feedback-images"))
  );
  // Static verifier images (PNGs written per verified state, content-addressed)
  app.use(
    "/api/verifier-images",
    express.static(path.join(DATA_DIR, "verifier-images"))
  );
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
      allowMethodOverride: true,
    })
  );

  // Single-origin production serving: when a frontend build exists, serve it
  // (static assets + SPA history fallback) from this same Express server so
  // one URL (e.g. http://132.73.84.70:PORT) works without a separate dev
  // server or reverse proxy. In dev, no build exists, so this stays off and
  // the frontend keeps running on its own Vite server.
  // __dirname is .../backend/api/_core (dev) or .../backend/api/dist (prod);
  // both are 3 levels below the repo root, so frontend/dist resolves the same.
  const FRONTEND_DIST = path.resolve(__dirname, "../../../frontend/dist");
  if (existsSync(path.join(FRONTEND_DIST, "index.html"))) {
    app.use(express.static(FRONTEND_DIST));
    // History fallback for client-side routes — anything not under /api/.
    app.get(/^\/(?!api\/).*/, (_req, res) => {
      res.sendFile(path.join(FRONTEND_DIST, "index.html"));
    });
    console.log(`[server] Serving frontend build from ${FRONTEND_DIST}`);
  } else {
    console.log(
      "[server] No frontend build found — running API-only (dev mode; frontend served by Vite)."
    );
  }

  const preferredPort = parseInt(process.env.PORT || "4000"); // Backend on 4000, frontend on 3000
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
