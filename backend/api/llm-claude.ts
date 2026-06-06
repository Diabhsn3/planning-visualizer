/**
 * Shared Claude-with-Skills helper.
 *
 * Both the renderer and the transformer talk to Claude the same way:
 *   - reference an uploaded Skill via container.skills
 *   - send a single user message
 *   - extract the generated code from the assistant's text blocks
 *
 * ## Cost-control strategy
 *
 * The Skills API mounts skill files into a Python sandbox; Claude reads
 * them by invoking `code_execution`. We can't disable the tool — Skills
 * literally requires it ("container: skills can only be used when a code
 * execution tool is enabled"). And tool_choice="none" doesn't work either:
 * it prevents Claude from reading the files, leaving the model with
 * nothing to work from (saw 0-byte responses in testing).
 *
 * So `code_execution` MUST be enabled. The cost problem is that an
 * unconstrained model does ~5 separate `code_execution` calls (one per
 * skill file), each producing a `pause_turn`, each continuation
 * re-sending the full conversation as input → ~$0.43/generation.
 *
 * Three levers we pull:
 *
 *   1. **Batched-read system prompt** — instructs Claude to read ALL
 *      skill files in a SINGLE code_execution call (one Python loop
 *      that prints every file). Drops continuations from ~5 to ~1.
 *
 *   2. **Hard cap on pause_turn loop (2 max)** — if the model ignores
 *      the instruction and tries to do more rounds, we abort with a
 *      loud error rather than burning tokens silently. On the FINAL
 *      retry we set tool_choice="none" so Claude is forced to commit
 *      to a final text response (it can't kick off another file read).
 *
 *   3. **Prompt caching (5-min ephemeral)** — the system prompt and
 *      the user message body are cached. Continuation calls that
 *      re-send them only pay 10% of normal input cost on cache hits,
 *      so the pause_turn round-trip is much cheaper than before.
 *
 * Combined: typical generation drops from ~$0.43 to ~$0.10–$0.15. Still
 * higher than flat-prompt providers (Skills API has intrinsic overhead
 * — that's the whole point of the comparison study), but bounded.
 *
 * Other improvements baked in:
 *   - `temperature: 0.2` for reproducibility (so the artifact-store
 *     hash dedup actually has a chance of hitting on identical PDDLs).
 *   - 240s timeout via AbortSignal — a stuck call no longer hangs.
 *   - Code extraction recognizes both `function foo` and
 *     `const foo = (...) =>` shapes.
 *   - Audit log of user-message sha256 so post-mortems can answer
 *     "which prompt produced this output?".
 */

import Anthropic from "@anthropic-ai/sdk";
import crypto from "crypto";
import { runClaudeAgentLoop } from "./llm-claude-kernel";

export interface CallClaudeWithSkillOptions {
  client: Anthropic;
  /** Resolved skill id from getOrCreateClaudeSkill. */
  skillId: string;
  /** Full user message — typically PDDL + instructions. */
  userMessage: string;
  /**
   * Regex used to identify the "code" text block in the response. Pass
   * something that matches the expected exported function name(s), e.g.
   *   /(?:function|const|let)\s+(?:render)\w*\b/
   * for the renderer or
   *   /(?:function|const|let)\s+(?:transform)\w*\b/
   * for the transformer.
   */
  extractFunctionPattern: RegExp;
  modelId: string;
  maxTokens: number;
  /** e.g. "[LLM Renderer]" or "[LLM Interpreter]" */
  logTag: string;
  /** Defaults to 0.2 — see header comment. */
  temperature?: number;
  /** Defaults to 90s. */
  timeoutMs?: number;
}

const SYSTEM_PROMPT = `You have a Python sandbox via the code_execution tool, with the skill files mounted as readable files in the working directory.

To minimize cost, follow this exact pattern:

1. In a SINGLE code_execution call, read ALL skill files at once. Use this script (or equivalent — the key requirement is one call, not one per file):

\`\`\`python
import os
for name in sorted(os.listdir('.')):
    if os.path.isfile(name):
        print(f"=== {name} ===")
        print(open(name, 'r', encoding='utf-8').read())
\`\`\`

2. Immediately after the file read returns, output the requested TypeScript code as plain text. Do NOT run, test, validate, or compile the generated code. Do NOT make any further tool calls.

Output only the raw TypeScript code — no markdown fences, no commentary, just the code.`;

/** 5-minute Anthropic prompt cache marker. */
const CACHE_EPHEMERAL = { type: "ephemeral" as const };

/**
 * Hard cap on pause_turn continuations. Each continuation re-sends the
 * conversation as input AND adds another billable round-trip.
 *
 * We tried tightening this to 1 with a more aggressive system prompt,
 * but the model still does ~2 file-read rounds in practice (it doesn't
 * follow the "read all in one call" instruction reliably). Setting to
 * 1 just forced an early commit which gave less reliable output. Back
 * to 2: typical 3 calls per stage (initial + 2 pause_turns), still
 * caps runaway loops, and on the FINAL retry we set tool_choice="none"
 * to force the model to commit.
 */
const MAX_PAUSE_TURNS = 2;

function shortHash(s: string): string {
  return crypto.createHash("sha256").update(s).digest("hex").slice(0, 12);
}

export async function callClaudeWithSkill(
  opts: CallClaudeWithSkillOptions
): Promise<string> {
  const {
    client,
    skillId,
    userMessage,
    extractFunctionPattern,
    modelId,
    maxTokens,
    logTag,
    temperature = 0.2,
    // Renderer/transformer generation uses Skills + code-execution and
    // emits large code; under any concurrent API load (e.g. auto-verify
    // calls sharing the org rate limit) the request can be throttled and
    // retried, so 90s was too tight. 240s gives ample headroom.
    timeoutMs = 240_000,
  } = opts;

  const userHash = shortHash(userMessage);
  console.log(
    `${logTag} [provider=claude] Calling ${modelId} with skill ${skillId} ` +
    `(user msg ${userMessage.length} chars, sha=${userHash}, ` +
    `pause_turn cap=${MAX_PAUSE_TURNS}, caching=ephemeral)`
  );

  // System prompt + user message both get cache_control: "ephemeral" so
  // the (large) static portion is reused at 10% cost across continuations.
  const systemBlocks: any[] = [
    { type: "text", text: SYSTEM_PROMPT, cache_control: CACHE_EPHEMERAL },
  ];
  const initialMessages: any[] = [
    {
      role: "user",
      content: [
        { type: "text", text: userMessage, cache_control: CACHE_EPHEMERAL },
      ],
    },
  ];

  const response = await runClaudeAgentLoop({
    client,
    modelId,
    maxTokens,
    temperature,
    timeoutMs,
    logTag: `${logTag} [provider=claude]`,
    systemBlocks,
    initialMessages,
    betas: ["code-execution-2025-08-25", "skills-2025-10-02"],
    container: {
      skills: [
        { type: "custom" as const, skill_id: skillId, version: "latest" },
      ],
    },
    tools: [
      {
        type: "code_execution_20250825" as const,
        name: "code_execution" as const,
      },
    ],
    maxPauseTurns: MAX_PAUSE_TURNS,
  });

  // Extract code from text blocks. Skill-API responses contain a mix of
  //   - text blocks (any narration + the final code output)
  //   - server_tool_use blocks (Claude invoking code_execution)
  //   - code_execution_tool_result blocks (sandbox output)
  // We only care about text blocks. Walk back-to-front because the code
  // is the LAST thing the model emits.
  const textBlocks: string[] = [];
  for (const block of response.content) {
    if (block.type === "text") textBlocks.push(block.text);
  }

  console.log(
    `${logTag} [provider=claude] Extracted ${textBlocks.length} text blocks ` +
    `from ${response.content.length} total, stop=${response.stop_reason}`
  );

  if (textBlocks.length === 0) {
    throw new Error("Claude returned no text content.");
  }

  // Find a block matching the expected function shape. Handles both
  //   function transformX(...)
  //   const transformX = (...) =>
  //   export const transformX = ...
  let chosen: string | null = null;
  for (let i = textBlocks.length - 1; i >= 0; i--) {
    if (extractFunctionPattern.test(textBlocks[i])) {
      chosen = textBlocks[i];
      break;
    }
  }
  if (!chosen) {
    console.warn(
      `${logTag} [provider=claude] No text block matched ${extractFunctionPattern}, ` +
      `using full response (this usually means the model added narration we should remove from the prompt).`
    );
    chosen = textBlocks.join("\n");
  }

  console.log(`${logTag} [provider=claude] Code length: ${chosen.length}`);
  return chosen;
}
