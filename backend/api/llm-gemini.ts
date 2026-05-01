/**
 * Shared Gemini helper.
 *
 * Gemini doesn't have a Skills API — we just concatenate the skill
 * content into a flat .txt file under prompts/ and pass it as a system
 * instruction. This module wraps that pattern with:
 *
 *   - Mtime-based cache invalidation: edit the prompt file, the next
 *     call notices the mtime changed and re-reads it (no restart).
 *   - Audit log of the prompt content hash so logs answer "which
 *     prompt ran for this generation?".
 *   - Bounded retry-with-backoff for transient 429/503 errors.
 *   - `maxOutputTokens` cap as a safety ceiling.
 *
 * Deliberately NOT set:
 *   - `temperature` — at 0.2 the model went into terse-mode and
 *     produced ~700-char outputs missing the entry function. Default
 *     temperature gives reliable multi-thousand-char code.
 *   - `responseMimeType` — text/plain is already the default; setting
 *     it explicitly didn't help and may have contributed to terseness.
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import { readFile, stat } from "fs/promises";
import crypto from "crypto";

interface CachedPrompt {
  text: string;
  mtimeMs: number;
  contentHash: string;
}

// Per-process cache keyed by absolute path.
const promptCache = new Map<string, CachedPrompt>();

function shortHash(s: string): string {
  return crypto.createHash("sha256").update(s).digest("hex").slice(0, 12);
}

/**
 * Read a Gemini system prompt from disk, using mtime as the cache key.
 * If the file's mtime has changed since the last read, re-load it.
 *
 * This mirrors the "edit the file, restart, it just works" experience
 * Claude users get from the hash-based skill version sync — but it's
 * even cheaper because there's no API upload involved.
 */
async function loadGeminiPromptCached(
  promptPath: string,
  logTag: string
): Promise<CachedPrompt> {
  const stats = await stat(promptPath);
  const cached = promptCache.get(promptPath);
  if (cached && cached.mtimeMs === stats.mtimeMs) {
    return cached;
  }

  const text = await readFile(promptPath, "utf-8");
  const contentHash = shortHash(text);
  const fresh: CachedPrompt = {
    text,
    mtimeMs: stats.mtimeMs,
    contentHash,
  };
  promptCache.set(promptPath, fresh);

  if (cached) {
    console.log(
      `${logTag} [provider=gemini] Prompt file changed ` +
      `(${cached.contentHash} → ${contentHash}); reloaded ${text.length} chars from ${promptPath}`
    );
  } else {
    console.log(
      `${logTag} [provider=gemini] Loaded prompt: ${text.length} chars, sha=${contentHash}`
    );
  }
  return fresh;
}

export interface CallGeminiOptions {
  /** Absolute path to the system-prompt .txt file. */
  promptPath: string;
  /** Full user message — typically PDDL + instructions. */
  userMessage: string;
  modelId: string;
  logTag: string;
  /** Number of retry attempts on transient (429/503) errors. Defaults to 2. */
  maxRetries?: number;
}

/**
 * Returns true if an error is worth retrying (transient — connection
 * problems, 429/503, timeouts). Avoids retrying 4xx like invalid-request
 * or auth failures, which won't get better on retry.
 */
function isTransient(err: unknown): boolean {
  if (!err) return false;
  const msg = err instanceof Error ? err.message : String(err);

  // Generic network / connection failures from Node's undici (the
  // GoogleGenerativeAI SDK uses fetch under the hood). "fetch failed"
  // wraps things like ECONNRESET, EPIPE, TLS handshake errors, etc.
  // — all worth retrying.
  if (/fetch failed/i.test(msg)) return true;
  if (/ECONN(RESET|REFUSED|ABORTED)|EPIPE|ETIMEDOUT|EAI_AGAIN|ENETUNREACH/i.test(msg)) return true;

  if (/aborted|abortError|timeout/i.test(msg)) return true;

  // GoogleGenerativeAI wraps HTTP errors with status text in the message.
  if (/\b(429|500|502|503|504)\b/.test(msg)) return true;
  if (/network|temporarily unavailable|service unavailable/i.test(msg)) return true;

  return false;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function callGemini(opts: CallGeminiOptions): Promise<string> {
  const { promptPath, userMessage, modelId, logTag, maxRetries = 2 } = opts;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is not set.");
  }

  const prompt = await loadGeminiPromptCached(promptPath, logTag);
  const userHash = shortHash(userMessage);
  console.log(
    `${logTag} [provider=gemini] Calling ${modelId} ` +
    `(user msg ${userMessage.length} chars, sha=${userHash}; prompt sha=${prompt.contentHash})`
  );

  const genAI = new GoogleGenerativeAI(apiKey);

  // KEEP THIS EXACTLY LIKE THE ORIGINAL WORKING IMPLEMENTATION.
  // Just two parameters: model + systemInstruction. Do NOT add
  // generationConfig (no maxOutputTokens, no temperature, no
  // responseMimeType — every one of these has historically broken
  // output quality on Gemini 2.5 Pro). The SDK default behavior is
  // what produced reliable multi-thousand-char code in the original
  // implementation.
  const model = genAI.getGenerativeModel({
    model: modelId,
    systemInstruction: prompt.text,
  });

  // Targeted safety net for Gemini variance: same prompt sometimes
  // produces full multi-thousand-char code, sometimes 200-char garbage.
  // When the response is below this threshold AND we have retries left,
  // try once more. Threshold chosen empirically: working ferry outputs
  // were ~6kB; broken ones were 339B / 2,314B. 1500 is a comfortable
  // middle. After exhausting retries we return whatever we got — the
  // frontend will surface a render error rather than save silently.
  const MIN_OUTPUT_CHARS = 1500;

  let lastErr: unknown;
  let lastShortText: string | null = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await model.generateContent(userMessage);
      const text = result.response.text();
      if (!text) throw new Error("Gemini returned no text content.");

      // Short-output safety net.
      if (text.length < MIN_OUTPUT_CHARS) {
        if (attempt < maxRetries) {
          console.warn(
            `${logTag} [provider=gemini] Suspiciously short response (${text.length} chars, ` +
            `threshold ${MIN_OUTPUT_CHARS}) on attempt ${attempt + 1}. Raw text preview:\n` +
            JSON.stringify(text.slice(0, 300)) + `\nRetrying…`
          );
          lastShortText = text;
          await sleep(500); // small backoff to give Gemini a beat
          continue;
        }
        // Last attempt — return what we got but flag it loudly. The
        // canvas will fail at render time which is no worse than before
        // we added this safety net; at least the user can see the model
        // is misbehaving.
        console.warn(
          `${logTag} [provider=gemini] All ${maxRetries + 1} attempts produced short responses. ` +
          `Returning the last one (${text.length} chars). Frontend canvas will likely fail; ` +
          `consider switching to Claude for this domain.`
        );
      }

      console.log(
        `${logTag} [provider=gemini] Code length: ${text.length}` +
        (attempt > 0 ? ` (after ${attempt} retr${attempt === 1 ? "y" : "ies"})` : "")
      );
      return text;
    } catch (err) {
      lastErr = err;
      if (attempt < maxRetries && isTransient(err)) {
        const backoffMs = 500 * Math.pow(2, attempt);
        console.warn(
          `${logTag} [provider=gemini] Transient failure on attempt ${attempt + 1}, ` +
          `retrying in ${backoffMs}ms:`,
          err instanceof Error ? err.message : err
        );
        await sleep(backoffMs);
        continue;
      }
      throw err;
    }
  }

  // If we got here it's because every attempt produced short output and
  // we exhausted retries — but the success path returns inside the loop,
  // so this is unreachable for the short-text case. Keep this for the
  // exotic case where every attempt threw a transient error.
  if (lastShortText !== null) {
    return lastShortText;
  }
  throw lastErr ?? new Error("Gemini call failed for unknown reason");
}
