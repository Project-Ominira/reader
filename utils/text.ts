// withHours is driven by the *total* duration, not this particular value, so
// elapsed/remaining labels don't change width mid-playback as they cross the
// 60-minute mark (reader-issues.md #1).
export function formatDuration(seconds: number, withHours = seconds >= 3600): string {
  seconds = Math.max(0, Math.round(seconds));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (withHours) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${m}:${String(s).padStart(2, "0")}`;
}

// Strips combining diacritical marks (U+0300-U+036F) left behind by
// normalize("NFKD"), e.g. turning "é" into "e" instead of "e" + accent.
const COMBINING_MARKS = new RegExp(
  "[" + String.fromCharCode(0x0300) + "-" + String.fromCharCode(0x036f) + "]",
  "g"
);

export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(COMBINING_MARKS, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
