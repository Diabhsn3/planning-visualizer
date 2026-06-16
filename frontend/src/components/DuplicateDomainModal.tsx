import { AnimatePresence } from "framer-motion";
import { SparklesIcon, CloseIcon, FileCodeIcon } from "@/components/Icons";
import { ModalBackdrop } from "@/components/ModalBackdrop";

export interface DuplicateMatch {
  id: number;
  displayName: string;
  domainName: string;
  provider: string;
  createdAt: string;
  transformerHash: string;
  rendererHash: string;
}

interface DuplicateDomainModalProps {
  show: boolean;
  matches: DuplicateMatch[];
  onDismiss: () => void;
  /** Reuse an existing saved-domain version by id. */
  onReuse: (id: number) => void;
  /** Generate a fresh versioned entry from the just-submitted PDDL. */
  onCreateNew: () => void;
}

/** "Domain already exists" — shown when an uploaded PDDL hash matches saved
 *  entries. The user reuses a specific version or creates a new one. */
export function DuplicateDomainModal({ show, matches, onDismiss, onReuse, onCreateNew }: DuplicateDomainModalProps) {
  return (
    <AnimatePresence>
      {show && (
        <ModalBackdrop onClose={onDismiss}>
          <div className="bg-[#111E30] rounded-2xl border border-white/[0.08] max-w-lg w-full overflow-hidden"
            style={{ boxShadow: "0 25px 60px rgba(0,0,0,0.6), 0 1px 0 rgba(255,255,255,0.05) inset" }}>
            <div className="px-6 py-4 border-b border-purple-500/20 bg-purple-500/[0.06]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-purple-500/15">
                    <SparklesIcon className="w-4 h-4 text-purple-400" />
                  </div>
                  <h3 className="text-sm font-semibold text-purple-300"
                    style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                    Domain already exists
                  </h3>
                </div>
                <button onClick={onDismiss}
                  className="text-slate-500 hover:text-slate-200 transition-all duration-150 p-2 rounded-xl hover:bg-white/[0.08]">
                  <CloseIcon className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="px-6 py-5">
              <p className="text-sm text-slate-400 leading-relaxed mb-4">
                Found <span className="text-slate-200 font-semibold">{matches.length}</span>{" "}
                existing version{matches.length === 1 ? "" : "s"} of this PDDL in your library.
                Pick one to reuse, or generate a new version.
              </p>
              <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                {matches.map(m => (
                  <button
                    key={m.id}
                    onClick={() => onReuse(m.id)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all border border-transparent hover:border-purple-500/30 hover:bg-purple-500/[0.08]"
                  >
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 bg-white/[0.06]">
                      <FileCodeIcon className="w-5 h-5 text-slate-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium leading-none text-slate-200"
                        style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                        {m.displayName}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {m.provider} &middot; {new Date(m.createdAt).toLocaleDateString()}
                      </div>
                      {(m.transformerHash || m.rendererHash) && (
                        <div className="flex gap-1 mt-1">
                          {m.transformerHash && (
                            <span
                              title={`Transformer hash: ${m.transformerHash}`}
                              className="px-1.5 py-0.5 rounded bg-white/[0.04] text-slate-400 font-mono text-[10px]"
                            >
                              T:{m.transformerHash.slice(0, 8)}
                            </span>
                          )}
                          {m.rendererHash && (
                            <span
                              title={`Renderer hash: ${m.rendererHash}`}
                              className="px-1.5 py-0.5 rounded bg-white/[0.04] text-slate-400 font-mono text-[10px]"
                            >
                              R:{m.rendererHash.slice(0, 8)}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
            <div className="px-6 py-4 border-t border-white/[0.05] bg-white/[0.02] flex justify-between gap-3">
              <button
                onClick={onDismiss}
                className="px-5 py-2.5 text-sm text-slate-400 hover:text-slate-200 font-medium transition-all duration-150 rounded-xl hover:bg-white/[0.08]"
              >
                Cancel
              </button>
              <button
                onClick={onCreateNew}
                className="px-5 py-2.5 text-sm font-semibold transition-all duration-150 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 text-purple-200 border border-purple-500/30"
              >
                Create new version
              </button>
            </div>
          </div>
        </ModalBackdrop>
      )}
    </AnimatePresence>
  );
}
