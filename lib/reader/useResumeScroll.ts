import { useEffect, useRef } from "react";
import type { BookDocument, Section } from "@/lib/book/schema";
import { useLibraryStore } from "@/stores/library-store";

/**
 * Resumes a book where the reader last left off. Once the carousel's slides
 * have mounted, jumps straight to the saved section (no transition — the
 * reader never asked for this move visually) and scrolls to the saved
 * passage within that slide. The saved position itself (which section
 * narration/audio considers "current") lives in library-store and needs no
 * separate seeding here — useReaderNarration reads the same per-book
 * position directly.
 */
export function useResumeScroll({
  book,
  sectionsById,
  orderedSections,
  goTo,
  getSlideEl,
}: {
  book: BookDocument;
  sectionsById: Map<string, Section>;
  orderedSections: Section[];
  goTo: (index: number, opts?: { animate?: boolean }) => void;
  getSlideEl: (id: string) => HTMLDivElement | undefined;
}) {
  const getPosition = useLibraryStore((s) => s.getPosition);
  const hasScrolledToResumeRef = useRef(false);

  useEffect(() => {
    if (hasScrolledToResumeRef.current) return;
    const stored = getPosition(book.id);
    const sectionIndex = stored ? orderedSections.findIndex((s) => s.id === stored.sectionId) : -1;
    const passageId = stored ? sectionsById.get(stored.sectionId)?.passages[stored.passageIndex]?.id : undefined;
    if (!stored || sectionIndex < 0 || !passageId) {
      hasScrolledToResumeRef.current = true;
      return;
    }
    goTo(sectionIndex, { animate: false });
    const raf = requestAnimationFrame(() => {
      getSlideEl(stored.sectionId)
        ?.querySelector(`[data-passage-id="${passageId}"]`)
        ?.scrollIntoView({ behavior: "auto", block: "start" });
      hasScrolledToResumeRef.current = true;
    });
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [book.id, orderedSections.length]);
}
