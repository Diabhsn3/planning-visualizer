import { describe, it, expect } from "vitest";
import {
  measureProblemSize,
  checkProblemSimplicity,
  checkPlanSimplicity,
  SIMPLICITY_LIMITS,
} from "../../pddl-simplicity";

const simpleBlocks = `
(define (problem bw-3)
  (:domain blocks-world)
  (:objects a b c - block)
  (:init (ontable a) (ontable b) (ontable c) (clear a) (clear b) (clear c) (handempty))
  (:goal (and (on a b) (on b c))))
`;

const bigObjects = `
(define (problem bw-many)
  (:domain blocks-world)
  (:objects a b c d e f g h i j - block)
  (:init (handempty))
  (:goal (and (on a b))))
`;

const manyGoals = `
(define (problem bw-goals)
  (:domain blocks-world)
  (:objects a b c - block)
  (:init (handempty))
  (:goal (and (on a b) (on b c) (clear a) (ontable c) (handempty) (clear b))))
`;

describe("measureProblemSize", () => {
  it("counts typed objects, ignoring dashes and type tokens", () => {
    expect(measureProblemSize(simpleBlocks).objects).toBe(3);
    expect(measureProblemSize(bigObjects).objects).toBe(10);
  });

  it("counts goal atoms but not the and/connectives", () => {
    expect(measureProblemSize(simpleBlocks).goalAtoms).toBe(2);
    expect(measureProblemSize(manyGoals).goalAtoms).toBe(6);
  });

  it("handles a single (non-and) goal atom", () => {
    const one = `(define (problem p) (:domain d) (:objects x - t)
      (:init) (:goal (at x)))`;
    expect(measureProblemSize(one).goalAtoms).toBe(1);
  });

  it("is case-insensitive", () => {
    const upper = simpleBlocks.toUpperCase();
    expect(measureProblemSize(upper).objects).toBe(3);
    expect(measureProblemSize(upper).goalAtoms).toBe(2);
  });
});

describe("checkProblemSimplicity (static gate)", () => {
  it("accepts a small problem", () => {
    expect(checkProblemSimplicity(simpleBlocks).ok).toBe(true);
  });

  it("rejects too many objects", () => {
    const v = checkProblemSimplicity(bigObjects);
    expect(v.ok).toBe(false);
    expect(v.errorType).toBe("too_complex_static");
    expect(v.message).toContain("10 objects");
    expect(v.message).toContain(`max ${SIMPLICITY_LIMITS.maxObjects}`);
  });

  it("rejects too many goal conditions", () => {
    const v = checkProblemSimplicity(manyGoals);
    expect(v.ok).toBe(false);
    expect(v.message).toContain("6 goal conditions");
  });

  it("reports both reasons when both caps are exceeded", () => {
    const both = `(define (problem p) (:domain d)
      (:objects a b c d e f g h i - block)
      (:init) (:goal (and (p1) (p2) (p3) (p4) (p5) (p6))))`;
    const v = checkProblemSimplicity(both);
    expect(v.ok).toBe(false);
    expect(v.message).toContain("objects");
    expect(v.message).toContain("goal conditions");
    expect(v.message).toContain(" and ");
  });
});

describe("checkPlanSimplicity (plan gate)", () => {
  it("accepts a short plan", () => {
    expect(checkPlanSimplicity(SIMPLICITY_LIMITS.maxPlanLength).ok).toBe(true);
    expect(checkPlanSimplicity(0).ok).toBe(true);
  });

  it("rejects a long plan with the right tag and numbers", () => {
    const v = checkPlanSimplicity(SIMPLICITY_LIMITS.maxPlanLength + 1);
    expect(v.ok).toBe(false);
    expect(v.errorType).toBe("too_complex_plan");
    expect(v.message).toContain(`${SIMPLICITY_LIMITS.maxPlanLength + 1} steps`);
  });
});
