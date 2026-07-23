import type { BookDocument } from "@/lib/book/schema";
import { flattenSections } from "@/lib/search/bookIndex";

export type AudioStatus = "none" | "partial" | "ready";

/**
 * Derived, not stored — a section counts as narrated once it has any
 * narrator track, so status always reflects what's actually on disk/in the
 * book JSON rather than a separate flag that could drift from it.
 */
export function computeAudioStatus(book: BookDocument): AudioStatus {
  if (!book.spine.length) return "none";

  const sectionsById = new Map(flattenSections(book.sections).map((s) => [s.id, s]));
  const withAudio = book.spine.filter((id) => sectionsById.get(id)?.audio?.narratorTracks.length).length;

  if (withAudio === 0) return "none";
  if (withAudio === book.spine.length) return "ready";
  return "partial";
}

/** First playable narrator track in spine order — used for the admin panel's inline preview. */
export function firstNarratorTrackSrc(book: BookDocument): string | undefined {
  const sectionsById = new Map(flattenSections(book.sections).map((s) => [s.id, s]));
  for (const id of book.spine) {
    const src = sectionsById.get(id)?.audio?.narratorTracks[0]?.src;
    if (src) return src;
  }
  return undefined;
}
