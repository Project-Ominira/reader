import { useEffect, useRef } from "react";
import type { BookDocument, Section } from "@/lib/book/schema";
import { useLibraryStore } from "@/stores/library-store";

// Only committed to the store after scrolling has settled for this long —
// resets on every scroll event, so continuous scrolling never writes at
// all until the reader actually stops, matching listen mode's own
// occasional (not every-frame) position writes.
const SETTLE_MS = 600;

/**
 * Plain-reading counterpart to useReaderNarration's position tracking.
 * Listen mode always knew exactly where the reader was (the playback
 * clock); reading mode previously only recorded which *section* was
 * active, resetting to its first passage on every navigation — so
 * resuming a book mid-chapter always dropped the reader back at the top
 * of the chapter, never the paragraph they'd actually stopped at.
 *
 * Two things happen here, both mirroring the section-only tracking this
 * replaced:
 *  - A genuine navigation to a *different* section starts back at its
 *    first passage — unless the stored position already points at the
 *    section being entered, in which case that's useResumeScroll's own
 *    jump landing (or the reader returning to a section they'd already
 *    made progress in), and the existing passageIndex is preserved rather
 *    than being stomped back to 0.
 *  - While remaining in one section, scroll position refines passageIndex
 *    further: "whichever passage is still visible at the very top of the
 *    viewport" is treated as the resume point, committed (debounced) the
 *    same way useReaderNarration commits `audioTimeMs` as playback
 *    advances.
 *
 * Deliberately never writes from an effect's *cleanup* — only from its
 * setup (the section-change branch) and from real 'scroll'/
 * 'visibilitychange' events. Cleanup runs on every dependency change
 * (including React StrictMode's dev-only double-invoke on mount), not just
 * "the reader is genuinely leaving," so a write there was landing stale/
 * premature positions unrelated to anything the reader actually did.
 */
export function useReadingProgress({
  book,
  mode,
  activeSectionId,
  activeSection,
  getSlideEl,
}: {
  book: BookDocument;
  mode: "read" | "listen";
  activeSectionId: string | undefined;
  activeSection: Section | undefined;
  getSlideEl: (id: string) => HTMLDivElement | undefined;
}) {
  const getPosition = useLibraryStore((s) => s.getPosition);
  const setPosition = useLibraryStore((s) => s.setPosition);
  const previousSectionRef = useRef<string | null>(null);

  useEffect(() => {
    if (mode !== "read" || !activeSectionId || !activeSection) return;

    const previous = previousSectionRef.current;
    previousSectionRef.current = activeSectionId;
    // `previous === null` is the very first section observed after mount —
    // whether that's book.spine[0] or wherever useResumeScroll is about to
    // jump to — left alone rather than written back on its own.
    if (previous !== null && previous !== activeSectionId) {
      const existing = getPosition(book.id);
      const passageIndex = existing?.sectionId === activeSectionId ? existing.passageIndex : 0;
      setPosition(book.id, { sectionId: activeSectionId, passageIndex });
    }

    const el = getSlideEl(activeSectionId);
    if (!el) return;

    const computePassageIndex = (): number | undefined => {
      const passageEls = el.querySelectorAll<HTMLElement>("[data-passage-id]");
      const containerTop = el.getBoundingClientRect().top;
      let lastId: string | undefined;
      for (const p of passageEls) {
        lastId = p.dataset.passageId;
        // The first passage not yet fully scrolled past the viewport's top
        // edge — i.e. whatever's showing right at the top right now.
        if (p.getBoundingClientRect().bottom > containerTop + 8) {
          const idx = activeSection.passages.findIndex((pg) => pg.id === p.dataset.passageId);
          return idx >= 0 ? idx : undefined;
        }
      }
      // Scrolled past every passage (e.g. resting on the "next chapter"
      // footer) — the last one is still the honest resume point, rather
      // than silently leaving whatever passageIndex was tracked earlier.
      const idx = lastId ? activeSection.passages.findIndex((pg) => pg.id === lastId) : -1;
      return idx >= 0 ? idx : undefined;
    };

    let settleTimer: ReturnType<typeof setTimeout> | null = null;
    const onScroll = () => {
      const passageIndex = computePassageIndex();
      if (passageIndex === undefined) return;
      if (settleTimer) clearTimeout(settleTimer);
      settleTimer = setTimeout(
        () => setPosition(book.id, { sectionId: activeSectionId, passageIndex }),
        SETTLE_MS
      );
    };
    el.addEventListener("scroll", onScroll, { passive: true });

    // The tab being hidden (backgrounded/closed) is a genuine "the reader
    // is leaving" signal, unlike an ordinary effect cleanup — safe to
    // recompute and write immediately rather than waiting out the settle
    // timer, so the last few paragraphs read aren't lost if it hasn't
    // fired yet. Recomputes fresh from the DOM rather than caching the
    // last scroll-derived value, since the slide is still mounted and
    // attached for as long as this listener is: no need to guess.
    const onVisibilityChange = () => {
      if (document.visibilityState !== "hidden") return;
      const passageIndex = computePassageIndex();
      if (passageIndex !== undefined) setPosition(book.id, { sectionId: activeSectionId, passageIndex });
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      if (settleTimer) clearTimeout(settleTimer);
      el.removeEventListener("scroll", onScroll);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [book.id, mode, activeSectionId, activeSection, getSlideEl, getPosition, setPosition]);
}
