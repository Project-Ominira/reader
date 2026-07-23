import type { AnnotationRange } from "@/stores/library-store";

/**
 * Turns the current window selection into one AnnotationRange per passage
 * it touches, in reading order — a single drag can span several
 * paragraphs, and each one gets its own local [start,end) offset into its
 * own Passage.text (the standard "count characters up to the boundary"
 * technique, per-passage). The caller groups the result under one shared
 * Annotation, so editing/deleting a cross-passage highlight or note treats
 * the whole span as a single unit.
 *
 * Returns null for a collapsed/empty selection, or one that doesn't
 * actually touch any real (non-image) passage under `sectionEl`.
 */
export function computeSelectionRanges(sectionEl: HTMLElement): AnnotationRange[] | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed || !sel.toString().trim()) return null;
  const range = sel.getRangeAt(0);

  const passageEls = Array.from(
    sectionEl.querySelectorAll<HTMLElement>("[data-passage-id][data-passage-type]")
  ).filter((el) => el.dataset.passageType !== "image");

  const ranges: AnnotationRange[] = [];
  for (const el of passageEls) {
    if (!range.intersectsNode(el)) continue;
    const passageId = el.dataset.passageId!;
    const fullLen = el.textContent?.length ?? 0;

    let start: number;
    if (el.contains(range.startContainer)) {
      const pre = document.createRange();
      pre.selectNodeContents(el);
      pre.setEnd(range.startContainer, range.startOffset);
      start = pre.toString().length;
    } else {
      // The selection began in an earlier passage — this one is covered
      // from its own start.
      start = 0;
    }

    let end: number;
    if (el.contains(range.endContainer)) {
      const pre = document.createRange();
      pre.selectNodeContents(el);
      pre.setEnd(range.endContainer, range.endOffset);
      end = pre.toString().length;
    } else {
      // The selection continues past this passage into a later one.
      end = fullLen;
    }

    if (end > start) ranges.push({ passageId, start, end });
  }

  return ranges.length ? ranges : null;
}
