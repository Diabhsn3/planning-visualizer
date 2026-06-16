/**
 * Shared NDJSON append-only store.
 *
 * Extracts the load / parse / id-counter / append boilerplate that was
 * copy-pasted across feedback.ts, sus.ts, events.ts, and verifier-storage.ts,
 * and — crucially — makes the whole critical section ATOMIC.
 *
 * The previous per-store implementations serialized only the id assignment
 * (via a chained promise) but left the `appendFile` outside any lock, so two
 * concurrent appends could interleave their writes / cache pushes. Here the
 * id assignment, record construction, file append, in-memory cache update,
 * and any derived-cache maintenance all run inside one `writeLock` section.
 *
 * Scope: a single Node process (same assumption as async-mutex.ts).
 */

import { readFile, writeFile, appendFile, mkdir, unlink, access } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { createMutex } from "./async-mutex";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Single source of truth for the runtime data directory (SUS results,
 * feedback, telemetry, verifier runs, saved domains, artifacts, and their
 * images). Every module that persists runtime data resolves its path from
 * here, so the location is configured in exactly one place.
 *
 * Resolution order:
 *   1. `DATA_DIR` env var (absolute or relative to CWD) — set this on the
 *      server to a folder OUTSIDE the repo (e.g. /home/you/pv-data) so that
 *      git pull/reset/clean can never overwrite real participant data.
 *   2. Default for local dev: a `data/` folder next to this module. In a prod
 *      build the server bundles to dist/index.js, so `data/` is one level up.
 */
export const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : __dirname.endsWith("dist")
    ? path.join(__dirname, "..", "data")
    : path.join(__dirname, "data");

/** Join one or more segments onto the runtime data dir. */
export function dataPath(...segments: string[]): string {
  return path.join(DATA_DIR, ...segments);
}

export async function fileExists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

export interface NdjsonStoreOptions<TRecord, TInput> {
  /** File name under DATA_DIR, e.g. "events.jsonl". */
  fileName: string;
  /** Prefix used in log/warn messages, e.g. "Events". */
  label: string;
  /** Read the numeric id off a record (drives the nextId counter). */
  getId: (record: TRecord) => number;
  /** Build a record from append input + the assigned id + ISO timestamp. May be async (e.g. to write an image file). */
  makeRecord: (input: TInput, id: number, createdAt: string) => TRecord | Promise<TRecord>;
  /** Optional one-time legacy migration; runs once before the first load. */
  migrate?: () => Promise<void>;
  /** Optional per-row serialized-size cap (bytes); append throws if exceeded. */
  maxLineBytes?: number;
  /** Optional hook to maintain a derived cache; runs inside the write lock. */
  onAppended?: (record: TRecord) => void;
}

export interface NdjsonStore<TRecord, TInput> {
  append: (input: TInput) => Promise<TRecord>;
  list: () => Promise<TRecord[]>;
}

interface InternalState<TRecord> {
  items: TRecord[];
  nextId: number;
}

export function createNdjsonStore<TRecord, TInput>(
  opts: NdjsonStoreOptions<TRecord, TInput>
): NdjsonStore<TRecord, TInput> {
  const filePath = path.join(DATA_DIR, opts.fileName);
  const writeLock = createMutex();
  let statePromise: Promise<InternalState<TRecord>> | null = null;

  function parseLines(text: string): TRecord[] {
    if (!text) return [];
    const out: TRecord[] = [];
    for (const raw of text.split("\n")) {
      const line = raw.trim();
      if (!line) continue;
      try {
        out.push(JSON.parse(line) as TRecord);
      } catch (err) {
        console.warn(
          `[${opts.label}] Skipping malformed NDJSON line: ${line.slice(0, 80)}${line.length > 80 ? "…" : ""} (${(err as Error).message})`
        );
      }
    }
    return out;
  }

  async function initState(): Promise<InternalState<TRecord>> {
    await mkdir(DATA_DIR, { recursive: true });
    if (opts.migrate) await opts.migrate();
    let items: TRecord[] = [];
    if (await fileExists(filePath)) {
      items = parseLines(await readFile(filePath, "utf-8"));
    }
    const nextId = items.reduce((m, r) => Math.max(m, opts.getId(r)), 0) + 1;
    return { items, nextId };
  }

  function getState(): Promise<InternalState<TRecord>> {
    if (statePromise === null) statePromise = initState();
    return statePromise;
  }

  async function append(input: TInput): Promise<TRecord> {
    // One critical section: id assignment + record build + append + cache
    // update are serialized together, so concurrent appends can neither
    // collide on ids nor interleave partial writes to the NDJSON file.
    return writeLock(async () => {
      const state = await getState();
      const id = state.nextId;
      const record = await opts.makeRecord(input, id, new Date().toISOString());
      const line = JSON.stringify(record);
      if (opts.maxLineBytes !== undefined && line.length > opts.maxLineBytes) {
        throw new Error(
          `[${opts.label}] Refusing to append row id=${id}: serialized size ${line.length} > ${opts.maxLineBytes}B cap`
        );
      }
      await appendFile(filePath, line + "\n", "utf-8");
      // Advance only after a successful write so a failed append doesn't burn an id.
      state.nextId = id + 1;
      state.items.push(record);
      opts.onAppended?.(record);
      return record;
    });
  }

  async function list(): Promise<TRecord[]> {
    const { items } = await getState();
    return items.slice();
  }

  return { append, list };
}

/**
 * One-time migration of a legacy `{ items: [...] }` JSON blob into NDJSON,
 * then removes the legacy file. Shared by feedback / verifier-storage.
 */
export async function migrateLegacyJsonToNdjson<TRecord>(args: {
  legacyFile: string;
  ndjsonFile: string;
  label: string;
}): Promise<void> {
  if (await fileExists(args.ndjsonFile)) return;
  if (!(await fileExists(args.legacyFile))) return;

  console.log(
    `[${args.label}] Migrating legacy ${path.basename(args.legacyFile)} → ${path.basename(args.ndjsonFile)} …`
  );
  const raw = await readFile(args.legacyFile, "utf-8");
  let parsed: { items?: TRecord[] };
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    console.error(
      `[${args.label}] Legacy ${path.basename(args.legacyFile)} is unparseable — leaving it. Error: ${(err as Error).message}`
    );
    return;
  }
  const items = Array.isArray(parsed.items) ? parsed.items : [];
  await mkdir(path.dirname(args.ndjsonFile), { recursive: true });
  const body = items.map((r) => JSON.stringify(r)).join("\n") + (items.length > 0 ? "\n" : "");
  await writeFile(args.ndjsonFile, body, "utf-8");
  await unlink(args.legacyFile);
  console.log(
    `[${args.label}] Migration complete — ${items.length} row(s) in NDJSON. Removed legacy file.`
  );
}
