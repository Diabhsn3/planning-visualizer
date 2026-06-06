import { z } from "zod";
import { publicProcedure, router } from "./_core/trpc";
import { appendFeedback, listFeedback } from "./feedback";
import type { FeedbackRecord } from "./feedback";
import { listVerifierRuns } from "./verifier-storage";
import type { VerifierRunRow } from "./verifier-storage";

const ratingSchema = z.number().min(1).max(5);

const norm = (s: string | null | undefined): string | null => s ?? null;

/**
 * Infer the visualization method for a feedback record that has no
 * matching verifier row to borrow it from. Mirrors the verifier's rule:
 * a built-in domain with no LLM code is "basic"; anything else is
 * attributed to its provider.
 */
function inferMethod(f: FeedbackRecord): string {
  const hasLLMCode = f.rendererHash !== null || f.transformerHash !== null;
  if (!hasLLMCode && !f.isCustomDomain) return "basic";
  const p = (f.llmProvider ?? "").toLowerCase();
  if (p.includes("gemini")) return "gemini";
  if (p.includes("claude")) return "claude";
  return f.llmProvider ?? "unknown";
}

/**
 * Find the verifier run that graded the same photo this feedback is for.
 *
 * Join key is the trajectory identity + stateIndex:
 *   - saved domain  → (savedDomainId, stateIndex)
 *   - non-saved     → (domainName, rendererHash, transformerHash, stateIndex)
 *
 * When the feedback carries a problemHash (recorded since the
 * cross-problem fix), it's required to match so a rating on one problem
 * doesn't bleed onto same-index states of another problem in the same
 * saved domain. Legacy feedback without a problemHash falls back to
 * trajectory + stateIndex only.
 */
function bestVerifierMatch(
  f: FeedbackRecord,
  runs: VerifierRunRow[]
): VerifierRunRow | null {
  const candidates = runs.filter((v) => {
    if (v.stateIndex !== f.stateIndex) return false;
    if (f.imageHash && v.imageHash && f.imageHash === v.imageHash) return true;
    if (f.problemHash && norm(v.problemHash) !== norm(f.problemHash)) return false;
    if (f.savedDomainId != null) return v.savedDomainId === f.savedDomainId;
    return (
      v.savedDomainId == null &&
      v.domainName === f.domainName &&
      norm(v.rendererHash) === norm(f.rendererHash) &&
      norm(v.transformerHash) === norm(f.transformerHash)
    );
  });
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return candidates[0];
}

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
        problemHash: z.string().nullable().optional().default(null),
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

  /**
   * Human feedback enriched with the agent's verification score for the
   * same photo. Powers the "Human feedback" section of the verifier page:
   * each entry shows the rendered image, the human rating + comment, and
   * (when a matching verifier run exists) the agent's precision/recall.
   * Newest first.
   */
  listFeedbackWithScores: publicProcedure.query(async () => {
    const [feedback, runs] = await Promise.all([
      listFeedback(),
      listVerifierRuns(),
    ]);
    return feedback
      .map((f) => {
        const v = bestVerifierMatch(f, runs);
        return {
          id: f.id,
          createdAt: f.createdAt,
          rating: f.rating,
          comment: f.comment,
          stateIndex: f.stateIndex,
          totalStates: f.totalStates,
          // Served by the static route in _core/index.ts; reachable from
          // the frontend through the /api vite proxy.
          imageUrl: `/api/${f.imageFile}`,
          // Grouping/labelling fields: prefer the matched verifier row
          // (which carries the corrected renderMethod + display name),
          // fall back to the feedback record's own fields.
          domainName: v?.domainName ?? f.domainName,
          renderMethod: v?.renderMethod ?? inferMethod(f),
          versionLabel:
            v?.savedDomainDisplayName ??
            (f.savedDomainId != null ? `#${f.savedDomainId}` : f.domainName),
          problem: v?.problem ?? null,
          verification: v
            ? {
                precision: v.precision,
                recall: v.recall,
                tp: v.tp.length,
                fp: v.fp.length,
                fn: v.fn.length,
                parseFailure: v.parseFailure,
              }
            : null,
        };
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }),
});
