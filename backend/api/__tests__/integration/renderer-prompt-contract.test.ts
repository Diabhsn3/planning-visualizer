/**
 * Contract test: the renderer-skill PROMPT and the strict VALIDATOR agree
 * on what a valid renderer output looks like.
 *
 * If someone edits the prompt to demand a fourth export, this test fails
 * until the validator is updated too. Conversely, if the validator gains
 * a new requirement, the prompt fixture must be re-checked.
 *
 * The "ground truth" sample comes from the prompt's worked example
 * (renderer-skill.txt around line 188 — the Hanoi sample).
 */

import { describe, it, expect } from "vitest";
import { validateRendererExports } from "../../renderer-validator";

const PROMPT_HANOI_SAMPLE = `
export function renderHanoi(ctx, state, width, height) {
  // ...
}
export function renderHanoiBackground(ctx, width, height) {
  // ...
}
export const renderHanoiLegend = undefined;
`;

const PROMPT_BLOCKS_SAMPLE = `
export function renderBlocksWorld(ctx: CanvasRenderingContext2D, state: any, width: number, height: number): void {}
export function renderBlocksWorldBackground(ctx: CanvasRenderingContext2D, width: number, height: number): void {}
export function renderBlocksWorldLegend(ctx: CanvasRenderingContext2D, x: number, y: number): void {}
`;

describe("renderer-skill prompt × strict validator contract", () => {
  it("validator accepts the prompt's Hanoi worked-example shape", () => {
    const result = validateRendererExports(PROMPT_HANOI_SAMPLE, "hanoi");
    expect(result.ok).toBe(true);
  });

  it("validator accepts the prompt's blocks-world worked-example shape with all three as functions", () => {
    const result = validateRendererExports(PROMPT_BLOCKS_SAMPLE, "blocks-world");
    expect(result.ok).toBe(true);
  });

  it("validator rejects when the model returns ONLY a main renderer (common failure mode)", () => {
    const onlyMain = `export function renderRovers(ctx, state, w, h) {}`;
    const result = validateRendererExports(onlyMain, "rovers");
    expect(result.ok).toBe(false);
    expect(result.issues.map((i) => i.export).sort()).toEqual(["background", "legend"]);
  });
});
