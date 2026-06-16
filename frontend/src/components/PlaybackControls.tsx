import { useEffect, useState } from "react";
import { motion, useMotionValue, useMotionValueEvent, animate as motionAnimate } from "framer-motion";
import { PlayIcon, PauseIcon, SkipForwardIcon, SkipBackIcon } from "@/components/Icons";

const easeOut: [number, number, number, number] = [0.23, 1, 0.32, 1];

/** A number that smoothly counts up/down to its target value. */
const AnimatedNumber = ({ value }: { value: number }) => {
  const mv = useMotionValue(value);
  const [display, setDisplay] = useState(value);
  useMotionValueEvent(mv, "change", (v) => setDisplay(Math.round(v)));
  useEffect(() => {
    const ctrl = motionAnimate(mv, value, { duration: 0.4, ease: easeOut });
    return () => ctrl.stop();
  }, [value, mv]);
  return (
    <span className="tabular-nums" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
      {display}
    </span>
  );
};

interface PlaybackControlsProps {
  currentStateIndex: number;
  totalStates: number;
  isPlaying: boolean;
  playbackSpeed: number;
  onPrevious: () => void;
  onPlay: () => void;
  onPause: () => void;
  onNext: () => void;
  onSeek: (index: number) => void;
  onSpeedChange: (ms: number) => void;
}

/**
 * Transport bar for the state animation: prev/play-pause/next, a timeline
 * scrubber, the step counter, and the speed slider. Presentational — all state
 * lives in the parent (see usePlayback).
 */
export function PlaybackControls({
  currentStateIndex,
  totalStates,
  isPlaying,
  playbackSpeed,
  onPrevious,
  onPlay,
  onPause,
  onNext,
  onSeek,
  onSpeedChange,
}: PlaybackControlsProps) {
  const atStart = currentStateIndex === 0;
  const atEnd = currentStateIndex >= totalStates - 1;

  return (
    <div className="px-6 py-4 border-t border-white/[0.05] bg-black/[0.15] space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1 bg-white/[0.04] rounded-xl border border-white/[0.06] p-1">
          <motion.button onClick={onPrevious} disabled={atStart}
            whileTap={{ scale: 0.92 }}
            className="p-2.5 rounded-lg hover:bg-white/[0.06] disabled:opacity-25 transition-all duration-150">
            <SkipBackIcon className="w-4 h-4 text-slate-400" />
          </motion.button>
          {isPlaying ? (
            <motion.button onClick={onPause} whileTap={{ scale: 0.92 }}
              className="p-2.5 rounded-lg bg-green-600 text-white hover:bg-green-500 transition-all duration-150">
              <PauseIcon className="w-4 h-4" />
            </motion.button>
          ) : (
            <motion.button onClick={onPlay} disabled={atEnd}
              whileTap={{ scale: 0.92 }}
              className="p-2.5 rounded-lg bg-green-600 text-white hover:bg-green-500 disabled:opacity-25 transition-all duration-150">
              <PlayIcon className="w-4 h-4" />
            </motion.button>
          )}
          <motion.button onClick={onNext} disabled={atEnd}
            whileTap={{ scale: 0.92 }}
            className="p-2.5 rounded-lg hover:bg-white/[0.06] disabled:opacity-25 transition-all duration-150">
            <SkipForwardIcon className="w-4 h-4 text-slate-400" />
          </motion.button>
        </div>

        <div className="flex-1 px-1">
          <input type="range" min="0" max={totalStates - 1} value={currentStateIndex}
            onChange={e => onSeek(Number(e.target.value))}
            className="w-full" />
        </div>

        <div className="text-xs font-medium text-slate-500 bg-white/[0.04] px-2.5 py-1.5 rounded-lg border border-white/[0.06]"
          style={{ fontFamily: "'JetBrains Mono', monospace" }}>
          <AnimatedNumber value={currentStateIndex + 1} />
          <span className="text-slate-700"> / {totalStates}</span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <span className="text-xs text-slate-500 font-medium">Speed</span>
        <input type="range" min="200" max="2000" step="200"
          value={2200 - playbackSpeed}
          onChange={e => onSpeedChange(2200 - Number(e.target.value))}
          className="w-28" />
        <span className="text-xs text-slate-500 font-medium tabular-nums"
          style={{ fontFamily: "'JetBrains Mono', monospace" }}>{playbackSpeed}ms</span>
      </div>
    </div>
  );
}
