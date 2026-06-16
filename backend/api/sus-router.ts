import { z } from "zod";
import { adminProcedure, publicProcedure, router } from "./_core/trpc";
import { appendSus, listSus } from "./sus";

export const susRouter = router({
  submitSus: publicProcedure
    .input(
      z.object({
        participantId: z.string().min(1),
        profile: z.enum(["lab_researcher", "cs_student"]).nullable(),
        studyDate: z.string(),
        facilitator: z.string(),
        noteTaker: z.string(),
        mode: z.enum(["in_person", "remote"]).nullable(),
        responses: z.array(z.number().int().min(1).max(5)).length(10),
        startedAt: z.string(),
        submittedAt: z.string(),
        durationMs: z.number().int().nonnegative(),
        userAgent: z.string().nullable(),
        exitInterview: z
          .object({
            useCases: z.string(),
            suggestions: z.string(),
            overallImpression: z.string(),
          })
          .nullable(),
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

  listSus: adminProcedure.query(async () => listSus()),
});
