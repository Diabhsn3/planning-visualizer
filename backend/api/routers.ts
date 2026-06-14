import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { visualizerRouter } from "./visualizer";
import { feedbackRouter } from "./feedback-router";
import { verifierRouter } from "./verifier-router";
import { susRouter } from "./sus-router";
import { eventsRouter } from "./events-router";

export const appRouter = router({
  system: systemRouter,
  visualizer: visualizerRouter,
  feedback: feedbackRouter,
  verifier: verifierRouter,
  sus: susRouter,
  events: eventsRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  // TODO: add feature routers here, e.g.
  // todo: router({
  //   list: protectedProcedure.query(({ ctx }) =>
  //     db.getUserTodos(ctx.user.id)
  //   ),
  // }),
});

export type AppRouter = typeof appRouter;
