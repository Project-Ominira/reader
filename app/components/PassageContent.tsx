"use client";

import { memo } from "react";
import type { Mark, Passage } from "@/lib/book/schema";
import type { Annotation } from "@/stores/library-store";

export type NoteLookup = { id: string; marker: string; text: string };

type Segment = {
  text: string;
  mark?: Mark;
  wordIndex?: number;
  annotationId?: string;
};
type WordRange = { start: number; end: number };
type LocalAnnotation = { id: string; start: number; end: number; highlighted: boolean; hasNote: boolean };

function computeWordRanges(text: string): WordRange[] {
  const ranges: WordRange[] = [];
  const re = /\S+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    ranges.push({ start: m.index, end: m.index + m[0].length });
  }
  return ranges;
}

/** Cuts passage text at the union of every mark, word, and user-annotation
 * boundary, so none of the three ever splits a piece another one needs
 * whole — a highlighted range spanning two marked words still renders as
 * one wrapped span internally made of the right em/strong/word pieces. */
function buildSegments(
  text: string,
  marks: Mark[] | undefined,
  words: WordRange[],
  annotations: LocalAnnotation[]
): Segment[] {
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
  for (const a of annotations) {
    cuts.add(a.start);
    cuts.add(a.end);
  }
  const points = Array.from(cuts).sort((a, b) => a - b);
  const tokens: Segment[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const start = points[i];
    const end = points[i + 1];
    if (start === end) continue;
    const mark = sortedMarks.find((m) => m.start <= start && end <= m.end);
    const wordIdx = words.findIndex((w) => w.start <= start && end <= w.end);
    const annotation = annotations.find((a) => a.start <= start && end <= a.end);
    tokens.push({
      text: text.slice(start, end),
      mark,
      wordIndex: wordIdx >= 0 ? wordIdx : undefined,
      annotationId: annotation?.id,
    });
  }
  return tokens;
}

// Theme-fitting active-narration-word highlight (reader-issues.md) —
// --reader-active-word-bg/text are per-theme tokens (app/globals.css), so
// this reads correctly in both themes instead of a single hardcoded color.
// Deliberately a cool blue, nowhere near --reader-highlight's warm
// terracotta, so "this is just what's playing" is never visually confused
// with "I highlighted this."
const ACTIVE_WORD_STYLE: React.CSSProperties = {
  background: "var(--reader-active-word-bg)",
  color: "var(--reader-active-word-text)",
  borderRadius: 4,
  padding: "1px 2px",
};

function renderLeaf(
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
  /** User highlights/notes touching this passage — range-scoped (a reader
   * can mark a single word or a whole sentence, not just the entire
   * passage, and a mark can span into neighboring passages too), rendered
   * as wrapping spans around the underlying mark/word tokens. */
  annotations: Annotation[];
  /** Fired for a plain click (not a fresh drag-selection) landing on a
   * *noted* range or its remaining underline — opens that note directly.
   * Highlight-only ranges get no click handler at all: selecting the same
   * text again and using the tooltip is the only way to remove a highlight
   * or add a note to it (per product decision — no separate click menu). */
  onNoteMarkerClick: (annotationId: string) => void;
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

/** Renders a passage's plain text with its ingested marks (em/strong/
 * footnote) and the reader's own highlights/notes applied — both are
 * additive layers cut into the same underlying plain string, never HTML.
 *
 * Wrapped in memo(): with the whole book mounted at once (reader-issues.md
 * — no notion of pages), tokenization now runs for every passage rather
 * than just the one being narrated or annotated. Reader.tsx passes stable
 * references for `passage`/`annotations` and stable callbacks, so on the
 * ~2.6/s re-renders during playback this skips re-tokenizing every passage
 * that isn't the one actually changing. */
export const PassageText = memo(function PassageText({
  passage,
  notesById,
  onNoteClick,
  annotations,
  onNoteMarkerClick,
  activeWordIndex,
  onWordClick,
}: PassageTextProps) {
  const words = activeWordIndex !== undefined || onWordClick ? computeWordRanges(passage.text) : [];
  // An annotation carries one range per passage it touches — resolve each
  // to its own local [start,end) here, since that's all buildSegments
  // needs to know about for this one passage.
  const localAnnotations: LocalAnnotation[] = [];
  for (const a of annotations) {
    const r = a.ranges.find((r) => r.passageId === passage.id);
    if (r) localAnnotations.push({ id: a.id, start: r.start, end: r.end, highlighted: a.highlighted, hasNote: a.notes.length > 0 });
  }
  const segments = buildSegments(passage.text, passage.marks, words, localAnnotations);
  const onSegmentWordClick = onWordClick ? (wordIndex: number) => onWordClick(passage.id, wordIndex) : undefined;

  // Group consecutive same-annotation tokens into one wrapper span each —
  // where the highlight background/underline actually gets painted (a
  // range, not the whole passage), and the click target for a noted range.
  const runs: { annotationId?: string; segs: Segment[] }[] = [];
  for (const seg of segments) {
    const last = runs[runs.length - 1];
    if (last && last.annotationId === seg.annotationId) last.segs.push(seg);
    else runs.push({ annotationId: seg.annotationId, segs: [seg] });
  }

  return (
    <>
      {runs.map((run, i) => {
        const children = run.segs.map((seg, j) =>
          renderLeaf(seg, j, notesById, onNoteClick, activeWordIndex, onSegmentWordClick)
        );
        if (!run.annotationId) return <span key={i}>{children}</span>;

        const local = localAnnotations.find((a) => a.id === run.annotationId)!;
        const handleClick = local.hasNote
          ? (e: React.MouseEvent<HTMLSpanElement>) => {
              // Don't hijack a fresh drag-selection that merely happens to
              // end on top of this range.
              const sel = window.getSelection();
              if (sel && !sel.isCollapsed && sel.toString().trim()) return;
              e.stopPropagation();
              onNoteMarkerClick(local.id);
            }
          : undefined;

        return (
          <span
            key={i}
            data-annotation-id={local.id}
            onClick={handleClick}
            className={local.hasNote ? "cursor-pointer" : ""}
            style={
              local.highlighted
                ? {
                    background: "var(--reader-highlight)",
                    borderBottom: "2px solid var(--reader-highlight-border)",
                    padding: "0 1px",
                  }
                : {
                    borderBottom: "2px dotted var(--reader-note-accent)",
                    paddingBottom: 1,
                  }
            }
          >
            {children}
          </span>
        );
      })}
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
