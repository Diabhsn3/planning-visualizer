import { useMemo, useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";

const mono = { fontFamily: "'JetBrains Mono', monospace" } as const;

function fmt(n: number | null, digits = 3): string {
  if (n === null) return "—";
  return n.toFixed(digits);
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

// Top-level tabs always shown in this order, even if a section is empty.
const SECTIONS: { id: "basic" | "claude" | "gemini"; label: string }[] = [
  { id: "basic", label: "Basic" },
  { id: "claude", label: "Claude" },
  { id: "gemini", label: "Gemini" },
];

export default function Verifier() {
  const [activeSection, setActiveSection] = useState<"basic" | "claude" | "gemini">("claude");
  const [openDomains, setOpenDomains] = useState<Set<string>>(new Set());

  const aggQuery = trpc.verifier.aggregateByMethodDomainAndVersion.useQuery();
  const runsQuery = trpc.verifier.listVerifierRuns.useQuery();
  const feedbackQuery = trpc.feedback.listFeedbackWithScores.useQuery();

  const methodsByKey = useMemo(() => {
    const m = new Map<string, (typeof aggQuery.data)[number]>();
    for (const a of aggQuery.data ?? []) m.set(a.renderMethod, a);
    return m;
  }, [aggQuery.data]);

  const totalRuns = runsQuery.data?.length ?? 0;

  const activeMethod = methodsByKey.get(activeSection);

  const toggleDomain = (key: string) => {
    setOpenDomains((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
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
              Per-state metrics, averaged per problem, per saved version, per domain, per method.
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

        <div className="flex items-center gap-2 text-[11px]" style={mono}>
          <span className="ml-auto text-slate-600">{totalRuns} runs</span>
        </div>

        {/* Method tabs */}
        <div className="flex items-stretch gap-2">
          {SECTIONS.map((s) => {
            const m = methodsByKey.get(s.id);
            const active = activeSection === s.id;
            const nDomains = m?.nDomains ?? 0;
            const nStates = m?.nStates ?? 0;
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
                  <span>avg P=<span className="tabular-nums text-slate-300">{fmt(m?.avgPrecision ?? null, 2)}</span></span>
                  <span>·</span>
                  <span>avg R=<span className="tabular-nums text-slate-300">{fmt(m?.avgRecall ?? null, 2)}</span></span>
                  <span className="ml-auto text-slate-600">
                    {nDomains}d · {nStates}s
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Active section body */}
        {aggQuery.isLoading ? (
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
              const isOpen = openDomains.has(domKey);
              const hasMultipleVersions = dom.nVersions > 1;
              return (
                <section
                  key={dom.domainName}
                  className="rounded-xl border border-white/[0.08] bg-[#0F1722] overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => hasMultipleVersions ? toggleDomain(domKey) : toggleDomain(domKey)}
                    className="w-full flex items-baseline gap-4 px-4 py-3 border-b border-white/[0.05] hover:bg-white/[0.03] transition-colors text-left"
                  >
                    <span
                      className="text-slate-500 inline-block w-3 tabular-nums"
                      style={mono}
                    >
                      {isOpen ? "▾" : "▸"}
                    </span>
                    <h2 className="text-sm font-semibold text-slate-100" style={mono}>
                      {dom.domainName}
                    </h2>
                    <div className="text-xs text-slate-400 flex items-center gap-3" style={mono}>
                      <span>avg P=<span className="tabular-nums text-slate-100">{fmt(dom.avgPrecision)}</span></span>
                      <span>avg R=<span className="tabular-nums text-slate-100">{fmt(dom.avgRecall)}</span></span>
                    </div>
                    <span className="ml-auto text-[10px] text-slate-600 uppercase tracking-wide" style={mono}>
                      {dom.nVersions} {dom.nVersions === 1 ? "version" : "versions"} · {dom.nStates} {dom.nStates === 1 ? "state" : "states"}
                    </span>
                  </button>

                  {isOpen && (
                    <div className="divide-y divide-white/[0.04]">
                      {dom.versions.map((v) => (
                        <div key={`${v.savedDomainId ?? "local"}:${v.versionLabel}`} className="px-4 py-3 space-y-2">
                          <div className="flex items-baseline gap-3 text-xs" style={mono}>
                            <span className="text-slate-200 font-medium">{v.versionLabel}</span>
                            <span className="text-slate-500">avg P=<span className="tabular-nums text-slate-100">{fmt(v.avgPrecision)}</span></span>
                            <span className="text-slate-500">avg R=<span className="tabular-nums text-slate-100">{fmt(v.avgRecall)}</span></span>
                            <span className="ml-auto text-[10px] text-slate-600 uppercase tracking-wide">
                              {v.problems.length} {v.problems.length === 1 ? "problem" : "problems"} · {v.nStates} {v.nStates === 1 ? "state" : "states"}
                            </span>
                          </div>
                          {v.problems.length > 0 && (
                            <table className="w-full text-[11px]" style={mono}>
                              <thead className="text-[10px] text-slate-500 uppercase tracking-wide">
                                <tr className="border-b border-white/[0.04]">
                                  <th className="text-left px-2 py-1.5">Problem</th>
                                  <th className="text-right px-2 py-1.5">avg P</th>
                                  <th className="text-right px-2 py-1.5">avg R</th>
                                  <th className="text-right px-2 py-1.5">n states</th>
                                </tr>
                              </thead>
                              <tbody>
                                {v.problems.map((p) => (
                                  <tr key={p.problem} className="border-b border-white/[0.03] last:border-b-0">
                                    <td className="px-2 py-1.5 text-slate-300">{p.problem}</td>
                                    <td className="px-2 py-1.5 text-right tabular-nums">{fmt(p.avgPrecision, 2)}</td>
                                    <td className="px-2 py-1.5 text-right tabular-nums">{fmt(p.avgRecall, 2)}</td>
                                    <td className="px-2 py-1.5 text-right tabular-nums text-slate-500">{p.nStates}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        )}

        {/* Human feedback — each entry shows the photo, the human rating +
            comment, and the agent's score for the same photo. */}
        <section className="rounded-xl border border-white/[0.08] bg-[#0F1722] overflow-hidden">
          <div className="px-4 py-3 border-b border-white/[0.05] text-xs text-slate-400" style={mono}>
            Human feedback ({(feedbackQuery.data ?? []).length})
          </div>
          {feedbackQuery.isLoading ? (
            <div className="px-4 py-6 text-xs text-slate-500" style={mono}>
              loading…
            </div>
          ) : (feedbackQuery.data ?? []).length === 0 ? (
            <div className="px-4 py-6 text-xs text-slate-500" style={mono}>
              No human feedback yet. Rate a state on the visualizer and it will
              appear here alongside the agent score.
            </div>
          ) : (
            <div className="divide-y divide-white/[0.04]">
              {(feedbackQuery.data ?? []).map((f) => (
                <div key={f.id} className="flex gap-4 px-4 py-4">
                  {/* Photo */}
                  <a
                    href={f.imageUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="shrink-0"
                    title="Open full image"
                  >
                    <img
                      src={f.imageUrl}
                      alt={`feedback ${f.id}`}
                      className="w-28 h-20 object-contain rounded-lg border border-white/[0.08] bg-black/40"
                    />
                  </a>

                  {/* Details */}
                  <div className="flex-1 min-w-0 space-y-1.5" style={mono}>
                    <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-wide text-slate-500">
                      <span className="px-1.5 py-0.5 rounded bg-white/[0.06] text-slate-300">
                        {f.renderMethod}
                      </span>
                      <span className="text-slate-300">{f.domainName}</span>
                      {f.versionLabel && f.versionLabel !== f.domainName && (
                        <>
                          <span className="text-slate-700">·</span>
                          <span className="text-slate-400">{f.versionLabel}</span>
                        </>
                      )}
                      {f.problem && (
                        <>
                          <span className="text-slate-700">·</span>
                          <span className="text-slate-400">{f.problem}</span>
                        </>
                      )}
                      <span className="text-slate-700">·</span>
                      <span className="text-slate-500">
                        state {f.stateIndex + 1}/{f.totalStates}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-slate-500">Human:</span>
                      <span className={`font-semibold tabular-nums ${ratingColor(f.rating)}`}>
                        {f.rating.toFixed(1)} / 5
                      </span>
                      <span className="text-slate-500">{ratingDescriptor(f.rating)}</span>
                    </div>

                    {f.comment && (
                      <div className="text-xs text-slate-300 bg-white/[0.03] border border-white/[0.06] rounded-md px-2.5 py-1.5 whitespace-pre-wrap">
                        {f.comment}
                      </div>
                    )}

                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-slate-500">Agent:</span>
                      {f.verification ? (
                        <>
                          <span className="text-slate-300">
                            P=<span className="tabular-nums text-slate-100">{fmt(f.verification.precision, 2)}</span>
                          </span>
                          <span className="text-slate-300">
                            R=<span className="tabular-nums text-slate-100">{fmt(f.verification.recall, 2)}</span>
                          </span>
                          <span className="text-slate-600">
                            TP {f.verification.tp} · FP {f.verification.fp} · FN {f.verification.fn}
                          </span>
                          {f.verification.parseFailure && (
                            <span className="text-amber-400 text-[10px] uppercase tracking-wide">
                              parse failure
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="text-slate-600">no verification for this photo</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Recent runs — debug aid, scoped to the active section */}
        <section className="rounded-xl border border-white/[0.08] bg-[#0F1722] overflow-hidden">
          <div className="px-4 py-3 border-b border-white/[0.05] text-xs text-slate-400" style={mono}>
            Recent runs ({(runsQuery.data ?? []).length})
          </div>
          {runsQuery.isLoading ? (
            <div className="px-4 py-6 text-xs text-slate-500" style={mono}>
              loading…
            </div>
          ) : (runsQuery.data ?? []).length === 0 ? (
            <div className="px-4 py-6 text-xs text-slate-500" style={mono}>
              (no runs)
            </div>
          ) : (
            <table className="w-full text-xs" style={mono}>
              <thead className="text-[10px] text-slate-500 uppercase tracking-wide">
                <tr className="border-b border-white/[0.05]">
                  <th className="text-left px-4 py-2">id</th>
                  <th className="text-left px-4 py-2">method</th>
                  <th className="text-left px-4 py-2">domain</th>
                  <th className="text-left px-4 py-2">version</th>
                  <th className="text-left px-4 py-2">problem</th>
                  <th className="text-right px-4 py-2">state</th>
                  <th className="text-right px-4 py-2">P</th>
                  <th className="text-right px-4 py-2">R</th>
                </tr>
              </thead>
              <tbody>
                {(runsQuery.data ?? []).slice().reverse().slice(0, 100).map((r: any) => (
                  <tr key={r.id} className="border-b border-white/[0.04]">
                    <td className="px-4 py-2 tabular-nums text-slate-500">{r.id}</td>
                    <td className="px-4 py-2 text-slate-400">{r.renderMethod ?? "—"}</td>
                    <td className="px-4 py-2 text-slate-200">{r.domainName}</td>
                    <td className="px-4 py-2 text-slate-300">{r.savedDomainDisplayName ?? "—"}</td>
                    <td className="px-4 py-2 text-slate-300">{r.problem ?? "(unknown)"}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-slate-500">
                      {r.stateIndex}/{r.totalStates}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">{fmt(r.precision, 2)}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{fmt(r.recall, 2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </div>
  );
}
