import { motion } from "framer-motion";
import { ChevronDownIcon, AlertIcon } from "@/components/Icons";
import { CollapseSection } from "@/components/CollapseSection";
import { SpeedBadge } from "@/components/SpeedBadge";
import { easeOut, listStagger, listItem } from "@/lib/animation";

export interface SearchStrategy {
  id: string;
  name: string;
  description: string;
  isOptimal: boolean;
  speed: "fast" | "medium" | "slow";
  whenToUse: string;
  warning: string | null;
}

interface StrategyPickerProps {
  isOpen: boolean;
  onToggle: () => void;
  strategies: SearchStrategy[] | undefined;
  selectedStrategy: string;
  onSelect: (id: string) => void;
  /** The currently-selected strategy (for the header summary + warning). */
  currentStrategy: SearchStrategy | undefined;
}

/** Step 3 of the configure sidebar: pick the Fast Downward search strategy. */
export function StrategyPicker({
  isOpen,
  onToggle,
  strategies,
  selectedStrategy,
  onSelect,
  currentStrategy,
}: StrategyPickerProps) {
  return (
    <div>
      <button onClick={onToggle}
        className="w-full px-4 py-3.5 flex items-center gap-3 hover:bg-white/[0.03] transition-all duration-150">
        <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ background: "rgba(139,92,246,0.15)", border: "1px solid rgba(139,92,246,0.3)" }}>
          <span className="text-[11px] font-bold"
            style={{ fontFamily: "'JetBrains Mono', monospace", color: "#A78BFA" }}>3</span>
        </div>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-sm font-semibold text-slate-200 flex-shrink-0"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}>Strategy</span>
          <span className="text-xs text-slate-500 truncate">{currentStrategy?.name}</span>
        </div>
        <motion.div animate={{ rotate: isOpen ? 0 : -90 }} transition={{ duration: 0.18, ease: easeOut }} className="flex-shrink-0">
          <ChevronDownIcon className="w-4 h-4 text-slate-600" />
        </motion.div>
      </button>

      <CollapseSection open={isOpen}>
        <div className="px-3 pb-4 pt-1 border-t border-white/[0.04]">
          <motion.div className="space-y-0.5" variants={listStagger} initial="initial" animate="animate">
            {strategies?.map((strategy) => {
              const sel = selectedStrategy === strategy.id;
              return (
                <motion.button
                  key={strategy.id}
                  variants={listItem}
                  transition={{ duration: 0.18, ease: easeOut }}
                  onClick={() => onSelect(strategy.id)}
                  whileTap={{ scale: 0.98 }}
                  whileHover={!sel ? { x: 2 } : undefined}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all ${
                    sel ? "bg-green-500/10 border border-green-500/[0.22] shadow-sm shadow-green-500/5" : "border border-transparent hover:bg-white/[0.04] hover:border-white/[0.06]"
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`text-sm font-medium ${sel ? "text-green-300" : "text-slate-300"}`}>
                        {strategy.name}
                      </span>
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
                        strategy.isOptimal ? "bg-purple-500/15 text-purple-400" : "bg-blue-500/15 text-blue-400"
                      }`}>
                        {strategy.isOptimal ? "Optimal" : "Satisficing"}
                      </span>
                      <SpeedBadge speed={strategy.speed} />
                    </div>
                    <div className="text-xs text-slate-500 leading-relaxed mt-0.5">{strategy.description}</div>
                    {strategy.whenToUse && (
                      <div className="text-xs text-slate-600 leading-relaxed mt-0.5 italic">{strategy.whenToUse}</div>
                    )}
                  </div>
                  {sel && <div className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0"
                    style={{ boxShadow: "0 0 6px rgba(34,197,94,0.8)" }} />}
                </motion.button>
              );
            })}
          </motion.div>
          {currentStrategy?.warning && (
            <div className="mt-2 p-3 bg-amber-500/[0.08] border border-amber-500/20 rounded-xl flex items-start gap-2">
              <AlertIcon className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-300/80 leading-relaxed">{currentStrategy.warning}</p>
            </div>
          )}
        </div>
      </CollapseSection>
    </div>
  );
}
