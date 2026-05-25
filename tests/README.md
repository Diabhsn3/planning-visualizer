# QA — Testing Pyramid & Demo Guide

This document is the single source of truth for the project's QA story.
It describes **what we test**, **where**, **how to run it**, and the
**4-step demo walkthrough** for showing results to a supervisor.

The acceptance bars come straight from the capstone report:

| Layer                       | Bar              | Where enforced                |
| --------------------------- | ---------------- | ----------------------------- |
| Unit + Integration          | 100% pass        | `unit-integration` CI job     |
| E2E built-in domains        | 100% pass        | `e2e-builtin` CI job          |
| E2E unseen domains          | ≥90% pass        | `e2e-unseen-nightly` CI job   |
| Open P0 bugs at submission  | 0                | Dashboard bug-board panel     |
| Silent failures             | **none**         | Error-surfacing audit         |

---

## The pyramid

```
                ┌──────────────────────────────────┐
                │ E2E (Playwright + real pipeline) │   ≥90% (unseen) / 100% (built-in)
                ├──────────────────────────────────┤
                │ Integration (boundaries, mocks)  │   100%
                ├──────────────────────────────────┤
                │ Unit (Python + TS + frontend)    │   100%
                └──────────────────────────────────┘
```

### Layer 1 — Unit tests
Fast, hermetic, no network.

- **Python** (`backend/planner/tests/unit/`): PDDL parser, state generator,
  domain detector, renderer factory, predicate utils. Run with `pytest`.
- **Backend TS** (`backend/api/__tests__/unit/`): strict renderer validator
  ([renderer-validator.ts](../backend/api/renderer-validator.ts)) and
  pure metric functions ([verifier-metrics.ts](../backend/api/verifier-metrics.ts)).
  Run with `vitest`.
- **Frontend** (`frontend/src/components/__tests__/`): each domain renderer
  is invoked against a mock Canvas context to confirm it doesn't throw on
  sample or empty state. Run with `vitest`.

### Layer 2 — Integration tests
Real boundaries, externals mocked.

- `backend/planner/tests/integration/test_pipeline_chain.py` — exercises the
  state-generator → renderer chain with hand-crafted plans (no Fast Downward
  needed) and the `visualizer_api.py list-strategies` CLI contract.
- `backend/api/__tests__/integration/stage1-stage2-handoff.test.ts` — fixes
  the Stage 1 (domain-interpreter) → Stage 2 (renderer) contract so a
  rename on either side is caught at CI time.
- `backend/api/__tests__/integration/renderer-prompt-contract.test.ts` —
  pins the prompt at [renderer-skill.txt](../backend/api/prompts/renderer-skill.txt)
  to the validator. Edit one without the other → CI red.
- `backend/api/__tests__/integration/error-surfacing.test.ts` — TS side
  of the error-surfacing audit.

### Layer 3 — End-to-end tests

- `backend/planner/tests/e2e/test_builtin_domains.py` — full PDDL → planner
  → state generator → renderer pipeline for each of the 6 built-in domains.
  **100% pass required.** Writes `reports/e2e-domains.json`.
- `backend/planner/tests/e2e/test_unseen_domains.py` — same pipeline against
  unseen IPC-style domains (logistics, ferry). **≥90% pass required.**
- `frontend/tests/e2e/smoke.spec.ts` — Playwright smoke; every key route
  loads. Real Playwright runs (LLM-driven flows) are gated to the nightly
  job.

### The error-surfacing audit
[`backend/planner/tests/e2e/test_error_surfacing.py`](../backend/planner/tests/e2e/test_error_surfacing.py)
+ [`backend/api/__tests__/integration/error-surfacing.test.ts`](../backend/api/__tests__/integration/error-surfacing.test.ts)
deliberately feed bad input at every boundary and assert a *clear*
user-facing message is surfaced. Results land in
`reports/error-surfacing*.json` and feed the dashboard's audit panel — the
direct enforcement of the capstone report's *"no silent failures"* bar.

---

## Running the suite locally

| What                       | Command                                   |
| -------------------------- | ----------------------------------------- |
| Everything (unit+integration) | `pnpm test:all`                        |
| Backend TS only            | `pnpm test:api`                           |
| Frontend unit only         | `pnpm test:frontend`                      |
| Python (incl. coverage)    | `pnpm test:python`                        |
| Backend E2E (built-in)     | `cd backend/planner && pytest tests/e2e/test_builtin_domains.py -m e2e` |
| Backend E2E (unseen)       | `cd backend/planner && pytest tests/e2e/test_unseen_domains.py -m e2e` |
| Frontend E2E (Playwright)  | `pnpm test:e2e:frontend`                  |
| **Build the dashboard**    | `pnpm dashboard`                          |
| Append a row to history    | `pnpm dashboard -- --append-history`      |

After running tests, open `reports/index.html` — that's the single page a
supervisor sees.

---

## The 90-second demo walkthrough

1. **Open the dashboard URL** (`reports/index.html` locally, or the
   GitHub Pages URL on `main`). Point at the four headline cards.
   Acceptance bar → actual number → green/red.

2. **Click a domain row** in the per-domain matrix. Playwright video
   plays; supervisor sees the pipeline working end-to-end with the
   visual output.

3. **Trigger a deliberate failure**. Push to a `demo/broken-renderer`
   branch (or run locally: edit one of the renderer fixtures to drop the
   `Background` export). CI turns the `unit-integration` job red.
   Click into the failing test → see the strict-validator error naming
   the exact missing export.

4. **Open the error-surfacing panel**. Show the table of every boundary
   we probed with bad input, side-by-side with the message the user
   actually sees. Proves the *"no silent failures"* claim with receipts.

---

## Adding a new domain

1. Drop `domain.pddl` + `p1.pddl` into `backend/planner/domains/<name>/`.
2. Add `"<name>"` to `BUILT_IN_DOMAINS` in
   [`conftest.py`](../backend/planner/conftest.py) and to `DOMAIN_NAME_MAP`
   in [`test_builtin_domains.py`](../backend/planner/tests/e2e/test_builtin_domains.py).
3. If the domain has a specific renderer, register it in
   [`state_renderer/__init__.py`](../backend/planner/state_renderer/__init__.py).
4. Add a row to the dashboard's matrix? Nothing to do — the dashboard
   reads `reports/e2e-domains.json`, which auto-includes the new domain.

Adding an *unseen* domain: drop the PDDL pair into
`backend/planner/tests/e2e/unseen_domains/<name>/`. The parametrized
`test_unseen_domain_planner_pipeline` picks it up automatically.

---

## What the LLM stages actually test

In CI the LLM SDKs are **mocked** with canned responses (one valid bundle,
plus invalid bundles missing each of the three required exports). The
strict validator at
[`renderer-validator.ts`](../backend/api/renderer-validator.ts) gates the
responses, so a regression in either the prompt or the LLM-output handler
fails CI immediately.

The **real** LLM is only called in the `e2e-unseen-nightly` job, which
requires `ANTHROPIC_API_KEY` / `GOOGLE_API_KEY` secrets. That job is the
only place we pay for tokens and the only place stochastic LLM behavior
can produce flakes — which is why its bar is **≥90%**, not 100%.
