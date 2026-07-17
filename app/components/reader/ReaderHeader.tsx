"use client";

import Link from "next/link";
import { ArrowLeft, BookOpen, CaseSensitive, Pause, Play, Search, Users } from "lucide-react";
import { READING_NOW_PLACEHOLDER } from "@/lib/reader/constants";

type Props = {
  visible: boolean;
  topBarHeightPx: number;
  railInsetPx: number;
  bookTitle: string;
  bookAuthor: string;
  currentSectionLabel: string | null;
  chaptersOpen: boolean;
  onToggleChapters: () => void;
  /** No listen button at all when the book has no narrator — not even a
   * disabled one, per product decision: there's nothing for it to do. */
  hasNarration: boolean;
  isListen: boolean;
  audioPlaying: boolean;
  onToggleMode: () => void;
  onDoubleClickPlay: () => void;
  onToggleSearch: () => void;
  typographyOpen: boolean;
  onOpenTypography: (rect: DOMRect) => void;
};

/**
 * Header — back arrow and outline/chapters toggle on the left, beside a
 * book-title / current-section-subtitle block; reading-now, listen,
 * search, and typography clustered on the right. Replaces the old separate
 * top bar + floating left icon rail: with the reader now a section-per-page
 * carousel, the chapters drawer's own `%` complete progress bar is the sole
 * progress indicator — no page count lives here.
 */
export default function ReaderHeader({
  visible,
  topBarHeightPx,
  railInsetPx,
  bookTitle,
  bookAuthor,
  currentSectionLabel,
  chaptersOpen,
  onToggleChapters,
  hasNarration,
  isListen,
  audioPlaying,
  onToggleMode,
  onDoubleClickPlay,
  onToggleSearch,
  typographyOpen,
  onOpenTypography,
}: Props) {
  return (
    <div
      style={{ height: topBarHeightPx, paddingLeft: railInsetPx, paddingRight: railInsetPx }}
      className={`absolute top-0 left-0 right-0 z-20 flex items-center gap-2 box-border transition-[transform,opacity] duration-200 ease-out ${
        visible ? "translate-y-0 opacity-100" : "-translate-y-full opacity-0 pointer-events-none"
      }`}
    >
      <Link
        href="/"
        title="Back to library"
        className="w-9 h-9 rounded-md border border-[var(--reader-border)] bg-[var(--reader-surface)] flex items-center justify-center text-[var(--reader-text)] no-underline flex-none"
      >
        <ArrowLeft size={18} />
      </Link>

      <button
        onClick={onToggleChapters}
        title="Chapters"
        className="min-w-0 flex-1 flex items-center gap-2 border-none bg-transparent cursor-pointer text-left"
      >
        <span
          className={`w-9 h-9 rounded-md flex items-center justify-center flex-none ${
            chaptersOpen ? "bg-brand-500/10 text-brand-500" : "text-[var(--reader-text)]"
          }`}
        >
          <BookOpen size={18} />
        </span>

        <div className="min-w-0 max-w-60 flex flex-col justify-center leading-tight">
          <div className="text-sm font-semibold text-[var(--reader-text)] truncate">{bookTitle}</div>
          {/* {currentSectionLabel && (
            <div className="text-xs text-[var(--reader-text-muted)] truncate">{currentSectionLabel}</div>
          )} */}
          {bookAuthor && (
            <div className="text-xs text-[var(--reader-text-muted)] truncate">{bookAuthor}</div>
          )}
        </div>
      </button>

      <div className="flex items-center gap-1.5 text-xs font-medium text-[var(--reader-text-muted)] flex-none">
        <Users size={14} />
        {READING_NOW_PLACEHOLDER} reading now
      </div>

      {hasNarration && (
        <button
          onClick={onToggleMode}
          onDoubleClick={onDoubleClickPlay}
          title={isListen ? "Listening — tap to switch to reading" : "Listen to this book"}
          className={`w-9 h-9 rounded-full border-none cursor-pointer flex items-center justify-center flex-none ${
            isListen && audioPlaying ? "bg-brand-500" : "bg-transparent text-[var(--reader-text)]"
          }`}
        >
          {isListen && audioPlaying ? <Pause size={18} className="text-white" /> : <Play size={18} />}
        </button>
      )}

      <button
        onClick={onToggleSearch}
        title="Search"
        className="w-9 h-9 rounded-md border-none bg-transparent cursor-pointer flex items-center justify-center flex-none text-[var(--reader-text)]"
      >
        <Search size={18} />
      </button>

      <button
        onClick={(e) => onOpenTypography(e.currentTarget.getBoundingClientRect())}
        title="Typography"
        className={`w-9 h-9 rounded-md border-none cursor-pointer flex items-center justify-center flex-none font-bold text-[15px] font-serif ${
          typographyOpen ? "bg-brand-500/10 text-brand-500" : "bg-transparent text-[var(--reader-text)]"
        }`}
      >
        <CaseSensitive size={18} />
      </button>
    </div>
  );
}
