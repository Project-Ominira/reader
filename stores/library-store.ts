import { create } from "zustand";
import { persist } from "zustand/middleware";

export type NoteContent =
  | { kind: "text"; text: string }
  | { kind: "voice"; audioUrl: string; durationMs: number };

/** One passage's own slice of a highlight/note — `start`/`end` are plain-
 * text character offsets into that passage's own `Passage.text`, matching
 * how ingestion's own `marks` are addressed. */
export type AnnotationRange = { passageId: string; start: number; end: number };

/**
 * One independent note — always its own top-level record, keyed by its own
 * id and carrying its own `ranges` (a single drag-selection's worth, which
 * may span several passages). Never nested inside another record's mutable
 * array: adding a second note to the same passage/selection is always a
 * plain insert of a new row, so it can never resolve to — and clobber — an
 * existing one the way an "append to this shared object's notes[]" design
 * could if the lookup used to find that object ever landed on the wrong
 * one (or the wrong render's stale copy of it). Editing/deleting a note
 * always targets exactly one row, by its own id, never anything derived.
 */
export type NoteEntry = {
  id: string;
  ranges: AnnotationRange[];
  content: NoteContent;
  savedAt: number;
};

/**
 * A highlighted span — likewise its own independent, id-keyed record, not
 * a flag riding on some other shared object. A given selection can carry a
 * Highlight, one or more NoteEntry rows, or both (per product decision:
 * "combine seamlessly") — neither requires the other to exist.
 */
export type Highlight = {
  id: string;
  ranges: AnnotationRange[];
  savedAt: number;
};

/**
 * Read-only, *computed* view combining whatever Highlight and/or NoteEntry
 * rows share one exact set of ranges — the shape the reading UI actually
 * wants (one marked span, one note thread underneath it), but never itself
 * the unit of storage or mutation. `id` is deterministic (derived from
 * `ranges`, see `rangesKey`), not a persisted uuid — every mutation
 * (addNote/updateNoteEntry/deleteNoteEntry/addHighlight/removeHighlight)
 * acts on a NoteEntry or Highlight row directly, by *its own* id;
 * `getForPassage` assembles this view fresh (see `recomputePassages`)
 * whenever the underlying rows for that passage actually change, and
 * caches it so it stays reference-stable in between — see the memoization
 * note on PassageText (components/PassageContent.tsx) for why that
 * stability matters.
 */
export type Annotation = {
  id: string;
  ranges: AnnotationRange[];
  highlighted: boolean;
  /** The underlying Highlight row's own id — only what removeHighlight
   * actually needs; absent when this group has no highlight, only notes. */
  highlightId?: string;
  notes: NoteEntry[];
  // Last activity in this group — a highlight toggle or any note
  // added/edited/deleted. Individual notes also carry their own `savedAt`.
  savedAt: number;
};

export type ReaderMode = "read" | "listen";

/** Resume position within a book. `audioTimeMs` is only meaningful in
 * "listen" mode and only set once a recorded track has actually played;
 * absent it, listen-mode resume falls back to the passage's first word. */
export type Position = { sectionId: string; passageIndex: number; audioTimeMs?: number };

// Stable reference for "no annotations" — PassageText is memo()'d and reads
// this on every passage in a section during ~2.6/s narration re-renders; a
// fresh `[]` literal per call would compare unequal every time and defeat
// that memoization for every unmarked passage.
const EMPTY_ANNOTATIONS: Annotation[] = [];

type RowIndex<T> = {
  byId: Record<string, T>;
  // Same object references as byId, just grouped by every passage each one
  // touches — a row spanning 3 passages appears in 3 buckets here, all
  // pointing at the one shared object.
  byPassage: Record<string, T[]>;
};

function rangesKey(ranges: AnnotationRange[]): string {
  return ranges.map((r) => `${r.passageId}:${r.start}:${r.end}`).join("|");
}

function sameRanges(a: AnnotationRange[], b: AnnotationRange[]): boolean {
  return a.length === b.length && a.every((r, i) => r.passageId === b[i].passageId && r.start === b[i].start && r.end === b[i].end);
}

// Rows never change their own `ranges` after creation (only content/
// highlighted-ness do), so rebuilding bucket membership on every update is
// unnecessary — this only ever replaces the row in place within whichever
// buckets it already belongs to, or (for a brand-new row) adds it to each
// bucket its ranges name.
function upsertRow<T extends { id: string; ranges: AnnotationRange[] }>(index: RowIndex<T>, row: T): RowIndex<T> {
  const byId = { ...index.byId, [row.id]: row };
  const byPassage = { ...index.byPassage };
  for (const r of row.ranges) {
    const bucket = byPassage[r.passageId] ?? [];
    const i = bucket.findIndex((x) => x.id === row.id);
    byPassage[r.passageId] = i >= 0 ? bucket.map((x, j) => (j === i ? row : x)) : [...bucket, row];
  }
  return { byId, byPassage };
}

function removeRow<T extends { id: string; ranges: AnnotationRange[] }>(index: RowIndex<T>, id: string): RowIndex<T> {
  const existing = index.byId[id];
  if (!existing) return index;
  const byId = { ...index.byId };
  delete byId[id];
  const byPassage = { ...index.byPassage };
  for (const r of existing.ranges) {
    byPassage[r.passageId] = (byPassage[r.passageId] ?? []).filter((x) => x.id !== id);
  }
  return { byId, byPassage };
}

function emptyRowIndex<T>(): RowIndex<T> {
  return { byId: {}, byPassage: {} };
}

/** Groups whichever Highlight/NoteEntry rows touch `passageId` by their
 * exact shared `ranges` into the Annotation[] view PassageText/NotesSidebar
 * actually read. `highlights`/`notes` are that passage's full buckets
 * (each row's own `ranges` may reach into neighboring passages too — that's
 * irrelevant here beyond being part of the grouping key). */
function buildAnnotationsForPassage(highlights: Highlight[], notes: NoteEntry[]): Annotation[] {
  const groups = new Map<string, { ranges: AnnotationRange[]; highlightId?: string; notes: NoteEntry[]; savedAt: number }>();
  for (const h of highlights) {
    const key = rangesKey(h.ranges);
    const g = groups.get(key) ?? { ranges: h.ranges, notes: [], savedAt: 0 };
    g.highlightId = h.id;
    g.savedAt = Math.max(g.savedAt, h.savedAt);
    groups.set(key, g);
  }
  for (const n of notes) {
    const key = rangesKey(n.ranges);
    const g = groups.get(key) ?? { ranges: n.ranges, notes: [], savedAt: 0 };
    g.notes.push(n);
    g.savedAt = Math.max(g.savedAt, n.savedAt);
    groups.set(key, g);
  }
  // g.notes is already in stable creation order: upsertRow appends a
  // brand-new NoteEntry to the end of its passage bucket but replaces an
  // edited one in place (same index), so editing a note must never re-sort
  // it to wherever its now-later savedAt would put it — it should stay put
  // in the thread, exactly like the original nested-array design did.
  return Array.from(groups.entries()).map(([key, g]) => ({
    id: key,
    ranges: g.ranges,
    highlighted: g.highlightId !== undefined,
    highlightId: g.highlightId,
    notes: g.notes,
    savedAt: g.savedAt,
  }));
}

/**
 * Everything this reader has done with one book — mode, resume position,
 * and private highlights/notes — nested under a single `books[bookId]`
 * entry rather than split across parallel stores, so a future sync layer
 * has exactly one per-book blob to ship (tagged with `readerId` from
 * reader-identity-store) instead of stitching several together.
 */
type BookState = {
  mode: ReaderMode;
  position: Position | undefined;
  highlights: RowIndex<Highlight>;
  notes: RowIndex<NoteEntry>;
  // Cached grouping of highlights/notes into the Annotation[] view, kept in
  // lockstep by every mutation below (recomputePassages) rather than
  // derived fresh on every read — getForPassage is a plain lookup so its
  // result stays reference-stable across renders that don't touch this
  // passage, which is what lets PassageText's memo() actually skip work.
  annotationsByPassage: Record<string, Annotation[]>;
  // Bumped on every write below — a coarse "this book entry changed"
  // signal for a future last-write-wins sync. Notes/highlights also carry
  // their own per-item `savedAt`, which stays the finer-grained signal.
  updatedAt: number;
};

function emptyBookState(): BookState {
  return {
    mode: "read",
    position: undefined,
    highlights: emptyRowIndex(),
    notes: emptyRowIndex(),
    annotationsByPassage: {},
    updatedAt: Date.now(),
  };
}

/** Rebuilds the Annotation[] cache for exactly `passageIds`, leaving every
 * other passage's cached array untouched (same reference) — call this
 * after `book.highlights`/`book.notes` have already been updated, with the
 * set of passageIds the mutation's ranges touched. */
function recomputePassages(book: BookState, passageIds: Iterable<string>): Record<string, Annotation[]> {
  const next = { ...book.annotationsByPassage };
  for (const passageId of passageIds) {
    const groups = buildAnnotationsForPassage(
      book.highlights.byPassage[passageId] ?? [],
      book.notes.byPassage[passageId] ?? []
    );
    if (groups.length) next[passageId] = groups;
    else delete next[passageId];
  }
  return next;
}

type LibraryState = {
  books: Record<string, BookState>;

  getMode: (bookId: string) => ReaderMode;
  setMode: (bookId: string, mode: ReaderMode) => void;

  getPosition: (bookId: string) => Position | undefined;
  setPosition: (bookId: string, position: Position) => void;

  getForPassage: (bookId: string, passageId: string) => Annotation[];
  rangeFor: (annotation: Annotation, passageId: string) => AnnotationRange | undefined;
  /** True when `a` and `b` name exactly the same passages/offsets, in the
   * same order — used to detect "the reader re-selected an
   * already-highlighted span" so the tooltip's Highlight button can toggle
   * it off instead of creating an overlapping duplicate, and to find
   * whatever thread already lives at a fresh selection so the notes panel
   * can show it (not needed to *add* a note — see `addNote`). */
  sameRanges: (a: AnnotationRange[], b: AnnotationRange[]) => boolean;
  addHighlight: (bookId: string, ranges: AnnotationRange[]) => void;
  // Un-highlighting simply deletes the Highlight row — it never touches any
  // NoteEntry rows at the same ranges, which is exactly the point of
  // keeping them as separate records: a noted range surviving a highlight
  // toggle is now just "the Highlight row is gone, the NoteEntry rows
  // aren't," not a special case this function has to know about.
  removeHighlight: (bookId: string, highlightId: string) => void;
  /** Always inserts a brand-new, independent NoteEntry row — appending a
   * note to an existing thread and starting a brand-new one are the same
   * operation, because there is no shared parent object to find-or-create;
   * the thread is just "every NoteEntry whose ranges match," assembled by
   * `getForPassage`, not something this call has to resolve. */
  addNote: (bookId: string, ranges: AnnotationRange[], content: NoteContent) => void;
  /** Edits one specific existing note entry in place, by its own id. */
  updateNoteEntry: (bookId: string, noteId: string, content: NoteContent) => void;
  deleteNoteEntry: (bookId: string, noteId: string) => void;
};

/**
 * Private, single-author per-book reading state — same stub-repository
 * shape as the rest of this app's client stores (localStorage today,
 * swappable for a real backend later without callers changing).
 */
export const useLibraryStore = create<LibraryState>()(
  persist(
    (set, get) => ({
      books: {},

      getMode: (bookId) => get().books[bookId]?.mode ?? "read",
      setMode: (bookId, mode) =>
        set((s) => {
          const book = s.books[bookId] ?? emptyBookState();
          return { books: { ...s.books, [bookId]: { ...book, mode, updatedAt: Date.now() } } };
        }),

      getPosition: (bookId) => get().books[bookId]?.position,
      setPosition: (bookId, position) =>
        set((s) => {
          const book = s.books[bookId] ?? emptyBookState();
          return { books: { ...s.books, [bookId]: { ...book, position, updatedAt: Date.now() } } };
        }),

      getForPassage: (bookId, passageId) => get().books[bookId]?.annotationsByPassage[passageId] ?? EMPTY_ANNOTATIONS,
      rangeFor: (annotation, passageId) => annotation.ranges.find((r) => r.passageId === passageId),
      sameRanges,

      addHighlight: (bookId, ranges) =>
        set((s) => {
          const book = s.books[bookId] ?? emptyBookState();
          const highlight: Highlight = { id: crypto.randomUUID(), ranges, savedAt: Date.now() };
          const highlights = upsertRow(book.highlights, highlight);
          const nextBook: BookState = { ...book, highlights, updatedAt: Date.now() };
          nextBook.annotationsByPassage = recomputePassages(nextBook, new Set(ranges.map((r) => r.passageId)));
          return { books: { ...s.books, [bookId]: nextBook } };
        }),
      removeHighlight: (bookId, highlightId) =>
        set((s) => {
          const book = s.books[bookId];
          const existing = book?.highlights.byId[highlightId];
          if (!book || !existing) return {};
          const highlights = removeRow(book.highlights, highlightId);
          const nextBook: BookState = { ...book, highlights, updatedAt: Date.now() };
          nextBook.annotationsByPassage = recomputePassages(nextBook, new Set(existing.ranges.map((r) => r.passageId)));
          return { books: { ...s.books, [bookId]: nextBook } };
        }),
      addNote: (bookId, ranges, content) =>
        set((s) => {
          const book = s.books[bookId] ?? emptyBookState();
          const note: NoteEntry = { id: crypto.randomUUID(), ranges, content, savedAt: Date.now() };
          const notes = upsertRow(book.notes, note);
          const nextBook: BookState = { ...book, notes, updatedAt: Date.now() };
          nextBook.annotationsByPassage = recomputePassages(nextBook, new Set(ranges.map((r) => r.passageId)));
          return { books: { ...s.books, [bookId]: nextBook } };
        }),
      updateNoteEntry: (bookId, noteId, content) =>
        set((s) => {
          const book = s.books[bookId];
          const existing = book?.notes.byId[noteId];
          if (!book || !existing) return {};
          const notes = upsertRow(book.notes, { ...existing, content, savedAt: Date.now() });
          const nextBook: BookState = { ...book, notes, updatedAt: Date.now() };
          nextBook.annotationsByPassage = recomputePassages(nextBook, new Set(existing.ranges.map((r) => r.passageId)));
          return { books: { ...s.books, [bookId]: nextBook } };
        }),
      deleteNoteEntry: (bookId, noteId) =>
        set((s) => {
          const book = s.books[bookId];
          const existing = book?.notes.byId[noteId];
          if (!book || !existing) return {};
          const notes = removeRow(book.notes, noteId);
          const nextBook: BookState = { ...book, notes, updatedAt: Date.now() };
          nextBook.annotationsByPassage = recomputePassages(nextBook, new Set(existing.ranges.map((r) => r.passageId)));
          return { books: { ...s.books, [bookId]: nextBook } };
        }),
    }),
    {
      // Bumped from v2: Annotation stopped being the unit of storage —
      // highlights/notes are now independent RowIndex collections instead
      // of nested inside a shared, mutable Annotation.notes[]. Pre-launch,
      // so a fresh key just orphans old test data (same convention v1→v2
      // already established) rather than writing a one-time shape
      // migration for data nobody depends on yet.
      name: "ominira-library-v3",
      // Same SSR-hydration-mismatch reasoning as the reader's other client
      // stores — inline highlight washes/markers and listen-mode render on
      // first paint, so they can't read localStorage before the server and
      // the client's first render agree. Rehydrated explicitly post-mount
      // in Reader.tsx.
      skipHydration: true,
      // Voice-note audio is a blob: URL scoped to this tab's lifetime — it
      // never resolves after a reload, so voice entries are dropped from
      // persistence (the highlight/other notes at the same ranges survive).
      // annotationsByPassage itself is never persisted at all — it's purely
      // a derived cache, and `merge` below rebuilds it from whatever
      // highlights/notes actually made it into storage, so it can never
      // drift out of sync with them (e.g. by way of a dropped voice note).
      partialize: (s) => ({
        books: Object.fromEntries(
          Object.entries(s.books).map(([bookId, book]) => {
            const noteById: Record<string, NoteEntry> = {};
            for (const [id, n] of Object.entries(book.notes.byId)) {
              if (n.content.kind !== "voice") noteById[id] = n;
            }
            const noteByPassage: Record<string, NoteEntry[]> = {};
            for (const [passageId, entries] of Object.entries(book.notes.byPassage)) {
              const kept = entries.filter((n) => n.content.kind !== "voice");
              if (kept.length) noteByPassage[passageId] = kept;
            }
            return [
              bookId,
              {
                mode: book.mode,
                position: book.position,
                highlights: book.highlights,
                notes: { byId: noteById, byPassage: noteByPassage },
                updatedAt: book.updatedAt,
              },
            ];
          })
        ),
      }),
      // Rebuilds each book's annotationsByPassage cache from its persisted
      // highlights/notes on rehydrate, since that cache is intentionally
      // never itself persisted (see partialize above) — skipping this would
      // leave every returning reader's books with an empty cache and no
      // markers/highlights rendered at all despite the underlying data
      // being right there.
      merge: (persistedState, currentState) => {
        const persisted = persistedState as { books?: Record<string, Omit<BookState, "annotationsByPassage">> } | undefined;
        const books = { ...currentState.books };
        for (const [bookId, pBook] of Object.entries(persisted?.books ?? {})) {
          const book: BookState = { ...pBook, annotationsByPassage: {} };
          const touched = new Set<string>();
          for (const h of Object.values(book.highlights.byId)) for (const r of h.ranges) touched.add(r.passageId);
          for (const n of Object.values(book.notes.byId)) for (const r of n.ranges) touched.add(r.passageId);
          book.annotationsByPassage = recomputePassages(book, touched);
          books[bookId] = book;
        }
        return { ...currentState, books };
      },
    }
  )
);
