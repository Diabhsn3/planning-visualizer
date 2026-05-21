/**
 * Pure metric functions for the verification agent.
 *
 * No LLM, no I/O. The LLM only does `unvis` (extracts s' from an image);
 * everything in this file is deterministic set arithmetic.
 *
 * Metric definitions (per supervisor):
 *   TP = predicates in s ∩ s'
 *   FP = predicates in s' \ s    (visualizer hallucinated)
 *   FN = predicates in s \ s'    (visualizer dropped)
 *   precision = TP / (TP + FP)
 *   recall    = TP / (TP + FN)
 *
 * Per-state values are computed first, then **averaged per domain** (not
 * micro-averaged across all states). Empty-set edge cases use the
 * conventions in the table below — see aggregateByDomain for the
 * exclusion rule:
 *
 *   expected | extracted | precision | recall | comment
 *   ---------|-----------|-----------|--------|------------------------
 *   ∅        | ∅         | 1         | 1      | trivially correct
 *   ∅        | non-∅     | 0         | null   | only FP, recall undefined
 *   non-∅    | ∅         | null      | 0      | only FN, precision undefined
 *   non-∅    | non-∅     | formula   | formula| normal case
 *
 * Null metrics are skipped (not counted as 0) when averaging. This avoids
 * silently penalizing states the verifier wasn't asked to grade.
 */

/**
 * Normalize a predicate string for set membership.
 *
 * The planner emits `(on b1 b2)`. The verifier *should* emit the same,
 * but model output drifts (extra whitespace, mixed case, trailing
 * punctuation). Apply a forgiving normalization so cosmetic differences
 * don't cause false negatives in the set diff.
 */
export function normalizePredicate(p: string): string {
  let s = p.trim().toLowerCase();
  // Strip wrapping quotes if the model emitted "(on b1 b2)" instead of (on b1 b2).
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1).trim();
  }
  // Collapse internal whitespace.
  s = s.replace(/\s+/g, " ");
  return s;
}

function predicateName(p: string): string | null {
  // Expect S-expr form: (name arg1 arg2) or (name)
  const m = /^\(([^\s()]+)/.exec(p);
  return m ? m[1] : null;
}

export interface ScopeResult {
  /** Predicate names retained for grading. */
  scope: string[];
  /** s after dropping predicates whose name isn't in scope. */
  expectedScoped: string[];
  /** s' after dropping predicates whose name isn't in scope. */
  extractedScoped: string[];
}

/**
 * Auto-scope: the set of predicate names that appear in `expected` (s).
 * Both sides are projected down to predicates whose name is in this set.
 *
 * Rationale: if the renderer can't see `at-position(...)` because it's not
 * part of this state, the verifier hallucinating it shouldn't count as
 * FP — that's noise outside the gradable scope. If `handempty` IS in s,
 * then the verifier missing it IS a real FN.
 */
export function scopeToExpected(
  expected: string[],
  extracted: string[]
): ScopeResult {
  const expNorm = expected.map(normalizePredicate);
  const extNorm = extracted.map(normalizePredicate);
  const scope = new Set<string>();
  for (const p of expNorm) {
    const n = predicateName(p);
    if (n) scope.add(n);
  }
  return {
    scope: [...scope].sort(),
    expectedScoped: [...new Set(expNorm.filter((p) => {
      const n = predicateName(p);
      return n !== null && scope.has(n);
    }))].sort(),
    extractedScoped: [...new Set(extNorm.filter((p) => {
      const n = predicateName(p);
      return n !== null && scope.has(n);
    }))].sort(),
  };
}

export interface SetMetrics {
  tp: string[];
  fp: string[];
  fn: string[];
  /** TP / (TP + FP). null when TP+FP = 0 AND expected is non-empty. */
  precision: number | null;
  /** TP / (TP + FN). null when TP+FN = 0 AND extracted is non-empty. */
  recall: number | null;
}

/**
 * Set-diff `expected` (s) vs `extracted` (s') after auto-scoping.
 *
 * Both inputs are the FULL predicate lists from each side; this function
 * scopes them internally so callers don't have to remember to.
 */
export function setMetrics(expected: string[], extracted: string[]): SetMetrics & { scope: string[] } {
  const { scope, expectedScoped, extractedScoped } = scopeToExpected(expected, extracted);
  const expSet = new Set(expectedScoped);
  const extSet = new Set(extractedScoped);

  const tp: string[] = [];
  const fp: string[] = [];
  const fn: string[] = [];

  for (const p of expSet) {
    if (extSet.has(p)) tp.push(p);
    else fn.push(p);
  }
  for (const p of extSet) {
    if (!expSet.has(p)) fp.push(p);
  }

  // Edge cases — see header.
  let precision: number | null;
  let recall: number | null;

  if (expSet.size === 0 && extSet.size === 0) {
    precision = 1;
    recall = 1;
  } else if (expSet.size === 0) {
    // Only FPs; recall denominator is 0.
    precision = 0;
    recall = null;
  } else if (extSet.size === 0) {
    // Only FNs; precision denominator is 0.
    precision = null;
    recall = 0;
  } else {
    precision = tp.length / (tp.length + fp.length);
    recall = tp.length / (tp.length + fn.length);
  }

  return { tp: tp.sort(), fp: fp.sort(), fn: fn.sort(), precision, recall, scope };
}

export interface AggregateRow {
  domainName: string;
  precision: number | null;
  recall: number | null;
}

export interface AggregateRowWithProblem extends AggregateRow {
  problem: string | null;
}

export interface DomainAggregate {
  domain: string;
  avgPrecision: number | null;
  avgRecall: number | null;
  /** Total rows considered (states), regardless of null metrics. */
  nStates: number;
  /** Rows where precision was non-null (denominator for avgPrecision). */
  nPrecisionContributors: number;
  /** Rows where recall was non-null (denominator for avgRecall). */
  nRecallContributors: number;
}

/**
 * Average precision and recall **per state then per domain** (per
 * supervisor — NOT micro-averaged across all predicates of all states).
 *
 * Null metrics are excluded from their respective average rather than
 * treated as 0. See header for why.
 */
export function aggregateByDomain(rows: AggregateRow[]): DomainAggregate[] {
  const byDomain = new Map<string, AggregateRow[]>();
  for (const r of rows) {
    const arr = byDomain.get(r.domainName) ?? [];
    arr.push(r);
    byDomain.set(r.domainName, arr);
  }

  const result: DomainAggregate[] = [];
  for (const [domain, items] of byDomain) {
    const ps = items.map((r) => r.precision).filter((p): p is number => p !== null);
    const rs = items.map((r) => r.recall).filter((p): p is number => p !== null);
    result.push({
      domain,
      avgPrecision: ps.length > 0 ? ps.reduce((a, b) => a + b, 0) / ps.length : null,
      avgRecall: rs.length > 0 ? rs.reduce((a, b) => a + b, 0) / rs.length : null,
      nStates: items.length,
      nPrecisionContributors: ps.length,
      nRecallContributors: rs.length,
    });
  }
  result.sort((a, b) => a.domain.localeCompare(b.domain));
  return result;
}

export interface ProblemAggregate {
  problem: string;
  avgPrecision: number | null;
  avgRecall: number | null;
  nStates: number;
  nPrecisionContributors: number;
  nRecallContributors: number;
}

export interface DomainAggregateWithProblems {
  domain: string;
  avgPrecision: number | null;
  avgRecall: number | null;
  nStates: number;
  nProblems: number;
  problems: ProblemAggregate[];
}

const UNKNOWN_PROBLEM = "(unknown)";

/**
 * Two-level rollup: domain → problem → states.
 *
 * Per-problem avg = mean of that problem's per-state metrics (nulls
 * excluded — see `aggregateByDomain` for the convention).
 *
 * Per-domain avg = mean of that domain's PER-PROBLEM averages (equal
 * weight per problem, NOT a flat micro-average across all states). This
 * matches the supervisor's per-state-then-mean rule applied recursively:
 * each problem gets one "vote" toward the domain average, no matter how
 * many states it contributes.
 *
 * Null problem-level averages are excluded from the domain-level average.
 */
export function aggregateByDomainAndProblem(
  rows: AggregateRowWithProblem[]
): DomainAggregateWithProblems[] {
  // First bucket by (domain, problem).
  const buckets = new Map<string, AggregateRowWithProblem[]>();
  for (const r of rows) {
    const problem = r.problem ?? UNKNOWN_PROBLEM;
    const key = `${r.domainName} ${problem}`;
    const arr = buckets.get(key) ?? [];
    arr.push(r);
    buckets.set(key, arr);
  }

  // Build per-problem aggregates, grouped by domain.
  const byDomain = new Map<string, ProblemAggregate[]>();
  for (const [key, items] of buckets) {
    const [domain, problem] = key.split(" ");
    const ps = items.map((r) => r.precision).filter((p): p is number => p !== null);
    const rs = items.map((r) => r.recall).filter((p): p is number => p !== null);
    const probAgg: ProblemAggregate = {
      problem,
      avgPrecision: ps.length > 0 ? ps.reduce((a, b) => a + b, 0) / ps.length : null,
      avgRecall: rs.length > 0 ? rs.reduce((a, b) => a + b, 0) / rs.length : null,
      nStates: items.length,
      nPrecisionContributors: ps.length,
      nRecallContributors: rs.length,
    };
    const arr = byDomain.get(domain) ?? [];
    arr.push(probAgg);
    byDomain.set(domain, arr);
  }

  const result: DomainAggregateWithProblems[] = [];
  for (const [domain, problems] of byDomain) {
    problems.sort((a, b) => a.problem.localeCompare(b.problem));
    const probPs = problems.map((p) => p.avgPrecision).filter((p): p is number => p !== null);
    const probRs = problems.map((p) => p.avgRecall).filter((p): p is number => p !== null);
    result.push({
      domain,
      avgPrecision: probPs.length > 0 ? probPs.reduce((a, b) => a + b, 0) / probPs.length : null,
      avgRecall: probRs.length > 0 ? probRs.reduce((a, b) => a + b, 0) / probRs.length : null,
      nStates: problems.reduce((s, p) => s + p.nStates, 0),
      nProblems: problems.length,
      problems,
    });
  }
  result.sort((a, b) => a.domain.localeCompare(b.domain));
  return result;
}

// ============================================================================
// Four-level rollup: method → domain → version → problem
// ============================================================================

export interface AggregateRowFull extends AggregateRowWithProblem {
  renderMethod: string | null;
  savedDomainId: number | null;
  savedDomainDisplayName: string | null;
  /** Hashes used by the inference fallback for rows that pre-date renderMethod. */
  rendererHash: string | null;
  transformerHash: string | null;
  isCustomDomain: boolean;
  /** Falls back as a label when llmProvider is unknown. */
  llmProvider: string | null;
}

export interface VersionAggregate {
  savedDomainId: number | null;
  /** Display label — "Ferry", "Ferry (2)", or just the domain name for basic. */
  versionLabel: string;
  avgPrecision: number | null;
  avgRecall: number | null;
  nStates: number;
  problems: ProblemAggregate[];
}

export interface DomainGroupAggregate {
  domainName: string;
  /** Mean of per-version avgs (equal weight per version, null-aware). */
  avgPrecision: number | null;
  avgRecall: number | null;
  nStates: number;
  nVersions: number;
  versions: VersionAggregate[];
}

export interface MethodAggregate {
  /** "basic" | "claude" | "gemini" | (any provider string). */
  renderMethod: string;
  /** Mean of per-domain avgs (equal weight per domain, null-aware). */
  avgPrecision: number | null;
  avgRecall: number | null;
  nStates: number;
  nDomains: number;
  domains: DomainGroupAggregate[];
}

const UNKNOWN_METHOD = "unknown";

/**
 * Backfill `renderMethod` for rows that pre-date the field.
 * Rule of thumb: if neither code hash was present AND it's not a custom
 * domain, treat as basic (hardcoded renderer). Otherwise fall back to the
 * provider name; lastly "unknown".
 */
function inferRenderMethod(r: AggregateRowFull): string {
  if (r.renderMethod) return r.renderMethod;
  const hasLLMCode = r.rendererHash !== null || r.transformerHash !== null;
  if (!hasLLMCode && !r.isCustomDomain) return "basic";
  return r.llmProvider ?? UNKNOWN_METHOD;
}

function meanOrNull(xs: (number | null)[]): number | null {
  const ns = xs.filter((x): x is number => x !== null);
  if (ns.length === 0) return null;
  return ns.reduce((a, b) => a + b, 0) / ns.length;
}

/**
 * Four-level rollup. Each level's average is the mean of the next level
 * down's averages (equal weight per child, null-aware). At the deepest
 * level, the per-problem averages are computed over per-state metrics.
 *
 * Hierarchy:
 *   method (basic / claude / gemini / …)
 *     └ domain (PDDL `(domain foo)` name)
 *         └ version (one row per saved-domain entry; basic rows fold into one)
 *             └ problem (PDDL `(problem bar)` name)
 *                 └ state (per-state precision/recall)
 *
 * Versions:
 *   - Saved domains: keyed by savedDomainId, label = savedDomainDisplayName
 *     ("Ferry", "Ferry (2)", …).
 *   - Non-saved (basic mode, transient LLM runs): all rows fold into one
 *     version labelled with the domain name itself, savedDomainId = null.
 */
export function aggregateByMethodDomainAndVersion(
  rows: AggregateRowFull[]
): MethodAggregate[] {
  // Bucket: method → domain → versionKey → problemKey → AggregateRow[]
  const byMethod = new Map<
    string,
    Map<string, Map<string, Map<string, AggregateRowFull[]>>>
  >();
  // Track version → display label (first one wins).
  const versionLabels = new Map<string, string>();
  // Track version → savedDomainId.
  const versionIds = new Map<string, number | null>();

  for (const r of rows) {
    const method = inferRenderMethod(r);
    const domain = r.domainName;
    const versionKey =
      r.savedDomainId !== null ? `saved-${r.savedDomainId}` : `local-${domain}`;
    const versionLabel =
      r.savedDomainDisplayName ?? r.domainName;
    if (!versionLabels.has(versionKey)) versionLabels.set(versionKey, versionLabel);
    if (!versionIds.has(versionKey)) versionIds.set(versionKey, r.savedDomainId);

    let mMap = byMethod.get(method);
    if (!mMap) {
      mMap = new Map();
      byMethod.set(method, mMap);
    }
    let dMap = mMap.get(domain);
    if (!dMap) {
      dMap = new Map();
      mMap.set(domain, dMap);
    }
    let vMap = dMap.get(versionKey);
    if (!vMap) {
      vMap = new Map();
      dMap.set(versionKey, vMap);
    }
    const problem = r.problem ?? "(unknown)";
    const arr = vMap.get(problem) ?? [];
    arr.push(r);
    vMap.set(problem, arr);
  }

  const result: MethodAggregate[] = [];
  for (const [method, mMap] of byMethod) {
    const domainAggs: DomainGroupAggregate[] = [];
    for (const [domain, dMap] of mMap) {
      const versionAggs: VersionAggregate[] = [];
      for (const [versionKey, vMap] of dMap) {
        const problemAggs: ProblemAggregate[] = [];
        for (const [problem, items] of vMap) {
          const ps = items.map((i) => i.precision);
          const rs = items.map((i) => i.recall);
          problemAggs.push({
            problem,
            avgPrecision: meanOrNull(ps),
            avgRecall: meanOrNull(rs),
            nStates: items.length,
            nPrecisionContributors: ps.filter((p) => p !== null).length,
            nRecallContributors: rs.filter((p) => p !== null).length,
          });
        }
        problemAggs.sort((a, b) => a.problem.localeCompare(b.problem));
        versionAggs.push({
          savedDomainId: versionIds.get(versionKey) ?? null,
          versionLabel: versionLabels.get(versionKey) ?? versionKey,
          avgPrecision: meanOrNull(problemAggs.map((p) => p.avgPrecision)),
          avgRecall: meanOrNull(problemAggs.map((p) => p.avgRecall)),
          nStates: problemAggs.reduce((s, p) => s + p.nStates, 0),
          problems: problemAggs,
        });
      }
      versionAggs.sort((a, b) => a.versionLabel.localeCompare(b.versionLabel));
      domainAggs.push({
        domainName: domain,
        avgPrecision: meanOrNull(versionAggs.map((v) => v.avgPrecision)),
        avgRecall: meanOrNull(versionAggs.map((v) => v.avgRecall)),
        nStates: versionAggs.reduce((s, v) => s + v.nStates, 0),
        nVersions: versionAggs.length,
        versions: versionAggs,
      });
    }
    domainAggs.sort((a, b) => a.domainName.localeCompare(b.domainName));
    result.push({
      renderMethod: method,
      avgPrecision: meanOrNull(domainAggs.map((d) => d.avgPrecision)),
      avgRecall: meanOrNull(domainAggs.map((d) => d.avgRecall)),
      nStates: domainAggs.reduce((s, d) => s + d.nStates, 0),
      nDomains: domainAggs.length,
      domains: domainAggs,
    });
  }
  // Stable ordering: basic → claude → gemini → others alphabetically.
  const order = ["basic", "claude", "gemini"];
  result.sort((a, b) => {
    const ai = order.indexOf(a.renderMethod);
    const bi = order.indexOf(b.renderMethod);
    if (ai !== -1 && bi !== -1) return ai - bi;
    if (ai !== -1) return -1;
    if (bi !== -1) return 1;
    return a.renderMethod.localeCompare(b.renderMethod);
  });
  return result;
}
