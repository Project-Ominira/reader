import type { Passage } from "@/lib/book/schema";

/**
 * Passage text for narration, with footnote/endnote reference markers
 * excised — Mark.kind === "note" ranges are the marker glyph itself (a
 * superscript "1" or "*") embedded inline in passage.text, the same
 * character a print reader's eye already skips over. Left in, TTS reads it
 * as a word ("one", "asterisk") mid-sentence instead of skipping it.
 */
export function spokenPassageText(passage: Passage): string {
  const noteMarks = (passage.marks ?? [])
    .filter((m) => m.kind === "note")
    .sort((a, b) => b.start - a.start);

  let text = passage.text;
  for (const mark of noteMarks) {
    text = text.slice(0, mark.start) + text.slice(mark.end);
  }
  return text;
}
