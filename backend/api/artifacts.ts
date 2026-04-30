/**
 * Content-Addressed Artifact Store
 *
 * Stores LLM-generated transformer/renderer JS code as files named by their
 * sha256 hash. Two domains that produce byte-identical code share one file.
 *
 * Layout:
 *   backend/api/data/artifacts/<sha256>.js
 *
 * The artifact body is the raw transpiled JavaScript — exactly what the
 * frontend feeds to `new Function(...)`.
 */

import { readFile, writeFile, mkdir, access } from "fs/promises";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// In production (dist/index.js), __dirname is .../dist, so go up one level.
const DATA_DIR = __dirname.endsWith("dist")
  ? path.join(__dirname, "..", "data")
  : path.join(__dirname, "data");

const ARTIFACTS_DIR = path.join(DATA_DIR, "artifacts");

/** Compute the sha256 hex digest of the code (used as the artifact id). */
export function hashCode(code: string): string {
  return crypto.createHash("sha256").update(code).digest("hex");
}

/**
 * Write code to the artifact store. Idempotent — if the artifact already
 * exists (same hash), this is a no-op. Returns the hash.
 */
export async function writeArtifact(code: string): Promise<string> {
  const hash = hashCode(code);
  await mkdir(ARTIFACTS_DIR, { recursive: true });
  const filepath = path.join(ARTIFACTS_DIR, `${hash}.js`);
  try {
    await access(filepath);
    // Already exists — dedup hit.
    return hash;
  } catch {
    // Doesn't exist — write it.
    await writeFile(filepath, code, "utf-8");
    return hash;
  }
}

/**
 * Read an artifact by hash. Returns null if not found.
 */
export async function readArtifact(hash: string): Promise<string | null> {
  try {
    const filepath = path.join(ARTIFACTS_DIR, `${hash}.js`);
    return await readFile(filepath, "utf-8");
  } catch {
    return null;
  }
}
