"use client";

import { memo } from "react";
import type { Mark, Passage } from "@/lib/book/schema";

export type NoteLookup = { id: string; marker: string; text: string };

type Segment = { text: string; mark?: Mark; wordIndex?: number };
type WordRange = { start: number; end: number };

function splitByMarks(text: string, marks: Mark[] | undefined): Segment[] {
  if (!marks || marks.length === 0) return [{ text }];
  const sorted = [...marks].sort((a, b) => a.start - b.start);
  const segments: Segment[] = [];
  let cursor = 0;
  for (const mark of sorted) {
    if (mark.start > cursor) segments.push({ text: text.slice(cursor, mark.start) });
    segments.push({ text: text.slice(mark.start, mark.end), mark });
    cursor = mark.end;
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor) });
  return segments;
}

function computeWordRanges(text: string): WordRange[] {
  const ranges: WordRange[] = [];
  const re = /\S+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    ranges.push({ start: m.index, end: m.index + m[0].length });
  }
  return ranges;
}

/** Splits text into pieces fine-grained enough to carry both mark formatting
 * (em/strong/note) and a word index for audio-sync highlighting (reader-issues
 * #7) — cutting at the union of mark and word boundaries so neither one ever
 * splits a piece the other needs whole. */
function tokenizeWithWords(text: string, marks: Mark[] | undefined, words: WordRange[]): Segment[] {
  const cuts = new Set<number>([0, text.length]);
  const sortedMarks = marks ? [...marks].sort((a, b) => a.start - b.start) : [];
  for (const mark of sortedMarks) {
    cuts.add(mark.start);
    cuts.add(mark.end);
  }
  for (const word of words) {
    cuts.add(word.start);
    cuts.add(word.end);
  }
  const points = Array.from(cuts).sort((a, b) => a - b);
  const tokens: Segment[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const start = points[i];
    const end = points[i + 1];
    if (start === end) continue;
    const mark = sortedMarks.find((m) => m.start <= start && end <= m.end);
    const wordIdx = words.findIndex((w) => w.start <= start && end <= w.end);
    tokens.push({ text: text.slice(start, end), mark, wordIndex: wordIdx >= 0 ? wordIdx : undefined });
  }
  return tokens;
}

// Theme-fitting active-narration-word highlight (reader-issues.md) —
// --reader-active-word-bg/text are per-theme tokens (app/globals.css), so
// this reads correctly across all 8 themes instead of a single hardcoded
// color. Deliberately separate from --reader-highlight (the user's own
// saved-highlight color) so "this is just what's playing" is never
// visually confused with "I highlighted this". Padding is marginal but
// present, per the request that this not look like a bare color swap.
const ACTIVE_WORD_STYLE: React.CSSProperties = {
  background: "var(--reader-active-word-bg)",
  color: "var(--reader-active-word-text)",
  borderRadius: 4,
  padding: "1px 2px",
};

function renderSegment(
  seg: Segment,
  key: number,
  notesById: Map<string, NoteLookup>,
  onNoteClick: (note: NoteLookup, target: HTMLElement) => void,
  activeWordIndex: number | undefined,
  onWordClick: ((wordIndex: number) => void) | undefined
) {
  const activeStyle =
    seg.wordIndex !== undefined && seg.wordIndex === activeWordIndex ? ACTIVE_WORD_STYLE : undefined;

  // Hover-to-preview, click-to-play-from-here — only wired up for word-
  // bearing segments (not the plain whitespace/punctuation gaps between
  // them), and only when a handler was actually passed in, so passages
  // rendered without listen-mode context stay inert.
  const wordProps =
    seg.wordIndex !== undefined && onWordClick
      ? {
          className: "reader-word-hover cursor-pointer",
          onClick: (e: React.MouseEvent) => {
            e.stopPropagation();
            onWordClick(seg.wordIndex!);
          },
        }
      : undefined;

  if (!seg.mark) return <span key={key} style={activeStyle} {...wordProps}>{seg.text}</span>;
  if (seg.mark.kind === "em") return <em key={key} style={activeStyle} {...wordProps}>{seg.text}</em>;
  if (seg.mark.kind === "strong") return <strong key={key} style={activeStyle} {...wordProps}>{seg.text}</strong>;
  if (seg.mark.kind === "note") {
    const note = seg.mark.noteId ? notesById.get(seg.mark.noteId) : undefined;
    if (!note) return <span key={key} style={activeStyle}>{seg.text}</span>;
    return (
      <button
        key={key}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onNoteClick(note, e.currentTarget);
        }}
        style={{ color: "var(--reader-note-accent)" }}
        className="inline align-super text-[0.7em] leading-none font-semibold px-0.5 bg-transparent border-none cursor-pointer"
      >
        {seg.text}
      </button>
    );
  }
  return <span key={key} style={activeStyle} {...wordProps}>{seg.text}</span>;
}

type PassageTextProps = {
  passage: Passage;
  notesById: Map<string, NoteLookup>;
  onNoteClick: (note: NoteLookup, target: HTMLElement) => void;
  /** Word index currently being narrated, for inline audio-sync highlighting
   * in the reading view itself (reader-issues #7) — omit outside listen mode. */
  activeWordIndex?: number;
  /** Hover-to-preview, click-to-start-narration-here, at word granularity.
   * Passing this (rather than only relying on activeWordIndex) is what
   * forces word-level tokenization even before anything is playing, so the
   * hover affordance is available from a standing start, not just once
   * narration is already under way. Takes the passage id (not just a word
   * index) so callers can pass one stable, book-wide function — see the
   * memo note below for why that matters. */
  onWordClick?: (passageId: string, wordIndex: number) => void;
};

/** Renders a passage's plain text with its marks applied — em/strong styling
 * and clickable footnote-reference glyphs (reader-issues #3). Marks are
 * assumed non-overlapping, matching how ingestion produces them.
 *
 * Wrapped in memo(): with the whole book mounted at once (reader-issues.md
 * — no notion of pages), word-level tokenization now runs for every passage
 * rather than just the one being narrated. Reader.tsx passes a stable
 * `passage` reference (the book's own object, not a per-render copy) and a
 * stable onWordClick/onNoteClick, so on the ~2.6/s re-renders during
 * playback this skips re-tokenizing every passage that isn't the one
 * actually changing (the currently-narrated one). */
export const PassageText = memo(function PassageText({
  passage,
  notesById,
  onNoteClick,
  activeWordIndex,
  onWordClick,
}: PassageTextProps) {
  const segments =
    activeWordIndex === undefined && !onWordClick
      ? splitByMarks(passage.text, passage.marks)
      : tokenizeWithWords(passage.text, passage.marks, computeWordRanges(passage.text));
  const onSegmentWordClick = onWordClick
    ? (wordIndex: number) => onWordClick(passage.id, wordIndex)
    : undefined;
  return (
    <>
      {segments.map((seg, i) =>
        renderSegment(seg, i, notesById, onNoteClick, activeWordIndex, onSegmentWordClick)
      )}
    </>
  );
});

/** Renders an `image`-type passage: the extracted figure plus its caption,
 * in place of the plain-paragraph fallback (reader-issues #5). */
export function ImagePassageBlock({ passage }: { passage: Passage }) {
  if (!passage.src) return null;
  return (
    <figure className="my-6 mx-0">
      {/* eslint-disable-next-line @next/next/no-img-element -- book-supplied assets, not app images */}
      <img src={passage.src} alt={passage.text} className="max-w-full w-auto h-auto rounded-xs" />
      {passage.caption && (
        <figcaption className="text-xs text-sand-500 mt-2 text-center font-sans leading-snug">
          {passage.caption}
        </figcaption>
      )}
    </figure>
  );
}
