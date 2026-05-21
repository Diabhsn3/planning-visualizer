import { useMemo, useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";

const mono = { fontFamily: "'JetBrains Mono', monospace" } as const;

function fmt(n: number | null, digits = 3): string {
  if (n === null) return "—";
  return n.toFixed(digits);
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
