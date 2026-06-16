import { z } from "zod";
import { adminProcedure, publicProcedure, router } from "./_core/trpc";
import { verifyImage } from "./verifier";
import { listVerifierRuns } from "./verifier-storage";
import { listFeedback } from "./feedback";
import {
  aggregateByDomain,
  aggregateByDomainAndProblem,
  aggregateByMethodDomainAndVersion,
  aggregateWithFeedback,
} from "./verifier-metrics";

/**
 * Strip the `data:image/png;base64,` prefix from a data URL.
 * Accepts either a raw base64 string or a full data URL.
 */
function stripDataUrl(s: string): string {
  const m = /^data:image\/png;base64,(.+)$/.exec(s);
  return m ? m[1] : s;
}

/** Compact per-state result returned by existingResultsForTrajectory. */
interface ResultDigest {
  precision: number | null;
  recall: number | null;
  parseFailure: boolean;
  tp: number;
  fp: number;
  fn: number;
}

const predicateSchemaSchema = z.array(
  z.object({
    name: z.string(),
    arg_types: z.array(z.string()),
  })
);
const pddlObjectsSchema = z.array(
  z.object({ name: z.string(), type: z.string() })
);

export const verifierRouter = router({
  /**
   * Verify a single canvas image against ground-truth predicates.
   *
   * The frontend captures the canvas as a PNG data URL and calls this
   * with the full context tuple (so the row joins with feedback.json).
   */
  verifyState: publicProcedure
    .input(
      z.object({
        // Image + ground truth
        pngBase64: z.string(),
        expected: z.array(z.string()),
        predicateSchema: predicateSchemaSchema,
        objects: pddlObjectsSchema,

        // Identifiers
        runId: z.string(),
        runKind: z.enum(["verify", "calibration"]).default("verify"),
        domainName: z.string(),
        problem: z.string().nullable(),
        problemHash: z.string().nullable(),
        renderMethod: z.string().nullable(),
        savedDomainDisplayName: z.string().nullable(),
        isCustomDomain: z.boolean(),
        savedDomainId: z.number().nullable(),
        transformerHash: z.string().nullable(),
        rendererHash: z.string().nullable(),
        llmProvider: z.string().nullable(),
        stateIndex: z.number().int().nonnegative(),
        totalStates: z.number().int().positive(),

        // Optional traceability
        feedbackId: z.number().int().positive().optional(),
        humanLabeller: z.string().optional(),
        imageProvenance: z.string().optional(),
        forceRefresh: z.boolean().default(false),
      })
    )
    .mutation(async ({ input }) => {
      const pngBase64 = stripDataUrl(input.pngBase64);
      return verifyImage({ ...input, pngBase64 });
    }),

  listVerifierRuns: adminProcedure
    .input(
      z
        .object({
          runId: z.string().optional(),
          runKind: z.enum(["verify", "calibration"]).optional(),
          domainName: z.string().optional(),
          rendererHash: z.string().optional(),
          feedbackId: z.number().int().positive().optional(),
        })
        .optional()
    )
    .query(async ({ input }) => listVerifierRuns(input)),

  aggregateVerifierRuns: adminProcedure
    .input(
      z
        .object({
          runId: z.string().optional(),
          runKind: z.enum(["verify", "calibration"]).optional(),
        })
        .optional()
    )
    .query(async ({ input }) => {
      const rows = await listVerifierRuns(input);
      const aggregateRows = rows.map((r) => ({
        domainName: r.domainName,
        precision: r.precision,
        recall: r.recall,
      }));
      return aggregateByDomain(aggregateRows);
    }),

  /**
   * Two-level rollup: domain → problem → states. Per-problem avgs are
   * means over their per-state metrics; per-domain avgs are means over
   * their per-problem averages (equal weight per problem). Nulls are
   * excluded from their respective averages at both levels.
   */
  aggregateByDomainAndProblem: adminProcedure
    .input(
      z
        .object({
          runId: z.string().optional(),
          runKind: z.enum(["verify", "calibration"]).optional(),
        })
        .optional()
    )
    .query(async ({ input }) => {
      const rows = await listVerifierRuns(input);
      return aggregateByDomainAndProblem(
        rows.map((r) => ({
          domainName: r.domainName,
          problem: r.problem ?? null,
          precision: r.precision,
          recall: r.recall,
        }))
      );
    }),

  /**
   * Return all already-verified rows for a given trajectory (same
   * renderer/transformer/saved domain on the same problem). Used by the
   * frontend to skip auto-verify on re-runs of an identical plan: if a
   * matching row exists for state N, the UI displays its P/R immediately
   * and does NOT fire verifyState.
   *
   * Matching rule:
   *   - savedDomainId set       → match (savedDomainId, problemHash).
   *   - savedDomainId null      → match (renderMethod, domainName,
   *                                      problemHash, transformerHash,
   *                                      rendererHash).
   *
   * Returns a map keyed by stateIndex. When multiple rows exist for the
   * same stateIndex (re-verifications), the most-recent wins.
   */
  existingResultsForTrajectory: publicProcedure
    .input(
      z.object({
        renderMethod: z.string().nullable(),
        domainName: z.string(),
        problemHash: z.string().nullable(),
        savedDomainId: z.number().nullable(),
        transformerHash: z.string().nullable(),
        rendererHash: z.string().nullable(),
      })
    )
    .query(async ({ input }) => {
      if (!input.problemHash) return {} as Record<number, ResultDigest>;
      const rows = await listVerifierRuns();
      const matching = rows.filter((r) => {
        if (r.problemHash !== input.problemHash) return false;
        if (input.savedDomainId !== null) {
          return r.savedDomainId === input.savedDomainId;
        }
        // No saved domain → must be the same method + domain + (renderer,
        // transformer) pair. nulls compare equal so two basic-mode runs
        // of the same domain match.
        return (
          (r.renderMethod ?? null) === (input.renderMethod ?? null) &&
          r.domainName === input.domainName &&
          (r.rendererHash ?? null) === (input.rendererHash ?? null) &&
          (r.transformerHash ?? null) === (input.transformerHash ?? null)
        );
      });
      // Sort by createdAt asc, then folding into a per-stateIndex map
      // leaves the newest result wins (since later puts overwrite).
      matching.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      const out: Record<number, ResultDigest> = {};
      for (const r of matching) {
        out[r.stateIndex] = {
          precision: r.precision,
          recall: r.recall,
          parseFailure: r.parseFailure,
          tp: r.tp.length,
          fp: r.fp.length,
          fn: r.fn.length,
        };
      }
      return out;
    }),

  /**
   * Full report: method → domain → version → problem → states, with both
   * the agent's P/R and the human rating averaged at every level, plus
   * per-state detail (screenshot, agent score, human rating + comment).
   * Powers the unified verifier page.
   */
  aggregateWithFeedback: adminProcedure.query(async () => {
    const [runs, feedback] = await Promise.all([
      listVerifierRuns(),
      listFeedback(),
    ]);
    return aggregateWithFeedback(
      runs.map((r) => ({
        // AggregateRowFull base
        domainName: r.domainName,
        problem: r.problem ?? null,
        precision: r.precision,
        recall: r.recall,
        renderMethod: r.renderMethod ?? null,
        savedDomainId: r.savedDomainId,
        savedDomainDisplayName: r.savedDomainDisplayName ?? null,
        rendererHash: r.rendererHash,
        transformerHash: r.transformerHash,
        isCustomDomain: r.isCustomDomain,
        llmProvider: r.llmProvider,
        // FullRow extras
        problemHash: r.problemHash ?? null,
        stateIndex: r.stateIndex,
        tp: r.tp.length,
        fp: r.fp.length,
        fn: r.fn.length,
        fnItems: r.fn,
        fpItems: r.fp,
        parseFailure: r.parseFailure,
        imageHash: r.imageHash,
        imagePath: r.imagePath ?? null,
        createdAt: r.createdAt,
      })),
      feedback.map((f) => ({
        rating: f.rating,
        comment: f.comment,
        savedDomainId: f.savedDomainId,
        domainName: f.domainName,
        rendererHash: f.rendererHash,
        transformerHash: f.transformerHash,
        problemHash: f.problemHash ?? null,
        stateIndex: f.stateIndex,
        imageHash: f.imageHash ?? null,
        imageFile: f.imageFile,
        createdAt: f.createdAt,
      }))
    );
  }),

  /**
   * Four-level rollup: method → domain → version → problem.
   * Drives the report page with sections for Basic / Claude / Gemini and
   * collapsable per-domain groups that contain per-version breakdowns.
   */
  aggregateByMethodDomainAndVersion: adminProcedure
    .input(
      z
        .object({
          runId: z.string().optional(),
          runKind: z.enum(["verify", "calibration"]).optional(),
        })
        .optional()
    )
    .query(async ({ input }) => {
      const rows = await listVerifierRuns(input);
      return aggregateByMethodDomainAndVersion(
        rows.map((r) => ({
          domainName: r.domainName,
          problem: r.problem ?? null,
          precision: r.precision,
          recall: r.recall,
          renderMethod: r.renderMethod ?? null,
          savedDomainId: r.savedDomainId,
          savedDomainDisplayName: r.savedDomainDisplayName ?? null,
          rendererHash: r.rendererHash,
          transformerHash: r.transformerHash,
          isCustomDomain: r.isCustomDomain,
          llmProvider: r.llmProvider,
        }))
      );
    }),
});
