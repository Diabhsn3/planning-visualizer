import { ZapIcon, ClockIcon, AlertIcon } from "@/components/Icons";

/** Small pill showing a search strategy's speed (fast / medium / slow). */
export function SpeedBadge({ speed }: { speed: string }) {
  const map = {
    fast:   { Icon: ZapIcon,   bg: "bg-green-500/15",  text: "text-green-400",  label: "Fast"   },
    medium: { Icon: ClockIcon, bg: "bg-amber-500/15",  text: "text-amber-400",  label: "Medium" },
    slow:   { Icon: AlertIcon, bg: "bg-red-500/15",    text: "text-red-400",    label: "Slow"   },
  }[speed] ?? { Icon: ClockIcon, bg: "bg-white/8", text: "text-slate-400", label: speed };
  const { Icon } = map;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${map.bg} ${map.text}`}>
      <Icon className="w-2.5 h-2.5" />{map.label}
    </span>
  );
}
