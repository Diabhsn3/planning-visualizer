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

import { createNdjsonStore } from "./ndjson-store";

export interface EventRecord {
  id: number;
  createdAt: string;
  clientId: string | null;
  sessionId: string | null;
  type: string;
  data: unknown;
}

export interface AppendEventInput {
  clientId: string | null;
  sessionId: string | null;
  type: string;
  data: unknown;
}

const store = createNdjsonStore<EventRecord, AppendEventInput>({
  fileName: "events.jsonl",
  label: "Events",
  getId: (r) => r.id,
  makeRecord: (input, id, createdAt) => ({
    id,
    createdAt,
    clientId: input.clientId,
    sessionId: input.sessionId,
    type: input.type.trim(),
    data: input.data ?? null,
  }),
});

export async function appendEvent(input: AppendEventInput): Promise<EventRecord> {
  const type = input.type?.trim();
  if (!type) throw new Error("event type is required");
  return store.append(input);
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
  return store.list();
}
