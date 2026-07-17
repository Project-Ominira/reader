export type KaraokeWord = {
  passageId: string;
  text: string;
  startMs: number;
  endMs: number;
};

export type KaraokeLine = {
  text: string;
  startMs: number;
  endMs: number;
  words: KaraokeWord[];
};

const SENTENCE_END = /[.!?]["')\]]?$/;

/**
 * Groups word-level timings into sentence-level "lines" for karaoke display.
 * Line grouping is a rendering concern, not part of the book schema — the
 * schema only guarantees word-level timing keyed to a passage.
 */
export function buildKaraokeLines(words: KaraokeWord[] | undefined): KaraokeLine[] {
  if (!words || words.length === 0) return [];
  const lines: KaraokeLine[] = [];
  let current: KaraokeWord[] = [];

  for (const word of words) {
    current.push(word);
    if (SENTENCE_END.test(word.text)) {
      lines.push(toLine(current));
      current = [];
    }
  }
  if (current.length) lines.push(toLine(current));
  return lines;
}

function toLine(words: KaraokeWord[]): KaraokeLine {
  return {
    text: words.map((w) => w.text).join(" "),
    startMs: words[0].startMs,
    endMs: words[words.length - 1].endMs,
    words,
  };
}

export function activeLineIndex(lines: KaraokeLine[], atMs: number): number {
  for (let i = lines.length - 1; i >= 0; i--) {
    if (atMs >= lines[i].startMs) return i;
  }
  return 0;
}

export function activeWordIndex(line: KaraokeLine, atMs: number): number {
  for (let i = line.words.length - 1; i >= 0; i--) {
    if (atMs >= line.words[i].startMs) return i;
  }
  return 0;
}
