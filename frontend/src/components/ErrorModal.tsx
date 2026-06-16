import { AnimatePresence } from "framer-motion";
import { AlertIcon, CloseIcon } from "@/components/Icons";
import { ModalBackdrop } from "@/components/ModalBackdrop";

export interface ErrorModalState {
  show: boolean;
  title: string;
  message: string;
  errorType?: string;
  suggestedDomain?: string;
  suggestedDomainName?: string;
}

interface ErrorModalProps {
  state: ErrorModalState;
  onClose: () => void;
  /** Called when the user accepts the suggested domain (for mismatch errors). */
  onSwitchDomain: (domain: string) => void;
}

/** Error / domain-mismatch dialog. Amber styling for mismatches, red otherwise;
 *  offers a one-click switch to a suggested domain when one is provided. */
export function ErrorModal({ state, onClose, onSwitchDomain }: ErrorModalProps) {
  const isMismatch = state.errorType?.includes("mismatch");
  return (
    <AnimatePresence>
      {state.show && (
        <ModalBackdrop onClose={onClose}>
          <div className="bg-[#111E30] rounded-2xl border border-white/[0.08] max-w-md w-full overflow-hidden"
            style={{ boxShadow: "0 25px 60px rgba(0,0,0,0.6), 0 1px 0 rgba(255,255,255,0.05) inset" }}>
            <div className={`px-6 py-4 border-b ${
              isMismatch ? "border-amber-500/20 bg-amber-500/[0.06]" : "border-red-500/20 bg-red-500/[0.06]"
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    isMismatch ? "bg-amber-500/15" : "bg-red-500/15"
                  }`}>
                    <AlertIcon className={`w-4 h-4 ${isMismatch ? "text-amber-400" : "text-red-400"}`} />
                  </div>
                  <h3 className={`text-sm font-semibold ${isMismatch ? "text-amber-300" : "text-red-300"}`}
                    style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                    {state.title}
                  </h3>
                </div>
                <button onClick={onClose}
                  className="text-slate-500 hover:text-slate-200 transition-all duration-150 p-2 rounded-xl hover:bg-white/[0.08]">
                  <CloseIcon className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="px-6 py-5">
              <p className="text-sm text-slate-400 whitespace-pre-wrap leading-relaxed">{state.message}</p>
              {state.suggestedDomain && state.suggestedDomainName && (
                <div className="mt-4 p-4 bg-green-500/[0.07] rounded-xl border border-green-500/20">
                  <p className="text-xs text-green-300/70 font-medium mb-3">Would you like to switch to the suggested domain?</p>
                  <button
                    onClick={() => onSwitchDomain(state.suggestedDomain!)}
                    className="w-full px-4 py-2.5 btn-primary-green text-[#0B1524] rounded-xl text-sm font-semibold">
                    Switch to {state.suggestedDomainName}
                  </button>
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-white/[0.05] bg-white/[0.02] flex justify-end">
              <button onClick={onClose}
                className="px-5 py-2.5 text-sm text-slate-400 hover:text-slate-200 font-medium transition-all duration-150 rounded-xl hover:bg-white/[0.08]">
                Close
              </button>
            </div>
          </div>
        </ModalBackdrop>
      )}
    </AnimatePresence>
  );
}
