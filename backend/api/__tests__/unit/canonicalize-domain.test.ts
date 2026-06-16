import { describe, it, expect } from "vitest";
import { canonicalizeDomainPddl } from "../../saved-domains";

const base = `
(define (domain blocks-world)
  (:requirements :strips)
  (:predicates (on ?x ?y) (ontable ?x) (clear ?x) (handempty) (holding ?x))
  (:action pick-up
    :parameters (?x)
    :precondition (and (clear ?x) (ontable ?x) (handempty))
    :effect (and (holding ?x) (not (ontable ?x)))))
`;

const canon = (s: string) => canonicalizeDomainPddl(s);

describe("canonicalizeDomainPddl", () => {
  it("ignores reformatting / whitespace", () => {
    const reflowed = base.replace(/\s+/g, " ").trim();
    expect(canon(base)).toBe(canon(reflowed));
  });

  it("ignores comments", () => {
    const withComments = base.replace(
      "(:requirements :strips)",
      "(:requirements :strips) ; classic STRIPS\n  ; another note"
    );
    expect(canon(withComments)).toBe(canon(base));
  });

  it("ignores letter case", () => {
    expect(canon(base.toUpperCase())).toBe(canon(base));
  });

  it("ignores the declared domain name", () => {
    const renamed = base.replace("blocks-world", "my-blocks");
    expect(canon(renamed)).toBe(canon(base));
  });

  it("treats renamed predicates as DIFFERENT (no false positive)", () => {
    const renamedPred = base.replace(/ontable/g, "on-table");
    expect(canon(renamedPred)).not.toBe(canon(base));
  });

  it("treats a genuinely different domain as different", () => {
    const other = `(define (domain gripper)
      (:predicates (at-robby ?r) (carry ?o ?g))
      (:action move :parameters (?a ?b) :effect (at-robby ?b)))`;
    expect(canon(other)).not.toBe(canon(base));
  });
});
