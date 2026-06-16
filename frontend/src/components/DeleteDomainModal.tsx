import { AnimatePresence } from "framer-motion";
import { AlertIcon, CloseIcon } from "@/components/Icons";
import { ModalBackdrop } from "@/components/ModalBackdrop";

interface DeleteDomainModalProps {
  show: boolean;
  displayName: string;
  isDeleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

/** Destructive confirmation for removing a saved domain from the library. */
export function DeleteDomainModal({ show, displayName, isDeleting, onCancel, onConfirm }: DeleteDomainModalProps) {
  return (
    <AnimatePresence>
      {show && (
        <ModalBackdrop onClose={onCancel}>
          <div className="bg-[#111E30] rounded-2xl border border-white/[0.08] max-w-md w-full overflow-hidden"
            style={{ boxShadow: "0 25px 60px rgba(0,0,0,0.6), 0 1px 0 rgba(255,255,255,0.05) inset" }}>
            <div className="px-6 py-4 border-b border-red-500/20 bg-red-500/[0.06]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-red-500/15">
                    <AlertIcon className="w-4 h-4 text-red-400" />
                  </div>
                  <h3 className="text-sm font-semibold text-red-300"
                    style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                    Delete saved domain
                  </h3>
                </div>
                <button onClick={onCancel}
                  className="text-slate-500 hover:text-slate-200 transition-all duration-150 p-2 rounded-xl hover:bg-white/[0.08]">
                  <CloseIcon className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="px-6 py-5">
              <p className="text-sm text-slate-400 leading-relaxed">
                Are you sure you want to delete{" "}
                <span className="text-slate-200 font-semibold" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                  {displayName}
                </span>
                {" "}from your library?
              </p>
              <p className="text-xs text-slate-500 mt-3 leading-relaxed">
                The entry is removed from the saved-domains list. The underlying generated code stays on disk —
                it's content-addressed and may be shared with other entries.
              </p>
            </div>
            <div className="px-6 py-4 border-t border-white/[0.05] bg-white/[0.02] flex justify-between gap-3">
              <button
                onClick={onCancel}
                className="px-5 py-2.5 text-sm text-slate-400 hover:text-slate-200 font-medium transition-all duration-150 rounded-xl hover:bg-white/[0.08]"
              >
                Cancel
              </button>
              <button
                onClick={onConfirm}
                disabled={isDeleting}
                className="px-5 py-2.5 text-sm font-semibold transition-all duration-150 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-200 border border-red-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isDeleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </ModalBackdrop>
      )}
    </AnimatePresence>
  );
}
