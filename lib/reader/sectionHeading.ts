import type { Section } from "@/lib/book/schema";

/**
 * The one human-readable label for a section — its own title if the source
 * markup gave it one, otherwise its first heading passage's text. Shared by
 * anywhere a section needs a display name outside its own slide (the
 * header's current-section subtitle, the prev/next footer nav), so they
 * can't drift into different heuristics for the same thing.
 */
export function sectionLabel(section: Section): string | null {
  if (section.title) return section.title;
  return section.passages.find((p) => p.type === "heading")?.text ?? null;
}
