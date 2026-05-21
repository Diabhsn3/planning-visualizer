/**
 * Shared kernel for Claude agent-loop calls.
 *
 * Both the Skills-based renderer/transformer (llm-claude.ts) and the
 * vision-based verifier (llm-verifier.ts) share the same control flow:
 *
 *   1. Send an initial request with a system prompt, user message, tools,
 *      maybe a container, and zero or more beta flags.
 *   2. If the response stop_reason is `pause_turn`, append the assistant
 *      content to the conversation and continue, up to `maxPauseTurns`.
 *   3. On the final allowed retry, force `tool_choice: "none"` so the
 *      model commits to a text response.
 *   4. Hard 60–90s abort timeout — slow calls fail loudly.
 *
 * What's call-site-specific (and therefore stays OUT of this kernel):
 *   - System prompt text
 *   - Initial user message structure (text-only vs. image + text)
 *   - Container (skills vs. none)
 *   - Tools list and beta flags
 *   - How the final text is parsed
 *
 * Keep this file dependency-light: no parsing, no logging beyond the
 * agent-loop progression, no I/O.
 */

import Anthropic from "@anthropic-ai/sdk";

export interface RunClaudeAgentLoopOptions {
  client: Anthropic;
  modelId: string;
  maxTokens: number;
  /** 0–1. Lower = more deterministic. */
  temperature: number;
  /** Hard timeout — request aborts on overrun. */
  timeoutMs: number;
  /** Tag for log lines, e.g. "[LLM Renderer]" or "[Verifier]". */
  logTag: string;
  /** Full system message blocks (already with cache_control if desired). */
  systemBlocks: any[];
  /** Initial user message(s). */
  initialMessages: any[];
  /** Anthropic-beta header values. */
  betas: string[];
  /** Container config — Skills users pass `{ skills: [...] }`, others omit. */
  container?: any;
  /** Tools available to the model (typically code_execution). */
  tools: any[];
  /**
   * Hard cap on pause_turn continuations. Each continuation re-sends the
   * conversation and adds another billable round-trip.
   */
  maxPauseTurns?: number;
}

/**
 * Drive the Claude agent loop and return the final response.
 *
 * Caller is responsible for extracting whatever they need from
 * `response.content` (text blocks, code execution outputs, etc.).
 */
export async function runClaudeAgentLoop(
  opts: RunClaudeAgentLoopOptions
): Promise<Anthropic.Beta.Messages.BetaMessage> {
  const {
    client,
    modelId,
    maxTokens,
    temperature,
    timeoutMs,
    logTag,
    systemBlocks,
    initialMessages,
    betas,
    container,
    tools,
    maxPauseTurns = 2,
  } = opts;

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);

  let response: Anthropic.Beta.Messages.BetaMessage;
  let pauseTurns = 0;
  let conversation: any[] = initialMessages;

  try {
    response = await client.beta.messages.create(
      {
        model: modelId,
        max_tokens: maxTokens,
        temperature,
        system: systemBlocks as any,
        ...(betas.length > 0 ? { betas: betas as any } : {}),
        ...(container ? { container } : {}),
        messages: conversation,
        ...(tools.length > 0 ? { tools } : {}),
      },
      { signal: ac.signal }
    );

    while (response.stop_reason === "pause_turn") {
      pauseTurns++;
      if (pauseTurns > maxPauseTurns) {
        throw new Error(
          `${logTag} Exceeded ${maxPauseTurns} pause_turns. Aborting to ` +
          `avoid runaway cost.`
        );
      }

      const isFinalRetry = pauseTurns === maxPauseTurns;
      console.log(
        `${logTag} pause_turn ${pauseTurns}/${maxPauseTurns}, ` +
        `continuing${isFinalRetry ? " (final retry: forcing tool_choice=none)" : ""}…`
      );

      conversation = [
        ...conversation,
        { role: "assistant", content: response.content },
      ];

      response = await client.beta.messages.create(
        {
          model: modelId,
          max_tokens: maxTokens,
          temperature,
          system: systemBlocks as any,
          ...(betas.length > 0 ? { betas: betas as any } : {}),
          // Reuse the container ID for sandbox state continuity if the
          // previous response opened one.
          ...(container || response.container?.id
            ? {
                container: response.container?.id
                  ? { id: response.container.id, ...(container ?? {}) }
                  : container,
              }
            : {}),
          messages: conversation,
          ...(tools.length > 0 ? { tools } : {}),
          ...(isFinalRetry && tools.length > 0
            ? { tool_choice: { type: "none" as const } }
            : {}),
        },
        { signal: ac.signal }
      );
    }
  } finally {
    clearTimeout(timer);
  }

  console.log(
    `${logTag} Final response: ${response.content.length} blocks, ` +
    `stop=${response.stop_reason}, pause_turns_used=${pauseTurns}`
  );
  return response;
}
