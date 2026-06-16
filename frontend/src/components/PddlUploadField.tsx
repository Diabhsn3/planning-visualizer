import { Textarea } from "@/components/ui/textarea";
import { UploadIcon } from "@/components/Icons";

export type UploadInputMode = "file" | "text";

interface PddlUploadFieldProps {
  label: string;
  inputMode: UploadInputMode;
  onInputModeChange: (mode: UploadInputMode) => void;
  file: File | null;
  onFileChange: (file: File | null) => void;
  text: string;
  onTextChange: (text: string) => void;
  /** Hint shown in the dropzone when no file is selected. */
  uploadHint: string;
  textPlaceholder: string;
}

/** A PDDL input that toggles between an upload dropzone and a paste-text area.
 *  Used for the domain and problem PDDL inputs of the custom-domain panel. */
export function PddlUploadField({
  label,
  inputMode,
  onInputModeChange,
  file,
  onFileChange,
  text,
  onTextChange,
  uploadHint,
  textPlaceholder,
}: PddlUploadFieldProps) {
  return (
    <div>
      <label className="text-xs font-medium text-slate-400 block mb-1.5">{label}</label>
      <div className="flex gap-1 mb-2">
        {(["file", "text"] as const).map(m => (
          <button key={m} onClick={() => onInputModeChange(m)}
            className="px-2.5 py-1 rounded-md text-xs font-medium transition-all"
            style={{ background: inputMode === m ? "rgba(168,85,247,0.2)" : "rgba(255,255,255,0.05)", color: inputMode === m ? "#c084fc" : "#64748B", border: `1px solid ${inputMode === m ? "rgba(168,85,247,0.3)" : "transparent"}` }}>
            {m === "file" ? "Upload File" : "Paste Text"}
          </button>
        ))}
      </div>
      {inputMode === "file" ? (
        <label className="flex flex-col items-center justify-center gap-2 px-3 py-4 rounded-xl border-2 border-dashed cursor-pointer transition-all hover:border-purple-500/40 hover:bg-white/[0.03]"
          style={{ borderColor: file ? "rgba(168,85,247,0.4)" : "rgba(255,255,255,0.08)", background: file ? "rgba(168,85,247,0.06)" : "transparent" }}>
          <span style={{ color: file ? "#c084fc" : "#475569" }}><UploadIcon className="w-5 h-5" /></span>
          <span className="text-xs text-center" style={{ color: file ? "#c084fc" : "#475569" }}>
            {file ? file.name : uploadHint}
          </span>
          <input type="file" accept=".pddl,.txt" className="hidden"
            onChange={e => onFileChange(e.target.files?.[0] || null)} />
        </label>
      ) : (
        <Textarea value={text} onChange={e => onTextChange(e.target.value)}
          placeholder={textPlaceholder}
          className="w-full h-28 text-xs font-mono resize-none bg-white/[0.04] border-white/[0.08] text-slate-300 placeholder-slate-600 focus:border-purple-500/30"
        />
      )}
    </div>
  );
}
