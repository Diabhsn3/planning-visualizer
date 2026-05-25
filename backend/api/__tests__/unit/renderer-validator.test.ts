import { describe, it, expect } from "vitest";
import {
  toCamelCase,
  validateRendererExports,
  assertRendererExports,
  RendererValidationError,
} from "../../renderer-validator";

const validBlocksWorld = `
export function renderBlocksWorld(ctx, state, width, height) { /* ... */ }
export function renderBlocksWorldBackground(ctx, width, height) { /* ... */ }
export const renderBlocksWorldLegend = undefined;
`;

const validHanoiArrowMain = `
export const renderHanoi = (ctx, state, w, h) => {};
export function renderHanoiBackground(ctx, w, h) {}
export function renderHanoiLegend(ctx, x, y) {}
`;

const missingBackground = `
export function renderRovers(ctx, state, w, h) {}
export const renderRoversLegend = undefined;
`;

const missingLegend = `
export function renderGripper(ctx, state, w, h) {}
export function renderGripperBackground(ctx, w, h) {}
`;

const missingMain = `
export function renderDepotBackground(ctx, w, h) {}
export const renderDepotLegend = undefined;
`;

const mainAsUndefined = `
export const renderSatellite = undefined;
export function renderSatelliteBackground(ctx, w, h) {}
export const renderSatelliteLegend = undefined;
`;

describe("toCamelCase", () => {
  it("handles hyphenated domain ids", () => {
    expect(toCamelCase("blocks-world")).toBe("BlocksWorld");
  });
  it("handles underscored domain ids", () => {
    expect(toCamelCase("blocks_world")).toBe("BlocksWorld");
  });
  it("handles single-word ids", () => {
    expect(toCamelCase("hanoi")).toBe("Hanoi");
  });
  it("handles mixed-case input", () => {
    expect(toCamelCase("Tower-OF-hanoi")).toBe("TowerOfHanoi");
  });
});

describe("validateRendererExports", () => {
  it("accepts a fully-valid 3-export bundle", () => {
    const result = validateRendererExports(validBlocksWorld, "blocks-world");
    expect(result.ok).toBe(true);
    expect(result.issues).toEqual([]);
    expect(result.mainExportName).toBe("renderBlocksWorld");
    expect(result.backgroundExportName).toBe("renderBlocksWorldBackground");
    expect(result.legendExportName).toBe("renderBlocksWorldLegend");
  });

  it("accepts arrow-function main + function legend", () => {
    const result = validateRendererExports(validHanoiArrowMain, "hanoi");
    expect(result.ok).toBe(true);
  });

  it("accepts legend exported as undefined", () => {
    const result = validateRendererExports(validBlocksWorld, "blocks-world");
    expect(result.ok).toBe(true);
  });

  it("rejects missing background export with a specific message", () => {
    const result = validateRendererExports(missingBackground, "rovers");
    expect(result.ok).toBe(false);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].export).toBe("background");
    expect(result.issues[0].reason).toMatch(/renderRoversBackground/);
  });

  it("rejects missing legend export", () => {
    const result = validateRendererExports(missingLegend, "gripper");
    expect(result.ok).toBe(false);
    expect(result.issues.map((i) => i.export)).toContain("legend");
  });

  it("rejects missing main export", () => {
    const result = validateRendererExports(missingMain, "depot");
    expect(result.ok).toBe(false);
    expect(result.issues.map((i) => i.export)).toContain("main");
  });

  it("rejects main exported as undefined (must be a function)", () => {
    const result = validateRendererExports(mainAsUndefined, "satellite");
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.export === "main" && /undefined/.test(i.reason))).toBe(true);
  });

  it("reports all missing exports at once (not just the first)", () => {
    const result = validateRendererExports("// nothing here", "blocks-world");
    expect(result.ok).toBe(false);
    expect(result.issues).toHaveLength(3);
    expect(new Set(result.issues.map((i) => i.export))).toEqual(
      new Set(["main", "background", "legend"])
    );
  });
});

describe("assertRendererExports", () => {
  it("returns the result when valid", () => {
    const result = assertRendererExports(validBlocksWorld, "blocks-world");
    expect(result.ok).toBe(true);
  });

  it("throws RendererValidationError with a user-readable message when invalid", () => {
    try {
      assertRendererExports(missingBackground, "rovers");
      expect.fail("expected to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(RendererValidationError);
      const message = (err as Error).message;
      expect(message).toMatch(/renderRoversBackground/);
      expect(message).toMatch(/failed validation/);
    }
  });
});
