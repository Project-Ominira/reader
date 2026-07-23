import { useCallback, useState } from "react";
import { useLibraryStore, type AnnotationRange } from "@/stores/library-store";
import { computeSelectionRanges } from "./annotationSelection";

export type SelectionState = { ranges: AnnotationRange[]; top: number; left: number };

export type NotesPanelState =
  | { mode: "list"; passageId: string }
  | {
      mode: "edit";
      passageId: string;
      annotationId?: string;
      ranges?: AnnotationRange[];
      /** Set only when editing one specific existing note entry in place
       * (from the list's own per-entry Edit) — absent, the panel composes
       * a fresh note to append to the thread instead of overwriting one. */
      editingNoteId?: string;
    };

/**
 * Everything about highlighting and note-taking on passage text, in one
 * place — capturing a selection (including one that spans several
 * passages), the tooltip's Highlight/Note actions, the notes panel's open/
 * closed state, and routing a click on an existing note straight to it.
 * Reader.tsx calls this once and wires the result into SelectionMenu/
 * NotesSidebar; nothing else in the component tree owns this state.
 *
 * Selecting text is the *only* way to start a highlight or note (per
 * product decision) — there's no separate "add" affordance on unmarked
 * passages, so this hook has no "create from nothing" entry point beyond
 * onTextSelect.
 */
export function useTextAnnotations(bookId: string) {
  const getForPassage = useLibraryStore((s) => s.getForPassage);
  const sameRanges = useLibraryStore((s) => s.sameRanges);
  const addHighlight = useLibraryStore((s) => s.addHighlight);
  const removeHighlight = useLibraryStore((s) => s.removeHighlight);

  const [selection, setSelection] = useState<SelectionState | null>(null);
  const [notesPanel, setNotesPanel] = useState<NotesPanelState | null>(null);

  // Called from the active section's own onMouseUp (not per-passage) so a
  // drag that crosses paragraph boundaries is captured as one selection
  // rather than only reacting to whichever passage the mouse happened to
  // release over.
  const onTextSelect = useCallback((sectionEl: HTMLElement) => {
    const ranges = computeSelectionRanges(sectionEl);
    if (!ranges) return;
    const rect = window.getSelection()!.getRangeAt(0).getBoundingClientRect();
    setSelection({ ranges, top: Math.max(8, rect.top - 48), left: rect.left });
  }, []);

  const dismissSelection = useCallback(() => setSelection(null), []);

  // Re-selecting an already-highlighted span toggles it off instead of
  // stacking a duplicate — the tooltip's Highlight button is the only
  // affordance for removing a highlight, matching "selection is the only
  // mechanism" (no separate click-to-cancel menu on marked text).
  // existing.highlightId (the underlying Highlight row's own id) is what
  // removeHighlight needs — existing.id is the grouped view's deterministic
  // range-derived key, not a real row id.
  const highlightSelection = useCallback(() => {
    if (!selection) return;
    const { ranges } = selection;
    const existing = getForPassage(bookId, ranges[0].passageId).find((a) => a.highlighted && sameRanges(a.ranges, ranges));
    if (existing?.highlightId) removeHighlight(bookId, existing.highlightId);
    else addHighlight(bookId, ranges);
    setSelection(null);
  }, [selection, bookId, getForPassage, sameRanges, removeHighlight, addHighlight]);

  // Adding a note always inserts a brand-new, independent note row — there
  // is no shared parent object to find-or-create, so a re-selection of an
  // already-noted range and a selection with nothing on it yet both just
  // call addNote with the current ranges (see library-store's addNote).
  // The panel still looks up whatever thread already lives at this exact
  // selection so it has something to *display* above the composer, but
  // that lookup is purely for rendering, not for routing the save.
  const noteFromSelection = useCallback(() => {
    if (!selection) return;
    const { ranges } = selection;
    const existing = getForPassage(bookId, ranges[0].passageId).find((a) => sameRanges(a.ranges, ranges));
    setNotesPanel({ mode: "edit", passageId: ranges[0].passageId, annotationId: existing?.id, ranges });
    setSelection(null);
  }, [selection, bookId, getForPassage, sameRanges]);

  // A noted range's inline marker — opens its whole thread (not one
  // specific entry, since a range can carry several notes), composer ready
  // to append. Highlight-only ranges get no click handler at all
  // (PassageContent never calls this for them).
  const onNoteMarkerClick = useCallback((passageId: string, annotationId: string) => {
    setNotesPanel({ mode: "edit", passageId, annotationId });
  }, []);

  // The passage gutter marker — every note touching this passage at once.
  const onOpenPassageNotes = useCallback((passageId: string) => {
    setNotesPanel({ mode: "list", passageId });
  }, []);

  // The list view's own per-entry "Edit" — targets one specific note.
  const onEditAnnotation = useCallback((passageId: string, annotationId: string, noteId: string) => {
    setNotesPanel({ mode: "edit", passageId, annotationId, editingNoteId: noteId });
  }, []);

  const closeNotesPanel = useCallback(() => setNotesPanel(null), []);

  return {
    getForPassage: useCallback((passageId: string) => getForPassage(bookId, passageId), [getForPassage, bookId]),
    selection,
    notesPanel,
    onTextSelect,
    dismissSelection,
    highlightSelection,
    noteFromSelection,
    onNoteMarkerClick,
    onOpenPassageNotes,
    onEditAnnotation,
    closeNotesPanel,
  };
}
