/**
 * Stage 1 (domain-interpreter) → Stage 2 (renderer) handoff contract.
 *
 * The renderer consumes `transformerCode` (Stage 1 output) plus sample
 * `states` produced by running the transformer. This test fixes the
 * contract: whatever Stage 1's response shape is today, Stage 2 must
 * accept it without field-rename surgery. Any breaking change to either
 * interface will fail compilation and one of the assertions below.
 *
 * We import the types only — no LLM calls. This is a static + structural
 * contract check, hermetic and fast.
 */

import { describe, it, expect } from "vitest";
import type {
  GenerateTransformerRequest,
  GenerateTransformerResponse,
} from "../../llm-domain-interpreter";
import type {
  GenerateRendererRequest,
  GenerateRendererResponse,
} from "../../llm-renderer";

const STAGE1_REQUEST: GenerateTransformerRequest = {
  domainName: "blocks-world",
  domainPddl: "(define (domain blocks-world) ...)",
  sampleStates: [
    { domain: "blocks-world", objects: [], relations: [] },
    { domain: "blocks-world", objects: [{ id: "a", type: "block", label: "A" }], relations: [] },
  ],
  provider: "claude",
};

const STAGE1_RESPONSE: GenerateTransformerResponse = {
  success: true,
  code: "export function transform(state) { return state; }",
  provider: "claude",
  model: "claude-sonnet-4-5",
};

describe("Stage 1 → Stage 2 handoff", () => {
  it("Stage 1 response carries the fields Stage 2 needs as request inputs", () => {
    // Stage 2's GenerateRendererRequest requires:
    //  - domainName (from Stage 1's request, unchanged)
    //  - domainPddl (also from Stage 1's request)
    //  - transformerCode (from Stage 1's response.code)
    //  - states (sample states AFTER the transformer is applied)
    //
    // Build a Stage 2 request by joining Stage 1 inputs + outputs:
    const stage2Request: GenerateRendererRequest = {
      domainName: STAGE1_REQUEST.domainName,
      states: STAGE1_REQUEST.sampleStates, // will be passed through transformer downstream
      domainPddl: STAGE1_REQUEST.domainPddl,
      transformerCode: STAGE1_RESPONSE.code!,
      provider: STAGE1_REQUEST.provider,
    };

    // Sanity: every required field present + non-empty.
    expect(stage2Request.domainName).toBe("blocks-world");
    expect(stage2Request.transformerCode.length).toBeGreaterThan(0);
    expect(Array.isArray(stage2Request.states)).toBe(true);
    expect(stage2Request.provider).toBe("claude");
  });

  it("response shapes have matching error reporting", () => {
    // Both stages MUST report errors with `success: false` + an `error` string
    // — this is what the frontend's error-surfacing relies on (no silent failures).
    const stage1Err: GenerateTransformerResponse = {
      success: false,
      error: "API timeout",
      provider: "claude",
      model: "claude-sonnet-4-5",
    };
    const stage2Err: GenerateRendererResponse = {
      success: false,
      error: "Renderer validation failed",
      provider: "claude",
      model: "claude-sonnet-4-5",
    };
    expect(stage1Err.success).toBe(false);
    expect(stage2Err.success).toBe(false);
    expect(stage1Err.error).toMatch(/timeout/);
    expect(stage2Err.error).toMatch(/validation/);
  });

  it("the LLMProvider type is shared between the two stages", () => {
    // If this ever diverges (e.g., Stage 1 adds a provider that Stage 2 doesn't),
    // the assignment below will fail to compile. Runtime check is a backstop.
    const provider: GenerateTransformerRequest["provider"] = "claude";
    const sameProvider: GenerateRendererRequest["provider"] = provider;
    expect(sameProvider).toBe("claude");
  });
});
