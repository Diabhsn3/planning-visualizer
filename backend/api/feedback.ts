/**
 * Human Feedback Store
 *
 * Append-only log of human ratings on visualized planning states. Records
 * are designed to be replayable by the future verification agent without
 * additional data — each entry carries the symbolic state `s`, a PNG of
 * the rendered image `vis(s)`, and identifiers for the artifacts that
 * produced the visualization.
 *
 * Layout:
 *   backend/api/data/feedback.json            — index { nextId, items }
 *   backend/api/data/feedback-images/<id>.png — one PNG per record
 */

import { readFile, writeFile, mkdir } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = __dirname.endsWith("dist")
  ? path.join(__dirname, "..", "data")
  : path.join(__dirname, "data");

const FEEDBACK_FILE = path.join(DATA_DIR, "feedback.json");
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

interface FeedbackStore {
  nextId: number;
  items: FeedbackRecord[];
}

async function loadStore(): Promise<FeedbackStore> {
  try {
    const raw = await readFile(FEEDBACK_FILE, "utf-8");
    return JSON.parse(raw) as FeedbackStore;
  } catch {
    return { nextId: 1, items: [] };
  }
}

async function saveStore(store: FeedbackStore): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(FEEDBACK_FILE, JSON.stringify(store, null, 2), "utf-8");
}

/**
 * Strip the `data:image/png;base64,` prefix from a data URL and return
 * the raw base64 body. Throws if the input isn't a PNG data URL.
 */
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

  const store = await loadStore();
  const id = store.nextId;

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

  store.items.push(record);
  store.nextId++;
  await saveStore(store);

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
  const store = await loadStore();
  if (!filter) return store.items;
  return store.items.filter(
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
