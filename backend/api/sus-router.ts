import { z } from "zod";
import { publicProcedure, router } from "./_core/trpc";
import { appendSus, listSus } from "./sus";

export const susRouter = router({
  submitSus: publicProcedure
    .input(
      z.object({
        participantName: z.string().min(1),
        responses: z.array(z.number().int().min(1).max(5)).length(10),
        startedAt: z.string(),
        submittedAt: z.string(),
        durationMs: z.number().int().nonnegative(),
        userAgent: z.string().nullable(),
      })
    )
    .mutation(async ({ input }) => {
      const record = await appendSus(input);
      return {
        id: record.id,
        createdAt: record.createdAt,
        score: record.score,
      };
    }),

  listSus: publicProcedure.query(async () => listSus()),
});
