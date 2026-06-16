import { motion, AnimatePresence } from "framer-motion";
import { UploadIcon, FileCodeIcon, CheckCircleIcon } from "@/components/Icons";
import { Textarea } from "@/components/ui/textarea";
import { fadeInUp, easeOut } from "@/lib/animation";
import { PillToggle } from "@/components/PillToggle";

export type ProblemType = "example" | "custom";
export type ProblemInputMode = "file" | "text";

interface ProblemInputProps {
  /** Display name of the currently selected built-in domain. */
  domainName: string | undefined;
  problemType: ProblemType;
  onProblemTypeChange: (value: ProblemType) => void;
  inputMode: ProblemInputMode;
  onInputModeChange: (value: ProblemInputMode) => void;
  problemFile: File | null;
  onProblemFileChange: (file: File | null) => void;
  problemText: string;
  onProblemTextChange: (text: string) => void;
  onViewExample: () => void;
}

/** Step 2 of the configure sidebar: choose the example problem or upload/paste a
 *  custom one (for built-in domains). */
export function ProblemInput({
  domainName,
  problemType,
  onProblemTypeChange,
  inputMode,
  onInputModeChange,
  problemFile,
  onProblemFileChange,
  problemText,
  onProblemTextChange,
  onViewExample,
}: ProblemInputProps) {
  return (
    <div>
      <div className="px-4 py-3.5 flex items-center gap-3">
        <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ background: "rgba(14,165,233,0.15)", border: "1px solid rgba(14,165,233,0.3)" }}>
          <span className="text-[11px] font-bold"
            style={{ fontFamily: "'JetBrains Mono', monospace", color: "#38BDF8" }}>2</span>
        </div>
        <span className="text-sm font-semibold text-slate-200"
          style={{ fontFamily: "'JetBrains Mono', monospace" }}>Problem</span>
      </div>
      <div className="px-4 pb-5 space-y-3">
        <PillToggle<ProblemType>
          options={[{ id: "example", label: "Example" }, { id: "custom", label: "Custom" }]}
          value={problemType}
          onChange={onProblemTypeChange}
        />

        <AnimatePresence mode="wait">
          {problemType === "example" ? (
            <motion.div key="ex" {...fadeInUp} transition={{ duration: 0.16, ease: easeOut }} className="space-y-3">
              <div className="p-3 bg-green-500/[0.07] rounded-xl border border-green-500/[0.15]">
                <p className="text-xs text-green-300/80 leading-relaxed">
                  Using default problem for <strong className="text-green-300">{domainName}</strong>
                </p>
              </div>
              <button onClick={onViewExample}
                className="w-full px-3 py-2.5 text-xs font-medium text-slate-500 hover:text-slate-300 rounded-lg hover:bg-white/[0.04] transition-all duration-150 flex items-center justify-center gap-1.5">
                <FileCodeIcon className="w-3 h-3" />
                View Example Problem
              </button>
            </motion.div>
          ) : (
            <motion.div key="cu" {...fadeInUp} transition={{ duration: 0.16, ease: easeOut }} className="space-y-3">
              <PillToggle<ProblemInputMode>
                options={[
                  { id: "file", label: <><UploadIcon className="w-3 h-3" />Upload</> },
                  { id: "text", label: <><FileCodeIcon className="w-3 h-3" />Paste</> },
                ]}
                value={inputMode}
                onChange={v => { onInputModeChange(v); if (v === "file") onProblemTextChange(""); else onProblemFileChange(null); }}
              />
              {inputMode === "file" ? (
                <div className="relative">
                  <input type="file" accept=".pddl"
                    onChange={e => onProblemFileChange(e.target.files?.[0] || null)}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                  <div className={`border-2 border-dashed rounded-xl p-5 text-center transition-all ${
                    problemFile
                      ? "border-green-500/40 bg-green-500/[0.06]"
                      : "border-white/[0.08] hover:border-green-500/30 hover:bg-green-500/[0.04]"
                  }`}>
                    {problemFile ? (
                      <><CheckCircleIcon className="w-6 h-6 text-green-500 mx-auto mb-1.5" />
                      <p className="text-xs text-green-400 font-medium truncate px-2">{problemFile.name}</p></>
                    ) : (
                      <><UploadIcon className="w-6 h-6 text-slate-600 mx-auto mb-1.5" />
                      <p className="text-xs text-slate-600">Drop .pddl file or click to browse</p></>
                    )}
                  </div>
                </div>
              ) : (
                <div>
                  <Textarea
                    value={problemText}
                    onChange={e => onProblemTextChange(e.target.value)}
                    placeholder={"(define (problem ...)\n  (:domain ...)\n  ...\n)"}
                    className="font-mono text-xs min-h-[260px] bg-white/[0.04] border-white/[0.08] text-slate-300 placeholder:text-slate-700 focus:border-green-500/40 rounded-xl resize-none"
                  />
                  {problemText && <p className="text-[11px] text-slate-500 mt-1.5">{problemText.split("\n").length} lines</p>}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
