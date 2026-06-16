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

import { writeFile, mkdir } from "fs/promises";
import path from "path";
import crypto from "crypto";
import {
  createNdjsonStore,
  migrateLegacyJsonToNdjson,
  DATA_DIR,
  dataPath,
} from "./ndjson-store";

const LEGACY_FILE = dataPath("feedback.json");
const NDJSON_FILE = dataPath("feedback.jsonl");
const IMAGES_DIR = dataPath("feedback-images");

/** Continuous 1–5 score. 5 = perfect, 1 = totally off. */
export type Rating = number;

export interface FeedbackRecord {
  id: number;
  createdAt: string;

  /** Anonymous per-browser id (pilot unique-user proxy); null for legacy rows. */
  clientId: string | null;
  /** Per-page-load session id; null for legacy rows. */
  sessionId: string | null;

  rating: Rating;
  comment: string | null;

  domainName: string;
  isCustomDomain: boolean;
  savedDomainId: number | null;
  transformerHash: string | null;
  rendererHash: string | null;
  llmProvider: string | null;
  /**
   * sha256[:12] of the problem PDDL content. Distinguishes states across
   * different problems of the same (saved) domain so a rating isn't
   * mis-joined to a same-index state of another problem. Null on legacy
   * rows written before this field.
   */
  problemHash?: string | null;

  stateIndex: number;
  totalStates: number;

  symbolicState: unknown;
  imageFile: string; // path relative to DATA_DIR, e.g. "feedback-images/3.png"
  /**
   * sha256 of the PNG base64 body — same hashing the verifier uses, so a
   * feedback entry can be matched to the exact verifier run that graded
   * the same photo. Null on legacy rows written before this field.
   */
  imageHash?: string | null;
}

// ============================================================================
// Public API
// ============================================================================

/** Extract the base64 body from a `data:image/png;base64,…` URL. */
function pngDataUrlBody(dataUrl: string): string {
  const match = /^data:image\/png;base64,(.+)$/.exec(dataUrl);
  if (!match) {
    throw new Error("Expected a base64 PNG data URL (data:image/png;base64,...)");
  }
  return match[1];
}

export interface AppendFeedbackInput {
  clientId: string | null;
  sessionId: string | null;
  rating: Rating;
  comment: string | null;
  domainName: string;
  isCustomDomain: boolean;
  savedDomainId: number | null;
  transformerHash: string | null;
  rendererHash: string | null;
  llmProvider: string | null;
  problemHash: string | null;
  stateIndex: number;
  totalStates: number;
  symbolicState: unknown;
  imageDataUrl: string;
}

const store = createNdjsonStore<FeedbackRecord, AppendFeedbackInput>({
  fileName: "feedback.jsonl",
  label: "Feedback",
  getId: (r) => r.id,
  maxLineBytes: 60_000,
  migrate: () =>
    migrateLegacyJsonToNdjson<FeedbackRecord>({
      legacyFile: LEGACY_FILE,
      ndjsonFile: NDJSON_FILE,
      label: "Feedback",
    }),
  makeRecord: async (input, id, createdAt) => {
    await mkdir(IMAGES_DIR, { recursive: true });
    const pngBase64 = pngDataUrlBody(input.imageDataUrl);
    // Same hashing the verifier uses (sha256 of the base64 body), so this
    // feedback can be matched to the verifier run for the identical photo.
    const imageHash = crypto.createHash("sha256").update(pngBase64).digest("hex");
    const pngBytes = Buffer.from(pngBase64, "base64");
    const imageRelPath = path.join("feedback-images", `${id}.png`);
    await writeFile(path.join(DATA_DIR, imageRelPath), pngBytes);

    return {
      id,
      createdAt,
      clientId: input.clientId,
      sessionId: input.sessionId,
      rating: input.rating,
      comment:
        input.rating === 5 ? (input.comment?.trim() || null) : input.comment!.trim(),
      domainName: input.domainName,
      isCustomDomain: input.isCustomDomain,
      savedDomainId: input.savedDomainId,
      transformerHash: input.transformerHash,
      rendererHash: input.rendererHash,
      llmProvider: input.llmProvider,
      problemHash: input.problemHash,
      stateIndex: input.stateIndex,
      totalStates: input.totalStates,
      symbolicState: input.symbolicState,
      imageFile: imageRelPath,
      imageHash,
    };
  },
});

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

  const record = await store.append(input);
  console.log(
    `[Feedback] Recorded id=${record.id} rating=${record.rating} domain="${record.domainName}" state=${record.stateIndex}/${record.totalStates}`
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
  const items = await store.list();
  if (!filter) return items;
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
