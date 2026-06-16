import { AnimatePresence } from "framer-motion";
import { CloseIcon } from "@/components/Icons";
import { ModalBackdrop } from "@/components/ModalBackdrop";

interface PddlViewerModalProps {
  show: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  /** The body content (typically a <pre> of PDDL, or loading/error states). */
  children: React.ReactNode;
}

/** Generic scrollable modal for displaying PDDL (or any preformatted) content.
 *  Backs the "Example Problem" and "Domain Definition" viewers. */
export function PddlViewerModal({ show, onClose, title, subtitle, children }: PddlViewerModalProps) {
  return (
    <AnimatePresence>
      {show && (
        <ModalBackdrop onClose={onClose}>
          <div className="bg-[#111E30] rounded-2xl border border-white/[0.08] max-w-3xl w-full max-h-[80vh] overflow-hidden flex flex-col"
            style={{ boxShadow: "0 25px 60px rgba(0,0,0,0.6), 0 1px 0 rgba(255,255,255,0.05) inset" }}>
            <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-200" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                  {title}
                </h3>
                {subtitle && <p className="text-xs text-slate-500 mt-1">{subtitle}</p>}
              </div>
              <button onClick={onClose}
                aria-label="Close modal"
                className="text-slate-500 hover:text-slate-200 transition-all duration-150 p-2 rounded-xl hover:bg-white/[0.08]">
                <CloseIcon className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1">
              {children}
            </div>
            <div className="px-6 py-4 border-t border-white/[0.05] bg-white/[0.02] flex justify-end">
              <button onClick={onClose}
                className="px-5 py-2.5 bg-white/[0.06] hover:bg-white/[0.1] text-sm text-slate-300 font-medium rounded-xl transition-all duration-150 border border-white/[0.06] hover:border-white/[0.1]">
                Close
              </button>
            </div>
          </div>
        </ModalBackdrop>
      )}
    </AnimatePresence>
  );
}
