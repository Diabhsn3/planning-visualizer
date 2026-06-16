import { motion } from "framer-motion";
import { FileCodeIcon, GeminiIcon, ClaudeIcon, CloseIcon } from "@/components/Icons";

export interface SavedDomain {
  id: number;
  displayName: string;
  domainName: string;
  provider: string | null;
  createdAt: string;
  transformerHash: string | null;
  rendererHash: string | null;
}

interface SavedDomainsListProps {
  savedDomains: SavedDomain[] | undefined;
  isLoading: boolean;
  selectedSavedDomainId: number | null;
  /** Select a saved domain (parent also primes the custom-domain name). */
  onSelect: (sd: SavedDomain) => void;
  /** Open the delete-confirmation flow for a saved domain. */
  onDelete: (sd: SavedDomain) => void;
}

/** The rows of the saved-domains library (loading / empty / list). Rendered
 *  inside the collapsible "Saved domains" section of the custom panel. */
export function SavedDomainsList({ savedDomains, isLoading, selectedSavedDomainId, onSelect, onDelete }: SavedDomainsListProps) {
  return (
    <div className="space-y-1 pt-1">
      {isLoading && (
        <div className="text-xs text-slate-500 text-center py-4">Loading saved domains...</div>
      )}
      {savedDomains && savedDomains.length === 0 && (
        <div className="text-center py-6 space-y-2">
          <div className="text-xs text-slate-500">No saved domains yet.</div>
          <div className="text-xs text-slate-600">Upload a new domain and it will be saved here automatically.</div>
        </div>
      )}
      {savedDomains?.map(sd => {
        const isSel = selectedSavedDomainId === sd.id;
        return (
          <motion.div
            key={sd.id}
            whileTap={{ scale: 0.98 }}
            whileHover={!isSel ? { x: 2 } : undefined}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all border group"
            style={isSel
              ? { background: "rgba(168,85,247,0.1)", borderColor: "rgba(168,85,247,0.35)" }
              : { borderColor: "transparent" }
            }
          >
            {/* Main click region — selecting the saved domain. */}
            <button
              type="button"
              onClick={() => onSelect(sd)}
              className="flex-1 flex items-center gap-3 min-w-0 text-left bg-transparent border-0 p-0 cursor-pointer"
            >
              <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors"
                style={{ background: isSel ? "rgba(168,85,247,0.2)" : "rgba(255,255,255,0.06)" }}>
                <FileCodeIcon className={`w-5 h-5 ${isSel ? "text-purple-400" : "text-slate-500"}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium leading-none transition-colors"
                  style={{ fontFamily: "'JetBrains Mono', monospace", color: isSel ? "#E9D5FF" : "#CBD5E1" }}>
                  {sd.displayName}
                </div>
                <div className="flex items-center gap-1 text-xs text-slate-500 mt-0.5">
                  {sd.provider?.toLowerCase().includes("gemini") ? (
                    <GeminiIcon className="w-3 h-3 flex-shrink-0" />
                  ) : sd.provider?.toLowerCase().includes("claude") ? (
                    <ClaudeIcon className="w-3 h-3 flex-shrink-0" />
                  ) : null}
                  <span className="truncate">{sd.provider} &middot; {new Date(sd.createdAt).toLocaleDateString()}</span>
                </div>
                {(sd.transformerHash || sd.rendererHash) && (
                  <div className="flex gap-1 mt-1">
                    {sd.transformerHash && (
                      <span
                        title={`Transformer hash: ${sd.transformerHash}`}
                        className="px-1.5 py-0.5 rounded bg-white/[0.04] text-slate-400 font-mono text-[10px]"
                      >
                        T:{sd.transformerHash.slice(0, 8)}
                      </span>
                    )}
                    {sd.rendererHash && (
                      <span
                        title={`Renderer hash: ${sd.rendererHash}`}
                        className="px-1.5 py-0.5 rounded bg-white/[0.04] text-slate-400 font-mono text-[10px]"
                      >
                        R:{sd.rendererHash.slice(0, 8)}
                      </span>
                    )}
                  </div>
                )}
              </div>
              {isSel && (
                <motion.div
                  layoutId="saved-domain-dot"
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ background: "#A855F7", boxShadow: "0 0 8px rgba(168,85,247,0.7)" }}
                />
              )}
            </button>
            {/* Delete button — opens confirmation modal. Stop propagation so it
                doesn't double-fire the row select. */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(sd);
              }}
              title={`Delete ${sd.displayName}`}
              className="flex-shrink-0 w-7 h-7 rounded-md flex items-center justify-center text-slate-600 hover:text-red-300 hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
            >
              <CloseIcon className="w-4 h-4" />
            </button>
          </motion.div>
        );
      })}
    </div>
  );
}
