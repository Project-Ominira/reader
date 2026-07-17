"use client";

import { memo } from "react";
import { ChevronLeft, ChevronRight, MessageCircle } from "lucide-react";
import { ImagePassageBlock, PassageText, type NoteLookup } from "../PassageContent";
import type { BookDocument, Passage, Section } from "@/lib/book/schema";
import { sectionLabel } from "@/lib/reader/sectionHeading";

// How much larger than body text each heading level renders — h1 down to
// h6/unleveled, so a chapter's own subheadings stay visually distinct from
// its title instead of one uniform "heading" size for every <h1>-<h6>.
const HEADING_FONT_BUMP: Record<number, number> = { 1: 16, 2: 10, 3: 6, 4: 4, 5: 2, 6: 1 };
function headingFontBump(level: number | undefined): number {
  return level !== undefined ? HEADING_FONT_BUMP[level] ?? 1 : 8;
}

type BookContentProps = {
  book: BookDocument;
  activeIndex: number;
  registerSlide: (id: string) => (el: HTMLDivElement | null) => void;
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
  onAnyClick: () => void;
  onPrev: () => void;
  onNext: () => void;
  contentPad: string;
  contentWidth: number;
  contentTopPad: number;
  orderedSections: Section[];
  notesIndexSectionId: string | null;
  notesIndexGroups: { heading: Passage; notes: BookDocument["notes"] }[] | null;
  isHighlighted: (bookId: string, passageId: string) => boolean;
  isListen: boolean;
  currentPlayingPassageId: string | undefined;
  currentWordIndex: number | undefined;
  fontSize: number;
  lineHeight: number;
  fontFamilyVar: string;
  notesById: Map<string, NoteLookup>;
  onNoteClick: (note: NoteLookup, target: HTMLElement) => void;
  onWordClick: (passageId: string, wordIndex: number) => void;
  seekToPassageForListening: (sectionId: string, passageId: string) => void;
  onTextSelect: (passageId: string) => void;
  setActivePassageId: (id: string) => void;
  setSidebarOpen: (open: boolean) => void;
  setSidebarMode: (mode: "thread" | "add") => void;
};

/**
 * The book itself — only the *active* section is ever mounted (not a
 * horizontal carousel of every section side by side): swipe/arrow/edge-
 * click/keyboard all resolve to a plain activeIndex change, and moving to a
 * new section is a full remount (`key={section.id}` below) with a quick
 * `reader-fade-in` animation, not a translated/sliding DOM. Two earlier
 * attempts at a real sliding transition (hand-rolled `translateX`, then
 * Embla Carousel) both ran into rendering bugs from the same root cause: a
 * horizontal carousel whose slides are also independently tall,
 * vertically-scrolling regions isn't a shape either approach handles well.
 * Mounting one section at a time sidesteps that entirely, and is simpler
 * besides — no `content-visibility` virtualization needed either, since
 * there's nothing else mounted to virtualize.
 */
const BookContent = memo(function BookContent({
  book,
  activeIndex,
  registerSlide,
  onPointerDown,
  onPointerUp,
  onAnyClick,
  onPrev,
  onNext,
  contentPad,
  contentWidth,
  contentTopPad,
  orderedSections,
  notesIndexSectionId,
  notesIndexGroups,
  isHighlighted,
  isListen,
  currentPlayingPassageId,
  currentWordIndex,
  fontSize,
  lineHeight,
  fontFamilyVar,
  notesById,
  onNoteClick,
  onWordClick,
  seekToPassageForListening,
  onTextSelect,
  setActivePassageId,
  setSidebarOpen,
  setSidebarMode,
}: BookContentProps) {
  const firstSectionId = orderedSections[0]?.id;
  const section = orderedSections[activeIndex];

  if (!section) {
    return <div className="flex-1 min-h-0 relative overflow-hidden" />;
  }

  const isPartDivider = section.children.length > 0;
  const isNotesIndex = section.id === notesIndexSectionId && notesIndexGroups;
  const prevSection = orderedSections[activeIndex - 1];
  const nextSection = orderedSections[activeIndex + 1];

  return (
    <div
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      className="flex-1 min-h-0 relative overflow-hidden"
    >
      <div
        key={section.id}
        ref={registerSlide(section.id)}
        data-section-id={section.id}
        onClick={onAnyClick}
        className="reader-fade-in om-scroll h-full overflow-y-auto relative"
        style={{ background: "var(--reader-bg)" }}
      >
        <div
          className={`mx-auto box-border ${contentPad}`}
          style={{ maxWidth: contentWidth, paddingTop: contentTopPad }}
        >
          {section.id === firstSectionId && (
            // Inline byline — book title/author live in the scrolling
            // content itself (Matter-style: the header stays minimal),
            // shown once at the very start of the book.
            <div className="mb-10">
              <div className="text-[11px] font-semibold tracking-wide uppercase text-[var(--reader-text-muted)]">
                {book.metadata.author}
              </div>
              <div className="text-2xl font-semibold font-serif text-[var(--reader-text)] mt-1">
                {book.metadata.title}
              </div>
            </div>
          )}

          {isNotesIndex
            ? notesIndexGroups!.map(({ heading, notes }) => (
                <div key={heading.id} data-passage-id={heading.id} className="mb-8">
                  <h3
                    className="font-serif font-semibold text-lg m-0 mb-3"
                    style={{ color: "var(--reader-text)" }}
                  >
                    {heading.text}
                  </h3>
                  {notes.length === 0 ? (
                    <p className="text-sm text-[var(--reader-text-muted)] m-0">
                      No notes for this chapter.
                    </p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {notes.map((n) => (
                        <p
                          key={n.id}
                          className="m-0 font-serif text-sm leading-relaxed"
                          style={{ color: "var(--reader-text)" }}
                        >
                          {n.text}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              ))
            : section.passages.map((raw) => {
                const p = { ...raw, highlighted: isHighlighted(book.id, raw.id) };
                const isHeading = p.type === "heading";
                // The "currently narrated" wash is deliberately a
                // separate concept from a user's own saved
                // highlight above (reader-issues.md) — a steel-
                // blue background, nowhere near the brand-
                // terracotta highlight color, so the two are
                // never visually confused. Neither gets a border
                // (per product decision: a highlight is just the
                // color plus an underline, not a bordered box) —
                // highlight wins the background, and only it gets
                // the underline, when a passage happens to be
                // both at once.
                const isNarrating = isListen && p.id === currentPlayingPassageId;
                const headingBump = isPartDivider ? 14 : headingFontBump(p.level);
                return (
                  <div
                    key={p.id}
                    data-passage-id={p.id}
                    className="group relative"
                    style={{
                      marginTop: isHeading ? (isPartDivider ? 56 : 32) : 0,
                      marginBottom: `${((24 * lineHeight) / 1.7).toFixed(0)}px`,
                    }}
                  >
                    {p.type === "image" ? (
                      <ImagePassageBlock passage={p} />
                    ) : (
                      <>
                        <button
                          onClick={() => {
                            setActivePassageId(p.id);
                            setSidebarOpen(true);
                            setSidebarMode("thread");
                          }}
                          title="Discuss this passage"
                          className={`absolute -top-1 right-0 w-6 h-6 rounded-sm border-none flex items-center justify-center cursor-pointer bg-transparent transition-opacity ${
                            p.highlighted
                              ? "text-brand-500 opacity-100"
                              : "text-[var(--reader-text-subtle)] opacity-0 group-hover:opacity-100"
                          }`}
                        >
                          <MessageCircle size={15} />
                        </button>
                        <p
                          onMouseUp={() => onTextSelect(p.id)}
                          onClick={() => {
                            if (!isListen) return;
                            // Don't hijack an in-progress text
                            // selection (highlight/note gesture) —
                            // only treat a plain click as "narrate
                            // from here".
                            const sel = window.getSelection();
                            if (sel && !sel.isCollapsed && sel.toString().trim()) return;
                            seekToPassageForListening(section.id, p.id);
                          }}
                          className={`m-0 font-serif rounded-xs ${isListen ? "cursor-pointer" : ""} ${
                            p.highlighted || isNarrating ? "py-2 px-3 -mx-3" : "p-0"
                          }`}
                          style={{
                            background: p.highlighted
                              ? "var(--reader-highlight)"
                              : isNarrating
                              ? "var(--reader-listen-wash)"
                              : undefined,
                            textDecorationLine: p.highlighted ? "underline" : undefined,
                            textDecorationThickness: p.highlighted ? "1px" : undefined,
                            textUnderlineOffset: p.highlighted ? "3px" : undefined,
                            ...(isHeading
                              ? {
                                  fontFamily: fontFamilyVar,
                                  fontWeight: 700,
                                  fontSize: fontSize + headingBump,
                                  lineHeight: 1.3,
                                  textAlign: isPartDivider ? "center" : "left",
                                  textTransform: isPartDivider ? "uppercase" : "none",
                                  letterSpacing: isPartDivider ? "0.08em" : "normal",
                                  color: "var(--reader-text)",
                                }
                              : {
                                  font: `400 ${fontSize}px/${lineHeight} ${fontFamilyVar}`,
                                  color: "var(--reader-text)",
                                }),
                          }}
                        >
                          <PassageText
                            passage={raw}
                            notesById={notesById}
                            onNoteClick={onNoteClick}
                            activeWordIndex={
                              p.id === currentPlayingPassageId ? currentWordIndex : undefined
                            }
                            onWordClick={isListen ? onWordClick : undefined}
                          />
                        </p>
                      </>
                    )}
                  </div>
                );
              })}

          {(prevSection || nextSection) && (
            // Explicit, always-visible page-turn affordance at the point a
            // reader naturally lands when they finish a section — the
            // invisible full-height edge buttons below cover the same
            // next()/prev(), but only reveal themselves on hover, which
            // does nothing for a reader who's just scrolled to the bottom
            // and is looking for what's next. Muted throughout (subtle
            // tracking-wide label, --reader-text-subtle chevrons) since
            // this is wayfinding, not a call to action.
            <nav
              aria-label="Section navigation"
              className="mt-16 pt-6 border-t border-[var(--reader-border)] flex items-stretch justify-between gap-6"
            >
              {prevSection ? (
                <button
                  onClick={onPrev}
                  className="group flex items-center gap-2 min-w-0 max-w-[46%] bg-transparent border-none cursor-pointer text-left py-2"
                >
                  <ChevronLeft
                    size={16}
                    className="flex-none text-[var(--reader-text-subtle)] transition-colors group-hover:text-[var(--reader-text-muted)]"
                  />
                  <div className="min-w-0">
                    <div className="text-[11px] font-semibold tracking-wide uppercase text-[var(--reader-text-subtle)]">
                      Previous
                    </div>
                    <div className="truncate text-sm text-[var(--reader-text-muted)] transition-colors group-hover:text-[var(--reader-text)]">
                      {sectionLabel(prevSection) ?? "Previous section"}
                    </div>
                  </div>
                </button>
              ) : (
                <span />
              )}

              {nextSection ? (
                <button
                  onClick={onNext}
                  className="group ml-auto flex items-center gap-2 min-w-0 max-w-[46%] bg-transparent border-none cursor-pointer text-right py-2"
                >
                  <div className="min-w-0">
                    <div className="text-[11px] font-semibold tracking-wide uppercase text-[var(--reader-text-subtle)]">
                      Next
                    </div>
                    <div className="truncate text-sm text-[var(--reader-text-muted)] transition-colors group-hover:text-[var(--reader-text)]">
                      {sectionLabel(nextSection) ?? "Next section"}
                    </div>
                  </div>
                  <ChevronRight
                    size={16}
                    className="flex-none text-[var(--reader-text-subtle)] transition-colors group-hover:text-[var(--reader-text-muted)]"
                  />
                </button>
              ) : (
                <span />
              )}
            </nav>
          )}
        </div>
      </div>

      <button
        onClick={onPrev}
        aria-label="Previous section"
        className="absolute left-3 top-0 bottom-0 w-16 flex items-center justify-start pl-1 opacity-0 hover:opacity-60 outline-none transition-opacity cursor-pointer z-10"
      >
        <ChevronLeft className="text-[var(--reader-text-muted)]" />
      </button>
      <button
        onClick={onNext}
        aria-label="Next section"
        // Inset from the true right edge (not flush against it, unlike the
        // left button) — the section's own vertical scrollbar renders right
        // at that edge, and this button used to sit on top of it (z-10),
        // swallowing clicks/drags meant for the scrollbar into a page-turn
        // instead.
        className="absolute right-3 top-0 bottom-0 w-16 flex items-center justify-end pr-1 opacity-0 hover:opacity-60 outline-none transition-opacity cursor-pointer z-10"
      >
        <ChevronRight className="text-[var(--reader-text-muted)]" />
      </button>
    </div>
  );
});

export default BookContent;
