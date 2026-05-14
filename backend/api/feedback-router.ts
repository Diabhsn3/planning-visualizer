import { z } from "zod";
import { publicProcedure, router } from "./_core/trpc";
import { appendFeedback, listFeedback } from "./feedback";

const ratingSchema = z.number().min(1).max(5);

export const feedbackRouter = router({
  submitFeedback: publicProcedure
    .input(
      z.object({
        rating: ratingSchema,
        comment: z.string().nullable(),
        domainName: z.string(),
        isCustomDomain: z.boolean(),
        savedDomainId: z.number().nullable(),
        transformerHash: z.string().nullable(),
        rendererHash: z.string().nullable(),
        llmProvider: z.string().nullable(),
        stateIndex: z.number().int().nonnegative(),
        totalStates: z.number().int().positive(),
        symbolicState: z.unknown(),
        imageDataUrl: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const record = await appendFeedback(input);
      return { id: record.id, createdAt: record.createdAt };
    }),

  listFeedback: publicProcedure
    .input(
      z
        .object({
          domainName: z.string().optional(),
          transformerHash: z.string().optional(),
          rendererHash: z.string().optional(),
          minRating: ratingSchema.optional(),
          maxRating: ratingSchema.optional(),
        })
        .optional()
    )
    .query(async ({ input }) => listFeedback(input)),
});
