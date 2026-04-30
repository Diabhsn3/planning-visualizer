/**
 * Saved Domains Library
 *
 * Persistent library of custom PDDL domains. Each entry now stores hash
 * references to content-addressed artifacts (transformer + renderer code)
 * instead of inlining the code, so two domains with identical generated
 * code share one artifact file.
 *
 * Two layers of caching/dedup:
 *   1. pddlHash → if the same domain PDDL is saved twice, return the
 *      existing entry instead of creating a duplicate.
 *   2. transformerHash / rendererHash → if two different PDDLs happen to
 *      produce the same code, the artifact is shared on disk.
 *
 * Backward compatibility: legacy entries that still have inline
 * `transformerCode` / `rendererCode` are auto-migrated on first load —
 * the code is hashed, written to the artifact store, and the entry is
 * rewritten to reference hashes only.
 */

import { readFile, writeFile, mkdir } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";
import { writeArtifact, readArtifact } from "./artifacts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = __dirname.endsWith("dist")
  ? path.join(__dirname, "..", "data")
  : path.join(__dirname, "data");

const SAVED_DOMAINS_FILE = path.join(DATA_DIR, "saved_domains.json");

// ==================== Types ====================

/**
 * On-disk shape. New entries store only hash references. Legacy entries
 * may still carry inline code — those are migrated on load.
 */
export interface SavedDomainRecord {
  id: number;
  displayName: string;
  domainName: string;
  /** SHA-256 (first 12 chars) of the trimmed domain PDDL — dedup key. */
  pddlHash: string;
  domainPddl: string;
  /** SHA-256 hex of the generated transformer JS. */
  transformerHash: string;
  /** SHA-256 hex of the generated renderer JS. */
  rendererHash: string;
  provider: string;
  createdAt: string;

  // ---- Legacy fields (only present in pre-migration entries) ----
  transformerCode?: string;
  rendererCode?: string;
}

/** Public shape returned by getSavedDomain — code is loaded from artifacts. */
export interface SavedDomain {
  id: number;
  displayName: string;
  domainName: string;
  pddlHash: string;
  domainPddl: string;
  transformerCode: string;
  rendererCode: string;
  transformerHash: string;
  rendererHash: string;
  provider: string;
  createdAt: string;
}

interface SavedDomainsStore {
  nextId: number;
  domains: SavedDomainRecord[];
}

// ==================== Helpers ====================

function hashPddl(pddlText: string): string {
  return crypto
    .createHash("sha256")
    .update(pddlText.trim())
    .digest("hex")
    .slice(0, 12);
}

async function loadStoreRaw(): Promise<SavedDomainsStore> {
  try {
    const raw = await readFile(SAVED_DOMAINS_FILE, "utf-8");
    return JSON.parse(raw) as SavedDomainsStore;
  } catch {
    return { nextId: 1, domains: [] };
  }
}

async function saveStore(store: SavedDomainsStore): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(
    SAVED_DOMAINS_FILE,
    JSON.stringify(store, null, 2),
    "utf-8"
  );
}

/**
 * Migrate any legacy entries that still have inline code. Writes the code
 * to the artifact store, replaces the inline fields with hash references,
 * and persists. Idempotent — entries already migrated are left alone.
 */
async function migrateLegacy(store: SavedDomainsStore): Promise<boolean> {
  let changed = false;
  for (const entry of store.domains) {
    if (!entry.transformerHash && entry.transformerCode) {
      entry.transformerHash = await writeArtifact(entry.transformerCode);
      delete entry.transformerCode;
      changed = true;
    }
    if (!entry.rendererHash && entry.rendererCode) {
      entry.rendererHash = await writeArtifact(entry.rendererCode);
      delete entry.rendererCode;
      changed = true;
    }
  }
  if (changed) {
    console.log(
      "[SavedDomains] Migrated legacy inline code to content-addressed artifacts"
    );
    await saveStore(store);
  }
  return changed;
}

async function loadStore(): Promise<SavedDomainsStore> {
  const store = await loadStoreRaw();
  await migrateLegacy(store);
  return store;
}

function generateDisplayName(
  baseName: string,
  existingNames: string[]
): string {
  const capitalized = baseName.charAt(0).toUpperCase() + baseName.slice(1);
  if (!existingNames.includes(capitalized)) return capitalized;
  let counter = 2;
  while (existingNames.includes(`${capitalized} (${counter})`)) counter++;
  return `${capitalized} (${counter})`;
}

/**
 * Hydrate a record into a full SavedDomain by loading the referenced
 * artifacts. Falls back to legacy inline code if the artifact is missing
 * (defensive — shouldn't normally happen post-migration).
 */
async function hydrate(record: SavedDomainRecord): Promise<SavedDomain> {
  const transformerCode =
    (record.transformerHash && (await readArtifact(record.transformerHash))) ||
    record.transformerCode ||
    "";
  const rendererCode =
    (record.rendererHash && (await readArtifact(record.rendererHash))) ||
    record.rendererCode ||
    "";
  return {
    id: record.id,
    displayName: record.displayName,
    domainName: record.domainName,
    pddlHash: record.pddlHash,
    domainPddl: record.domainPddl,
    transformerCode,
    rendererCode,
    transformerHash: record.transformerHash || "",
    rendererHash: record.rendererHash || "",
    provider: record.provider,
    createdAt: record.createdAt,
  };
}

// ==================== Public API ====================

/**
 * List all saved domains (metadata only — no code, no PDDL body).
 */
export async function listSavedDomains(): Promise<
  Array<
    Omit<SavedDomain, "transformerCode" | "rendererCode" | "domainPddl"> & {
      domainPddlPreview: string;
    }
  >
> {
  const store = await loadStore();
  return store.domains.map((d) => ({
    id: d.id,
    displayName: d.displayName,
    domainName: d.domainName,
    pddlHash: d.pddlHash,
    domainPddlPreview:
      d.domainPddl.slice(0, 200) + (d.domainPddl.length > 200 ? "..." : ""),
    transformerHash: d.transformerHash || "",
    rendererHash: d.rendererHash || "",
    provider: d.provider,
    createdAt: d.createdAt,
  }));
}

/**
 * Get a saved domain by ID, with code hydrated from artifacts.
 */
export async function getSavedDomain(id: number): Promise<SavedDomain | null> {
  const store = await loadStore();
  const record = store.domains.find((d) => d.id === id);
  return record ? hydrate(record) : null;
}

/**
 * Look up a saved domain by the hash of its PDDL text. Returns the latest
 * matching entry (sorted by createdAt) or null.
 *
 * This is the cache-hit path: if a user re-submits the same PDDL, we can
 * skip both LLM calls entirely.
 */
export async function findSavedDomainByPddl(
  domainPddl: string
): Promise<SavedDomain | null> {
  const targetHash = hashPddl(domainPddl);
  const store = await loadStore();
  const matches = store.domains.filter((d) => d.pddlHash === targetHash);
  if (matches.length === 0) return null;
  // Newest first
  matches.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return hydrate(matches[0]);
}

/**
 * Light-weight metadata listing of every saved domain whose pddlHash
 * matches `domainPddl`. Newest-first. Code is NOT hydrated — used by the
 * "duplicate detected" modal which only needs to render rows, then loads
 * the full code for the chosen one separately via getSavedDomain().
 */
export async function findAllSavedDomainsByPddl(
  domainPddl: string
): Promise<
  Array<{
    id: number;
    displayName: string;
    domainName: string;
    provider: string;
    createdAt: string;
    transformerHash: string;
    rendererHash: string;
  }>
> {
  const targetHash = hashPddl(domainPddl);
  const store = await loadStore();
  const matches = store.domains.filter((d) => d.pddlHash === targetHash);
  matches.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return matches.map((d) => ({
    id: d.id,
    displayName: d.displayName,
    domainName: d.domainName,
    provider: d.provider,
    createdAt: d.createdAt,
    transformerHash: d.transformerHash || "",
    rendererHash: d.rendererHash || "",
  }));
}

/**
 * Save a new domain to the library. Always creates a new entry — multiple
 * versions of the same PDDL are allowed (Ferry, Ferry (2), Ferry (3) …).
 * Collision UX (offer to reuse vs. create new) is handled by the frontend
 * before this is called.
 *
 * Code is written to the content-addressed artifact store, so identical
 * generated code across versions still occupies a single file on disk.
 */
export async function saveDomain(params: {
  domainName: string;
  domainPddl: string;
  transformerCode: string;
  rendererCode: string;
  provider: string;
}): Promise<SavedDomain> {
  const store = await loadStore();
  const pddlHash = hashPddl(params.domainPddl);

  // Write code to artifacts (deduped by content hash)
  const transformerHash = await writeArtifact(params.transformerCode);
  const rendererHash = await writeArtifact(params.rendererCode);

  const existingNames = store.domains.map((d) => d.displayName);
  const displayName = generateDisplayName(params.domainName, existingNames);

  const record: SavedDomainRecord = {
    id: store.nextId,
    displayName,
    domainName: params.domainName,
    pddlHash,
    domainPddl: params.domainPddl,
    transformerHash,
    rendererHash,
    provider: params.provider,
    createdAt: new Date().toISOString(),
  };

  store.domains.push(record);
  store.nextId++;
  await saveStore(store);

  console.log(
    `[SavedDomains] Saved "${displayName}" (id=${record.id}, pddlHash=${pddlHash}, transformer=${transformerHash.slice(0, 8)}…, renderer=${rendererHash.slice(0, 8)}…)`
  );
  return hydrate(record);
}

/**
 * Delete a saved domain entry. Note: we do NOT garbage-collect the
 * underlying artifacts because they may be shared with other entries.
 */
export async function deleteSavedDomain(id: number): Promise<boolean> {
  const store = await loadStore();
  const idx = store.domains.findIndex((d) => d.id === id);
  if (idx === -1) return false;
  const removed = store.domains.splice(idx, 1)[0];
  await saveStore(store);
  console.log(
    `[SavedDomains] Deleted domain: ${removed.displayName} (id=${id})`
  );
  return true;
}
