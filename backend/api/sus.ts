/**
 * SUS (System Usability Scale) Store (NDJSON-backed).
 *
 * Append-only log of focus-group participants' SUS questionnaire responses.
 * Each record carries the participant's name, the ten raw Likert answers
 * (1–5), the server-computed SUS score (0–100), and timing metadata so we
 * can report time-on-session alongside usability.
 *
 * Layout:
 *   backend/api/data/sus_responses.jsonl — one record per line
 *
 * Storage strategy mirrors feedback.ts: NDJSON for O(1) appends, a single
 * in-memory cache populated on first access, and a promise-chained `nextId`
 * counter so concurrent appends can't collide on an id.
 */

import { readFile, appendFile, mkdir, access } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = __dirname.endsWith("dist")
  ? path.join(__dirname, "..", "data")
  : path.join(__dirname, "data");

const NDJSON_FILE = path.join(DATA_DIR, "sus_responses.jsonl");

/** The ten standard SUS statements, in order. Odd items are positively
 * worded, even items negatively worded — this ordering drives scoring. */
export const SUS_QUESTIONS: readonly string[] = [
  "I think that I would like to use this system frequently.",
  "I found the system unnecessarily complex.",
  "I thought the system was easy to use.",
  "I think that I would need the support of a technical person to be able to use this system.",
  "I found the various functions in this system were well integrated.",
  "I thought there was too much inconsistency in this system.",
  "I would imagine that most people would learn to use this system very quickly.",
  "I found the system very cumbersome to use.",
  "I felt very confident using the system.",
  "I needed to learn a lot of things before I could get going with this system.",
];

export type StudyProfile = "lab_researcher" | "cs_student";
export type StudyMode = "in_person" | "remote";

export interface ExitInterview {
  useCases: string;
  suggestions: string;
  overallImpression: string;
}

export interface SusRecord {
  id: number;
  createdAt: string;

  // ---- Participant intake header ----
  participantId: string;
  profile: StudyProfile | null;
  /** Session date (YYYY-MM-DD), as entered by the facilitator. */
  studyDate: string;
  facilitator: string;
  noteTaker: string;
  mode: StudyMode | null;

  /** Ten raw Likert answers, each an integer 1–5, in question order. */
  responses: number[];
  /** SUS score 0–100, recomputed on the server (never trusted from client). */
  score: number;

  startedAt: string;
  submittedAt: string;
  durationMs: number;
  userAgent: string | null;

  /** Optional verbal exit interview, null if the facilitator left it blank. */
  exitInterview: ExitInterview | null;

  /** Legacy: pre-intake rows carried only a free-text name. */
  participantName?: string;
}

/**
 * Standard SUS scoring. For odd-indexed questions (1,3,5,7,9) the
 * contribution is `(response - 1)`; for even-indexed questions
 * (2,4,6,8,10) it is `(5 - response)`. The sum of contributions is
 * multiplied by 2.5 to land on a 0–100 scale.
 */
export function computeSusScore(responses: number[]): number {
  if (responses.length !== 10) {
    throw new Error("SUS scoring requires exactly 10 responses");
  }
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    const r = responses[i];
    // questions are 1-indexed in SUS; i is 0-indexed → odd question == even i
    const isOddQuestion = i % 2 === 0;
    sum += isOddQuestion ? r - 1 : 5 - r;
  }
  return sum * 2.5;
}

// ============================================================================
// Lazy init: scan once per process, keep results in module state.
// ============================================================================

interface State {
  items: SusRecord[];
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

function parseLines(text: string): SusRecord[] {
  if (!text) return [];
  const out: SusRecord[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    try {
      out.push(JSON.parse(line) as SusRecord);
    } catch (err) {
      console.warn(
        `[SUS] Skipping malformed NDJSON line: ${line.slice(0, 80)}${line.length > 80 ? "…" : ""} (${(err as Error).message})`
      );
    }
  }
  return out;
}

async function initState(): Promise<State> {
  await mkdir(DATA_DIR, { recursive: true });

  let items: SusRecord[] = [];
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

export interface AppendSusInput {
  participantId: string;
  profile: StudyProfile | null;
  studyDate: string;
  facilitator: string;
  noteTaker: string;
  mode: StudyMode | null;
  responses: number[];
  startedAt: string;
  submittedAt: string;
  durationMs: number;
  userAgent: string | null;
  exitInterview: ExitInterview | null;
}

export async function appendSus(input: AppendSusInput): Promise<SusRecord> {
  const participantId = input.participantId?.trim();
  if (!participantId) {
    throw new Error("participantId is required");
  }
  if (
    !Array.isArray(input.responses) ||
    input.responses.length !== 10 ||
    input.responses.some(
      (r) => !Number.isInteger(r) || r < 1 || r > 5
    )
  ) {
    throw new Error("responses must be exactly 10 integers between 1 and 5");
  }

  const score = computeSusScore(input.responses);

  const state = await getState();

  // Capture-then-replace the counter promise so concurrent appends each
  // get a unique id.
  const myIdPromise = state.nextIdPromise;
  state.nextIdPromise = myIdPromise.then((n) => n + 1);
  const id = await myIdPromise;

  // Drop an exit interview that is entirely blank.
  const ei = input.exitInterview;
  const exitInterview: ExitInterview | null =
    ei && (ei.useCases.trim() || ei.suggestions.trim() || ei.overallImpression.trim())
      ? {
          useCases: ei.useCases.trim(),
          suggestions: ei.suggestions.trim(),
          overallImpression: ei.overallImpression.trim(),
        }
      : null;

  const record: SusRecord = {
    id,
    createdAt: new Date().toISOString(),
    participantId,
    profile: input.profile,
    studyDate: input.studyDate,
    facilitator: input.facilitator.trim(),
    noteTaker: input.noteTaker.trim(),
    mode: input.mode,
    responses: input.responses.slice(),
    score,
    startedAt: input.startedAt,
    submittedAt: input.submittedAt,
    durationMs: input.durationMs,
    userAgent: input.userAgent,
    exitInterview,
  };

  await appendFile(NDJSON_FILE, JSON.stringify(record) + "\n", "utf-8");
  state.items.push(record);

  console.log(
    `[SUS] Recorded id=${id} participant="${record.participantId}" score=${record.score}`
  );
  return record;
}

export async function listSus(): Promise<SusRecord[]> {
  const { items } = await getState();
  return items.slice();
}
