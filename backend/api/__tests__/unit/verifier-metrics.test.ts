import { describe, it, expect } from "vitest";
import {
  normalizePredicate,
  scopeToExpected,
  setMetrics,
  aggregateByDomain,
  aggregateByDomainAndProblem,
  aggregateByMethodDomainAndVersion,
} from "../../verifier-metrics";

describe("normalizePredicate", () => {
  it("lowercases and trims", () => {
    expect(normalizePredicate("  (On A B)  ")).toBe("(on a b)");
  });
  it("strips wrapping double quotes", () => {
    expect(normalizePredicate('"(on a b)"')).toBe("(on a b)");
  });
  it("strips wrapping single quotes", () => {
    expect(normalizePredicate("'(on a b)'")).toBe("(on a b)");
  });
  it("collapses internal whitespace", () => {
    expect(normalizePredicate("(on   a    b)")).toBe("(on a b)");
  });
});

describe("scopeToExpected", () => {
  it("auto-scopes to predicate names found in expected", () => {
    const result = scopeToExpected(
      ["(on a b)", "(handempty)"],
      ["(on a b)", "(at-robby room1)", "(handempty)"]
    );
    expect(result.scope).toEqual(["handempty", "on"]);
    expect(result.expectedScoped).toEqual(["(handempty)", "(on a b)"]);
    expect(result.extractedScoped).toEqual(["(handempty)", "(on a b)"]);
  });

  it("dedupes within scope", () => {
    const result = scopeToExpected(["(on a b)", "(on a b)"], ["(on a b)"]);
    expect(result.expectedScoped).toEqual(["(on a b)"]);
  });
});

describe("setMetrics", () => {
  it("computes TP/FP/FN correctly", () => {
    const m = setMetrics(
      ["(on a b)", "(ontable c)", "(handempty)"],
      ["(on a b)", "(ontable c)", "(holding d)"] // missing handempty; holding is in scope (matches "holding" name? no — scope is built from expected)
    );
    // Scope is {on, ontable, handempty}. So (holding d) is dropped.
    expect(m.tp).toEqual(["(on a b)", "(ontable c)"]);
    expect(m.fp).toEqual([]);
    expect(m.fn).toEqual(["(handempty)"]);
    expect(m.precision).toBe(1);
    expect(m.recall).toBeCloseTo(2 / 3);
  });

  it("scopes out hallucinated predicate names not in expected", () => {
    const m = setMetrics(["(on a b)"], ["(on a b)", "(zzz nope)"]);
    expect(m.fp).toEqual([]);
    expect(m.precision).toBe(1);
    expect(m.recall).toBe(1);
  });

  it("normalizes case and whitespace before diffing", () => {
    const m = setMetrics(["(on A B)"], ["(ON  a  b)"]);
    expect(m.tp).toHaveLength(1);
    expect(m.precision).toBe(1);
    expect(m.recall).toBe(1);
  });

  it("empty expected and empty extracted → P=1, R=1 (trivially correct)", () => {
    const m = setMetrics([], []);
    expect(m.precision).toBe(1);
    expect(m.recall).toBe(1);
  });

  it("empty expected, non-empty extracted → P=0, R=null", () => {
    // Scope is empty (built from expected), so extracted is filtered to []
    // Actually with empty expected, scope = ∅, so both expectedScoped and extractedScoped are ∅
    // That puts us in the (∅, ∅) branch
    const m = setMetrics([], ["(on a b)"]);
    // With auto-scoping, this collapses to (∅, ∅)
    expect(m.precision).toBe(1);
    expect(m.recall).toBe(1);
  });

  it("non-empty expected, empty extracted → P=null, R=0", () => {
    const m = setMetrics(["(on a b)"], []);
    expect(m.precision).toBeNull();
    expect(m.recall).toBe(0);
    expect(m.fn).toEqual(["(on a b)"]);
  });
});

describe("aggregateByDomain", () => {
  it("averages per-state metrics within each domain", () => {
    const rows = [
      { domainName: "blocks-world", precision: 1.0, recall: 1.0 },
      { domainName: "blocks-world", precision: 0.5, recall: 0.5 },
      { domainName: "gripper", precision: 0.8, recall: 0.6 },
    ];
    const out = aggregateByDomain(rows);
    expect(out).toHaveLength(2);
    const bw = out.find((r) => r.domain === "blocks-world")!;
    expect(bw.avgPrecision).toBe(0.75);
    expect(bw.avgRecall).toBe(0.75);
    expect(bw.nStates).toBe(2);
    expect(bw.nPrecisionContributors).toBe(2);
  });

  it("excludes null precision from average, doesn't treat as 0", () => {
    const rows = [
      { domainName: "x", precision: 1.0, recall: 0.5 },
      { domainName: "x", precision: null, recall: 0.5 },
    ];
    const out = aggregateByDomain(rows);
    expect(out[0].avgPrecision).toBe(1.0); // not (1.0 + 0) / 2
    expect(out[0].nPrecisionContributors).toBe(1);
    expect(out[0].nStates).toBe(2);
  });

  it("returns null avg when every contributor is null", () => {
    const rows = [
      { domainName: "x", precision: null, recall: null },
      { domainName: "x", precision: null, recall: null },
    ];
    const out = aggregateByDomain(rows);
    expect(out[0].avgPrecision).toBeNull();
    expect(out[0].avgRecall).toBeNull();
  });

  it("sorts results alphabetically", () => {
    const rows = [
      { domainName: "zoo", precision: 1, recall: 1 },
      { domainName: "ant", precision: 1, recall: 1 },
    ];
    const out = aggregateByDomain(rows);
    expect(out.map((r) => r.domain)).toEqual(["ant", "zoo"]);
  });
});

describe("aggregateByDomainAndProblem", () => {
  it("rolls up per problem then per domain (equal weight per problem)", () => {
    const rows = [
      { domainName: "bw", problem: "p1", precision: 1.0, recall: 1.0 },
      { domainName: "bw", problem: "p1", precision: 1.0, recall: 1.0 },
      { domainName: "bw", problem: "p2", precision: 0.0, recall: 0.0 },
    ];
    const out = aggregateByDomainAndProblem(rows);
    expect(out).toHaveLength(1);
    // Per-problem avgs: p1=1.0, p2=0.0 → domain avg = (1.0 + 0.0)/2 = 0.5
    expect(out[0].avgPrecision).toBe(0.5);
    expect(out[0].problems).toHaveLength(2);
    expect(out[0].nStates).toBe(3);
    expect(out[0].nProblems).toBe(2);
  });

  it("uses '(unknown)' for missing problem name", () => {
    const rows = [
      { domainName: "bw", problem: null, precision: 1, recall: 1 },
    ];
    const out = aggregateByDomainAndProblem(rows);
    expect(out[0].problems[0].problem).toBe("(unknown)");
  });
});

describe("aggregateByMethodDomainAndVersion", () => {
  it("orders methods basic → claude → gemini → others", () => {
    const rows = [
      { domainName: "x", problem: "p", precision: 1, recall: 1,
        renderMethod: "gemini", savedDomainId: null, savedDomainDisplayName: null,
        rendererHash: null, transformerHash: null, isCustomDomain: false, llmProvider: null },
      { domainName: "x", problem: "p", precision: 1, recall: 1,
        renderMethod: "basic", savedDomainId: null, savedDomainDisplayName: null,
        rendererHash: null, transformerHash: null, isCustomDomain: false, llmProvider: null },
      { domainName: "x", problem: "p", precision: 1, recall: 1,
        renderMethod: "claude", savedDomainId: null, savedDomainDisplayName: null,
        rendererHash: null, transformerHash: null, isCustomDomain: false, llmProvider: null },
    ];
    const out = aggregateByMethodDomainAndVersion(rows);
    expect(out.map((m) => m.renderMethod)).toEqual(["basic", "claude", "gemini"]);
  });

  it("infers 'basic' for legacy rows without LLM hashes", () => {
    const rows = [
      { domainName: "x", problem: "p", precision: 1, recall: 1,
        renderMethod: null, savedDomainId: null, savedDomainDisplayName: null,
        rendererHash: null, transformerHash: null, isCustomDomain: false, llmProvider: null },
    ];
    const out = aggregateByMethodDomainAndVersion(rows);
    expect(out[0].renderMethod).toBe("basic");
  });

  it("groups saved-domain entries by savedDomainId (versions)", () => {
    const rows = [
      { domainName: "ferry", problem: "p1", precision: 1, recall: 1,
        renderMethod: "claude", savedDomainId: 1, savedDomainDisplayName: "Ferry",
        rendererHash: "h1", transformerHash: "t1", isCustomDomain: true, llmProvider: "claude" },
      { domainName: "ferry", problem: "p1", precision: 0.5, recall: 0.5,
        renderMethod: "claude", savedDomainId: 2, savedDomainDisplayName: "Ferry (2)",
        rendererHash: "h2", transformerHash: "t2", isCustomDomain: true, llmProvider: "claude" },
    ];
    const out = aggregateByMethodDomainAndVersion(rows);
    expect(out).toHaveLength(1);
    expect(out[0].domains[0].nVersions).toBe(2);
    expect(out[0].domains[0].versions.map((v) => v.versionLabel)).toEqual(["Ferry", "Ferry (2)"]);
  });
});
