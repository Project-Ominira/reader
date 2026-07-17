"use client";

import { X } from "lucide-react";
import type { NoteLookup } from "./PassageContent";

type Props = {
  note: NoteLookup;
  top: number;
  left: number;
  onClose: () => void;
};

/** Popover for a book-provided footnote/endnote (reader-issues #3) — distinct
 * from NotesSidebar, which is the unrelated user-authored discussion/notes
 * feature. Click-outside-to-dismiss via a full-screen transparent backdrop,
 * same pattern as the selection menu already used in Reader.tsx. */
export default function FootnotePopover({ note, top, left, onClose }: Props) {
  return (
    <>
      <div onClick={onClose} className="fixed inset-0 bg-black/20 z-29" />
      <div
        style={{ top, left }}
        className="fixed z-30 w-80 max-w-[90vw] bg-[var(--reader-surface)] text-[var(--reader-text)] border border-[var(--reader-border)] rounded-md shadow-lg p-4 box-border"
      >
        <div className="flex items-start justify-between gap-3">
          <span className="text-xs font-semibold text-[var(--reader-text-muted)]">
            Note
          </span>
          <button
            onClick={onClose}
            className="bg-transparent border-none cursor-pointer text-[var(--reader-text-muted)] flex-none"
          >
            <X size={14} />
          </button>
        </div>
        <p className="text-xs mt-2 leading-5 mb-0">{note.text}</p>
      </div>
    </>
  );
}
