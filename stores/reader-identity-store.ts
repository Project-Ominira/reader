import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * A stable local identifier for this browser's reader — the seam a future
 * Supabase sync layer would attach to outgoing rows (a `reader_id` column
 * on tables mirroring library-store's per-book state) once accounts exist.
 * It does not scope any local storage today (a browser profile is already
 * effectively single-reader); it exists purely so that seam doesn't have to
 * be retrofitted later.
 */
type ReaderIdentityState = {
  readerId: string | null;
  /** Returns the persisted id if one exists, otherwise mints and persists a
   * fresh one. Idempotent — safe to call on every mount. */
  ensureReaderId: () => string;
};

export const useReaderIdentityStore = create<ReaderIdentityState>()(
  persist(
    (set, get) => ({
      readerId: null,
      ensureReaderId: () => {
        const existing = get().readerId;
        if (existing) return existing;
        const id = crypto.randomUUID();
        set({ readerId: id });
        return id;
      },
    }),
    {
      name: "ominira-reader-identity",
      // Same SSR-hydration-mismatch reasoning as the reader's other client
      // stores, though nothing here renders directly — kept consistent so
      // rehydration always runs before `ensureReaderId` is called (Reader.tsx),
      // avoiding a spurious fresh id on every SSR pass.
      skipHydration: true,
    }
  )
);
