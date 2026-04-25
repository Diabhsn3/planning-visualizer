/**
 * Saved Domains Library
 * 
 * Manages a persistent library of custom PDDL domains that have been
 * successfully processed by the LLM pipeline. Each saved domain stores:
 * - The domain PDDL text
 * - The generated transformer code
 * - The generated renderer code
 * - A content hash to detect duplicate uploads
 * 
 * Stored in a JSON file on disk for simplicity.
 */

import { readFile, writeFile, mkdir } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Storage location: backend/api/data/saved_domains.json
const DATA_DIR = __dirname.endsWith("dist")
  ? path.join(__dirname, "..", "data")
  : path.join(__dirname, "data");

const SAVED_DOMAINS_FILE = path.join(DATA_DIR, "saved_domains.json");

// ==================== Types ====================

export interface SavedDomain {
  /** Unique ID (auto-incremented) */
  id: number;
  /** Display name, e.g. "Ferry", "Ferry (2)" */
  displayName: string;
  /** Raw domain name parsed from PDDL */
  domainName: string;
  /** SHA-256 hash of the domain PDDL text (first 12 chars) */
  pddlHash: string;
  /** Full domain PDDL text */
  domainPddl: string;
  /** Generated transformer JS code */
  transformerCode: string;
  /** Generated renderer JS code */
  rendererCode: string;
  /** LLM provider used (claude / gemini) */
  provider: string;
  /** ISO timestamp of when it was saved */
  createdAt: string;
}

interface SavedDomainsStore {
  nextId: number;
  domains: SavedDomain[];
}

// ==================== Helpers ====================

/** Compute a short hash of the PDDL text */
function hashPddl(pddlText: string): string {
  return crypto.createHash("sha256").update(pddlText.trim()).digest("hex").slice(0, 12);
}

/** Load the store from disk */
async function loadStore(): Promise<SavedDomainsStore> {
  try {
    const raw = await readFile(SAVED_DOMAINS_FILE, "utf-8");
    return JSON.parse(raw) as SavedDomainsStore;
  } catch {
    // File doesn't exist yet — return empty store
    return { nextId: 1, domains: [] };
  }
}

/** Save the store to disk */
async function saveStore(store: SavedDomainsStore): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(SAVED_DOMAINS_FILE, JSON.stringify(store, null, 2), "utf-8");
}

/** Generate a unique display name, appending (2), (3), etc. if needed */
function generateDisplayName(baseName: string, existingNames: string[]): string {
  // Capitalize first letter
  const capitalized = baseName.charAt(0).toUpperCase() + baseName.slice(1);
  
  if (!existingNames.includes(capitalized)) {
    return capitalized;
  }
  
  // Find the next available number
  let counter = 2;
  while (existingNames.includes(`${capitalized} (${counter})`)) {
    counter++;
  }
  return `${capitalized} (${counter})`;
}

// ==================== Public API ====================

/**
 * List all saved domains (returns metadata only, no code).
 */
export async function listSavedDomains(): Promise<Array<Omit<SavedDomain, "transformerCode" | "rendererCode" | "domainPddl"> & { domainPddlPreview: string }>> {
  const store = await loadStore();
  return store.domains.map(d => ({
    id: d.id,
    displayName: d.displayName,
    domainName: d.domainName,
    pddlHash: d.pddlHash,
    domainPddlPreview: d.domainPddl.slice(0, 200) + (d.domainPddl.length > 200 ? "..." : ""),
    provider: d.provider,
    createdAt: d.createdAt,
  }));
}

/**
 * Get a saved domain by ID (full data including code).
 */
export async function getSavedDomain(id: number): Promise<SavedDomain | null> {
  const store = await loadStore();
  return store.domains.find(d => d.id === id) || null;
}

/**
 * Save a new domain to the library.
 * Returns the saved domain entry.
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

  // Always create a new entry (even for duplicate PDDL) so users can keep
  // multiple transformer/renderer versions for the same domain.

  // Generate a unique display name
  const existingNames = store.domains.map(d => d.displayName);
  const displayName = generateDisplayName(params.domainName, existingNames);

  const newDomain: SavedDomain = {
    id: store.nextId,
    displayName,
    domainName: params.domainName,
    pddlHash,
    domainPddl: params.domainPddl,
    transformerCode: params.transformerCode,
    rendererCode: params.rendererCode,
    provider: params.provider,
    createdAt: new Date().toISOString(),
  };

  store.domains.push(newDomain);
  store.nextId++;
  await saveStore(store);

  console.log(`[SavedDomains] Saved new domain: ${displayName} (id=${newDomain.id}, hash=${pddlHash})`);
  return newDomain;
}

/**
 * Delete a saved domain by ID (admin only — not exposed to users).
 */
export async function deleteSavedDomain(id: number): Promise<boolean> {
  const store = await loadStore();
  const idx = store.domains.findIndex(d => d.id === id);
  if (idx === -1) return false;
  
  const removed = store.domains.splice(idx, 1)[0];
  await saveStore(store);
  console.log(`[SavedDomains] Deleted domain: ${removed.displayName} (id=${id})`);
  return true;
}
