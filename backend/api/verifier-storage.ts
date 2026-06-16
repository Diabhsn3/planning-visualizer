/**
 * Append-only log of verification-agent runs (NDJSON-backed).
 *
 * Layout:
 *   backend/api/data/verifier_runs.jsonl  — one row per line
 *
 * Each row carries the full identifying tuple used by Phase 1
 * (feedback.json) so Phase 3 can join human ratings and agent P/R on
 * (rendererHash, stateIndex, domainName, ...) without remembering field
 * names that diverged.
 *
 * Storage strategy: NDJSON for O(1) appends. In-memory `items[]` cache
 * is hydrated once on first access and kept in sync. `nextId` lives in
 * a chained promise so concurrent appends serialize uniquely.
 *
 * Extraction cache: `findCachedExtraction` is hot (called per state-view
 * during auto-verify). We maintain an in-memory map
 *   `${imageHash}::${extractorVersion}::${extractorModelId}` → row
 * for O(1) lookups, built alongside the items cache and updated on each
 * append.
 *
 * Migration: on first load, if the legacy `verifier_runs.json` is
 * present and the NDJSON file is not, we re-emit each item as a line
 * and `unlink` the old file.
 */

import {
  createNdjsonStore,
  migrateLegacyJsonToNdjson,
  dataPath,
} from "./ndjson-store";

const LEGACY_FILE = dataPath("verifier_runs.json");
const NDJSON_FILE = dataPath("verifier_runs.jsonl");

export type RunKind = "verify" | "calibration";

export interface VerifierRunRow {
  id: number;
  runId: string;
  runKind: RunKind;
  createdAt: string;

  // Identifiers — MUST match feedback.json field-for-field for Phase 3 join.
  domainName: string;
  problem: string | null;
  /**
   * sha256[:12] of the problem PDDL content. Lets the client detect a
   * re-run of the same trajectory (same domain + same problem) and skip
   * re-verification. Null on legacy rows that pre-date the field.
   */
  problemHash?: string | null;
  renderMethod?: "basic" | "claude" | "gemini" | string | null;
  savedDomainDisplayName?: string | null;
  isCustomDomain: boolean;
  savedDomainId: number | null;
  transformerHash: string | null;
  rendererHash: string | null;
  llmProvider: string | null;
  stateIndex: number;
  totalStates: number;

  // Extraction provenance
  extractorModelId: string;
  extractorVersion: string;
  imageHash: string;
  imagePath: string | null;

  // Values (after auto-scoping in metrics)
  expected: string[];
  extracted: string[];
  scope: string[];
  tp: string[];
  fp: string[];
  fn: string[];
  precision: number | null;
  recall: number | null;
  parseFailure: boolean;
  rawText: string | null;

  feedbackId?: number | null;
  humanLabeller?: string | null;
  imageProvenance?: string | null;
}

// ============================================================================
// Lazy init: migrate + load NDJSON once per process.
// ============================================================================

function cacheKey(imageHash: string, version: string, model: string): string {
  return `${imageHash}::${version}::${model}`;
}

// ============================================================================
// Public API
// ============================================================================

export type AppendVerifierRunInput = Omit<VerifierRunRow, "id" | "createdAt">;

// Derived O(1) lookup for findCachedExtraction (hot: called per state-view).
// Built lazily from the store on first use, then kept fresh in onAppended
// (which runs inside the store's write lock). Newer rows win for the same key.
let extractionCache: Map<string, VerifierRunRow> | null = null;

const store = createNdjsonStore<VerifierRunRow, AppendVerifierRunInput>({
  fileName: "verifier_runs.jsonl",
  label: "VerifierStore",
  getId: (r) => r.id,
  maxLineBytes: 60_000,
  migrate: () =>
    migrateLegacyJsonToNdjson<VerifierRunRow>({
      legacyFile: LEGACY_FILE,
      ndjsonFile: NDJSON_FILE,
      label: "VerifierStore",
    }),
  makeRecord: (input, id, createdAt) => ({ id, createdAt, ...input }),
  onAppended: (row) => {
    extractionCache?.set(
      cacheKey(row.imageHash, row.extractorVersion, row.extractorModelId),
      row
    );
  },
});

export async function appendVerifierRun(
  input: AppendVerifierRunInput
): Promise<VerifierRunRow> {
  const row = await store.append(input);
  console.log(
    `[VerifierStore] Recorded id=${row.id} runId=${row.runId} ` +
    `kind=${row.runKind} domain="${row.domainName}" state=${row.stateIndex} ` +
    `P=${row.precision} R=${row.recall}`
  );
  return row;
}

export interface FindCachedExtractionInput {
  imageHash: string;
  extractorVersion: string;
  extractorModelId: string;
}

export async function findCachedExtraction(
  input: FindCachedExtractionInput
): Promise<{ extracted: string[]; parseFailure: boolean } | null> {
  if (extractionCache === null) {
    // Build once from the loaded rows; later rows arrive via onAppended.
    const cache = new Map<string, VerifierRunRow>();
    for (const r of await store.list()) {
      cache.set(cacheKey(r.imageHash, r.extractorVersion, r.extractorModelId), r);
    }
    extractionCache = cache;
  }
  const hit = extractionCache.get(
    cacheKey(input.imageHash, input.extractorVersion, input.extractorModelId)
  );
  if (!hit) return null;
  return { extracted: hit.extracted, parseFailure: hit.parseFailure };
}

export interface ListVerifierRunsFilter {
  runId?: string;
  runKind?: RunKind;
  domainName?: string;
  rendererHash?: string;
  feedbackId?: number;
}

export async function listVerifierRuns(
  filter?: ListVerifierRunsFilter
): Promise<VerifierRunRow[]> {
  const items = await store.list();
  if (!filter) return items;
  return items.filter(
    (r) =>
      (filter.runId === undefined || r.runId === filter.runId) &&
      (filter.runKind === undefined || r.runKind === filter.runKind) &&
      (filter.domainName === undefined || r.domainName === filter.domainName) &&
      (filter.rendererHash === undefined || r.rendererHash === filter.rendererHash) &&
      (filter.feedbackId === undefined || r.feedbackId === filter.feedbackId)
  );
}
