import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = t.procedure.use(requireUser);

// One-time warning so an operator notices when admin endpoints are unguarded.
let warnedAdminOpen = false;

// Gates data-export endpoints behind an admin token. Active only when
// ADMIN_TOKEN is configured (see context.ts); otherwise it stays open for
// local/dev. Replaces the old check on ctx.user, which was always null.
export const adminProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.adminEnforced && !warnedAdminOpen) {
      warnedAdminOpen = true;
      console.warn(
        "[auth] ADMIN_TOKEN is not set — data-export endpoints are OPEN. " +
          "Set ADMIN_TOKEN (server) + send the x-admin-token header to require auth.",
      );
    }

    if (!ctx.isAdmin) {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    return next({ ctx });
  }),
);
