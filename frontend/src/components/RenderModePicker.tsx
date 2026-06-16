import { AnimatePresence, motion } from "framer-motion";
import {
  BrainIcon, ChevronDownIcon, RefreshIcon, WandIcon, CheckCircleIcon, AlertIcon,
} from "@/components/Icons";
import { CollapseSection } from "@/components/CollapseSection";
import { easeOut } from "@/lib/animation";

export type RenderMode = "basic" | "llm";
export type LlmProvider = "claude" | "gemini";

interface RenderModePickerProps {
  /** Hidden entirely for custom domains (LLM rendering is automatic there). */
  isCustomDomain: boolean;
  isOpen: boolean;
  onToggle: () => void;
  renderMode: RenderMode;
  onRenderModeChange: (mode: RenderMode) => void;
  llmProvider: LlmProvider;
  onProviderChange: (provider: LlmProvider) => void;
  onGenerate: () => void;
  isGenerating: boolean;
  rendererCode: string | null;
  modelInfo: string | null;
  error: string | null;
}

const RENDER_MODES: { id: RenderMode; label: string }[] = [
  { id: "basic", label: "Basic" },
  { id: "llm", label: "LLM" },
];

const PROVIDERS: { id: LlmProvider; label: string; active: string }[] = [
  { id: "claude", label: "Claude", active: "bg-orange-500/15 border-orange-500/30 text-orange-400" },
  { id: "gemini", label: "Gemini", active: "bg-blue-500/15 border-blue-500/30 text-blue-400" },
];

/**
 * Render-mode panel of the configure sidebar: choose Basic vs LLM rendering,
 * pick the LLM provider, and trigger renderer generation. Presentational —
 * all state lives in the parent.
 */
export function RenderModePicker({
  isCustomDomain,
  isOpen,
  onToggle,
  renderMode,
  onRenderModeChange,
  llmProvider,
  onProviderChange,
  onGenerate,
  isGenerating,
  rendererCode,
  modelInfo,
  error,
}: RenderModePickerProps) {
  return (
    <AnimatePresence>
      {!isCustomDomain && (
        <motion.div
          key="render-mode-panel"
          className="rounded-2xl border border-white/[0.08] bg-[#111E30] overflow-hidden"
          style={{ boxShadow: "0 1px 0 rgba(255,255,255,0.05) inset, 0 8px 32px rgba(0,0,0,0.18)" }}
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.25, ease: easeOut }}
        >
          <button onClick={onToggle}
            className="w-full px-4 py-3.5 flex items-center gap-3 hover:bg-white/[0.03] transition-all duration-150">
            <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.3)" }}>
              <BrainIcon className="w-3.5 h-3.5 text-green-400" />
            </div>
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <span className="text-sm font-semibold text-slate-200 flex-shrink-0"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}>Render Mode</span>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                renderMode === "llm"
                  ? "bg-green-500/15 text-green-400 border border-green-500/25"
                  : "bg-white/[0.08] text-slate-400 border border-white/[0.08]"
              }`}>{renderMode === "llm" ? "LLM" : "Basic"}</span>
            </div>
            <motion.div animate={{ rotate: isOpen ? 0 : -90 }} transition={{ duration: 0.18, ease: easeOut }}>
              <ChevronDownIcon className="w-4 h-4 text-slate-600" />
            </motion.div>
          </button>
          <CollapseSection open={isOpen}>
            <div className="px-4 pb-4 pt-1 border-t border-white/[0.04] space-y-3">
              {/* Basic / LLM toggle */}
              <div className="flex items-center gap-0.5 bg-white/[0.04] rounded-lg p-0.5 border border-white/[0.06]">
                {RENDER_MODES.map(m => (
                  <button key={m.id} onClick={() => onRenderModeChange(m.id)}
                    className={`flex-1 px-3 py-2 rounded-md text-xs font-medium transition-all duration-150 ${
                      renderMode === m.id
                        ? m.id === "llm" ? "bg-green-600 text-white shadow-sm" : "bg-white/[0.08] text-slate-200 shadow-sm"
                        : "text-slate-600 hover:text-slate-400"
                    }`}>
                    {m.label}
                  </button>
                ))}
              </div>
              {/* LLM options */}
              <CollapseSection open={renderMode === "llm"}>
                <div className="space-y-3">
                  {/* Model selector */}
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-500 flex-shrink-0">Model</span>
                    <div className="flex items-center gap-1 flex-1">
                      {PROVIDERS.map(m => (
                        <button key={m.id} onClick={() => onProviderChange(m.id)}
                          className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors border ${
                            llmProvider === m.id ? m.active : "bg-white/[0.03] border-white/[0.07] text-slate-600 hover:text-slate-400 hover:border-white/[0.12]"
                          }`}>
                          {m.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  {/* Generate LLM renderer button */}
                  <button onClick={onGenerate} disabled={isGenerating}
                    className={`w-full py-2 px-4 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-2 ${
                      isGenerating ? "bg-green-500/10 text-green-400/50 cursor-wait" : "btn-primary-green text-[#0B1524]"
                    }`}>
                    {isGenerating ? (
                      <><div className="w-3.5 h-3.5 border-2 border-green-500/30 border-t-green-500 rounded-full animate-spin" />Generating renderer...</>
                    ) : rendererCode ? (
                      <><RefreshIcon className="w-3 h-3" />Regenerate</>
                    ) : (
                      <><WandIcon className="w-3 h-3" />Generate LLM Renderer</>
                    )}
                  </button>
                  {/* Status indicators */}
                  {rendererCode && (
                    <div className="flex items-center gap-2 text-xs text-green-400 bg-green-500/8 px-3 py-2 rounded-lg border border-green-500/20">
                      <CheckCircleIcon className="w-3.5 h-3.5 flex-shrink-0" />
                      LLM renderer active{modelInfo && ` — ${modelInfo}`}
                    </div>
                  )}
                  {error && (
                    <div className="flex items-start gap-2 text-xs text-red-400 bg-red-500/8 px-3 py-2 rounded-lg border border-red-500/20">
                      <AlertIcon className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                      <span className="leading-relaxed">{error}</span>
                    </div>
                  )}
                </div>
              </CollapseSection>
            </div>
          </CollapseSection>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
