/**
 * One-line agent-verification status, displayed beneath the canvas.
 *
 * Driven by a per-state map in the parent so navigating back to an
 * already-verified state shows THAT state's saved result rather than a
 * fresh "Verifying…" or whichever other state's result is most recent.
 */

import type { ReactNode } from "react";

const mono = { fontFamily: "'JetBrains Mono', monospace" } as const;

export type VerifyEntry =
  | { status: "pending" }
  | {
      status: "done";
      result: {
        precision: number | null;
        recall: number | null;
        parseFailure: boolean;
        cacheHit: boolean;
      };
    }
  | { status: "error"; error: string };

export interface VerifyStatusProps {
  /** Render nothing when verification isn't applicable (basic mode / examples). */
  applicable: boolean;
  /** The stored entry for the currently-displayed state, or null if not yet seen. */
  entry: VerifyEntry | null;
  /** Current 0-based state index — used for the "Verifying state N" copy. */
  stateIndex: number;
}

function fmt(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return n.toFixed(2);
}

export function VerifyStatus({ applicable, entry, stateIndex }: VerifyStatusProps) {
  if (!applicable) return null;

  let body: ReactNode;
  if (entry === null) {
    body = <span className="text-slate-600">No verification yet for this state.</span>;
  } else if (entry.status === "pending") {
    body = (
      <span className="text-slate-400">
        Verifying state {stateIndex + 1}…
      </span>
    );
  } else if (entry.status === "error") {
    body = (
      <span className="text-red-400">
        Agent ✗ {entry.error}
      </span>
    );
  } else if (entry.result.parseFailure) {
    body = (
      <span className="text-amber-400">
        Agent ✗ parse failure — see verifier page
      </span>
    );
  } else {
    body = (
      <span className="text-slate-300">
        Agent ✓ · P=
        <span className="tabular-nums text-slate-100">{fmt(entry.result.precision)}</span> · R=
        <span className="tabular-nums text-slate-100">{fmt(entry.result.recall)}</span>
        {entry.result.cacheHit && (
          <span className="ml-2 text-[10px] uppercase tracking-wide text-emerald-500/70">
            cached
          </span>
        )}
      </span>
    );
  }

  return (
    <div
      className="px-6 py-2 border-t border-white/[0.05] bg-black/[0.15] text-xs"
      style={mono}
    >
      {body}
    </div>
  );
}
