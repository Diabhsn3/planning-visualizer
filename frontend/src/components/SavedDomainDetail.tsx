import { motion, AnimatePresence } from "framer-motion";
import { SparklesIcon } from "@/components/Icons";
import { easeOut } from "@/lib/animation";
import { PddlUploadField, type UploadInputMode } from "@/components/PddlUploadField";

function formatBytes(n: number): string {
  if (!n || n < 1024) return `${n} B`;
  const kb = n / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(2)} MB`;
}

interface SavedDomainDetailProps {
  domainPddl: string;
  transformerCode: string | null;
  rendererCode: string | null;
  transformerHash: string | null;
  rendererHash: string | null;
  showGeneratedCode: boolean;
  onToggleGeneratedCode: () => void;

  // Problem PDDL upload for this saved domain.
  problemInputMode: UploadInputMode;
  onProblemInputModeChange: (mode: UploadInputMode) => void;
  problemFile: File | null;
  onProblemFileChange: (file: File | null) => void;
  problemText: string;
  onProblemTextChange: (text: string) => void;
}

/** Detail panel shown when a saved domain is selected: its domain PDDL, the
 *  generated transformer/renderer code, and a problem PDDL input. */
export function SavedDomainDetail({
  domainPddl,
  transformerCode,
  rendererCode,
  transformerHash,
  rendererHash,
  showGeneratedCode,
  onToggleGeneratedCode,
  problemInputMode,
  onProblemInputModeChange,
  problemFile,
  onProblemFileChange,
  problemText,
  onProblemTextChange,
}: SavedDomainDetailProps) {
  const artifacts = [
    { kind: "transformer", code: transformerCode, hash: transformerHash },
    { kind: "renderer", code: rendererCode, hash: rendererHash },
  ] as const;

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.2, ease: easeOut }}
      className="overflow-hidden space-y-3 pt-2"
    >
      {/* Domain Definition Preview */}
      <div>
        <label className="text-xs font-medium text-slate-400 block mb-1.5">Domain Definition</label>
        <div className="w-full h-28 text-xs font-mono bg-white/[0.04] border border-white/[0.08] rounded-lg p-2 overflow-auto text-slate-400">
          <pre className="whitespace-pre-wrap">{domainPddl}</pre>
        </div>
      </div>
      {/* Generated Code (transformer + renderer artifacts) */}
      <div>
        <button
          type="button"
          onClick={onToggleGeneratedCode}
          className="flex items-center justify-between w-full text-xs font-medium text-slate-400 hover:text-slate-300 mb-1.5"
        >
          <span>Generated Code</span>
          <span className="font-mono text-[10px] text-slate-500">
            {showGeneratedCode ? "▾ hide" : "▸ show"}
          </span>
        </button>
        <AnimatePresence>
          {showGeneratedCode && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.18, ease: easeOut }}
              className="overflow-hidden space-y-2"
            >
              {artifacts.map(({ kind, code, hash }) => (
                <div key={kind} className="bg-white/[0.04] border border-white/[0.08] rounded-lg p-2">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-xs font-medium text-slate-300 capitalize">{kind}</span>
                    <span
                      title={hash || "(no hash)"}
                      className="font-mono text-[10px] text-slate-500 truncate flex-1 min-w-0"
                    >
                      {hash ? hash.slice(0, 16) + "…" : "(legacy, no hash)"}
                    </span>
                    <span className="font-mono text-[10px] text-slate-500 flex-shrink-0">
                      {formatBytes(code?.length || 0)}
                    </span>
                    <button
                      type="button"
                      onClick={() => { if (code) navigator.clipboard.writeText(code); }}
                      className="px-1.5 py-0.5 rounded text-[10px] font-mono text-slate-400 hover:text-slate-200 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08]"
                      title="Copy code to clipboard"
                    >
                      copy
                    </button>
                  </div>
                  <pre className="text-[10px] font-mono text-slate-400 whitespace-pre overflow-auto max-h-48 leading-relaxed">
                    {code || "(no code)"}
                  </pre>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      {/* Problem PDDL */}
      <PddlUploadField
        label="Problem PDDL"
        inputMode={problemInputMode}
        onInputModeChange={onProblemInputModeChange}
        file={problemFile}
        onFileChange={onProblemFileChange}
        text={problemText}
        onTextChange={onProblemTextChange}
        uploadHint="Click to upload problem.pddl"
        textPlaceholder={"(define (problem my-problem)\n  (:domain my-domain)\n  ...)"}
      />
      {/* Info banner */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs" style={{ background: "rgba(168,85,247,0.08)", border: "1px solid rgba(168,85,247,0.15)" }}>
        <SparklesIcon className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />
        <span className="text-purple-300/80">Pre-trained renderer will be used. No LLM call needed.</span>
      </div>
    </motion.div>
  );
}
