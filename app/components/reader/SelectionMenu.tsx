"use client";

import type { ReactNode } from "react";
import { Copy, Highlighter, PenLine, Play } from "lucide-react";
import type { Theme } from "@/stores/reader-store";

type Props = {
  top: number;
  left: number;
  /** Drives the pill's invert-against-the-page treatment below — not read
   * from the reader's own CSS theme vars, since this deliberately goes the
   * *opposite* direction of the page it floats over. */
  theme: Theme;
  copyLabel: string;
  /** Omitted entirely when the book has no narrator — no Play option is
   * shown, rather than one that would fall back to a live-TTS voice. */
  onPlay?: () => void;
  onHighlight: () => void;
  onNote: () => void;
  onCopy: () => void;
  onDismiss: () => void;
};

type Item = { key: string; icon: ReactNode; label: string; onClick: () => void };

/**
 * Selection menu (Play/Highlight/Note/Copy) shown on text selection. A
 * fixed-position overlay rendered outside BookContent's scrollable tree, so
 * selecting text never forces the (memoized) book content to re-render.
 * No Share — sharing is out of scope for now (per product decision).
 *
 * Inverts against the reading page (note-redesign.md): a light page gets a
 * near-black pill, a dark page gets a near-white one — the same idiom as a
 * native OS tooltip landing on arbitrary content, and it guarantees contrast
 * regardless of what's behind it without needing per-theme tuning.
 */
export default function SelectionMenu({
  top,
  left,
  theme,
  copyLabel,
  onPlay,
  onHighlight,
  onNote,
  onCopy,
  onDismiss,
}: Props) {
  const inverted = theme === "light";
  const bg = inverted ? "#0a0a0a" : "#fdfbf8";
  const fg = inverted ? "#fdfbf8" : "#0a0a0a";
  const divider = inverted ? "rgba(255,255,255,.15)" : "rgba(0,0,0,.12)";
  const shadow = inverted ? "var(--shadow-md)" : "var(--shadow-lg)";

  const items: Item[] = [
    ...(onPlay
      ? [{ key: "play", icon: <Play size={14} fill="currentColor" stroke="none" />, label: "Play", onClick: onPlay }]
      : []),
    { key: "highlight", icon: <Highlighter size={14} />, label: "Highlight", onClick: onHighlight },
    { key: "note", icon: <PenLine size={14} />, label: "Note", onClick: onNote },
    { key: "copy", icon: <Copy size={14} />, label: copyLabel, onClick: onCopy },
  ];

  return (
    <>
      {/* Transparent click-outside catcher — the selection menu previously
          had no dismiss path besides its own buttons (unlike every other
          popover in this file), so it stuck around after the reader clicked
          away or moved on. */}
      <div onClick={onDismiss} className="fixed inset-0 z-29" />
      <div
        style={{ top, left, background: bg, boxShadow: shadow }}
        className="reader-menu-in fixed flex items-center gap-px rounded-full p-1.25 z-30"
      >
        <div style={{ background: bg }} className="absolute -bottom-1 left-5 w-2 h-2 rotate-45 rounded-xs" />
        {items.map((item, i) => (
          <div key={item.key} className="flex items-center">
            {i > 0 && <div style={{ background: divider }} className="w-px h-4 mx-0.5 flex-none" />}
            <button
              onClick={item.onClick}
              style={{ color: fg }}
              className="flex items-center gap-1.5 bg-transparent border-none py-1.75 px-3 rounded-full cursor-pointer text-xs font-semibold whitespace-nowrap"
            >
              {item.icon}
              {item.label}
            </button>
          </div>
        ))}
      </div>
    </>
  );
}
