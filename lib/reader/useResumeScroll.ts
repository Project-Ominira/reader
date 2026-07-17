import { useEffect, useRef } from "react";
import type { BookDocument, Section } from "@/lib/book/schema";
import { useReaderStore } from "@/stores/reader-store";
import { usePositionStore } from "@/stores/position-store";

/**
 * Resumes a book where the reader last left off. Seeds this session's audio
 * position from the saved position (reader-issues #2) once per book, not a
 * general sync, so it doesn't fight ordinary sidebar navigation afterward.
 * Then, once the carousel's slides have mounted, jumps straight to the
 * resume section (no transition — the reader never asked for this move
 * visually) and scrolls to the saved passage within that slide.
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
  const setAudioSectionId = useReaderStore((s) => s.setCurrentSectionId);
  const getPosition = usePositionStore((s) => s.getPosition);
  const hasScrolledToResumeRef = useRef(false);

  useEffect(() => {
    const stored = getPosition(book.id);
    if (stored) setAudioSectionId(stored.sectionId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [book.id]);

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
