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

import { readFile, writeFile, appendFile, mkdir, unlink, access } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = __dirname.endsWith("dist")
  ? path.join(__dirname, "..", "data")
  : path.join(__dirname, "data");

const LEGACY_FILE = path.join(DATA_DIR, "verifier_runs.json");
const NDJSON_FILE = path.join(DATA_DIR, "verifier_runs.jsonl");

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

interface State {
  items: VerifierRunRow[];
  /** Newest-first lookup so cache hits return the most recent extraction. */
  extractionCache: Map<string, VerifierRunRow>;
  nextIdPromise: Promise<number>;
}

let statePromise: Promise<State> | null = null;

async function fileExists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

function parseLines(text: string): VerifierRunRow[] {
  if (!text) return [];
  const out: VerifierRunRow[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    try {
      out.push(JSON.parse(line) as VerifierRunRow);
    } catch (err) {
      console.warn(
        `[VerifierStore] Skipping malformed NDJSON line: ${line.slice(0, 80)}${line.length > 80 ? "…" : ""} (${(err as Error).message})`
      );
    }
  }
  return out;
}

async function migrateLegacyIfNeeded(): Promise<void> {
  if (await fileExists(NDJSON_FILE)) return;
  if (!(await fileExists(LEGACY_FILE))) return;

  console.log("[VerifierStore] Migrating legacy verifier_runs.json → verifier_runs.jsonl …");
  const raw = await readFile(LEGACY_FILE, "utf-8");
  let parsed: { items?: VerifierRunRow[]; nextId?: number };
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    console.error(
      `[VerifierStore] Legacy verifier_runs.json is unparseable — leaving it. Error: ${(err as Error).message}`
    );
    return;
  }
  const items = Array.isArray(parsed.items) ? parsed.items : [];
  await mkdir(DATA_DIR, { recursive: true });
  const body = items.map((r) => JSON.stringify(r)).join("\n") + (items.length > 0 ? "\n" : "");
  await writeFile(NDJSON_FILE, body, "utf-8");
  await unlink(LEGACY_FILE);
  console.log(`[VerifierStore] Migration complete — ${items.length} row(s) in NDJSON. Removed legacy file.`);
}

async function initState(): Promise<State> {
  await mkdir(DATA_DIR, { recursive: true });
  await migrateLegacyIfNeeded();

  let items: VerifierRunRow[] = [];
  if (await fileExists(NDJSON_FILE)) {
    const text = await readFile(NDJSON_FILE, "utf-8");
    items = parseLines(text);
  }

  // Build extraction cache. Newer rows overwrite older for same key, which
  // is what we want (latest extraction wins).
  const extractionCache = new Map<string, VerifierRunRow>();
  for (const r of items) {
    extractionCache.set(cacheKey(r.imageHash, r.extractorVersion, r.extractorModelId), r);
  }

  const maxId = items.reduce((m, r) => (r.id > m ? r.id : m), 0);
  return {
    items,
    extractionCache,
    nextIdPromise: Promise.resolve(maxId + 1),
  };
}

async function getState(): Promise<State> {
  if (statePromise === null) statePromise = initState();
  return statePromise;
}

// ============================================================================
// Public API
// ============================================================================

export type AppendVerifierRunInput = Omit<VerifierRunRow, "id" | "createdAt">;

export async function appendVerifierRun(
  input: AppendVerifierRunInput
): Promise<VerifierRunRow> {
  const state = await getState();

  const myIdPromise = state.nextIdPromise;
  state.nextIdPromise = myIdPromise.then((n) => n + 1);
  const id = await myIdPromise;

  const row: VerifierRunRow = {
    id,
    createdAt: new Date().toISOString(),
    ...input,
  };

  const line = JSON.stringify(row);
  if (line.length > 60_000) {
    throw new Error(
      `[VerifierStore] Refusing to append row id=${id}: serialized size ${line.length} > 60KB cap`
    );
  }
  await appendFile(NDJSON_FILE, line + "\n", "utf-8");
  state.items.push(row);
  state.extractionCache.set(
    cacheKey(row.imageHash, row.extractorVersion, row.extractorModelId),
    row
  );

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
  const state = await getState();
  const hit = state.extractionCache.get(
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
  const { items } = await getState();
  if (!filter) return items.slice();
  return items.filter(
    (r) =>
      (filter.runId === undefined || r.runId === filter.runId) &&
      (filter.runKind === undefined || r.runKind === filter.runKind) &&
      (filter.domainName === undefined || r.domainName === filter.domainName) &&
      (filter.rendererHash === undefined || r.rendererHash === filter.rendererHash) &&
      (filter.feedbackId === undefined || r.feedbackId === filter.feedbackId)
  );
}
