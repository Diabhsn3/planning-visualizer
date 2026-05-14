import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";

/** Continuous 1–5 score. 5 = perfect, 1 = totally off. */
export type Rating = number;

export interface FeedbackContext {
  domainName: string;
  isCustomDomain: boolean;
  savedDomainId: number | null;
  transformerHash: string | null;
  rendererHash: string | null;
  llmProvider: string | null;
  stateIndex: number;
  totalStates: number;
  symbolicState: unknown;
}

interface FeedbackBoxProps {
  context: FeedbackContext;
  /** Returns a base64 PNG data URL of the current canvas, or null if unavailable. */
  getImageDataUrl: () => string | null;
  /** Optional: hide while a generation/loading is in flight. */
  disabled?: boolean;
}

const RATING_MIN = 1;
const RATING_MAX = 5;
const RATING_STEP = 0.5;

function ratingDescriptor(r: number): string {
  if (r >= 4.75) return "Perfect";
  if (r >= 4) return "Mostly correct";
  if (r >= 3) return "Partial — some issues";
  if (r >= 2) return "Mostly wrong";
  return "Totally off";
}

export function FeedbackBox({ context, getImageDataUrl, disabled }: FeedbackBoxProps) {
  const [rating, setRating] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset whenever the user navigates to a different state — feedback is
  // per-state-view, not per-session.
  useEffect(() => {
    setRating(null);
    setComment("");
    setSubmitted(false);
    setError(null);
  }, [context.stateIndex, context.rendererHash, context.transformerHash]);

  const submitMutation = trpc.feedback.submitFeedback.useMutation({
    onSuccess: () => {
      setSubmitted(true);
      setError(null);
    },
    onError: (err) => {
      setError(err.message || "Failed to submit feedback");
    },
  });

  const needsComment = rating !== null && rating < RATING_MAX;
  const canSubmit =
    rating !== null &&
    !disabled &&
    !submitMutation.isPending &&
    (!needsComment || comment.trim().length > 0);

  const handleSubmit = () => {
    if (!canSubmit || rating === null) return;
    const imageDataUrl = getImageDataUrl();
    if (!imageDataUrl) {
      setError("Could not capture the canvas image.");
      return;
    }
    submitMutation.mutate({
      rating,
      comment: needsComment ? comment.trim() : (comment.trim() || null),
      imageDataUrl,
      ...context,
    });
  };

  const reset = () => {
    setRating(null);
    setComment("");
    setSubmitted(false);
    setError(null);
  };

  if (submitted) {
    return (
      <div
        className="px-6 py-3 border-t border-white/[0.05] bg-black/[0.15] text-xs text-slate-400 flex items-center gap-3"
        style={{ fontFamily: "'JetBrains Mono', monospace" }}
      >
        <span className="text-green-400">✓</span>
        <span>Feedback recorded</span>
        <button
          type="button"
          onClick={reset}
          className="ml-auto text-slate-500 hover:text-slate-300 underline underline-offset-2"
        >
          submit another
        </button>
      </div>
    );
  }

  const sliderValue = rating ?? RATING_MIN;
  const tickCount = Math.round((RATING_MAX - RATING_MIN) / 1) + 1; // 1,2,3,4,5

  return (
    <div className="px-6 py-4 border-t border-white/[0.05] bg-black/[0.15] space-y-3">
      <div className="flex items-center justify-between">
        <span
          className="text-xs font-medium text-slate-400"
          style={{ fontFamily: "'JetBrains Mono', monospace" }}
        >
          How well does this image represent the state?
        </span>
        <span className="text-[10px] text-slate-600 uppercase tracking-wide">
          step {context.stateIndex + 1} / {context.totalStates}
        </span>
      </div>

      <div className="flex items-center gap-4">
        <input
          type="range"
          min={RATING_MIN}
          max={RATING_MAX}
          step={RATING_STEP}
          value={sliderValue}
          onChange={(e) => setRating(Number(e.target.value))}
          disabled={disabled}
          className="flex-1 accent-green-500"
        />
        <div
          className={`min-w-[68px] text-right tabular-nums text-sm font-medium ${
            rating === null ? "text-slate-600" : "text-slate-200"
          }`}
          style={{ fontFamily: "'JetBrains Mono', monospace" }}
        >
          {rating === null ? "—" : rating.toFixed(1)} / {RATING_MAX}
        </div>
      </div>

      <div
        className="flex justify-between px-1 text-[10px] text-slate-600 tabular-nums"
        style={{ fontFamily: "'JetBrains Mono', monospace" }}
      >
        {Array.from({ length: tickCount }, (_, i) => RATING_MIN + i).map((n) => (
          <span key={n}>{n}</span>
        ))}
      </div>

      {rating !== null && (
        <div
          className="text-[11px] text-slate-500"
          style={{ fontFamily: "'JetBrains Mono', monospace" }}
        >
          {ratingDescriptor(rating)}
        </div>
      )}

      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder={
          needsComment
            ? "What's missing or wrong? (required for scores below 5)"
            : "Optional comment"
        }
        disabled={disabled || rating === null}
        rows={3}
        className="w-full px-3 py-2 text-xs bg-white/[0.04] border border-white/[0.08] rounded-lg text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-white/[0.2] resize-y disabled:opacity-50"
        style={{ fontFamily: "'JetBrains Mono', monospace" }}
      />

      {error && (
        <div className="text-xs text-red-400" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
          {error}
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="px-4 py-2 text-xs font-medium rounded-lg bg-green-600 text-white hover:bg-green-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          style={{ fontFamily: "'JetBrains Mono', monospace" }}
        >
          {submitMutation.isPending ? "Submitting…" : "Submit feedback"}
        </button>
      </div>
    </div>
  );
}
