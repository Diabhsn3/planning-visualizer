import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { parse as parseCookie } from "cookie";
import { randomUUID, timingSafeEqual } from "crypto";

/** Anonymous, persistent per-browser id — the unique-user proxy for the pilot. */
const CLIENT_ID_COOKIE = "pv_client_id";
const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

/** Header carrying the admin token for data-export endpoints. */
const ADMIN_TOKEN_HEADER = "x-admin-token";

function normalizeHeader(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

/** Constant-time compare; false on length mismatch or empty inputs. */
function tokensMatch(provided: string | undefined, expected: string): boolean {
  if (!provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: null; // Authentication not used in visualizer app
  /** Stable anonymous id from the pv_client_id cookie (issued here if absent). */
  clientId: string;
  /**
   * Whether admin gating is active. True only when ADMIN_TOKEN is configured on
   * the server. When false, admin endpoints stay open (local/dev convenience).
   */
  adminEnforced: boolean;
  /** True when the request is allowed to hit admin (data-export) procedures. */
  isAdmin: boolean;
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

  // Admin gating is enforced only when ADMIN_TOKEN is set. Otherwise the
  // data-export endpoints stay open (matches prior behavior for local/dev).
  const expectedAdminToken = process.env.ADMIN_TOKEN;
  const adminEnforced = !!expectedAdminToken;
  const providedAdminToken = normalizeHeader(opts.req.headers[ADMIN_TOKEN_HEADER]);
  const isAdmin = adminEnforced
    ? tokensMatch(providedAdminToken, expectedAdminToken)
    : true;

  return {
    req: opts.req,
    res: opts.res,
    user: null,
    clientId,
    adminEnforced,
    isAdmin,
  };
}
