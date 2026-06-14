import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { trpc } from "@/lib/trpc";

// ── The ten standard SUS statements, in order ───────────────────────────────
// Odd items are positively worded, even items negatively worded. Do not
// paraphrase — these are the validated wordings.
const SUS_QUESTIONS: string[] = [
  "I think that I would like to use this system frequently.",
  "I found the system unnecessarily complex.",
  "I thought the system was easy to use.",
  "I think that I would need the support of a technical person to be able to use this system.",
  "I found the various functions in this system were well integrated.",
  "I thought there was too much inconsistency in this system.",
  "I would imagine that most people would learn to use this system very quickly.",
  "I found the system very cumbersome to use.",
  "I felt very confident using the system.",
  "I needed to learn a lot of things before I could get going with this system.",
];

const SCALE = [
  { value: 1, label: "Strongly disagree" },
  { value: 2, label: "Disagree" },
  { value: 3, label: "Neutral" },
  { value: 4, label: "Agree" },
  { value: 5, label: "Strongly agree" },
];

const mono = { fontFamily: "'JetBrains Mono', monospace" } as const;

interface SusSurveyProps {
  open: boolean;
  participantName: string;
  /** ISO timestamp of when the study session started. */
  startedAt: string;
  /** Close without submitting (e.g. facilitator cancels). */
  onClose: () => void;
  /** Called after a successful submit + the participant dismisses the
   * thank-you screen — used to clear Study Mode. */
  onFinished: () => void;
}

function csvEscape(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function SusSurvey({
  open,
  participantName,
  startedAt,
  onClose,
  onFinished,
}: SusSurveyProps) {
  const [answers, setAnswers] = useState<(number | null)[]>(
    Array(10).fill(null)
  );
  const [submittedScore, setSubmittedScore] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const utils = trpc.useUtils();
  const submitMutation = trpc.sus.submitSus.useMutation({
    onSuccess: (res) => {
      setSubmittedScore(res.score);
      setError(null);
    },
    onError: (err) => setError(err.message || "Failed to submit survey"),
  });

  const answeredCount = answers.filter((a) => a !== null).length;
  const allAnswered = answeredCount === 10;

  const handleSubmit = () => {
    if (!allAnswered || submitMutation.isPending) return;
    const submittedAt = new Date().toISOString();
    const durationMs = Math.max(
      0,
      new Date(submittedAt).getTime() - new Date(startedAt).getTime()
    );
    submitMutation.mutate({
      participantName,
      responses: answers as number[],
      startedAt,
      submittedAt,
      durationMs,
      userAgent: navigator.userAgent ?? null,
    });
  };

  const handleExportCsv = async () => {
    try {
      const rows = await utils.sus.listSus.fetch();
      const header = [
        "id",
        "participantName",
        "score",
        "durationMs",
        "startedAt",
        "submittedAt",
        ...Array.from({ length: 10 }, (_, i) => `q${i + 1}`),
        "userAgent",
      ];
      const lines = [header.join(",")];
      for (const r of rows) {
        lines.push(
          [
            r.id,
            r.participantName,
            r.score,
            r.durationMs,
            r.startedAt,
            r.submittedAt,
            ...r.responses,
            r.userAgent,
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
      a.download = "sus_responses.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(
        `CSV export failed: ${(err as Error).message ?? "unknown error"}`
      );
    }
  };

  const scoreVerdict = useMemo(() => {
    if (submittedScore === null) return "";
    if (submittedScore >= 85) return "Excellent";
    if (submittedScore >= 70) return "Good — above the acceptability threshold";
    if (submittedScore >= 50) return "OK — below the 70 target";
    return "Poor";
  }, [submittedScore]);

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[100] flex items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {/* backdrop */}
        <div
          className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          onClick={submittedScore === null ? onClose : undefined}
        />

        <motion.div
          className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-white/[0.08] bg-[#0F1A2E] shadow-2xl"
          initial={{ opacity: 0, scale: 0.96, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 4 }}
          transition={{ type: "spring", stiffness: 380, damping: 34 }}
        >
          {submittedScore === null ? (
            <div className="p-6 sm:p-8 space-y-6">
              <div>
                <div
                  className="text-[10px] uppercase tracking-[0.28em] text-purple-300/85 mb-2"
                  style={mono}
                >
                  System Usability Scale
                </div>
                <h2 className="text-xl font-semibold text-slate-100">
                  A few quick questions, {participantName.split(" ")[0]}
                </h2>
                <p className="mt-1 text-sm text-slate-400">
                  For each statement, choose how much you agree. There are no
                  right answers — go with your first instinct.
                </p>
              </div>

              <div className="space-y-5">
                {SUS_QUESTIONS.map((q, i) => (
                  <div
                    key={i}
                    className="rounded-xl border border-white/[0.06] bg-black/[0.18] p-4"
                  >
                    <div className="flex gap-2 text-sm text-slate-200">
                      <span className="text-slate-500 tabular-nums" style={mono}>
                        {i + 1}.
                      </span>
                      <span>{q}</span>
                    </div>
                    <div className="mt-3 grid grid-cols-5 gap-1.5">
                      {SCALE.map((s) => {
                        const selected = answers[i] === s.value;
                        return (
                          <button
                            key={s.value}
                            type="button"
                            onClick={() =>
                              setAnswers((prev) => {
                                const next = prev.slice();
                                next[i] = s.value;
                                return next;
                              })
                            }
                            className={`flex flex-col items-center gap-1 rounded-lg border px-1 py-2 text-center transition-colors ${
                              selected
                                ? "border-emerald-400/60 bg-emerald-500/15 text-emerald-200"
                                : "border-white/[0.07] bg-white/[0.02] text-slate-400 hover:bg-white/[0.06]"
                            }`}
                          >
                            <span
                              className="text-sm font-semibold tabular-nums"
                              style={mono}
                            >
                              {s.value}
                            </span>
                            <span className="text-[9px] leading-tight text-slate-500">
                              {s.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {error && (
                <div className="text-xs text-red-400" style={mono}>
                  {error}
                </div>
              )}

              <div className="flex items-center justify-between gap-4">
                <span className="text-xs text-slate-500" style={mono}>
                  {answeredCount} / 10 answered
                </span>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 text-xs font-medium rounded-lg text-slate-400 hover:text-slate-200 transition-colors"
                    style={mono}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={!allAnswered || submitMutation.isPending}
                    className="px-5 py-2 text-xs font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    style={mono}
                  >
                    {submitMutation.isPending ? "Submitting…" : "Submit survey"}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            // ── Thank-you / results screen ──
            <div className="p-8 text-center space-y-6">
              <div className="text-5xl">✓</div>
              <div>
                <h2 className="text-xl font-semibold text-slate-100">
                  Thank you, {participantName.split(" ")[0]}!
                </h2>
                <p className="mt-1 text-sm text-slate-400">
                  Your responses have been recorded.
                </p>
              </div>

              <div className="mx-auto inline-flex flex-col items-center rounded-2xl border border-white/[0.08] bg-black/[0.2] px-10 py-6">
                <div
                  className="text-[10px] uppercase tracking-[0.28em] text-slate-500"
                  style={mono}
                >
                  SUS score
                </div>
                <div
                  className="text-5xl font-semibold tabular-nums text-emerald-300"
                  style={mono}
                >
                  {submittedScore.toFixed(1)}
                </div>
                <div className="mt-1 text-xs text-slate-400">{scoreVerdict}</div>
              </div>

              {error && (
                <div className="text-xs text-red-400" style={mono}>
                  {error}
                </div>
              )}

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleExportCsv}
                  className="px-4 py-2 text-xs font-medium rounded-lg border border-white/[0.12] text-slate-200 hover:bg-white/[0.06] transition-colors"
                  style={mono}
                >
                  Export all results (CSV)
                </button>
                <button
                  type="button"
                  onClick={onFinished}
                  className="px-5 py-2 text-xs font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 transition-colors"
                  style={mono}
                >
                  Finish session
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
