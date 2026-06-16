import { motion } from "framer-motion";
import { SparklesIcon, ClaudeIcon, GeminiIcon } from "@/components/Icons";
import { easeOut } from "@/lib/animation";
import { PddlUploadField, type UploadInputMode } from "@/components/PddlUploadField";
import type { LlmProvider } from "@/components/RenderModePicker";

const PROVIDERS: { id: LlmProvider; label: string; Icon: React.ComponentType<{ className?: string }>; active: string }[] = [
  { id: "claude", label: "Claude", Icon: ClaudeIcon, active: "bg-orange-500/15 border-orange-500/30 text-orange-400" },
  { id: "gemini", label: "Gemini", Icon: GeminiIcon, active: "bg-blue-500/15 border-blue-500/30 text-blue-400" },
];

interface CustomDomainUploadProps {
  llmProvider: LlmProvider;
  onProviderChange: (provider: LlmProvider) => void;
  domainName: string;
  onDomainNameChange: (value: string) => void;

  domainInputMode: UploadInputMode;
  onDomainInputModeChange: (mode: UploadInputMode) => void;
  domainFile: File | null;
  onDomainFileChange: (file: File | null) => void;
  domainText: string;
  onDomainTextChange: (text: string) => void;

  problemInputMode: UploadInputMode;
  onProblemInputModeChange: (mode: UploadInputMode) => void;
  problemFile: File | null;
  onProblemFileChange: (file: File | null) => void;
  problemText: string;
  onProblemTextChange: (text: string) => void;
}

/** The "Upload New" custom-domain panel: provider choice + domain name +
 *  domain/problem PDDL inputs. Animated in/out by the parent's AnimatePresence. */
export function CustomDomainUpload({
  llmProvider,
  onProviderChange,
  domainName,
  onDomainNameChange,
  domainInputMode,
  onDomainInputModeChange,
  domainFile,
  onDomainFileChange,
  domainText,
  onDomainTextChange,
  problemInputMode,
  onProblemInputModeChange,
  problemFile,
  onProblemFileChange,
  problemText,
  onProblemTextChange,
}: CustomDomainUploadProps) {
  return (
    <motion.div
      key="upload-new"
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.2, ease: easeOut }}
      className="overflow-hidden space-y-3"
    >
      {/* LLM-only notice */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-purple-500/[0.08] border border-purple-500/20">
        <SparklesIcon className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />
        <span className="text-[11px] text-purple-300/80 leading-relaxed">
          LLM rendering is used automatically for custom domains.
        </span>
      </div>
      {/* LLM Provider selector */}
      <div className="flex items-center gap-3">
        <span className="text-xs text-slate-500 flex-shrink-0">LLM Model</span>
        <div className="flex items-center gap-1 flex-1">
          {PROVIDERS.map(m => (
            <button key={m.id} onClick={() => onProviderChange(m.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors border ${
                llmProvider === m.id ? m.active : "bg-white/[0.03] border-white/[0.07] text-slate-600 hover:text-slate-400 hover:border-white/[0.12]"
              }`}>
              <m.Icon className="w-3.5 h-3.5 flex-shrink-0" />
              {m.label}
            </button>
          ))}
        </div>
      </div>
      {/* Domain Name */}
      <div>
        <label className="text-xs font-medium text-slate-400 block mb-1.5">Domain Name</label>
        <input
          type="text"
          value={domainName}
          onChange={e => onDomainNameChange(e.target.value)}
          placeholder="e.g. logistics, ferry, floortile..."
          className="w-full px-3 py-2 rounded-lg text-sm text-slate-200 placeholder-slate-600 border border-white/[0.08] bg-white/[0.04] focus:outline-none focus:border-purple-500/40 focus:bg-white/[0.06] transition-all"
          style={{ fontFamily: "'JetBrains Mono', monospace" }}
        />
      </div>
      <PddlUploadField
        label="Domain PDDL"
        inputMode={domainInputMode}
        onInputModeChange={onDomainInputModeChange}
        file={domainFile}
        onFileChange={onDomainFileChange}
        text={domainText}
        onTextChange={onDomainTextChange}
        uploadHint="Click to upload domain.pddl"
        textPlaceholder={"(define (domain my-domain)\n  (:requirements :strips)\n  ...)"}
      />
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
    </motion.div>
  );
}
