import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { parse as parseCookie } from "cookie";
import { randomUUID } from "crypto";

/** Anonymous, persistent per-browser id — the unique-user proxy for the pilot. */
const CLIENT_ID_COOKIE = "pv_client_id";
const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: null; // Authentication not used in visualizer app
  /** Stable anonymous id from the pv_client_id cookie (issued here if absent). */
  clientId: string;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  const cookies = parseCookie(opts.req.headers.cookie || "");
  let clientId = cookies[CLIENT_ID_COOKIE];

  if (!clientId) {
    clientId = randomUUID();
    // Persistent, http-only, lax (single-origin) — no Secure so it works over
    // plain http on the lab server. Best-effort: never block the request.
    try {
      opts.res.cookie(CLIENT_ID_COOKIE, clientId, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: ONE_YEAR_MS,
      });
    } catch {
      /* response may already be committed; ignore */
    }
  }

  return {
    req: opts.req,
    res: opts.res,
    user: null,
    clientId,
  };
}
