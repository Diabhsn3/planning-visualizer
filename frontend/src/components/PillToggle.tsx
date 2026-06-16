interface PillToggleProps<T extends string> {
  options: { id: T; label: React.ReactNode }[];
  value: T;
  onChange: (value: T) => void;
}

/** A small segmented pill toggle. Generic over the option id type, so callers
 *  get a typed onChange (no string casts). */
export function PillToggle<T extends string>({ options, value, onChange }: PillToggleProps<T>) {
  return (
    <div className="flex bg-white/[0.04] rounded-lg p-0.5 border border-white/[0.07]">
      {options.map(o => (
        <button key={o.id} onClick={() => onChange(o.id)}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-md text-xs font-medium transition-all duration-150 ${
            value === o.id
              ? "bg-[#1a2e48] text-slate-100 shadow-sm border border-white/[0.1]"
              : "text-slate-600 hover:text-slate-400"
          }`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
