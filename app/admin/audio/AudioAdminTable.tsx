"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Circle,
  Loader2,
  Mic,
  Pause,
  Play,
  RefreshCw,
} from "lucide-react";
import { generateBookAudio } from "./actions";
import type { AudioStatus } from "@/lib/audio/status";

export type AudioAdminRow = {
  slug: string;
  title: string;
  author: string;
  cover: string;
  status: AudioStatus;
  previewSrc?: string;
};

const STATUS_STYLE: Record<AudioStatus, string> = {
  none: "text-[var(--reader-text-muted)] bg-[var(--reader-surface-hover)]",
  partial: "text-amber-700 bg-amber-50 dark:text-amber-400 dark:bg-amber-500/10",
  ready: "text-emerald-700 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-500/10",
};

const STATUS_LABEL: Record<AudioStatus, string> = {
  none: "Not generated",
  partial: "Partial",
  ready: "Ready",
};

const STATUS_ICON: Record<AudioStatus, React.ReactNode> = {
  none: <Circle size={12} />,
  partial: <AlertTriangle size={12} />,
  ready: <CheckCircle2 size={12} />,
};

export default function AudioAdminTable({ books }: { books: AudioAdminRow[] }) {
  const [rows, setRows] = useState(books);
  const [pendingSlug, setPendingSlug] = useState<string | null>(null);
  const [playingSlug, setPlayingSlug] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [, startTransition] = useTransition();
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onEnded = () => setPlayingSlug(null);
    audio.addEventListener("ended", onEnded);
    return () => audio.removeEventListener("ended", onEnded);
  }, []);

  const onTogglePreview = (row: AudioAdminRow) => {
    const audio = audioRef.current;
    if (!audio || !row.previewSrc) return;
    if (playingSlug === row.slug) {
      audio.pause();
      setPlayingSlug(null);
      return;
    }
    audio.src = row.previewSrc;
    audio.play();
    setPlayingSlug(row.slug);
  };

  const onGenerate = (slug: string) => {
    if (playingSlug === slug) {
      audioRef.current?.pause();
      setPlayingSlug(null);
    }
    setPendingSlug(slug);
    setErrors((e) => ({ ...e, [slug]: "" }));
    startTransition(async () => {
      const result = await generateBookAudio(slug);
      setPendingSlug(null);
      if (!result.ok) {
        setErrors((e) => ({ ...e, [slug]: result.error }));
        return;
      }
      setRows((rs) => rs.map((r) => (r.slug === slug ? { ...r, status: "ready" } : r)));
    });
  };

  return (
    <div className="rounded-2xl border border-[var(--reader-border)] bg-[var(--reader-surface)] overflow-hidden">
      <audio ref={audioRef} className="hidden" />
      <ul>
        {rows.map((row, i) => {
          const isPending = pendingSlug === row.slug;
          const isPlaying = playingSlug === row.slug;
          const error = errors[row.slug];
          return (
            <li
              key={row.slug}
              className={`group flex items-center gap-4 px-4 py-3 hover:bg-[var(--reader-surface-hover)] transition-colors ${
                i < rows.length - 1 ? "border-b border-[var(--reader-border)]" : ""
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- content-library thumbnail, not an app asset */}
              <img
                src={row.cover}
                alt=""
                className="w-9 h-12 flex-none rounded-sm object-cover bg-[var(--reader-surface-hover)] shadow-sm"
              />

              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-[var(--reader-text)] truncate">
                  {row.title}
                </div>
                <div className="text-xs text-[var(--reader-text-muted)] truncate">{row.author}</div>
                {error && (
                  <div className="flex items-start gap-1 text-xs text-red-600 mt-1 max-w-md">
                    <AlertCircle size={12} className="mt-0.5 flex-none" />
                    <span>{error}</span>
                  </div>
                )}
              </div>

              <span
                className={`hidden sm:inline-flex items-center gap-1.5 text-xs font-medium rounded-full px-2.5 py-1 flex-none ${STATUS_STYLE[row.status]}`}
              >
                {STATUS_ICON[row.status]}
                {STATUS_LABEL[row.status]}
              </span>

              <div className="flex items-center gap-1.5 flex-none">
                <button
                  onClick={() => onTogglePreview(row)}
                  disabled={!row.previewSrc}
                  title={row.previewSrc ? "Preview narration" : "No audio to preview yet"}
                  className="w-8 h-8 rounded-full flex items-center justify-center flex-none text-[var(--reader-text)] cursor-pointer disabled:opacity-25 disabled:cursor-default hover:bg-[var(--reader-border)] transition-colors"
                >
                  {isPlaying ? <Pause size={14} /> : <Play size={14} className="ml-0.5" />}
                </button>
                <button
                  onClick={() => onGenerate(row.slug)}
                  disabled={isPending}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-brand-500 text-sand-25 text-xs font-medium cursor-pointer disabled:opacity-50 disabled:cursor-default hover:opacity-90 transition-opacity"
                >
                  {isPending ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : row.status === "none" ? (
                    <Mic size={13} />
                  ) : (
                    <RefreshCw size={13} />
                  )}
                  <span className="hidden md:inline">
                    {isPending ? "Generating…" : row.status === "none" ? "Generate" : "Regenerate"}
                  </span>
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
