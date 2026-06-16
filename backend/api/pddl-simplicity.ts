/**
 * First-upload simplicity gate for custom domains.
 *
 * When a user uploads a BRAND-NEW domain, the system generates its visualizer
 * (transformer + renderer) once via the LLM and validates it visually. That
 * one-time setup is far cheaper and more reliable on a SMALL problem, so we
 * require the first problem for a new domain to be simple. Once the domain is
 * set up (a saved entry exists), this gate no longer applies and the user can
 * run arbitrarily large problems.
 *
 * Two cheap, ordered checks (see uploadAndGenerateCustom):
 *   1. STATIC  — count objects + goal conditions straight from the problem
 *      PDDL text. Instant, no solve required; rejects obvious giants up front.
 *   2. PLAN    — after the planner solves, require a short plan. Catches the
 *      small-but-combinatorially-hard problem the static check can't see.
 *
 * Pure functions only (no IO) so the thresholds are unit-testable.
 */

/** Tunable caps for what counts as a "simple" first problem. */
export const SIMPLICITY_LIMITS = {
  maxObjects: 8,
  maxGoalAtoms: 5,
  maxPlanLength: 15,
} as const;

/** Logical connectives that wrap goal atoms but are not themselves atoms. */
const GOAL_CONNECTIVES = new Set(["and", "or", "not", "imply", "forall", "exists", "when", "preference"]);

export interface ProblemSize {
  objects: number;
  goalAtoms: number;
}

/** Pull the body of a `(:section …)` block, paren-balanced, or "" if absent. */
function extractSection(pddlLower: string, section: string): string {
  const head = `(:${section}`;
  const start = pddlLower.indexOf(head);
  if (start === -1) return "";
  let depth = 0;
  let i = start;
  for (; i < pddlLower.length; i++) {
    if (pddlLower[i] === "(") depth++;
    else if (pddlLower[i] === ")") {
      depth--;
      if (depth === 0) break;
    }
  }
  // Body is between the section keyword and the matching close paren.
  return pddlLower.slice(start + head.length, i);
}

/**
 * Count declared objects in a `(:objects …)` body. Handles typed blocks like
 * `a b c - block d e - table`: every whitespace token is an object name except
 * the `-` markers and the type token that follows each `-`.
 */
function countObjects(objectsBody: string): number {
  const tokens = objectsBody.split(/\s+/).filter(Boolean);
  let count = 0;
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i] === "-") {
      i++; // skip the type token after the dash
      continue;
    }
    count++;
  }
  return count;
}

/**
 * Count goal atoms in a `(:goal …)` body: predicate-opening parens that are
 * not logical connectives. `(and (on a b) (clear c))` → 2.
 */
function countGoalAtoms(goalBody: string): number {
  const matches = goalBody.match(/\(\s*([\w-]+)/g) ?? [];
  let count = 0;
  for (const m of matches) {
    const name = m.replace(/[(\s]/g, "");
    if (!GOAL_CONNECTIVES.has(name)) count++;
  }
  return count;
}

/** Measure a problem's static size from its PDDL text. */
export function measureProblemSize(problemPddl: string): ProblemSize {
  const lower = problemPddl.toLowerCase();
  return {
    objects: countObjects(extractSection(lower, "objects")),
    goalAtoms: countGoalAtoms(extractSection(lower, "goal")),
  };
}

export interface SimplicityVerdict {
  ok: boolean;
  /** Telemetry tag, e.g. "too_complex_static" / "too_complex_plan". */
  errorType?: string;
  /** User-facing explanation (only when !ok). */
  message?: string;
}

const SETUP_PREAMBLE =
  "Setting up a new domain generates and visually checks its renderer once, " +
  "so the first problem needs to be small. ";

const SETUP_SUFFIX =
  " You can run larger problems on this domain right after it's set up.";

/**
 * STATIC check — runs before solving. Rejects a first problem that is clearly
 * too large by object / goal count.
 */
export function checkProblemSimplicity(
  problemPddl: string,
  limits = SIMPLICITY_LIMITS
): SimplicityVerdict {
  const { objects, goalAtoms } = measureProblemSize(problemPddl);
  const reasons: string[] = [];
  if (objects > limits.maxObjects) {
    reasons.push(`${objects} objects (max ${limits.maxObjects})`);
  }
  if (goalAtoms > limits.maxGoalAtoms) {
    reasons.push(`${goalAtoms} goal conditions (max ${limits.maxGoalAtoms})`);
  }
  if (reasons.length === 0) return { ok: true };
  return {
    ok: false,
    errorType: "too_complex_static",
    message:
      SETUP_PREAMBLE +
      `This problem has ${reasons.join(" and ")}. ` +
      "Please start with a smaller problem." +
      SETUP_SUFFIX,
  };
}

/**
 * PLAN check — runs after solving. Rejects a first problem whose optimal/found
 * plan is long (i.e. hard to set the renderer up against), even if it looked
 * small statically.
 */
export function checkPlanSimplicity(
  planLength: number,
  limits = SIMPLICITY_LIMITS
): SimplicityVerdict {
  if (planLength <= limits.maxPlanLength) return { ok: true };
  return {
    ok: false,
    errorType: "too_complex_plan",
    message:
      SETUP_PREAMBLE +
      `This problem takes ${planLength} steps to solve (max ${limits.maxPlanLength}). ` +
      "Please start with a problem that solves in fewer steps." +
      SETUP_SUFFIX,
  };
}

/** Prefix used to mark a TOO_COMPLEX error so the frontend can detect it. */
export const TOO_COMPLEX_PREFIX = "TOO_COMPLEX::";
