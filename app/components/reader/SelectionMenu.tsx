"use client";

import { Copy, Highlighter, MessageCircle, Play, Share2 } from "lucide-react";

type Props = {
  top: number;
  left: number;
  copyLabel: string;
  /** Omitted entirely when the book has no narrator — no Play option is
   * shown, rather than one that would fall back to a live-TTS voice. */
  onPlay?: () => void;
  onHighlight: () => void;
  onNote: () => void;
  onShare: () => void;
  onCopy: () => void;
  onDismiss: () => void;
};

/**
 * Selection menu (Play/Highlight/Note/Share/Copy) shown on text selection. A
 * fixed-position overlay rendered outside BookContent's scrollable tree, so
 * selecting text never forces the (memoized) book content to re-render.
 */
export default function SelectionMenu({ top, left, copyLabel, onPlay, onHighlight, onNote, onShare, onCopy, onDismiss }: Props) {
  return (
    <>
      {/* Transparent click-outside catcher — the selection menu previously
          had no dismiss path besides its own buttons (unlike every other
          popover in this file), so it stuck around after the reader clicked
          away or moved on. */}
      <div onClick={onDismiss} className="fixed inset-0 z-29" />
      <div
        style={{ top, left }}
        className="fixed flex items-center bg-[var(--reader-surface)] border border-[var(--reader-border)] rounded-md shadow-lg overflow-hidden z-30"
      >
        {onPlay && (
          <button
            onClick={onPlay}
            className="flex items-center gap-1.5 bg-transparent border-none text-[var(--reader-text)] py-2.5 px-3.5 cursor-pointer text-sm border-r border-[var(--reader-border)]"
          >
            <Play size={14} />
            Play
          </button>
        )}
        <button
          onClick={onHighlight}
          className="flex items-center gap-1.5 bg-transparent border-none text-[var(--reader-text)] py-2.5 px-3.5 cursor-pointer text-sm border-r border-[var(--reader-border)]"
        >
          <Highlighter size={14} />
          Highlight
        </button>
        <button
          onClick={onNote}
          className="flex items-center gap-1.5 bg-transparent border-none text-[var(--reader-text)] py-2.5 px-3.5 cursor-pointer text-sm border-r border-[var(--reader-border)]"
        >
          <MessageCircle size={14} />
          Note
        </button>
        <button
          onClick={onShare}
          className="flex items-center gap-1.5 bg-transparent border-none text-[var(--reader-text)] py-2.5 px-3.5 cursor-pointer text-sm border-r border-[var(--reader-border)]"
        >
          <Share2 size={14} />
          Share
        </button>
        <button
          onClick={onCopy}
          className="flex items-center gap-1.5 bg-transparent border-none text-[var(--reader-text)] py-2.5 px-3.5 cursor-pointer text-sm"
        >
          <Copy size={14} />
          {copyLabel}
        </button>
      </div>
    </>
  );
}
