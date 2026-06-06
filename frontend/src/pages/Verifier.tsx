import { useMemo, useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";

const mono = { fontFamily: "'JetBrains Mono', monospace" } as const;

function fmt(n: number | null, digits = 3): string {
  if (n === null) return "—";
  return n.toFixed(digits);
}

function fmtH(n: number | null): string {
  if (n === null) return "—";
  return n.toFixed(1);
}

function ratingDescriptor(r: number): string {
  if (r >= 4.75) return "Perfect";
  if (r >= 4) return "Mostly correct";
  if (r >= 3) return "Partial — some issues";
  if (r >= 2) return "Mostly wrong";
  return "Totally off";
}

function ratingColor(r: number): string {
  if (r >= 4) return "text-green-400";
  if (r >= 3) return "text-yellow-400";
  if (r >= 2) return "text-orange-400";
  return "text-red-400";
}

// Top-level tabs, always shown in this order even if a section is empty.
const SECTIONS: { id: "basic" | "claude" | "gemini"; label: string }[] = [
  { id: "basic", label: "Basic" },
  { id: "claude", label: "Claude" },
  { id: "gemini", label: "Gemini" },
];

/** Compact "avg P · avg R · avg Human" trio used at every level. */
function AvgTrio({
  p,
  r,
  h,
}: {
  p: number | null;
  r: number | null;
  h: number | null;
}) {
  return (
    <div className="flex items-center gap-3 text-xs" style={mono}>
      <span className="text-slate-500">
        P=<span className="tabular-nums text-slate-100">{fmt(p, 2)}</span>
      </span>
      <span className="text-slate-500">
        R=<span className="tabular-nums text-slate-100">{fmt(r, 2)}</span>
      </span>
      <span className="text-slate-500">
        Human=
        <span className={`tabular-nums ${h === null ? "text-slate-600" : "text-slate-100"}`}>
          {fmtH(h)}
        </span>
      </span>
    </div>
  );
}

export default function Verifier() {
  const [activeSection, setActiveSection] = useState<"basic" | "claude" | "gemini">("claude");
  const [openDomains, setOpenDomains] = useState<Set<string>>(new Set());
  const [openProblems, setOpenProblems] = useState<Set<string>>(new Set());

  const fullQuery = trpc.verifier.aggregateWithFeedback.useQuery();

  const methodsByKey = useMemo(() => {
    const m = new Map<string, NonNullable<typeof fullQuery.data>[number]>();
    for (const a of fullQuery.data ?? []) m.set(a.renderMethod, a);
    return m;
  }, [fullQuery.data]);

  const activeMethod = methodsByKey.get(activeSection);

  const toggle = (set: Set<string>, setSet: (s: Set<string>) => void, key: string) => {
    const next = new Set(set);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setSet(next);
  };

  return (
    <div className="min-h-screen bg-[#0A1018] text-slate-200">
      <div className="max-w-5xl mx-auto px-6 py-10 space-y-8">
        <header className="flex items-baseline justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight" style={mono}>
              Verifier report
            </h1>
            <p className="text-xs text-slate-500 mt-1" style={mono}>
              Agent precision/recall and human rating, per method → domain → version → problem → state.
            </p>
          </div>
          <Link
            href="/visualizer"
            className="text-xs text-blue-400 hover:text-blue-300 underline underline-offset-2"
            style={mono}
          >
            back to visualizer
          </Link>
        </header>

        {/* Method tabs */}
        <div className="flex items-stretch gap-2">
          {SECTIONS.map((s) => {
            const m = methodsByKey.get(s.id);
            const active = activeSection === s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setActiveSection(s.id)}
                className={`flex-1 px-4 py-3 rounded-xl border text-left transition-colors ${
                  active
                    ? "border-white/[0.18] bg-white/[0.06]"
                    : "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]"
                }`}
              >
                <div
                  className={`text-sm font-semibold ${active ? "text-slate-100" : "text-slate-300"}`}
                  style={mono}
                >
                  {s.label}
                </div>
                <div className="text-[10px] text-slate-500 mt-1 flex items-center gap-2" style={mono}>
                  <span>P=<span className="tabular-nums text-slate-300">{fmt(m?.avgPrecision ?? null, 2)}</span></span>
                  <span>R=<span className="tabular-nums text-slate-300">{fmt(m?.avgRecall ?? null, 2)}</span></span>
                  <span>H=<span className="tabular-nums text-slate-300">{fmtH(m?.avgHumanRating ?? null)}</span></span>
                  <span className="ml-auto text-slate-600">
                    {(m?.nDomains ?? 0)}d · {(m?.nStates ?? 0)}s · {(m?.nHumanRated ?? 0)}★
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Active section body */}
        {fullQuery.isLoading ? (
          <div className="rounded-xl border border-white/[0.08] bg-[#0F1722] px-4 py-6 text-xs text-slate-500" style={mono}>
            loading…
          </div>
        ) : !activeMethod || activeMethod.domains.length === 0 ? (
          <div className="rounded-xl border border-white/[0.08] bg-[#0F1722] px-4 py-6 text-xs text-slate-500" style={mono}>
            No runs yet for {SECTIONS.find((s) => s.id === activeSection)!.label}.
          </div>
        ) : (
          <div className="space-y-3">
            {activeMethod.domains.map((dom) => {
              const domKey = `${activeSection}::${dom.domainName}`;
              const domOpen = openDomains.has(domKey);
              return (
                <section
                  key={dom.domainName}
                  className="rounded-xl border border-white/[0.08] bg-[#0F1722] overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => toggle(openDomains, setOpenDomains, domKey)}
                    className="w-full flex items-baseline gap-4 px-4 py-3 border-b border-white/[0.05] hover:bg-white/[0.03] transition-colors text-left"
                  >
                    <span className="text-slate-500 inline-block w-3 tabular-nums" style={mono}>
                      {domOpen ? "▾" : "▸"}
                    </span>
                    <h2 className="text-sm font-semibold text-slate-100" style={mono}>
                      {dom.domainName}
                    </h2>
                    <AvgTrio p={dom.avgPrecision} r={dom.avgRecall} h={dom.avgHumanRating} />
                    <span className="ml-auto text-[10px] text-slate-600 uppercase tracking-wide" style={mono}>
                      {dom.nVersions} {dom.nVersions === 1 ? "version" : "versions"} · {dom.nStates}{" "}
                      {dom.nStates === 1 ? "state" : "states"} · {dom.nHumanRated} rated
                    </span>
                  </button>

                  {domOpen && (
                    <div className="divide-y divide-white/[0.04]">
                      {dom.versions.map((v) => (
                        <div key={`${v.savedDomainId ?? "local"}:${v.versionLabel}`} className="px-4 py-3 space-y-3">
                          <div className="flex items-baseline gap-3 text-xs" style={mono}>
                            <span className="text-slate-200 font-medium">{v.versionLabel}</span>
                            <AvgTrio p={v.avgPrecision} r={v.avgRecall} h={v.avgHumanRating} />
                            <span className="ml-auto text-[10px] text-slate-600 uppercase tracking-wide">
                              {v.problems.length} {v.problems.length === 1 ? "problem" : "problems"} · {v.nStates}{" "}
                              {v.nStates === 1 ? "state" : "states"}
                            </span>
                          </div>

                          {v.problems.map((p) => {
                            const probKey = `${domKey}::${v.savedDomainId ?? "local"}::${p.problem}`;
                            const probOpen = openProblems.has(probKey);
                            return (
                              <div
                                key={p.problem}
                                className="rounded-lg border border-white/[0.05] bg-white/[0.015] overflow-hidden"
                              >
                                <button
                                  type="button"
                                  onClick={() => toggle(openProblems, setOpenProblems, probKey)}
                                  className="w-full flex items-baseline gap-3 px-3 py-2 hover:bg-white/[0.03] transition-colors text-left"
                                >
                                  <span className="text-slate-500 inline-block w-3 tabular-nums" style={mono}>
                                    {probOpen ? "▾" : "▸"}
                                  </span>
                                  <span className="text-xs text-slate-300" style={mono}>{p.problem}</span>
                                  <AvgTrio p={p.avgPrecision} r={p.avgRecall} h={p.avgHumanRating} />
                                  <span className="ml-auto text-[10px] text-slate-600 uppercase tracking-wide" style={mono}>
                                    {p.nStates} {p.nStates === 1 ? "state" : "states"} · {p.nHumanRated} rated
                                  </span>
                                </button>

                                {probOpen && (
                                  <div className="divide-y divide-white/[0.04] border-t border-white/[0.05]">
                                    {p.states.map((st) => (
                                      <div key={st.stateIndex} className="flex gap-4 px-3 py-3">
                                        {/* Screenshot */}
                                        {st.imageUrl ? (
                                          <a
                                            href={st.imageUrl}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="shrink-0"
                                            title="Open full image"
                                          >
                                            <img
                                              src={st.imageUrl}
                                              alt={`state ${st.stateIndex}`}
                                              className="w-28 h-20 object-contain rounded-lg border border-white/[0.08] bg-black/40"
                                            />
                                          </a>
                                        ) : (
                                          <div className="shrink-0 w-28 h-20 rounded-lg border border-white/[0.06] bg-black/20 flex items-center justify-center text-[9px] text-slate-600 uppercase tracking-wide" style={mono}>
                                            no image
                                          </div>
                                        )}

                                        {/* Scores */}
                                        <div className="flex-1 min-w-0 space-y-1.5" style={mono}>
                                          <div className="text-[10px] uppercase tracking-wide text-slate-500">
                                            state {st.stateIndex + 1}
                                          </div>

                                          <div className="flex items-center gap-2 text-xs">
                                            <span className="text-slate-500">Agent:</span>
                                            <span className="text-slate-300">
                                              P=<span className="tabular-nums text-slate-100">{fmt(st.precision, 2)}</span>
                                            </span>
                                            <span className="text-slate-300">
                                              R=<span className="tabular-nums text-slate-100">{fmt(st.recall, 2)}</span>
                                            </span>
                                            <span className="text-slate-600">
                                              TP {st.tp} · FP {st.fp} · FN {st.fn}
                                            </span>
                                            {st.parseFailure && (
                                              <span className="text-amber-400 text-[10px] uppercase tracking-wide">
                                                parse failure
                                              </span>
                                            )}
                                          </div>

                                          <div className="flex items-center gap-2 text-xs">
                                            <span className="text-slate-500">Human:</span>
                                            {st.humanRating != null ? (
                                              <>
                                                <span className={`font-semibold tabular-nums ${ratingColor(st.humanRating)}`}>
                                                  {st.humanRating.toFixed(1)} / 5
                                                </span>
                                                <span className="text-slate-500">
                                                  {ratingDescriptor(st.humanRating)}
                                                </span>
                                              </>
                                            ) : (
                                              <span className="text-slate-600">no feedback</span>
                                            )}
                                          </div>

                                          {st.humanComment && (
                                            <div className="text-xs text-slate-300 bg-white/[0.03] border border-white/[0.06] rounded-md px-2.5 py-1.5 whitespace-pre-wrap">
                                              {st.humanComment}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
