import { describe, it, expect } from "vitest";
import { renderDepot, renderDepotBackground, renderDepotLegend } from "@/components/renderDepot";
import { renderRovers, renderRoversBackground, renderRoversLegend } from "@/components/renderRovers";
import { renderSatellite, renderSatelliteBackground, renderSatelliteLegend } from "@/components/renderSatellite";

function makeCtx(): CanvasRenderingContext2D {
  const handler: ProxyHandler<object> = {
    get(_t, prop) {
      if (prop === "createLinearGradient" || prop === "createRadialGradient") {
        return () => ({ addColorStop: () => undefined });
      }
      if (prop === "measureText") {
        return () => ({ width: 10 });
      }
      if (prop === "createPattern") return () => null;
      return () => undefined;
    },
    set() {
      return true;
    },
  };
  return new Proxy({}, handler) as CanvasRenderingContext2D;
}

const emptyState = (domain: string) => ({
  domain,
  objects: [],
  relations: [],
});

const sampleDepot = {
  domain: "depot",
  objects: [
    { id: "depot1", type: "depot", label: "D1", position: [0, 0] as [number, number] },
    { id: "truck1", type: "truck", label: "T1", position: [100, 0] as [number, number] },
    { id: "crate1", type: "package", label: "C1", position: [0, 50] as [number, number] },
  ],
  relations: [{ type: "at", source: "truck1", target: "depot1" }],
};

const sampleRovers = {
  domain: "rovers",
  objects: [
    { id: "rover1", type: "rover", label: "R1", position: [0, 0] as [number, number] },
    { id: "wp1", type: "waypoint", label: "W1", position: [100, 100] as [number, number] },
  ],
  relations: [{ type: "at-rover", source: "rover1", target: "wp1" }],
};

const sampleSatellite = {
  domain: "satellite",
  objects: [
    { id: "s1", type: "satellite", label: "S1" },
    { id: "i1", type: "instrument", label: "I1" },
    { id: "t1", type: "target", label: "T1" },
  ],
  relations: [{ type: "onboard", source: "i1", target: "s1" }],
};

describe.each([
  ["depot", renderDepot, renderDepotBackground, renderDepotLegend, sampleDepot],
  ["rovers", renderRovers, renderRoversBackground, renderRoversLegend, sampleRovers],
  ["satellite", renderSatellite, renderSatelliteBackground, renderSatelliteLegend, sampleSatellite],
])("%s renderer", (name, render, background, legend, sample) => {
  it("renders sample state without throwing", () => {
    expect(() => render(makeCtx(), sample as never)).not.toThrow();
  });
  it("renders empty state without throwing", () => {
    expect(() => render(makeCtx(), emptyState(name) as never)).not.toThrow();
  });
  it("background renders without throwing", () => {
    if (typeof background === "function") {
      expect(() => background(makeCtx(), 800, 600)).not.toThrow();
    }
  });
  it("legend is callable or explicitly undefined", () => {
    if (typeof legend === "function") {
      expect(() => legend(makeCtx(), 0, 0)).not.toThrow();
    } else {
      expect(legend).toBeUndefined();
    }
  });
});
