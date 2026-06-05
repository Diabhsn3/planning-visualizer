/**
 * Planning Visualizer — Custom Icon System
 * All icons: 16×16 viewBox · 1.1–1.4px stroke · currentColor · round linecap/join
 */

interface IconProps {
  className?: string;
}

// ── Playback ──────────────────────────────────────────────────────────────────

export const PlayIcon = ({ className = "" }: IconProps) => (
  <svg viewBox="0 0 16 16" fill="none" className={className}>
    <path d="M4.5 3L13 8L4.5 13V3Z" fill="currentColor" fillOpacity="0.9" stroke="currentColor" strokeWidth="0.6" strokeLinejoin="round" />
    <line x1="3" y1="3" x2="3" y2="13" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeOpacity="0.45" />
  </svg>
);

export const PauseIcon = ({ className = "" }: IconProps) => (
  <svg viewBox="0 0 16 16" fill="none" className={className}>
    <rect x="3.5" y="3" width="3" height="10" rx="0.8" fill="currentColor" />
    <rect x="9.5" y="3" width="3" height="10" rx="0.8" fill="currentColor" />
  </svg>
);

export const SkipBackIcon = ({ className = "" }: IconProps) => (
  <svg viewBox="0 0 16 16" fill="none" className={className}>
    <rect x="2.5" y="3" width="2" height="10" rx="0.6" fill="currentColor" fillOpacity="0.8" />
    <path d="M13 3L6.5 8L13 13V3Z" fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
  </svg>
);

export const SkipForwardIcon = ({ className = "" }: IconProps) => (
  <svg viewBox="0 0 16 16" fill="none" className={className}>
    <rect x="11.5" y="3" width="2" height="10" rx="0.6" fill="currentColor" fillOpacity="0.8" />
    <path d="M3 3L9.5 8L3 13V3Z" fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
  </svg>
);

// ── Input ─────────────────────────────────────────────────────────────────────

export const UploadIcon = ({ className = "" }: IconProps) => (
  <svg viewBox="0 0 16 16" fill="none" className={className}>
    <path d="M8 2V9.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    <path d="M5 5L8 2L11 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M2.5 11V13C2.5 13.3 2.7 13.5 3 13.5H13C13.3 13.5 13.5 13.3 13.5 13V11" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const FileCodeIcon = ({ className = "" }: IconProps) => (
  <svg viewBox="0 0 16 16" fill="none" className={className}>
    <path d="M3 2H9.5L13 5.5V14H3V2Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
    <path d="M9.5 2V5.5H13" stroke="currentColor" strokeWidth="1" strokeLinejoin="round" strokeOpacity="0.5" />
    <path d="M5.5 8.5L7 10L5.5 11.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M10.5 8.5L9 10L10.5 11.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" strokeOpacity="0.6" />
  </svg>
);

// ── Status ────────────────────────────────────────────────────────────────────

export const AlertIcon = ({ className = "" }: IconProps) => (
  <svg viewBox="0 0 16 16" fill="none" className={className}>
    <path d="M8 1.5L14.5 13H1.5L8 1.5Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    <line x1="8" y1="6.5" x2="8" y2="10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    <circle cx="8" cy="11.8" r="0.65" fill="currentColor" />
  </svg>
);

export const ClockIcon = ({ className = "" }: IconProps) => (
  <svg viewBox="0 0 16 16" fill="none" className={className}>
    <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.3" />
    <path d="M8 5V8.2L10 9.8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    <line x1="8" y1="2.5" x2="8" y2="3.5" stroke="currentColor" strokeWidth="1" strokeOpacity="0.4" />
    <line x1="13.5" y1="8" x2="12.5" y2="8" stroke="currentColor" strokeWidth="1" strokeOpacity="0.4" />
  </svg>
);

export const ZapIcon = ({ className = "" }: IconProps) => (
  <svg viewBox="0 0 16 16" fill="none" className={className}>
    <path d="M9.5 1.5L3.5 9H8L6 14.5L13 7H8.5L9.5 1.5Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" fill="currentColor" fillOpacity="0.15" />
  </svg>
);

export const CheckCircleIcon = ({ className = "" }: IconProps) => (
  <svg viewBox="0 0 16 16" fill="none" className={className}>
    <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.3" />
    <path d="M5 8L7 10.5L11 5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const XCircleIcon = ({ className = "" }: IconProps) => (
  <svg viewBox="0 0 16 16" fill="none" className={className}>
    <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.3" />
    <path d="M5.5 5.5L10.5 10.5M10.5 5.5L5.5 10.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
  </svg>
);

// ── UI Controls ───────────────────────────────────────────────────────────────

export const SettingsIcon = ({ className = "" }: IconProps) => (
  <svg viewBox="0 0 16 16" fill="none" className={className}>
    <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.2" />
    <path
      d="M8 1.5V3M8 13V14.5M14.5 8H13M3 8H1.5M12.95 3.05L11.9 4.1M4.1 11.9L3.05 12.95M12.95 12.95L11.9 11.9M4.1 4.1L3.05 3.05"
      stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"
    />
  </svg>
);

export const CpuIcon = ({ className = "" }: IconProps) => (
  <svg viewBox="0 0 16 16" fill="none" className={className}>
    <rect x="4.5" y="4.5" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.2" />
    <rect x="6.5" y="6.5" width="3" height="3" rx="0.4" fill="currentColor" fillOpacity="0.4" />
    <path d="M6.5 4.5V2.5M9.5 4.5V2.5M6.5 11.5V13.5M9.5 11.5V13.5M4.5 6.5H2.5M4.5 9.5H2.5M11.5 6.5H13.5M11.5 9.5H13.5"
      stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
  </svg>
);

export const ChevronDownIcon = ({ className = "" }: IconProps) => (
  <svg viewBox="0 0 16 16" fill="none" className={className}>
    <path d="M4.5 6.5L8 10L11.5 6.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const WandIcon = ({ className = "" }: IconProps) => (
  <svg viewBox="0 0 16 16" fill="none" className={className}>
    <line x1="3" y1="13" x2="10" y2="6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M10 6L12.5 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    <circle cx="13" cy="3" r="1" fill="currentColor" />
    {/* star top-left */}
    <path d="M5 4.5L5.5 3L6 4.5L7.5 5L6 5.5L5.5 7L5 5.5L3.5 5L5 4.5Z"
      stroke="currentColor" strokeWidth="0.7" strokeLinejoin="round" strokeOpacity="0.75" />
    {/* star bottom-right */}
    <path d="M11.5 9.5L12 8.5L12.5 9.5L13.5 10L12.5 10.5L12 11.5L11.5 10.5L10.5 10L11.5 9.5Z"
      stroke="currentColor" strokeWidth="0.6" strokeLinejoin="round" strokeOpacity="0.5" />
  </svg>
);

export const RefreshIcon = ({ className = "" }: IconProps) => (
  <svg viewBox="0 0 16 16" fill="none" className={className}>
    <path d="M13 8C13 10.76 10.76 13 8 13C5.24 13 3 10.76 3 8C3 5.24 5.24 3 8 3C9.8 3 11.38 3.9 12.3 5.3"
      stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    <path d="M10 3L12.3 5.3L14.5 3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const BrainIcon = ({ className = "" }: IconProps) => (
  <svg viewBox="0 0 16 16" fill="none" className={className}>
    {/* centre hub */}
    <circle cx="8" cy="8" r="1.4" fill="currentColor" />
    {/* outer nodes */}
    <circle cx="3.5" cy="5.5" r="0.9" fill="currentColor" fillOpacity="0.7" />
    <circle cx="12.5" cy="5.5" r="0.9" fill="currentColor" fillOpacity="0.7" />
    <circle cx="3.5" cy="10.5" r="0.9" fill="currentColor" fillOpacity="0.7" />
    <circle cx="12.5" cy="10.5" r="0.9" fill="currentColor" fillOpacity="0.7" />
    <circle cx="8" cy="2.5" r="0.75" fill="currentColor" fillOpacity="0.5" />
    <circle cx="8" cy="13.5" r="0.75" fill="currentColor" fillOpacity="0.5" />
    {/* edges */}
    <line x1="8" y1="8" x2="3.5" y2="5.5" stroke="currentColor" strokeWidth="0.7" strokeOpacity="0.35" />
    <line x1="8" y1="8" x2="12.5" y2="5.5" stroke="currentColor" strokeWidth="0.7" strokeOpacity="0.35" />
    <line x1="8" y1="8" x2="3.5" y2="10.5" stroke="currentColor" strokeWidth="0.7" strokeOpacity="0.35" />
    <line x1="8" y1="8" x2="12.5" y2="10.5" stroke="currentColor" strokeWidth="0.7" strokeOpacity="0.35" />
    <line x1="8" y1="8" x2="8" y2="2.5" stroke="currentColor" strokeWidth="0.7" strokeOpacity="0.35" />
    <line x1="8" y1="8" x2="8" y2="13.5" stroke="currentColor" strokeWidth="0.7" strokeOpacity="0.35" />
    {/* outer ring connections */}
    <line x1="3.5" y1="5.5" x2="8" y2="2.5" stroke="currentColor" strokeWidth="0.5" strokeOpacity="0.2" />
    <line x1="12.5" y1="5.5" x2="8" y2="2.5" stroke="currentColor" strokeWidth="0.5" strokeOpacity="0.2" />
  </svg>
);

export const TrashIcon = ({ className = "" }: IconProps) => (
  <svg viewBox="0 0 16 16" fill="none" className={className}>
    <line x1="2.5" y1="4.5" x2="13.5" y2="4.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    <path d="M5.5 4.5V3.5C5.5 3 6 2.5 6.5 2.5H9.5C10 2.5 10.5 3 10.5 3.5V4.5" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
    <path d="M4.5 4.5L5 13H11L11.5 4.5" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
    <line x1="6.5" y1="7" x2="6.5" y2="10.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeOpacity="0.5" />
    <line x1="9.5" y1="7" x2="9.5" y2="10.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeOpacity="0.5" />
  </svg>
);

export const HistoryIcon = ({ className = "" }: IconProps) => (
  <svg viewBox="0 0 16 16" fill="none" className={className}>
    <path d="M3.5 8C3.5 5.5 5.5 3.5 8 3.5C10.5 3.5 12.5 5.5 12.5 8C12.5 10.5 10.5 12.5 8 12.5"
      stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    <path d="M1.5 5.5L3.5 8L6 6.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M8 5.5V8.2L9.5 9.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const MenuIcon = ({ className = "" }: IconProps) => (
  <svg viewBox="0 0 16 16" fill="none" className={className}>
    <line x1="2.5" y1="5" x2="13.5" y2="5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    <line x1="2.5" y1="8" x2="10" y2="8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    <line x1="2.5" y1="11" x2="13.5" y2="11" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
  </svg>
);

export const CloseIcon = ({ className = "" }: IconProps) => (
  <svg viewBox="0 0 16 16" fill="none" className={className}>
    <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

export const TerminalIcon = ({ className = "" }: IconProps) => (
  <svg viewBox="0 0 16 16" fill="none" className={className}>
    <rect x="1.5" y="2.5" width="13" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
    <path d="M4.5 6L6.5 8L4.5 10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    <line x1="8.5" y1="10" x2="11.5" y2="10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
  </svg>
);

// ── Domain Icons ──────────────────────────────────────────────────────────────

export const BlocksWorldIcon = ({ className = "" }: IconProps) => (
  <svg viewBox="0 0 16 16" fill="none" className={className}>
    {/* Isometric cube */}
    <path d="M8 2L13 4.8V9.6L8 12.5L3 9.6V4.8L8 2Z" stroke="currentColor" strokeWidth="1.15" strokeLinejoin="round" />
    {/* Internal iso lines */}
    <line x1="3" y1="4.8" x2="8" y2="7.6" stroke="currentColor" strokeWidth="0.85" strokeOpacity="0.45" />
    <line x1="13" y1="4.8" x2="8" y2="7.6" stroke="currentColor" strokeWidth="0.85" strokeOpacity="0.45" />
    <line x1="8" y1="7.6" x2="8" y2="12.5" stroke="currentColor" strokeWidth="0.85" strokeOpacity="0.45" />
    {/* Ground shadow */}
    <line x1="5" y1="13.5" x2="11" y2="13.5" stroke="currentColor" strokeWidth="0.8" strokeLinecap="round" strokeOpacity="0.25" />
  </svg>
);

export const GripperIcon = ({ className = "" }: IconProps) => (
  <svg viewBox="0 0 16 16" fill="none" className={className}>
    {/* Arm shaft */}
    <line x1="8" y1="1.5" x2="8" y2="5.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    {/* Joint */}
    <circle cx="8" cy="5.5" r="1.3" stroke="currentColor" strokeWidth="1.1" />
    {/* Left jaw */}
    <path d="M8 7C5.8 7 4 8.2 4 9.8C4 11.2 5.2 12.2 7 12.2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    <path d="M7 12.2L6.5 13" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
    {/* Right jaw */}
    <path d="M8 7C10.2 7 12 8.2 12 9.8C12 11.2 10.8 12.2 9 12.2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    <path d="M9 12.2L9.5 13" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
    {/* Fingertips */}
    <path d="M5.5 13C6 13.3 6.5 13.5 7 13" stroke="currentColor" strokeWidth="0.9" strokeLinecap="round" />
    <path d="M10.5 13C10 13.3 9.5 13.5 9 13" stroke="currentColor" strokeWidth="0.9" strokeLinecap="round" />
  </svg>
);

export const DepotIcon = ({ className = "" }: IconProps) => (
  <svg viewBox="0 0 16 16" fill="none" className={className}>
    {/* Warehouse roof */}
    <path d="M1.5 7L8 3.5L14.5 7" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" strokeLinecap="round" />
    {/* Walls */}
    <path d="M1.5 7V13.5H14.5V7" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
    {/* Loading door */}
    <rect x="6" y="9" width="4" height="4.5" rx="0.4" stroke="currentColor" strokeWidth="1.1" />
    {/* Windows */}
    <rect x="2.5" y="8" width="2.5" height="2" rx="0.3" stroke="currentColor" strokeWidth="0.9" strokeOpacity="0.55" />
    <rect x="11" y="8" width="2.5" height="2" rx="0.3" stroke="currentColor" strokeWidth="0.9" strokeOpacity="0.55" />
    {/* Direction arrow on roof */}
    <path d="M11 4L12.5 5.5L14.5 4" stroke="currentColor" strokeWidth="0.9" strokeLinecap="round" strokeLinejoin="round" strokeOpacity="0.6" />
  </svg>
);

export const HanoiIcon = ({ className = "" }: IconProps) => (
  <svg viewBox="0 0 16 16" fill="none" className={className}>
    {/* Base bar */}
    <rect x="1" y="12.5" width="14" height="1.5" rx="0.5" fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeWidth="0.9" />
    {/* Pegs */}
    <line x1="3.5" y1="3" x2="3.5" y2="12.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeOpacity="0.65" />
    <line x1="8" y1="3" x2="8" y2="12.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeOpacity="0.65" />
    <line x1="12.5" y1="3" x2="12.5" y2="12.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeOpacity="0.65" />
    {/* Discs on left peg (largest → smallest) */}
    <rect x="0.5" y="10.5" width="6" height="1.7" rx="0.5" stroke="currentColor" strokeWidth="1" />
    <rect x="1.2" y="8.5" width="4.6" height="1.7" rx="0.5" stroke="currentColor" strokeWidth="1" />
    <rect x="2" y="6.5" width="3" height="1.7" rx="0.5" stroke="currentColor" strokeWidth="1" />
  </svg>
);

export const RoverIcon = ({ className = "" }: IconProps) => (
  <svg viewBox="0 0 16 16" fill="none" className={className}>
    {/* Body */}
    <rect x="3.5" y="5" width="9" height="5" rx="1" stroke="currentColor" strokeWidth="1.2" />
    {/* Solar panels */}
    <rect x="0.5" y="4.2" width="2.5" height="1.8" rx="0.35" stroke="currentColor" strokeWidth="0.95" strokeOpacity="0.65" />
    <rect x="13" y="4.2" width="2.5" height="1.8" rx="0.35" stroke="currentColor" strokeWidth="0.95" strokeOpacity="0.65" />
    <line x1="3" y1="5.1" x2="3.5" y2="5.8" stroke="currentColor" strokeWidth="0.8" />
    <line x1="13" y1="5.1" x2="12.5" y2="5.8" stroke="currentColor" strokeWidth="0.8" />
    {/* Wheels */}
    <circle cx="5" cy="11.3" r="1.5" stroke="currentColor" strokeWidth="1.15" />
    <circle cx="8" cy="11.6" r="1.2" stroke="currentColor" strokeWidth="1" strokeOpacity="0.7" />
    <circle cx="11" cy="11.3" r="1.5" stroke="currentColor" strokeWidth="1.15" />
    {/* Antenna */}
    <line x1="8.5" y1="5" x2="10.5" y2="2.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
    <circle cx="10.8" cy="2.2" r="0.7" fill="currentColor" fillOpacity="0.9" />
    {/* Camera */}
    <circle cx="5.5" cy="7.5" r="1" stroke="currentColor" strokeWidth="0.9" strokeOpacity="0.5" />
  </svg>
);

export const SatelliteIcon = ({ className = "" }: IconProps) => (
  <svg viewBox="0 0 16 16" fill="none" className={className}>
    {/* Orbital path */}
    <ellipse cx="8" cy="8" rx="6.5" ry="4" stroke="currentColor" strokeWidth="0.9"
      strokeDasharray="1.5 2" strokeOpacity="0.3" />
    {/* Body */}
    <rect x="6.5" y="6.5" width="3" height="3" rx="0.6" stroke="currentColor" strokeWidth="1.2" />
    {/* Solar panels */}
    <rect x="2.5" y="7" width="3.5" height="2" rx="0.35" stroke="currentColor" strokeWidth="1" />
    <rect x="10" y="7" width="3.5" height="2" rx="0.35" stroke="currentColor" strokeWidth="1" />
    <line x1="6" y1="8" x2="6.5" y2="8" stroke="currentColor" strokeWidth="0.9" />
    <line x1="10" y1="8" x2="9.5" y2="8" stroke="currentColor" strokeWidth="0.9" />
    {/* Signal arcs */}
    <path d="M8 4C5.2 4 3 5.8 3 8" stroke="currentColor" strokeWidth="0.85" strokeLinecap="round" strokeOpacity="0.4" />
    <path d="M8 2C4.1 2 1 4.7 1 8.5" stroke="currentColor" strokeWidth="0.7" strokeLinecap="round" strokeOpacity="0.22" />
  </svg>
);

export const PlusIcon = ({ className = "" }: IconProps) => (
  <svg viewBox="0 0 16 16" fill="none" className={className}>
    <line x1="8" y1="3" x2="8" y2="13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <line x1="3" y1="8" x2="13" y2="8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

export const SparklesIcon = ({ className = "" }: IconProps) => (
  <svg viewBox="0 0 16 16" fill="none" className={className}>
    <path d="M8 2L9 5.5L12.5 6.5L9 7.5L8 11L7 7.5L3.5 6.5L7 5.5L8 2Z"
      stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" fill="currentColor" fillOpacity="0.15" />
    <path d="M12.5 10L13 11.5L14.5 12L13 12.5L12.5 14L12 12.5L10.5 12L12 11.5L12.5 10Z"
      stroke="currentColor" strokeWidth="0.9" strokeLinejoin="round" strokeOpacity="0.7" />
    <path d="M3.5 2L4 3L5 3.5L4 4L3.5 5L3 4L2 3.5L3 3L3.5 2Z"
      stroke="currentColor" strokeWidth="0.8" strokeLinejoin="round" strokeOpacity="0.5" />
  </svg>
);

export const LayersIcon = ({ className = "" }: IconProps) => (
  <svg viewBox="0 0 16 16" fill="none" className={className}>
    <path d="M8 1.5L14 5L8 8.5L2 5L8 1.5Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
    <path d="M2 8.5L8 12L14 8.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" strokeOpacity="0.6" />
    <path d="M2 11L8 14.5L14 11" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" strokeOpacity="0.35" />
  </svg>
);

// ── Brand / LLM provider marks (official logos) ─────────────────────────────────

// Anthropic Claude mark — rendered in brand terracotta.
export const ClaudeIcon = ({ className = "" }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} fill="#D97757" xmlns="http://www.w3.org/2000/svg">
    <path d="m4.7144 15.9555 4.7174-2.6471.079-.2307-.079-.1275h-.2307l-.7893-.0486-2.6956-.0729-2.3375-.0971-2.2646-.1214-.5707-.1215-.5343-.7042.0546-.3522.4797-.3218.686.0608 1.5179.1032 2.2767.1578 1.6514.0972 2.4468.255h.3886l.0546-.1579-.1336-.0971-.1032-.0972L6.973 9.8356l-2.55-1.6879-1.3356-.9714-.7225-.4918-.3643-.4614-.1578-1.0078.6557-.7225.8803.0607.2246.0607.8925.686 1.9064 1.4754 2.4893 1.8336.3643.3035.1457-.1032.0182-.0728-.164-.2733-1.3539-2.4467-1.445-2.4893-.6435-1.032-.17-.6194c-.0607-.255-.1032-.4674-.1032-.7285L6.287.1335 6.6997 0l.9957.1336.419.3642.6192 1.4147 1.0018 2.2282 1.5543 3.0296.4553.8985.2429.8318.091.255h.1579v-.1457l.1275-1.706.2368-2.0947.2307-2.6957.0789-.7589.3764-.9107.7468-.4918.5828.2793.4797.686-.0668.4433-.2853 1.8517-.5586 2.9021-.3643 1.9429h.2125l.2429-.2429.9835-1.3053 1.6514-2.0643.7286-.8196.85-.9046.5464-.4311h1.0321l.759 1.1293-.34 1.1657-1.0625 1.3478-.8804 1.1414-1.2628 1.7-.7893 1.36.0729.1093.1882-.0183 2.8535-.607 1.5421-.2794 1.8396-.3157.8318.3886.091.3946-.3278.8075-1.967.4857-2.3072.4614-3.4364.8136-.0425.0304.0486.0607 1.5482.1457.6618.0364h1.621l3.0175.2247.7892.522.4736.6376-.079.4857-1.2142.6193-1.6393-.3886-3.825-.9107-1.3113-.3279h-.1822v.1093l1.0929 1.0686 2.0035 1.8092 2.5075 2.3314.1275.5768-.3218.4554-.34-.0486-2.2039-1.6575-.85-.7468-1.9246-1.621h-.1275v.17l.4432.6496 2.3436 3.5214.1214 1.0807-.17.3521-.6071.2125-.6679-.1214-1.3721-1.9246L14.38 17.959l-1.1414-1.9428-.1397.079-.674 7.2552-.3156.3703-.7286.2793-.6071-.4614-.3218-.7468.3218-1.4753.3886-1.9246.3157-1.53.2853-1.9004.17-.6314-.0121-.0425-.1397.0182-1.4328 1.9672-2.1796 2.9446-1.7243 1.8456-.4128.164-.7164-.3704.0667-.6618.4008-.5889 2.386-3.0357 1.4389-1.882.929-1.0868-.0062-.1579h-.0546l-6.3385 4.1164-1.1293.1457-.4857-.4554.0608-.7467.2307-.2429 1.9064-1.3114Z" />
  </svg>
);

// Google Gemini mark — rendered with the brand blue→purple gradient.
export const GeminiIcon = ({ className = "" }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="gemini-brand-gradient" x1="0" y1="24" x2="24" y2="0" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="#4285F4" />
        <stop offset="0.52" stopColor="#9B72CB" />
        <stop offset="1" stopColor="#D96570" />
      </linearGradient>
    </defs>
    <path fill="url(#gemini-brand-gradient)" d="M11.04 19.32Q12 21.51 12 24q0-2.49.93-4.68.96-2.19 2.58-3.81t3.81-2.55Q21.51 12 24 12q-2.49 0-4.68-.93a12.3 12.3 0 0 1-3.81-2.58 12.3 12.3 0 0 1-2.58-3.81Q12 2.49 12 0q0 2.49-.96 4.68-.93 2.19-2.55 3.81a12.3 12.3 0 0 1-3.81 2.58Q2.49 12 0 12q2.49 0 4.68.96 2.19.93 3.81 2.55t2.55 3.81" />
  </svg>
);
