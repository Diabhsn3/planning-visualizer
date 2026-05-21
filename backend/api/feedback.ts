/**
 * Human Feedback Store (NDJSON-backed).
 *
 * Append-only log of human ratings on visualized planning states. Records
 * are designed to be replayable by the verification agent without any
 * extra data — each entry carries the symbolic state `s`, a PNG of the
 * rendered image, and identifiers for the artifacts that produced it.
 *
 * Layout:
 *   backend/api/data/feedback.jsonl           — one record per line
 *   backend/api/data/feedback-images/<id>.png — one PNG per record
 *
 * Storage strategy: NDJSON for O(1) appends. Each row is one JSON object
 * per line, no global wrapper. In-memory cache `items[]` is populated
 * once on first access and kept in sync via append. `nextId` lives in a
 * promise-cached counter; concurrent appends serialize by chaining off
 * the same promise so duplicates can't be assigned.
 *
 * Migration: on first load, if the legacy `feedback.json` is present and
 * `feedback.jsonl` is not, we re-emit each item as a line and `unlink`
 * the old file.
 */

import { readFile, writeFile, appendFile, mkdir, unlink, access } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = __dirname.endsWith("dist")
  ? path.join(__dirname, "..", "data")
  : path.join(__dirname, "data");

const LEGACY_FILE = path.join(DATA_DIR, "feedback.json");
const NDJSON_FILE = path.join(DATA_DIR, "feedback.jsonl");
const IMAGES_DIR = path.join(DATA_DIR, "feedback-images");

/** Continuous 1–5 score. 5 = perfect, 1 = totally off. */
export type Rating = number;

export interface FeedbackRecord {
  id: number;
  createdAt: string;

  rating: Rating;
  comment: string | null;

  domainName: string;
  isCustomDomain: boolean;
  savedDomainId: number | null;
  transformerHash: string | null;
  rendererHash: string | null;
  llmProvider: string | null;

  stateIndex: number;
  totalStates: number;

  symbolicState: unknown;
  imageFile: string; // path relative to DATA_DIR, e.g. "feedback-images/3.png"
}

// ============================================================================
// Lazy init: scan/migrate once per process, keep results in module state.
// ============================================================================

interface State {
  items: FeedbackRecord[];
  // Counter chain — each appendFeedback awaits, increments, replaces.
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

function parseLines(text: string): FeedbackRecord[] {
  if (!text) return [];
  const out: FeedbackRecord[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    try {
      out.push(JSON.parse(line) as FeedbackRecord);
    } catch (err) {
      console.warn(
        `[Feedback] Skipping malformed NDJSON line: ${line.slice(0, 80)}${line.length > 80 ? "…" : ""} (${(err as Error).message})`
      );
    }
  }
  return out;
}

async function migrateLegacyIfNeeded(): Promise<void> {
  // Skip if NDJSON already exists OR legacy doesn't.
  if (await fileExists(NDJSON_FILE)) return;
  if (!(await fileExists(LEGACY_FILE))) return;

  console.log("[Feedback] Migrating legacy feedback.json → feedback.jsonl …");
  const raw = await readFile(LEGACY_FILE, "utf-8");
  let parsed: { items?: FeedbackRecord[]; nextId?: number };
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    console.error(
      `[Feedback] Legacy feedback.json is unparseable — leaving it in place. Error: ${(err as Error).message}`
    );
    return;
  }
  const items = Array.isArray(parsed.items) ? parsed.items : [];
  await mkdir(DATA_DIR, { recursive: true });
  const body = items.map((r) => JSON.stringify(r)).join("\n") + (items.length > 0 ? "\n" : "");
  await writeFile(NDJSON_FILE, body, "utf-8");
  await unlink(LEGACY_FILE);
  console.log(`[Feedback] Migration complete — ${items.length} row(s) in NDJSON. Removed legacy file.`);
}

async function initState(): Promise<State> {
  await mkdir(DATA_DIR, { recursive: true });
  await migrateLegacyIfNeeded();

  let items: FeedbackRecord[] = [];
  if (await fileExists(NDJSON_FILE)) {
    const text = await readFile(NDJSON_FILE, "utf-8");
    items = parseLines(text);
  }

  const maxId = items.reduce((m, r) => (r.id > m ? r.id : m), 0);
  return {
    items,
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

function decodePngDataUrl(dataUrl: string): Buffer {
  const match = /^data:image\/png;base64,(.+)$/.exec(dataUrl);
  if (!match) {
    throw new Error("Expected a base64 PNG data URL (data:image/png;base64,...)");
  }
  return Buffer.from(match[1], "base64");
}

export interface AppendFeedbackInput {
  rating: Rating;
  comment: string | null;
  domainName: string;
  isCustomDomain: boolean;
  savedDomainId: number | null;
  transformerHash: string | null;
  rendererHash: string | null;
  llmProvider: string | null;
  stateIndex: number;
  totalStates: number;
  symbolicState: unknown;
  imageDataUrl: string;
}

export async function appendFeedback(
  input: AppendFeedbackInput
): Promise<FeedbackRecord> {
  if (!Number.isFinite(input.rating) || input.rating < 1 || input.rating > 5) {
    throw new Error("rating must be a number between 1 and 5");
  }
  if (input.rating < 5) {
    if (!input.comment || !input.comment.trim()) {
      throw new Error("comment is required when rating is below 5");
    }
  }

  const state = await getState();

  // Capture-then-replace the counter promise so two concurrent appends
  // both serialize through this assignment and each gets a unique id.
  const myIdPromise = state.nextIdPromise;
  state.nextIdPromise = myIdPromise.then((n) => n + 1);
  const id = await myIdPromise;

  await mkdir(IMAGES_DIR, { recursive: true });
  const pngBytes = decodePngDataUrl(input.imageDataUrl);
  const imageRelPath = path.join("feedback-images", `${id}.png`);
  await writeFile(path.join(DATA_DIR, imageRelPath), pngBytes);

  const record: FeedbackRecord = {
    id,
    createdAt: new Date().toISOString(),
    rating: input.rating,
    comment: input.rating === 5 ? (input.comment?.trim() || null) : input.comment!.trim(),
    domainName: input.domainName,
    isCustomDomain: input.isCustomDomain,
    savedDomainId: input.savedDomainId,
    transformerHash: input.transformerHash,
    rendererHash: input.rendererHash,
    llmProvider: input.llmProvider,
    stateIndex: input.stateIndex,
    totalStates: input.totalStates,
    symbolicState: input.symbolicState,
    imageFile: imageRelPath,
  };

  const line = JSON.stringify(record);
  if (line.length > 60_000) {
    throw new Error(
      `[Feedback] Refusing to append row id=${id}: serialized size ${line.length} > 60KB cap`
    );
  }
  await appendFile(NDJSON_FILE, line + "\n", "utf-8");
  state.items.push(record);

  console.log(
    `[Feedback] Recorded id=${id} rating=${record.rating} domain="${record.domainName}" state=${record.stateIndex}/${record.totalStates}`
  );
  return record;
}

export interface ListFeedbackFilter {
  domainName?: string;
  transformerHash?: string;
  rendererHash?: string;
  minRating?: Rating;
  maxRating?: Rating;
}

export async function listFeedback(
  filter?: ListFeedbackFilter
): Promise<FeedbackRecord[]> {
  const { items } = await getState();
  if (!filter) return items.slice();
  return items.filter(
    (r) =>
      (filter.domainName === undefined || r.domainName === filter.domainName) &&
      (filter.transformerHash === undefined ||
        r.transformerHash === filter.transformerHash) &&
      (filter.rendererHash === undefined ||
        r.rendererHash === filter.rendererHash) &&
      (filter.minRating === undefined || r.rating >= filter.minRating) &&
      (filter.maxRating === undefined || r.rating <= filter.maxRating)
  );
}
