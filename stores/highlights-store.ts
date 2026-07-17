import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Stub for what should eventually be a server-persisted notes/highlights
 * repository (per reader.md) — same shape as lib/book/repository.ts's
 * swap-the-implementation pattern. Today this only tracks highlighted
 * passage ids per book in localStorage; a real backend can replace the
 * body of `toggle` without callers changing.
 */
type HighlightsState = {
  highlightedByBook: Record<string, string[]>;
  isHighlighted: (bookId: string, passageId: string) => boolean;
  toggle: (bookId: string, passageId: string) => void;
};

export const useHighlightsStore = create<HighlightsState>()(
  persist(
    (set, get) => ({
      highlightedByBook: {},
      isHighlighted: (bookId, passageId) =>
        (get().highlightedByBook[bookId] ?? []).includes(passageId),
      toggle: (bookId, passageId) =>
        set((s) => {
          const current = s.highlightedByBook[bookId] ?? [];
          const next = current.includes(passageId)
            ? current.filter((id) => id !== passageId)
            : [...current, passageId];
          return { highlightedByBook: { ...s.highlightedByBook, [bookId]: next } };
        }),
    }),
    {
      name: "ominira-highlights",
      // Reading localStorage synchronously at store-creation time makes the
      // client's *first* render (pre-hydration) already reflect saved
      // highlights while the server-rendered HTML never could — a hydration
      // mismatch on every highlighted passage's class/style. Skipping it
      // here and rehydrating explicitly post-mount (Reader.tsx) means both
      // the server and the client's first paint agree (nothing highlighted
      // yet), and the real data arrives a beat later as an ordinary
      // client-side update instead of a mismatch.
      skipHydration: true,
    }
  )
);
