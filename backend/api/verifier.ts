/**
 * Verifier orchestration.
 *
 * Thin layer that combines:
 *   - `llm-verifier.extractPredicates` — the only LLM surface (unvis).
 *   - `verifier-metrics.setMetrics` — pure set-arithmetic grading.
 *   - `verifier-storage` — append-only log + extraction cache.
 *   - `loadDomainPddl` — domain PDDL lookup for built-in and saved
 *     domains, kept here for callers that need raw PDDL.
 *
 * This module owns the cache-then-call-then-grade flow. The router just
 * shapes input/output. The metric math stays in verifier-metrics.ts.
 */

import { readFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { getSavedDomain } from "./saved-domains";
import { extractPredicates, hashImage, EXTRACTOR_VERSION } from "./llm-verifier";
import type { PredicateSchemaEntry, PddlObject } from "./llm-verifier";
import { setMetrics } from "./verifier-metrics";
import { findCachedExtraction, appendVerifierRun } from "./verifier-storage";
import type { AppendVerifierRunInput, RunKind } from "./verifier-storage";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PLANNER_DIR = __dirname.endsWith("dist")
  ? path.join(__dirname, "..", "..", "planner")
  : path.join(__dirname, "..", "planner");

const BUILTIN_DOMAIN_PDDL: Record<string, string> = {
  "blocks-world": path.join(PLANNER_DIR, "domains/blocks_world/domain.pddl"),
  "gripper":      path.join(PLANNER_DIR, "domains/gripper/domain.pddl"),
  "depot":        path.join(PLANNER_DIR, "domains/depot/domain.pddl"),
  "hanoi":        path.join(PLANNER_DIR, "domains/hanoi/domain.pddl"),
  "rovers":       path.join(PLANNER_DIR, "domains/rovers/domain.pddl"),
  "satellite":    path.join(PLANNER_DIR, "domains/satellite/domain.pddl"),
};

export async function loadDomainPddl(
  domainName: string,
  savedDomainId: number | null
): Promise<string | null> {
  if (savedDomainId !== null) {
    const sd = await getSavedDomain(savedDomainId);
    return sd?.domainPddl ?? null;
  }
  const builtinPath = BUILTIN_DOMAIN_PDDL[domainName];
  if (!builtinPath) return null;
  try {
    return await readFile(builtinPath, "utf-8");
  } catch {
    return null;
  }
}

export interface VerifyImageInput {
  /** PNG bytes as a base64 string (no data: prefix). */
  pngBase64: string;
  /** Ground-truth predicates from the planner. */
  expected: string[];
  domainName: string;
  /** PDDL problem name (e.g. "blocks-3-easy"). Null when unknown. */
  problem: string | null;
  /** sha256[:12] of the problem PDDL content. Null when unknown. */
  problemHash: string | null;
  /** "basic" / "claude" / "gemini" — drives the top-level report grouping. */
  renderMethod: "basic" | "claude" | "gemini" | string | null;
  /** Display name like "Ferry (2)". Null for non-saved-domain runs. */
  savedDomainDisplayName: string | null;
  predicateSchema: PredicateSchemaEntry[];
  objects: PddlObject[];

  // For persisting the verifier run row.
  runId: string;
  runKind: RunKind;
  isCustomDomain: boolean;
  savedDomainId: number | null;
  transformerHash: string | null;
  rendererHash: string | null;
  llmProvider: string | null;
  stateIndex: number;
  totalStates: number;
  feedbackId?: number | null;
  humanLabeller?: string | null;
  imageProvenance?: string | null;

  /** Skip cache and call the LLM even if a cached extraction exists. */
  forceRefresh?: boolean;
}

export interface VerifyImageResult {
  runRowId: number;
  imageHash: string;
  extracted: string[];
  scope: string[];
  tp: string[];
  fp: string[];
  fn: string[];
  precision: number | null;
  recall: number | null;
  parseFailure: boolean;
  cacheHit: boolean;
  /** Raw model output. null on cache hits (we don't replay it). */
  rawText: string | null;
}

/**
 * Single-state verification: extract predicates from the image (cached),
 * compute set metrics against `expected`, persist the row, and return.
 */
export async function verifyImage(
  input: VerifyImageInput
): Promise<VerifyImageResult> {
  const imageHash = hashImage(input.pngBase64);
  const extractorModelId = "claude-sonnet-4-5";

  // Cache lookup. Re-run on parse-failure cache hits — the previous run
  // produced nothing useful and the prompt/parser may have improved.
  let extracted: string[];
  let parseFailure: boolean;
  let rawText: string | null = null;
  let cacheHit = false;
  if (!input.forceRefresh) {
    const cached = await findCachedExtraction({
      imageHash,
      extractorVersion: EXTRACTOR_VERSION,
      extractorModelId,
    });
    if (cached && !cached.parseFailure) {
      extracted = cached.extracted;
      parseFailure = cached.parseFailure;
      cacheHit = true;
      console.log(`[Verifier] Cache HIT for image ${imageHash.slice(0, 8)}…`);
    } else {
      const r = await extractPredicates({
        pngBase64: input.pngBase64,
        domainName: input.domainName,
        predicateSchema: input.predicateSchema,
        objects: input.objects,
      });
      extracted = r.predicates;
      parseFailure = r.parseFailure;
      rawText = r.rawText;
    }
  } else {
    const r = await extractPredicates({
      pngBase64: input.pngBase64,
      domainName: input.domainName,
      predicateSchema: input.predicateSchema,
      objects: input.objects,
    });
    extracted = r.predicates;
    parseFailure = r.parseFailure;
    rawText = r.rawText;
  }

  const metrics = setMetrics(input.expected, extracted);

  const appendInput: AppendVerifierRunInput = {
    runId: input.runId,
    runKind: input.runKind,
    domainName: input.domainName,
    problem: input.problem,
    problemHash: input.problemHash,
    renderMethod: input.renderMethod,
    savedDomainDisplayName: input.savedDomainDisplayName,
    isCustomDomain: input.isCustomDomain,
    savedDomainId: input.savedDomainId,
    transformerHash: input.transformerHash,
    rendererHash: input.rendererHash,
    llmProvider: input.llmProvider,
    stateIndex: input.stateIndex,
    totalStates: input.totalStates,
    extractorModelId,
    extractorVersion: EXTRACTOR_VERSION,
    imageHash,
    imagePath: null,
    expected: input.expected,
    extracted,
    scope: metrics.scope,
    tp: metrics.tp,
    fp: metrics.fp,
    fn: metrics.fn,
    precision: metrics.precision,
    recall: metrics.recall,
    parseFailure,
    // Truncate to keep verifier_runs.json reasonable on disk. 4 KB is
    // enough for ~one model turn including a few hundred lines of code
    // execution stdout.
    rawText: rawText === null ? null : rawText.slice(0, 4096),
    feedbackId: input.feedbackId ?? null,
    humanLabeller: input.humanLabeller ?? null,
    imageProvenance: input.imageProvenance ?? null,
  };
  const row = await appendVerifierRun(appendInput);

  return {
    runRowId: row.id,
    imageHash,
    extracted,
    scope: metrics.scope,
    tp: metrics.tp,
    fp: metrics.fp,
    fn: metrics.fn,
    precision: metrics.precision,
    recall: metrics.recall,
    parseFailure,
    cacheHit,
    rawText,
  };
}
