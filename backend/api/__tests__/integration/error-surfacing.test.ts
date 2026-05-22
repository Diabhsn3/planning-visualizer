/**
 * Error-surfacing audit for the TS API side.
 *
 * Mirrors the Python audit at backend/planner/tests/e2e/test_error_surfacing.py
 * but for the boundaries owned by the TS API:
 *   - renderer validator (rejects bad LLM output with a clear message)
 *   - metrics (handles malformed predicate strings without crashing)
 *
 * Writes its captured user-visible messages to reports/error-surfacing-ts.json
 * for the dashboard.
 */

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  validateRendererExports,
  assertRendererExports,
  RendererValidationError,
} from "../../renderer-validator";
import { setMetrics, normalizePredicate } from "../../verifier-metrics";

const REPORTS = path.resolve(__dirname, "../../../../reports");
const FILE = path.join(REPORTS, "error-surfacing-ts.json");

function record(caseName: string, surfaced: boolean, message: string) {
  fs.mkdirSync(REPORTS, { recursive: true });
  let payload: Record<string, unknown> = {};
  if (fs.existsSync(FILE)) {
    try {
      payload = JSON.parse(fs.readFileSync(FILE, "utf-8"));
    } catch {
      payload = {};
    }
  }
  payload[caseName] = {
    surfaced,
    user_visible_message: message.slice(0, 400),
    timestamp: new Date().toISOString(),
  };
  fs.writeFileSync(FILE, JSON.stringify(payload, null, 2));
}

describe("Error-surfacing — TS API boundaries", () => {
  it("validator__missing_background → produces a message naming the export", () => {
    const result = validateRendererExports(
      "export function renderRovers(){} export const renderRoversLegend = undefined;",
      "rovers"
    );
    const surfaced =
      !result.ok && result.issues.some((i) => /renderRoversBackground/.test(i.reason));
    const message = result.issues.map((i) => i.reason).join(" | ");
    record("validator__missing_background", surfaced, message);
    expect(surfaced).toBe(true);
  });

  it("validator__throws_on_assert → user-readable error message", () => {
    let thrown: Error | null = null;
    try {
      assertRendererExports("// nothing", "gripper");
    } catch (e) {
      thrown = e as Error;
    }
    const surfaced =
      thrown instanceof RendererValidationError &&
      /failed validation/i.test(thrown.message) &&
      /renderGripper\b/.test(thrown.message);
    record(
      "validator__throws_on_assert",
      surfaced,
      thrown ? thrown.message : "(no throw)"
    );
    expect(surfaced).toBe(true);
  });

  it("metrics__handles_malformed_predicates → no throw, scope auto-restricts", () => {
    // Garbage strings that don't parse as S-expressions must be tolerated.
    let threw = false;
    let m: ReturnType<typeof setMetrics> | null = null;
    try {
      m = setMetrics(["(on a b)"], ["completely not an s-expr", "(on a b)"]);
    } catch {
      threw = true;
    }
    const surfaced = !threw && m !== null && m.precision === 1 && m.recall === 1;
    record(
      "metrics__handles_malformed_predicates",
      surfaced,
      threw ? "crashed on malformed input" : "tolerated and auto-scoped"
    );
    expect(surfaced).toBe(true);
  });

  it("metrics__case_insensitive_match → '(ON a b)' equals '(on a b)'", () => {
    const m = setMetrics(["(ON A B)"], ["(on a b)"]);
    const surfaced = m.precision === 1 && m.recall === 1;
    record(
      "metrics__case_insensitive_match",
      surfaced,
      `normalize('(ON A B)') = ${normalizePredicate("(ON A B)")}`
    );
    expect(surfaced).toBe(true);
  });
});
