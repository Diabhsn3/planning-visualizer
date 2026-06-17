import { type Ref } from "react";
import { motion } from "framer-motion";
import { TerminalIcon } from "@/components/Icons";

interface PlanStepsListProps {
  plan: string[];
  currentStateIndex: number;
  /** Jump the canvas to a state index (parent also stops playback). */
  onSelectIndex: (index: number) => void;
  /** "card" = the docked right column; "floating" = translucent overlay used in fullscreen. */
  variant?: "card" | "floating";
  className?: string;
  /** Forwarded to the scroll container so the parent's active-step auto-scroll keeps working. */
  listRef?: Ref<HTMLDivElement>;
}

/**
 * The Plan Steps list (initial state + one row per action). Extracted from the
 * Visualizer so the normal split layout and the fullscreen overlay share a
 * single source of truth for the click/keyboard/highlight logic.
 */
export function PlanStepsList({
  plan,
  currentStateIndex,
  onSelectIndex,
  variant = "card",
  className = "",
  listRef,
}: PlanStepsListProps) {
  const shell =
    variant === "floating"
      ? "w-72 rounded-2xl border border-white/[0.08] bg-[#111E30]/[0.97] backdrop-blur-md shadow-2xl overflow-hidden flex flex-col"
      : "w-80 flex-shrink-0 rounded-2xl border border-white/[0.08] bg-[#111E30] overflow-hidden";

  return (
    <div
      className={`${shell} ${className}`}
      style={variant === "card" ? { boxShadow: "0 1px 0 rgba(255,255,255,0.04) inset" } : undefined}
    >
      <div className="px-4 py-3 border-b border-white/[0.05] bg-white/[0.02] flex items-center justify-between flex-shrink-0">
        <h3 className="text-xs font-semibold text-slate-300 flex items-center gap-2"
          style={{ fontFamily: "'JetBrains Mono', monospace" }}>
          <TerminalIcon className="w-3.5 h-3.5 text-green-500" />
          Plan Steps
        </h3>
        <span className="text-xs text-slate-500 tabular-nums">{plan.length} actions</span>
      </div>
      <div ref={listRef}
        className={`p-3 space-y-0.5 overflow-y-auto overscroll-contain ${variant === "floating" ? "flex-1" : "max-h-[600px]"}`}
        style={{ scrollBehavior: "smooth" }}>
        {/* State 0 — initial state (before any action fires) */}
        <motion.div
          initial={false}
          animate={currentStateIndex === 0 ? { backgroundColor: "rgba(34,197,94,0.08)" } : { backgroundColor: "transparent" }}
          transition={{ duration: 0.2 }}
          onClick={() => onSelectIndex(0)}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelectIndex(0); } }}
          role="button"
          tabIndex={0}
          title="Show initial state (before any action)"
          className={`text-xs px-3 py-2 rounded-lg transition-colors font-mono cursor-pointer focus:outline-none focus:ring-1 focus:ring-green-500/40 ${
            currentStateIndex === 0
              ? "text-green-300 font-medium border-l-[2px] border-green-500"
              : "text-slate-700 hover:bg-white/[0.03] hover:text-slate-500"
          }`}>
          <span className={`mr-2 tabular-nums ${currentStateIndex === 0 ? "text-green-600" : "text-slate-700"}`}>
            00.
          </span>
          Initial State
        </motion.div>
        {plan.map((action, idx) => {
          // plan[idx] transitions state[idx] → state[idx+1]; show the produced state.
          const handleJumpToAction = () => onSelectIndex(idx + 1);
          return (
            <motion.div key={idx}
              initial={false}
              animate={idx === currentStateIndex - 1 ? { backgroundColor: "rgba(34,197,94,0.08)" } : { backgroundColor: "transparent" }}
              transition={{ duration: 0.2 }}
              onClick={handleJumpToAction}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleJumpToAction();
                }
              }}
              role="button"
              tabIndex={0}
              title={`Show state after this action`}
              className={`text-xs px-3 py-2 rounded-lg transition-colors font-mono cursor-pointer focus:outline-none focus:ring-1 focus:ring-green-500/40 ${
                idx === currentStateIndex - 1
                  ? "text-green-300 font-medium border-l-[2px] border-green-500"
                  : idx < currentStateIndex - 1
                  ? "text-slate-700 hover:bg-white/[0.03] hover:text-slate-500"
                  : "text-slate-500 hover:bg-white/[0.03] hover:text-slate-300"
              }`}>
              <span className={`mr-2 tabular-nums ${idx === currentStateIndex - 1 ? "text-green-600" : "text-slate-700"}`}>
                {String(idx + 1).padStart(2, "0")}.
              </span>
              {action}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
