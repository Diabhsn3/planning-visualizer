/**
 * Skill File Sync Helpers
 *
 * The Claude Skills API stores skills server-side; once uploaded, edits to
 * the local skill files are invisible to the API until you push a new
 * version. These helpers detect local edits via a content hash and push a
 * new version to the existing skill_id when files change.
 *
 * Lifecycle (used inside getOrCreateClaudeSkill in both
 * llm-renderer.ts and llm-domain-interpreter.ts):
 *
 *   1. After resolving an existing skill_id (in-memory / disk / list),
 *      compute a hash of the current local skill files.
 *   2. Read the stored hash from .claude-skill-hash (or sibling file).
 *   3. If hashes match → skill is up to date, do nothing.
 *   4. If hashes differ (or the hash file is missing) → call
 *      `client.beta.skills.versions.create(skill_id, { files })` which
 *      pushes a new version under the same skill_id. The Messages API
 *      already references `version: "latest"`, so subsequent calls
 *      automatically pick up the new version. Write the new hash.
 */

import { readFile, writeFile } from "fs/promises";
import path from "path";
import crypto from "crypto";
import Anthropic from "@anthropic-ai/sdk";

/**
 * Compute a deterministic sha256 over a set of skill files. The hash is
 * stable regardless of `paths` order: we sort by basename and prefix each
 * file's content with a header containing its filename so a rename also
 * changes the hash.
 */
export async function hashSkillFiles(paths: string[]): Promise<string> {
  const hash = crypto.createHash("sha256");
  const sorted = [...paths].sort((a, b) =>
    path.basename(a).localeCompare(path.basename(b))
  );
  for (const p of sorted) {
    hash.update(`--- ${path.basename(p)} ---\n`);
    hash.update(await readFile(p));
    hash.update("\n");
  }
  return hash.digest("hex");
}

export async function readStoredHash(path: string): Promise<string | null> {
  try {
    const raw = await readFile(path, "utf-8");
    return raw.trim() || null;
  } catch {
    return null;
  }
}

export async function writeStoredHash(
  path: string,
  hash: string
): Promise<void> {
  await writeFile(path, hash, "utf-8");
}

/**
 * One file in the skill bundle. `mimeType` controls the Content-Type sent
 * to Anthropic ("text/markdown" for SKILL.md/rules.md, "text/plain" for
 * code files).
 */
export interface SkillFileSpec {
  path: string;
  uploadName: string; // e.g. "canvas-renderer-generator/SKILL.md"
  mimeType: "text/markdown" | "text/plain";
}

/**
 * If the local skill files have changed since the last sync, push a new
 * version to the existing skill_id. No-op if the hashes match.
 *
 * **Never throws.** If the upload fails (API quirks, network, etc.) the
 * caller still has a working `skillId` pointing at the previous version,
 * so the app keeps functioning with stale skill files until the next
 * restart fixes it. We log the error and return `{ updated: false }` so
 * the caller's fallback chain isn't poisoned.
 *
 * Logging is verbose by design — when this runs, it's user-visible work.
 */
export async function syncSkillVersionIfStale(opts: {
  client: Anthropic;
  skillId: string;
  files: SkillFileSpec[];
  hashCachePath: string;
  logTag: string; // e.g. "[LLM Renderer]"
}): Promise<{ updated: boolean; version?: string }> {
  // `client` is no longer used — we bypass the SDK and POST directly
  // (see comment inside the upload block). Kept on the options type for
  // call-site stability.
  const { skillId, files, hashCachePath, logTag } = opts;

  let currentHash: string;
  try {
    currentHash = await hashSkillFiles(files.map((f) => f.path));
  } catch (err) {
    console.warn(`${logTag} Could not hash skill files (continuing with cached skill version):`, err);
    return { updated: false };
  }

  const storedHash = await readStoredHash(hashCachePath);

  if (storedHash === currentHash) {
    console.log(`${logTag} Skill files unchanged (hash=${currentHash.slice(0, 12)}…); using existing version.`);
    return { updated: false };
  }

  console.log(
    `${logTag} Skill files changed — pushing new version. ` +
    `Old hash: ${storedHash ? storedHash.slice(0, 12) + "…" : "none"}, ` +
    `new hash: ${currentHash.slice(0, 12)}…`
  );

  try {
    // SDK BUG WORKAROUND: client.beta.skills.versions.create() calls
    // multipartFormRequestOptions() with the default stripFilenames=true,
    // which clobbers our directory prefix and uploads files as
    // "SKILL.md" / "interfaces.ts" instead of
    // "pddl-domain-interpreter/SKILL.md". The Anthropic API then can't
    // identify the top-level folder and rejects with
    //   "SKILL.md file must be exactly in the top-level folder."
    // skills.create() works because it explicitly passes
    // stripFilenames=false. There's no public way to override the
    // version-create helper's flag, so we POST the multipart request
    // ourselves and preserve filenames verbatim.
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY is not set");
    }

    const formData = new FormData();
    for (const f of files) {
      const buf = await readFile(f.path);
      // FIELD NAME: must be "files[]" (not "files") — that's the
      // repeated-array convention the Anthropic API expects, and it's
      // what the SDK's own createForm() emits for array body fields.
      // Calling with field "files" gets "No files provided".
      //
      // FormData.append's third argument is the multipart filename and
      // is taken verbatim into Content-Disposition (no path stripping).
      formData.append(
        "files[]",
        new Blob([buf], { type: f.mimeType }),
        f.uploadName
      );
    }

    const url = `https://api.anthropic.com/v1/skills/${encodeURIComponent(skillId)}/versions?beta=true`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "skills-2025-10-02",
      },
      body: formData,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`HTTP ${response.status}: ${text}`);
    }

    const newVersion = (await response.json()) as { version?: string };
    console.log(`${logTag} Uploaded skill version: ${newVersion.version}`);

    // Write the new hash AFTER the upload succeeds so a failed upload
    // doesn't poison the cache and skip the retry on next start.
    await writeStoredHash(hashCachePath, currentHash);

    return { updated: true, version: newVersion.version };
  } catch (err) {
    console.warn(
      `${logTag} Failed to push new skill version (continuing with previous version):`,
      err instanceof Error ? err.message : err
    );
    return { updated: false };
  }
}
