"use client";

import { useEffect, useState } from "react";
import { Check, Pause, Play, RotateCcw, RotateCw, User, X } from "lucide-react";
import { useAudioStore } from "@/stores/audio-store";
import { formatDuration } from "@/utils/text";
import type { NarratorOption } from "@/lib/reader/useReaderNarration";

const SPEEDS = [0.75, 1, 1.25, 1.5, 1.75, 2];

type Props = {
  variant?: "full" | "mini";
  bookTitle: string;
  chapterLabel: string;
  coverSrc: string;
  /** Only the first entry is ever narrated (per product decision — one
   * narration per book for now); kept as an array rather than a single
   * value since `book.narrators`/`narratorTracks` stay array-shaped in the
   * schema for when multi-narrator selection is re-enabled. */
  narrators: NarratorOption[];
  durationMs: number;
  /** Routes through the caller instead of the store's seekTo directly — for
   * TTS-driven playback there's no real audio timeline to scrub, so Reader
   * resyncs the speech engine to the nearest passage on seek. This is the
   * one thing that must vary by audio source, and it lives in the caller so
   * this component never has to branch on where the audio is coming from. */
  onSeek: (ms: number) => void;
  /** Exits listen mode entirely (distinct from pause) — resume position is
   * left untouched in library-store, so reopening the player later picks
   * up where playback left off instead of restarting. */
  onClose?: () => void;
};

export default function AudioPlayer({
  variant = "full",
  bookTitle,
  chapterLabel,
  coverSrc,
  narrators,
  durationMs,
  onSeek,
  onClose,
}: Props) {
  const isMini = variant === "mini";
  const isPlaying = useAudioStore((s) => s.isPlaying);
  const currentTimeMs = useAudioStore((s) => s.currentTimeMs);
  const speed = useAudioStore((s) => s.speed);
  const toggle = useAudioStore((s) => s.toggle);
  const setSpeed = useAudioStore((s) => s.setSpeed);

  const [speedMenuOpen, setSpeedMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 720);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const duration = durationMs / 1000;
  const time = Math.min(currentTimeMs / 1000, duration);
  const progress = duration > 0 ? time / duration : 0;
  const withHours = duration >= 3600;

  const selectedNarrator = narrators[0];

  const onScrub = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    onSeek(Math.round(pct * duration * 1000));
  };

  const coverSize = isMini ? "w-8 h-8" : isMobile ? "w-9 h-9" : "w-10 h-10";
  const trackPad = isMini ? "px-4 pt-2" : isMobile ? "px-3.5 pt-2" : "px-6 pt-2.5";
  const controlsPad = isMini ? "px-4 pb-2" : isMobile ? "px-3.5 pb-2.5" : "px-6 pb-3";
  const playSize = isMini ? "w-8.5 h-8.5" : "w-10.5 h-10.5";

  return (
    <div className="w-full h-full box-border relative flex flex-col justify-center bg-[var(--reader-surface)] border-t border-[var(--reader-border)]">
      {onClose && (
        <button
          onClick={onClose}
          title="Close player"
          className="absolute -top-3 right-3 z-10 w-7 h-7 rounded-full bg-[var(--reader-surface)] border border-[var(--reader-border)] shadow-sm cursor-pointer flex items-center justify-center text-[var(--reader-text-muted)]"
        >
          <X size={14} />
        </button>
      )}
      {/* Progress track */}
      <div className={`flex items-center gap-2.5 ${trackPad}`}>
        <span className="text-[11px] font-medium text-[var(--reader-text-muted)] flex-none tabular-nums">
          {formatDuration(time, withHours)}
        </span>
        <div onClick={onScrub} className="flex-1 h-4 flex items-center cursor-pointer">
          <div className="w-full h-1 rounded-full bg-[var(--reader-border)] overflow-hidden">
            <div
              className="h-full bg-brand-500 rounded-full"
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </div>
        </div>
        <span className="text-[11px] font-medium text-[var(--reader-text-muted)] flex-none tabular-nums">
          -{formatDuration(duration - time, withHours)}
        </span>
      </div>

      {/* Controls row */}
      <div className={`flex items-center box-border gap-3 ${controlsPad}`}>
        {!isMobile ? (
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <img src={coverSrc} alt="cover" className={`${coverSize} object-cover rounded-xs flex-none`} />
            <div className="min-w-0">
              <div className="text-sm font-semibold text-[var(--reader-text)] whitespace-nowrap overflow-hidden text-ellipsis">
                {bookTitle}
              </div>
              <div className="text-xs font-medium text-[var(--reader-text-muted)] whitespace-nowrap overflow-hidden text-ellipsis">
                {chapterLabel}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1" />
        )}

        <div className="flex items-center gap-1.5 flex-none">
          <button
            onClick={() => onSeek(currentTimeMs - 15_000)}
            className="relative bg-transparent border-none cursor-pointer text-[var(--reader-text)] w-8 h-8 flex items-center justify-center"
          >
            <RotateCcw size={19} />
            <span className="absolute text-[7px] font-bold">15</span>
          </button>
          <button
            onClick={toggle}
            className={`${playSize} rounded-full bg-brand-500 border-none cursor-pointer flex items-center justify-center flex-none text-sand-25`}
          >
            {isPlaying ? <Pause size={isMini ? 15 : 18} /> : <Play size={isMini ? 15 : 18} />}
          </button>
          <button
            onClick={() => onSeek(currentTimeMs + 15_000)}
            className="relative bg-transparent border-none cursor-pointer text-[var(--reader-text)] w-8 h-8 flex items-center justify-center"
          >
            <RotateCw size={19} />
            <span className="absolute text-[7px] font-bold">15</span>
          </button>
          {!isMobile && (
            <button
              onClick={() => setSpeedMenuOpen((o) => !o)}
              className="bg-transparent border-none cursor-pointer text-sm font-medium text-[var(--reader-text)] flex-none ml-1"
            >
              {speed}x
            </button>
          )}
        </div>

        {!isMobile && (
          <div className="flex items-center justify-end min-w-0 flex-1">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xs text-[var(--reader-text-muted)] whitespace-nowrap overflow-hidden text-ellipsis">
                Read by{" "}
                <span className="font-semibold text-[var(--reader-text)]">
                  {selectedNarrator?.name}
                </span>
              </span>
              <div className="w-7 h-7 rounded-full bg-[var(--reader-surface-hover)] flex items-center justify-center flex-none overflow-hidden">
                {selectedNarrator?.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element -- narrator avatar, not an app asset
                  <img
                    src={selectedNarrator.avatar}
                    alt={selectedNarrator.name}
                    className="w-full h-full object-cover rounded-full"
                  />
                ) : (
                  <User size={14} className="text-[var(--reader-text-muted)]" />
                )}
              </div>
            </div>
          </div>
        )}

        {speedMenuOpen && (
          <>
            <div
              onClick={() => setSpeedMenuOpen(false)}
              className="fixed inset-0 bg-black/20 z-19"
            />
            <div className="absolute bottom-[calc(100%+8px)] left-1/2 -translate-x-1/2 w-36 bg-[var(--reader-surface)] border border-[var(--reader-border)] rounded-md shadow-lg p-3.5 z-20">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold text-[var(--reader-text)]">Speed</span>
                <span
                  onClick={() => setSpeedMenuOpen(false)}
                  className="cursor-pointer text-[var(--reader-text-muted)]"
                >
                  <X size={16} />
                </span>
              </div>
              <div className="flex flex-col gap-0.5">
                {SPEEDS.map((s) => {
                  const active = s === speed;
                  return (
                    <div
                      key={s}
                      onClick={() => {
                        setSpeed(s);
                        setSpeedMenuOpen(false);
                      }}
                      className={`flex items-center justify-between py-2 px-2.5 rounded-sm cursor-pointer ${
                        active ? "bg-[var(--reader-surface-hover)]" : ""
                      }`}
                    >
                      <span className="text-sm text-[var(--reader-text)]">{s}x</span>
                      {active && <Check size={16} className="text-brand-500 flex-none" />}
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
