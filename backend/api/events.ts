/**
 * Pilot Event Log (NDJSON-backed).
 *
 * A structured, append-only log of operational events for the live (wet
 * pilot) experiment, so functional reliability can be computed instead of
 * grepped out of stdout. Every event carries an anonymous `clientId`
 * (per-browser, from a cookie) and a `sessionId` (per page-load), which is
 * what makes ">=20 unique users", "completed sessions", and error rates
 * countable.
 *
 * Event types currently emitted:
 *   - "session_start"  : a page/app load              (client)
 *   - "solve_attempt"  : a planner run + outcome      (server, visualizer.ts)
 *   - "llm_call"       : a renderer/transformer call  (server, visualizer.ts)
 *   - "render_crash"   : a canvas renderer threw      (client, StateCanvas)
 *   - "app_crash"      : a React ErrorBoundary catch  (client, ErrorBoundary)
 *
 * Layout: backend/api/data/events.jsonl — one JSON object per line.
 * Storage strategy mirrors feedback.ts / sus.ts (O(1) appends, in-memory
 * cache, promise-chained id counter — safe within one process).
 */

import { readFile, appendFile, mkdir, access } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = __dirname.endsWith("dist")
  ? path.join(__dirname, "..", "data")
  : path.join(__dirname, "data");

const NDJSON_FILE = path.join(DATA_DIR, "events.jsonl");

export interface EventRecord {
  id: number;
  createdAt: string;
  clientId: string | null;
  sessionId: string | null;
  type: string;
  data: unknown;
}

interface State {
  items: EventRecord[];
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

function parseLines(text: string): EventRecord[] {
  if (!text) return [];
  const out: EventRecord[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    try {
      out.push(JSON.parse(line) as EventRecord);
    } catch (err) {
      console.warn(
        `[Events] Skipping malformed NDJSON line: ${line.slice(0, 80)}${line.length > 80 ? "…" : ""} (${(err as Error).message})`
      );
    }
  }
  return out;
}

async function initState(): Promise<State> {
  await mkdir(DATA_DIR, { recursive: true });
  let items: EventRecord[] = [];
  if (await fileExists(NDJSON_FILE)) {
    items = parseLines(await readFile(NDJSON_FILE, "utf-8"));
  }
  const maxId = items.reduce((m, r) => (r.id > m ? r.id : m), 0);
  return { items, nextIdPromise: Promise.resolve(maxId + 1) };
}

async function getState(): Promise<State> {
  if (statePromise === null) statePromise = initState();
  return statePromise;
}

export interface AppendEventInput {
  clientId: string | null;
  sessionId: string | null;
  type: string;
  data: unknown;
}

export async function appendEvent(input: AppendEventInput): Promise<EventRecord> {
  const type = input.type?.trim();
  if (!type) throw new Error("event type is required");

  const state = await getState();
  const myIdPromise = state.nextIdPromise;
  state.nextIdPromise = myIdPromise.then((n) => n + 1);
  const id = await myIdPromise;

  const record: EventRecord = {
    id,
    createdAt: new Date().toISOString(),
    clientId: input.clientId,
    sessionId: input.sessionId,
    type,
    data: input.data ?? null,
  };

  await appendFile(NDJSON_FILE, JSON.stringify(record) + "\n", "utf-8");
  state.items.push(record);
  return record;
}

/**
 * Fire-and-forget append. Instrumentation must never break the request it
 * is measuring, so failures are logged and swallowed.
 */
export async function logEventSafe(input: AppendEventInput): Promise<void> {
  try {
    await appendEvent(input);
  } catch (err) {
    console.warn(`[Events] Failed to log "${input.type}":`, err);
  }
}

export async function listEvents(): Promise<EventRecord[]> {
  const { items } = await getState();
  return items.slice();
}
