import { z } from "zod";
import { adminProcedure, publicProcedure, router } from "./_core/trpc";
import { appendEvent, listEvents } from "./events";

export const eventsRouter = router({
  /**
   * Log a client-side event (session_start, render_crash, app_crash, …).
   * The clientId is taken from the server-issued cookie in ctx, never the
   * client, so it can't be spoofed and is consistent across a browser.
   */
  logEvent: publicProcedure
    .input(
      z.object({
        sessionId: z.string(),
        type: z.string().min(1),
        data: z.unknown().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const record = await appendEvent({
        clientId: ctx.clientId,
        sessionId: input.sessionId,
        type: input.type,
        data: input.data ?? null,
      });
      return { id: record.id };
    }),

  /** All events (for the facilitator's reliability rollup / CSV export). */
  listEvents: adminProcedure.query(async () => listEvents()),
});
