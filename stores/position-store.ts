import { create } from "zustand";
import { persist } from "zustand/middleware";

type Position = { sectionId: string; passageIndex: number };

type PositionState = {
  positionByBook: Record<string, Position>;
  getPosition: (bookId: string) => Position | undefined;
  setPosition: (bookId: string, position: Position) => void;
};

/**
 * Per-book resume position — reader-issues #2: listening should pick up from
 * the chapter and passage last reached, not always restart a chapter from
 * its first passage. Same Record<bookId, ...> + persist pattern as
 * highlights-store; a real backend can replace the store body later without
 * callers changing, same swap-the-implementation shape as book/repository.ts.
 */
export const usePositionStore = create<PositionState>()(
  persist(
    (set, get) => ({
      positionByBook: {},
      getPosition: (bookId) => get().positionByBook[bookId],
      setPosition: (bookId, position) =>
        set((s) => ({ positionByBook: { ...s.positionByBook, [bookId]: position } })),
    }),
    {
      name: "ominira-position",
      // Same SSR-hydration-mismatch reasoning as highlights-store.
      skipHydration: true,
    }
  )
);
