import { useCallback, useEffect, useRef, useState } from "react";

interface UsePlaybackArgs {
  /** Number of states in the current plan (renderedStates.length). */
  totalStates: number;
  /** Setter for the currently displayed state index, owned by the parent. */
  setCurrentStateIndex: React.Dispatch<React.SetStateAction<number>>;
}

export interface Playback {
  isPlaying: boolean;
  playbackSpeed: number;
  setPlaybackSpeed: React.Dispatch<React.SetStateAction<number>>;
  /** Start autoplay. */
  play: () => void;
  /** Pause autoplay (alias of stop). */
  pause: () => void;
  /** Stop autoplay and clear the interval — safe to call from anywhere. */
  stop: () => void;
  /** Advance one state (clamped to the last). */
  next: () => void;
  /** Go back one state (clamped to the first). */
  previous: () => void;
}

/**
 * Owns autoplay state (isPlaying, playbackSpeed) and the interval that advances
 * the current state. The interval is recreated whenever isPlaying or
 * playbackSpeed changes, so changing the speed mid-playback takes effect
 * immediately rather than being stuck with the speed captured at play time.
 */
export function usePlayback({ totalStates, setCurrentStateIndex }: UsePlaybackArgs): Playback {
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1000);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setCurrentStateIndex((prev) => {
        if (prev >= totalStates - 1) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, playbackSpeed);
    intervalRef.current = interval;
    return () => {
      clearInterval(interval);
      if (intervalRef.current === interval) intervalRef.current = null;
    };
  }, [isPlaying, playbackSpeed, totalStates, setCurrentStateIndex]);

  const stop = useCallback(() => {
    setIsPlaying(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const play = useCallback(() => setIsPlaying(true), []);
  const next = useCallback(
    () => setCurrentStateIndex((p) => Math.min(p + 1, totalStates - 1)),
    [totalStates, setCurrentStateIndex]
  );
  const previous = useCallback(
    () => setCurrentStateIndex((p) => Math.max(p - 1, 0)),
    [setCurrentStateIndex]
  );

  return { isPlaying, playbackSpeed, setPlaybackSpeed, play, pause: stop, stop, next, previous };
}
