/**
 * Basic-Domain LLM Renderer Cache
 *
 * For built-in domains (blocks-world, gripper, depot, hanoi, rovers,
 * satellite), users can switch the canvas into "LLM render mode" and have
 * an LLM generate an alternate renderer. The generated JS lives in the
 * shared content-addressed artifact store (data/artifacts/<sha256>.js);
 * this module is the small index that maps (domain, provider) → artifact.
 *
 * On a cache hit the frontend skips the LLM call entirely.
 */

import { readFile, writeFile, mkdir } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { writeArtifact, readArtifact } from "./artifacts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = __dirname.endsWith("dist")
  ? path.join(__dirname, "..", "data")
  : path.join(__dirname, "data");

const INDEX_FILE = path.join(DATA_DIR, "basic_renderers.json");

interface BasicRendererEntry {
  domain: string;
  provider: string;
  artifactHash: string;
  createdAt: string;
}

interface BasicRendererStore {
  entries: BasicRendererEntry[];
}

export interface BasicRendererHit {
  domain: string;
  provider: string;
  artifactHash: string;
  code: string;
  createdAt: string;
}

async function loadStore(): Promise<BasicRendererStore> {
  try {
    const raw = await readFile(INDEX_FILE, "utf-8");
    return JSON.parse(raw) as BasicRendererStore;
  } catch {
    return { entries: [] };
  }
}

async function saveStore(store: BasicRendererStore): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(INDEX_FILE, JSON.stringify(store, null, 2), "utf-8");
}

/**
 * Persist a generated renderer for a basic domain.
 *
 * Idempotent: if an entry already exists for (domain, provider) pointing
 * at the same artifact hash, the index is not touched. If the hash
 * differs, the existing entry is replaced (we keep one current renderer
 * per (domain, provider) pair — older artifacts on disk remain because
 * other entries may share them).
 */
export async function saveBasicRenderer(
  domain: string,
  provider: string,
  code: string
): Promise<{ artifactHash: string; reused: boolean }> {
  const artifactHash = await writeArtifact(code);
  const store = await loadStore();
  const existing = store.entries.find(
    (e) => e.domain === domain && e.provider === provider
  );
  if (existing && existing.artifactHash === artifactHash) {
    return { artifactHash, reused: true };
  }
  if (existing) {
    existing.artifactHash = artifactHash;
    existing.createdAt = new Date().toISOString();
  } else {
    store.entries.push({
      domain,
      provider,
      artifactHash,
      createdAt: new Date().toISOString(),
    });
  }
  await saveStore(store);
  console.log(
    `[BasicRendererCache] Saved (${domain}, ${provider}) → ${artifactHash.slice(0, 12)}…`
  );
  return { artifactHash, reused: false };
}

/**
 * Look up a previously generated renderer for (domain, provider).
 * Returns the hydrated code or null if no entry exists / artifact missing.
 */
export async function findBasicRenderer(
  domain: string,
  provider: string
): Promise<BasicRendererHit | null> {
  const store = await loadStore();
  const entry = store.entries.find(
    (e) => e.domain === domain && e.provider === provider
  );
  if (!entry) return null;
  const code = await readArtifact(entry.artifactHash);
  if (!code) return null;
  return {
    domain: entry.domain,
    provider: entry.provider,
    artifactHash: entry.artifactHash,
    code,
    createdAt: entry.createdAt,
  };
}
