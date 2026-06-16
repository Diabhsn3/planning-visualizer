import { motion } from "framer-motion";
import { FileCodeIcon } from "@/components/Icons";
import { easeOut, listStagger, listItem } from "@/lib/animation";

export interface Domain {
  id: string;
  name: string;
  description: string;
  Icon: React.ComponentType<{ className?: string }>;
}

export interface DomainColor {
  iconBg: string;
  iconColor: string;
  selBg: string;
  selBorder: string;
  nameColor: string;
  dotColor: string;
  dotGlow: string;
}

export type DomainColors = Record<string, DomainColor>;

interface DomainGridProps {
  domains: Domain[];
  selectedDomain: string;
  domainColors: DomainColors;
  /** Select a built-in domain by id (parent also clears custom-domain mode). */
  onSelect: (id: string) => void;
  onViewDefinition: () => void;
}

/** The built-in (basic) domain list of Step 1. Animated in/out by the parent's
 *  AnimatePresence — hence the motion.div root with a stable key. */
export function DomainGrid({ domains, selectedDomain, domainColors, onSelect, onViewDefinition }: DomainGridProps) {
  return (
    <motion.div
      key="basic-list"
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.2, ease: easeOut }}
      className="overflow-hidden space-y-0.5"
    >
      <motion.div className="space-y-0.5" variants={listStagger} initial="initial" animate="animate">
        {domains.map(domain => {
          const DomainIcon = domain.Icon;
          const sel = selectedDomain === domain.id;
          return (
            <motion.button
              key={domain.id}
              variants={listItem}
              transition={{ duration: 0.18, ease: easeOut }}
              onClick={() => onSelect(domain.id)}
              whileTap={{ scale: 0.98 }}
              whileHover={!sel ? { x: 2 } : undefined}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all border"
              style={sel ? { background: domainColors[domain.id]?.selBg, borderColor: domainColors[domain.id]?.selBorder } : { borderColor: "transparent" }}
            >
              <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors"
                style={{ background: sel ? domainColors[domain.id]?.iconBg : "rgba(255,255,255,0.06)" }}>
                <span style={{ color: sel ? domainColors[domain.id]?.iconColor : "#64748B", display: "contents" }}>
                  <DomainIcon className="w-5 h-5 transition-colors" />
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium leading-none transition-colors"
                  style={{ fontFamily: "'JetBrains Mono', monospace", color: sel ? domainColors[domain.id]?.nameColor : "#CBD5E1" }}>
                  {domain.name}
                </div>
                <div className="text-xs text-slate-500 truncate mt-0.5">{domain.description}</div>
              </div>
              {sel && (
                <motion.div
                  layoutId="domain-sel-dot"
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ background: domainColors[domain.id]?.dotColor, boxShadow: `0 0 8px ${domainColors[domain.id]?.dotGlow}` }}
                />
              )}
            </motion.button>
          );
        })}
      </motion.div>
      <button
        onClick={onViewDefinition}
        className="w-full mt-1 px-3 py-2.5 text-xs font-medium text-slate-500 hover:text-slate-300 rounded-lg hover:bg-white/[0.04] transition-all duration-150 flex items-center justify-center gap-1.5">
        <FileCodeIcon className="w-3 h-3" />
        View Domain Definition
      </button>
    </motion.div>
  );
}
