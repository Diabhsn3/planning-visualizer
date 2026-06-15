import { useMemo } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";

const mono = { fontFamily: "'JetBrains Mono', monospace" } as const;

const PROFILE_LABEL: Record<string, string> = {
  lab_researcher: "Lab researcher",
  cs_student: "CS student (no PDDL)",
};
const MODE_LABEL: Record<string, string> = {
  in_person: "In-person",
  remote: "Remote",
};

function fmtDuration(ms: number): string {
  if (!ms || ms < 0) return "—";
  const s = Math.round(ms / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
}

function csvEscape(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export default function StudyResults() {
  const [, navigate] = useLocation();
  const { data, isLoading, error, refetch, isFetching } =
    trpc.sus.listSus.useQuery();

  const rows = useMemo(
    () =>
      (data ?? [])
        .slice()
        .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)),
    [data]
  );

  const summary = useMemo(() => {
    if (rows.length === 0) return null;
    const scores = rows.map((r) => r.score);
    const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
    const pctPass =
      (scores.filter((s) => s >= 70).length / scores.length) * 100;
    return { count: rows.length, mean, pctPass };
  }, [rows]);

  const participantLabel = (r: (typeof rows)[number]) =>
    r.participantId || r.participantName || "—";

  const handleExportCsv = () => {
    const header = [
      "id",
      "participantId",
      "profile",
      "mode",
      "studyDate",
      "facilitator",
      "noteTaker",
      "score",
      "durationMs",
      "startedAt",
      "submittedAt",
      ...Array.from({ length: 10 }, (_, i) => `q${i + 1}`),
      "exit_useCases",
      "exit_suggestions",
      "exit_overallImpression",
      "userAgent",
    ];
    const lines = [header.join(",")];
    for (const r of rows) {
      lines.push(
        [
          r.id,
          participantLabel(r),
          r.profile ?? "",
          r.mode ?? "",
          r.studyDate ?? "",
          r.facilitator ?? "",
          r.noteTaker ?? "",
          r.score,
          r.durationMs,
          r.startedAt,
          r.submittedAt,
          ...(r.responses ?? []),
          r.exitInterview?.useCases ?? "",
          r.exitInterview?.suggestions ?? "",
          r.exitInterview?.overallImpression ?? "",
          r.userAgent ?? "",
        ]
          .map(csvEscape)
          .join(",")
      );
    }
    const blob = new Blob([lines.join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "sus_results.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const th =
    "text-left text-[10px] uppercase tracking-wider text-slate-500 font-medium px-3 py-2 whitespace-nowrap";
  const td = "px-3 py-2 align-top text-slate-300";

  return (
    <div
      className="min-h-screen w-full bg-[#0B1524] text-slate-100 px-6 py-10"
      style={mono}
    >
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="text-[10px] uppercase tracking-[0.28em] text-purple-300/85">
              Focus group · SUS
            </div>
            <h1 className="text-2xl font-semibold text-slate-100 mt-1">
              Study results
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => refetch()}
              className="px-3 py-2 text-xs rounded-lg border border-white/[0.12] text-slate-300 hover:bg-white/[0.06] transition-colors"
            >
              {isFetching ? "Refreshing…" : "Refresh"}
            </button>
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={rows.length === 0}
              className="px-3 py-2 text-xs rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-30 transition-colors"
            >
              Download CSV
            </button>
            <button
              type="button"
              onClick={() => navigate("/")}
              className="px-3 py-2 text-xs rounded-lg text-slate-400 hover:text-slate-200 transition-colors"
            >
              ← Home
            </button>
          </div>
        </div>

        {/* Summary cards */}
        {summary && (
          <div className="mt-7 grid grid-cols-3 gap-3 max-w-xl">
            {[
              { label: "Participants", value: String(summary.count), tint: "#a78bfa" },
              { label: "Mean SUS", value: summary.mean.toFixed(1), tint: summary.mean >= 70 ? "#22c55e" : "#fbbf24" },
              { label: "≥ 70 (target)", value: `${Math.round(summary.pctPass)}%`, tint: "#7dd3fc" },
            ].map((c) => (
              <div
                key={c.label}
                className="rounded-xl border border-white/[0.07] bg-[#0F1A2E] px-4 py-4 text-center"
              >
                <div
                  className="text-3xl font-semibold tabular-nums"
                  style={{ color: c.tint }}
                >
                  {c.value}
                </div>
                <div className="mt-1 text-[10px] uppercase tracking-[0.22em] text-slate-500">
                  {c.label}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Body states */}
        {isLoading ? (
          <div className="mt-10 text-sm text-slate-500">Loading…</div>
        ) : error ? (
          <div className="mt-10 text-sm text-red-400">
            Failed to load results: {error.message}
          </div>
        ) : rows.length === 0 ? (
          <div className="mt-10 text-sm text-slate-500">
            No submissions yet. Start a study session from the home page and
            complete the survey to see results here.
          </div>
        ) : (
          <div className="mt-8 overflow-x-auto rounded-xl border border-white/[0.07]">
            <table className="w-full text-xs border-collapse">
              <thead className="bg-white/[0.03]">
                <tr>
                  <th className={th}>Participant</th>
                  <th className={th}>Profile</th>
                  <th className={th}>Mode</th>
                  <th className={th}>Date</th>
                  <th className={th}>Facilitator</th>
                  <th className={th}>Note-taker</th>
                  <th className={th}>SUS</th>
                  <th className={th}>Duration</th>
                  <th className={th}>Submitted</th>
                  <th className={th}>Exit interview</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.id}
                    className="border-t border-white/[0.05] hover:bg-white/[0.02]"
                  >
                    <td className={`${td} font-medium text-slate-100 whitespace-nowrap`}>
                      {participantLabel(r)}
                    </td>
                    <td className={`${td} whitespace-nowrap`}>
                      {r.profile ? PROFILE_LABEL[r.profile] ?? r.profile : "—"}
                    </td>
                    <td className={`${td} whitespace-nowrap`}>
                      {r.mode ? MODE_LABEL[r.mode] ?? r.mode : "—"}
                    </td>
                    <td className={`${td} whitespace-nowrap`}>{r.studyDate || "—"}</td>
                    <td className={`${td} whitespace-nowrap`}>{r.facilitator || "—"}</td>
                    <td className={`${td} whitespace-nowrap`}>{r.noteTaker || "—"}</td>
                    <td className={`${td} tabular-nums`}>
                      <span
                        className={
                          r.score >= 70 ? "text-emerald-300" : "text-amber-300"
                        }
                      >
                        {r.score.toFixed(1)}
                      </span>
                    </td>
                    <td className={`${td} tabular-nums whitespace-nowrap`}>
                      {fmtDuration(r.durationMs)}
                    </td>
                    <td className={`${td} whitespace-nowrap text-slate-500`}>
                      {r.submittedAt?.replace("T", " ").slice(0, 16) ?? "—"}
                    </td>
                    <td className={`${td} min-w-[220px] max-w-[340px]`}>
                      {r.exitInterview ? (
                        <div className="space-y-1 text-[11px] text-slate-400">
                          {r.exitInterview.useCases && (
                            <div>
                              <span className="text-slate-500">Use cases: </span>
                              {r.exitInterview.useCases}
                            </div>
                          )}
                          {r.exitInterview.suggestions && (
                            <div>
                              <span className="text-slate-500">Suggestions: </span>
                              {r.exitInterview.suggestions}
                            </div>
                          )}
                          {r.exitInterview.overallImpression && (
                            <div>
                              <span className="text-slate-500">Impression: </span>
                              {r.exitInterview.overallImpression}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
