import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FileCodeIcon, GeminiIcon, ClaudeIcon, CloseIcon, ChevronDownIcon } from "@/components/Icons";

export interface SavedDomain {
  id: number;
  displayName: string;
  domainName: string;
  provider: string | null;
  createdAt: string;
  transformerHash: string | null;
  rendererHash: string | null;
  /** Groups versions of the same domain (cosmetics ignored). */
  canonicalHash?: string | null;
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

const easeOut: [number, number, number, number] = [0.23, 1, 0.32, 1];

/** "Ferry (12)" → "Ferry". Strips the auto-versioning suffix for group titles. */
function baseName(displayName: string): string {
  return displayName.replace(/\s*\(\d+\)\s*$/, "").trim() || displayName;
}

function providerKind(provider: string | null | undefined): "gemini" | "claude" | "other" {
  const p = (provider ?? "").toLowerCase();
  if (p.includes("gemini")) return "gemini";
  if (p.includes("claude")) return "claude";
  return "other";
}

function ProviderIcon({ kind, className }: { kind: "gemini" | "claude" | "other"; className?: string }) {
  if (kind === "gemini") return <GeminiIcon className={className} />;
  if (kind === "claude") return <ClaudeIcon className={className} />;
  return null;
}

interface DomainGroup {
  key: string;
  title: string;
  versions: SavedDomain[];   // newest first
  latest: SavedDomain;
  providers: Array<"gemini" | "claude" | "other">;
}

/** The saved-domains library, grouped by logical domain (canonical hash) so
 *  every version of a domain — Claude and Gemini alike — sits under one
 *  collapsible header. */
export function SavedDomainsList({ savedDomains, isLoading, selectedSavedDomainId, onSelect, onDelete }: SavedDomainsListProps) {
  // Which groups the user has explicitly toggled open.
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());

  const groups = useMemo<DomainGroup[]>(() => {
    const byKey = new Map<string, SavedDomain[]>();
    for (const sd of savedDomains ?? []) {
      // Fall back to a per-id key if canonicalHash is somehow missing, so the
      // entry still shows (as its own group) rather than vanishing.
      const key = sd.canonicalHash || `id:${sd.id}`;
      const arr = byKey.get(key);
      if (arr) arr.push(sd);
      else byKey.set(key, [sd]);
    }
    const result: DomainGroup[] = [];
    for (const [key, versions] of byKey) {
      const sorted = [...versions].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      const providers: Array<"gemini" | "claude" | "other"> = [];
      for (const v of sorted) {
        const k = providerKind(v.provider);
        if (k !== "other" && !providers.includes(k)) providers.push(k);
      }
      result.push({ key, title: baseName(sorted[0].displayName), versions: sorted, latest: sorted[0], providers });
    }
    // Newest domain first.
    result.sort((a, b) => b.latest.createdAt.localeCompare(a.latest.createdAt));
    return result;
  }, [savedDomains]);

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

      {groups.map(group => {
        const hasSelected = group.versions.some(v => v.id === selectedSavedDomainId);
        // A group is open if the user toggled it, or it holds the selected version.
        const isOpen = openGroups.has(group.key) || hasSelected;
        const single = group.versions.length === 1;

        return (
          <div key={group.key} className="rounded-xl overflow-hidden border border-white/[0.05] bg-white/[0.015]">
            {/* Group header — domain name, version count, providers present. */}
            <button
              type="button"
              onClick={() => setOpenGroups(prev => {
                const next = new Set(prev);
                next.has(group.key) ? next.delete(group.key) : next.add(group.key);
                return next;
              })}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-white/[0.03]"
            >
              <motion.div animate={{ rotate: isOpen ? 0 : -90 }} transition={{ duration: 0.18, ease: easeOut }}>
                <ChevronDownIcon className="w-4 h-4 text-slate-600" />
              </motion.div>
              <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: hasSelected ? "rgba(168,85,247,0.18)" : "rgba(255,255,255,0.05)" }}>
                <FileCodeIcon className={`w-4 h-4 ${hasSelected ? "text-purple-400" : "text-slate-500"}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium leading-none truncate"
                  style={{ fontFamily: "'JetBrains Mono', monospace", color: hasSelected ? "#E9D5FF" : "#CBD5E1" }}>
                  {group.title}
                </div>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-white/[0.06] text-slate-500">
                    {single ? "1 version" : `${group.versions.length} versions`}
                  </span>
                  {group.providers.map(p => (
                    <ProviderIcon key={p} kind={p} className="w-3 h-3 text-slate-500" />
                  ))}
                </div>
              </div>
            </button>

            {/* Version rows. */}
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2, ease: easeOut }}
                  className="overflow-hidden"
                >
                  <div className="px-1.5 pb-1.5 pt-0.5 space-y-0.5">
                    {group.versions.map((sd, i) => {
                      const isSel = selectedSavedDomainId === sd.id;
                      const kind = providerKind(sd.provider);
                      const isLatest = i === 0 && !single;
                      return (
                        <motion.div
                          key={sd.id}
                          whileTap={{ scale: 0.98 }}
                          className="w-full flex items-center gap-2.5 pl-3 pr-2 py-2 rounded-lg text-left transition-all border group/row"
                          style={isSel
                            ? { background: "rgba(168,85,247,0.1)", borderColor: "rgba(168,85,247,0.35)" }
                            : { borderColor: "transparent" }
                          }
                        >
                          <button
                            type="button"
                            onClick={() => onSelect(sd)}
                            className="flex-1 flex items-center gap-2.5 min-w-0 text-left bg-transparent border-0 p-0 cursor-pointer"
                          >
                            <ProviderIcon kind={kind} className="w-3.5 h-3.5 flex-shrink-0 text-slate-400" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                {/* The name the user gave this version. */}
                                <span className="text-xs font-medium leading-none truncate"
                                  style={{ fontFamily: "'JetBrains Mono', monospace", color: isSel ? "#E9D5FF" : "#CBD5E1" }}>
                                  {sd.displayName}
                                </span>
                                {isLatest && (
                                  <span className="text-[9px] font-semibold px-1 py-0.5 rounded bg-purple-500/15 text-purple-300 flex-shrink-0">
                                    LATEST
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5 mt-1">
                                <span className="text-[10px] text-slate-500 truncate">{sd.provider || "Unknown"}</span>
                                <span className="text-[10px] text-slate-600">&middot;</span>
                                <span className="text-[10px] text-slate-500">{new Date(sd.createdAt).toLocaleDateString()}</span>
                                {sd.rendererHash && (
                                  <span title={`Renderer hash: ${sd.rendererHash}`}
                                    className="px-1 py-0.5 rounded bg-white/[0.04] text-slate-500 font-mono text-[9px]">
                                    R:{sd.rendererHash.slice(0, 6)}
                                  </span>
                                )}
                              </div>
                            </div>
                            {isSel && (
                              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                                style={{ background: "#A855F7", boxShadow: "0 0 8px rgba(168,85,247,0.7)" }} />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); onDelete(sd); }}
                            title={`Delete ${sd.displayName}`}
                            className="flex-shrink-0 w-6 h-6 rounded-md flex items-center justify-center text-slate-600 hover:text-red-300 hover:bg-red-500/10 transition-colors opacity-0 group-hover/row:opacity-100 focus:opacity-100"
                          >
                            <CloseIcon className="w-3.5 h-3.5" />
                          </button>
                        </motion.div>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
