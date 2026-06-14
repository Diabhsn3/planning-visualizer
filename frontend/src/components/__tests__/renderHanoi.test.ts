import { describe, it, expect } from "vitest";
import {
  renderHanoi,
  renderHanoiBackground,
  renderHanoiLegend,
  type RenderedState,
} from "@/components/renderHanoi";

function makeCtx() {
  const calls: { method: string; args: unknown[] }[] = [];
  const handler: ProxyHandler<object> = {
    get(_t, prop) {
      if (prop === "calls") return calls;
      // gradients & similar return chainable objects
      if (prop === "createLinearGradient" || prop === "createRadialGradient") {
        return (..._args: unknown[]) => ({ addColorStop: () => undefined });
      }
      if (prop === "measureText") {
        return (..._args: unknown[]) => ({ width: 10 });
      }
      return (...args: unknown[]) => {
        calls.push({ method: String(prop), args });
      };
    },
    set() {
      return true;
    },
  };
  return new Proxy({}, handler) as CanvasRenderingContext2D & { calls: { method: string; args: unknown[] }[] };
}

const sampleHanoi: RenderedState = {
  domain: "hanoi",
  objects: [
    { id: "p1", type: "peg", label: "P1" },
    { id: "p2", type: "peg", label: "P2" },
    { id: "p3", type: "peg", label: "P3" },
    { id: "d1", type: "disk", label: "1" },
    { id: "d2", type: "disk", label: "2" },
  ],
  relations: [
    { type: "on", source: "d1", target: "d2" },
    { type: "on-peg", source: "d2", target: "p1" },
  ],
};

describe("renderHanoi", () => {
  it("renders a sample state without throwing", () => {
    const ctx = makeCtx();
    expect(() => renderHanoi(ctx, sampleHanoi)).not.toThrow();
    expect(ctx.calls.length).toBeGreaterThan(0);
  });

  it("handles empty state without throwing", () => {
    const ctx = makeCtx();
    expect(() =>
      renderHanoi(ctx, { domain: "hanoi", objects: [], relations: [] })
    ).not.toThrow();
  });

  it("background renders without throwing", () => {
    const ctx = makeCtx();
    expect(() => renderHanoiBackground(ctx, 800, 600)).not.toThrow();
  });

  it("legend is undefined when not implemented", () => {
    expect(renderHanoiLegend).toBeUndefined();
  });
});
