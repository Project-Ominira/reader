"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AudioPlayer from "./AudioPlayer";
import NotesSidebar from "./NotesSidebar";
import SearchModal from "./SearchModal";
import FootnotePopover from "./FootnotePopover";
import type { NoteLookup } from "./PassageContent";
import BookContent from "./reader/BookContent";
import ReaderHeader from "./reader/ReaderHeader";
import ChaptersDrawer from "./reader/ChaptersDrawer";
import SelectionMenu from "./reader/SelectionMenu";
import BackToCurrentButton from "./reader/BackToCurrentButton";
import type { BookDocument, Passage, Section } from "@/lib/book/schema";
import {
  FONT_FAMILY_VARS,
  contentWidthPxFromScale,
  fontSizePxFromScale,
  lineHeightFromScale,
  useReaderStore,
} from "@/stores/reader-store";
import { useLibraryStore } from "@/stores/library-store";
import { useAudioStore } from "@/stores/audio-store";
import { useReaderIdentityStore } from "@/stores/reader-identity-store";
import { useReaderNarration } from "@/lib/reader/useReaderNarration";
import { useSectionCarousel } from "@/lib/reader/useSectionCarousel";
import { useResumeScroll } from "@/lib/reader/useResumeScroll";
import { useReadingProgress } from "@/lib/reader/useReadingProgress";
import { useTextAnnotations } from "@/lib/reader/useTextAnnotations";
import { sectionLabel } from "@/lib/reader/sectionHeading";

export default function Reader({ book }: { book: BookDocument }) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [copyLabel, setCopyLabel] = useState("Copy");
  const [chaptersOpen, setChaptersOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState<{ note: NoteLookup; top: number; left: number } | null>(
    null
  );
  const playerContainerRef = useRef<HTMLDivElement>(null);

  const {
    getForPassage: getAnnotations,
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
  } = useTextAnnotations(book.id);

  const mode = useLibraryStore((s) => s.books[book.id]?.mode ?? "read");
  const setLibraryMode = useLibraryStore((s) => s.setMode);
  const setMode = useCallback((m: "read" | "listen") => setLibraryMode(book.id, m), [setLibraryMode, book.id]);
  const theme = useReaderStore((s) => s.theme);
  const setTheme = useReaderStore((s) => s.setTheme);
  const fontSizeScale = useReaderStore((s) => s.fontSizeScale);
  const fontFamily = useReaderStore((s) => s.fontFamily);
  const lineSpacingScale = useReaderStore((s) => s.lineSpacingScale);
  const contentWidthScale = useReaderStore((s) => s.contentWidthScale);

  const audioPlaying = useAudioStore((s) => s.isPlaying);
  const audioToggle = useAudioStore((s) => s.toggle);
  const audioPause = useAudioStore((s) => s.pause);

  // These stores skip automatic persist hydration (see their own comments)
  // specifically so the server and the client's first paint render
  // identical output — pulling in the real localStorage values here, once,
  // right after mount, is what actually restores them. reader-identity-
  // store's rehydrate must land before ensureReaderId, so a returning
  // reader's existing id is reused rather than shadowed by a fresh one.
  useEffect(() => {
    useReaderStore.persist.rehydrate();
    useLibraryStore.persist.rehydrate();
    useReaderIdentityStore.persist.rehydrate();
    useReaderIdentityStore.getState().ensureReaderId();
  }, []);

  const fontSize = fontSizePxFromScale(fontSizeScale);
  const lineHeight = lineHeightFromScale(lineSpacingScale);
  const contentWidth = contentWidthPxFromScale(contentWidthScale);
  const fontFamilyVar = FONT_FAMILY_VARS[fontFamily];

  // Flat lookup over the content tree (arbitrary depth — see ingestion.md's
  // "content-first, chapter-agnostic" design) so sections can be resolved by
  // stable id instead of array position.
  const sectionsById = useMemo(() => {
    const map = new Map<string, Section>();
    const walk = (sections: Section[]) => {
      for (const s of sections) {
        map.set(s.id, s);
        walk(s.children);
      }
    };
    walk(book.sections);
    return map;
  }, [book.sections]);

  // book.spine is already the whole book's reading order (front matter,
  // part dividers, and chapters alike) — the same order the sidebar and
  // audio auto-advance walk. Each spine entry is now one carousel "slide"
  // (reader-issues #2: section-per-page, not one continuous document).
  const orderedSections = useMemo(
    () => book.spine.map((id) => sectionsById.get(id)).filter((s): s is Section => Boolean(s)),
    [book.spine, sectionsById]
  );
  const sectionIds = useMemo(() => orderedSections.map((s) => s.id), [orderedSections]);

  const passageLookup = useMemo(() => {
    const byId = new Map<string, Passage>();
    const sectionOf = new Map<string, string>();
    for (const section of orderedSections) {
      for (const p of section.passages) {
        byId.set(p.id, p);
        sectionOf.set(p.id, section.id);
      }
    }
    return { byId, sectionOf };
  }, [orderedSections]);

  // Endnote/bibliography sections (e.g. "Notes") ingest one of two shapes —
  // bare chapter-divider headings (one per citing chapter, note bodies
  // diverted under each into book.notes) or entirely empty (the whole file
  // was note-body markup with no interstitial headers at all; ingestion
  // still gives it a spine slot since it's a titled, TOC-listed chapter —
  // see pipeline.py's all_leaves comment) — but either way the section's
  // *own* passages are never a reliable index into book.notes: a chapter-
  // divider list often opens with a page-title heading ("Notes") that isn't
  // itself a chapter, which shifts a positional pairing against book.notes
  // out of alignment for every entry after it. Group by each note's own
  // sectionId instead (always correct) and label groups from the *citing*
  // chapter's own title/heading — never from text found inside the notes
  // section itself.
  //
  // Candidate detection also has to reject a false-positive shape: a plain
  // two-line Part-divider page ("PART ONE" / "The Bolshevik") satisfies the
  // same "every passage is a heading" test as a real endnotes chapter. Where
  // one exists, prefer a candidate whose own title says "notes" before
  // falling back to the bare structural match.
  const notesIndexSectionId = useMemo(() => {
    if (!book.notes.length) return null;
    const isNotesShaped = (s: Section) =>
      s.passages.length === 0 ||
      (s.passages.length > 1 && s.passages.every((p) => p.type === "heading"));
    const titled = orderedSections.find((s) => isNotesShaped(s) && /note/i.test(s.title ?? ""));
    return titled?.id ?? orderedSections.find(isNotesShaped)?.id ?? null;
  }, [orderedSections, book.notes.length]);

  const notesIndexGroups = useMemo(() => {
    if (!notesIndexSectionId) return null;
    const orderedNoteSectionIds = Array.from(new Set(book.notes.map((n) => n.sectionId))).sort(
      (a, b) => book.spine.indexOf(a) - book.spine.indexOf(b)
    );
    return orderedNoteSectionIds.map((sectionId, i) => {
      const citingSection = sectionsById.get(sectionId);
      const label = (citingSection && sectionLabel(citingSection)) || "Notes";
      return {
        heading: { id: `${notesIndexSectionId}-h${i}`, index: i, type: "heading" as const, text: label },
        notes: book.notes.filter((n) => n.sectionId === sectionId),
      };
    });
  }, [notesIndexSectionId, sectionsById, book.notes, book.spine]);

  const notesById = useMemo(() => new Map(book.notes.map((n) => [n.id, n])), [book.notes]);

  // Any open modal/panel (or an active selection menu) suspends the
  // carousel's own keyboard/swipe handling, so typing in search or
  // arrow-keying through a picker never turns the page underneath.
  const navDisabled =
    searchOpen || chaptersOpen || Boolean(notesPanel) || Boolean(noteOpen) || Boolean(selection);

  const {
    activeIndex,
    activeSectionId,
    goTo,
    goToSection,
    next,
    prev,
    registerSlide,
    getSlideEl,
    isMobile,
    chromeHidden,
    setChromeHidden,
    scrollPct,
    onPointerDown,
    onPointerUp,
  } = useSectionCarousel({
    sectionIds,
    // The selection menu floats at a fixed viewport position tied to a text
    // range at the moment it opened — once the page scrolls, that position
    // no longer points at the selection, so treat any scroll as a dismissal
    // rather than leaving a stale menu floating in place. A page turn can
    // move the reader to a new slide with zero scroll events, so it gets
    // its own dismissal trigger (onNavigate) rather than relying on scroll.
    onScroll: dismissSelection,
    onNavigate: dismissSelection,
    disabled: navDisabled,
  });

  useResumeScroll({
    book,
    sectionsById,
    orderedSections,
    goTo,
    getSlideEl,
  });

  // Plain reading (no audio) had no position-save path at all — only
  // useReaderNarration's listen-mode effects ever called setPosition, so
  // leaving a book mid-chapter while just reading never persisted anything
  // finer than "which section," and resuming always dropped the reader
  // back at the chapter's first passage. This tracks scroll position
  // within the active section instead (skipping entirely while isListen,
  // which keeps owning its own audio-offset-aware writes).
  useReadingProgress({
    book,
    mode,
    activeSectionId,
    activeSection: sectionsById.get(activeSectionId),
    getSlideEl,
  });

  const {
    isListen,
    hasNarration,
    audioSection,
    audioSectionTrack,
    narratorOptions,
    currentPlayingPassageId,
    currentWordIndex,
    seekToPassageForListening,
    handleWordClick,
    handleSeek,
    awayFromNarration,
    nudgeDirection,
    jumpToNarration,
    playerHeight,
  } = useReaderNarration({
    book,
    sectionsById,
    passageLookup,
    mode,
    activeIndex,
    goTo,
    getSlideEl,
    playerContainerRef,
  });

  const activeSectionForSidebar = activeSectionId ?? book.spine[0];
  const currentSection = orderedSections[activeIndex];
  const currentSectionLabel = currentSection ? sectionLabel(currentSection) : null;
  const getPassageText = useCallback(
    (passageId: string) => passageLookup.byId.get(passageId)?.text ?? "",
    [passageLookup]
  );

  const onNoteClick = useCallback((note: NoteLookup, target: HTMLElement) => {
    const rect = target.getBoundingClientRect();
    setNoteOpen({
      note,
      top: rect.bottom + 6,
      left: Math.min(window.innerWidth - 336, Math.max(8, rect.left - 140)),
    });
  }, []);

  const menuCopy = () => {
    setCopyLabel("Copied ✓");
    setTimeout(() => {
      setCopyLabel("Copy");
      dismissSelection();
    }, 800);
  };

  const chromeVisible = !chromeHidden;
  const railInsetPx = isMobile ? 12 : 16;
  // Bumped from the old single-line top bar to fit a book-title +
  // current-section subtitle now that the icon rail has merged into it.
  const topBarHeightPx = isMobile ? 60 : 64;
  // Static now rather than conditional on chromeVisible: the header is a
  // fixed overlay that can reappear over the content at any moment on
  // upward scroll, so the scroll area always reserves their space instead
  // of the content reflowing underneath them when they're hidden.
  const contentPad = isMobile ? `px-5 pb-16` : `px-10 pb-20`;
  const contentTopPad = topBarHeightPx + (isMobile ? 28 : 48);

  return (
    <div
      data-reader-theme={theme}
      className="w-full h-screen box-border flex flex-col overflow-hidden relative font-sans"
    >
      <div className="flex-1 min-h-0 relative overflow-hidden">
        <ReaderHeader
          visible={chromeVisible}
          topBarHeightPx={topBarHeightPx}
          railInsetPx={railInsetPx}
          bookTitle={book.metadata.title}
          bookAuthor={book.metadata.author}
          currentSectionLabel={currentSectionLabel}
          chaptersOpen={chaptersOpen}
          onToggleChapters={() => setChaptersOpen((o) => !o)}
          hasNarration={hasNarration}
          isListen={isListen}
          audioPlaying={audioPlaying}
          onToggleMode={() => setMode(mode === "read" ? "listen" : "read")}
          onDoubleClickPlay={audioToggle}
          onToggleSearch={() => setSearchOpen((o) => !o)}
          theme={theme}
          onToggleTheme={() => setTheme(theme === "light" ? "dark" : "light")}
        />

        {chaptersOpen && (
          <ChaptersDrawer
            book={book}
            scrollPct={scrollPct}
            activeSectionId={activeSectionForSidebar}
            isMobile={isMobile}
            onNavigate={(id) => goToSection(id, { animate: false })}
            onClose={() => setChaptersOpen(false)}
          />
        )}

        {/* Main column */}
        <div className="w-full h-full flex flex-col relative" style={{ background: "var(--reader-bg)" }}>
          <BookContent
            book={book}
            activeIndex={activeIndex}
            registerSlide={registerSlide}
            onPointerDown={onPointerDown}
            onPointerUp={onPointerUp}
            onAnyClick={() => setChromeHidden(false)}
            onPrev={prev}
            onNext={next}
            contentPad={contentPad}
            contentWidth={contentWidth}
            contentTopPad={contentTopPad}
            orderedSections={orderedSections}
            notesIndexSectionId={notesIndexSectionId}
            notesIndexGroups={notesIndexGroups}
            getAnnotations={getAnnotations}
            isListen={isListen}
            currentPlayingPassageId={currentPlayingPassageId}
            currentWordIndex={currentWordIndex}
            fontSize={fontSize}
            lineHeight={lineHeight}
            fontFamilyVar={fontFamilyVar}
            notesById={notesById}
            onNoteClick={onNoteClick}
            onWordClick={handleWordClick}
            seekToPassageForListening={seekToPassageForListening}
            onTextSelect={onTextSelect}
            onNoteMarkerClick={onNoteMarkerClick}
            onOpenPassageNotes={onOpenPassageNotes}
          />

          {/* Selection menu is a fixed-position overlay, so it doesn't need
              to live inside BookContent's scrollable tree; keeping it here
              means selecting text never forces the (memoized) book content
              to re-render. Selecting text is the *only* way to start a
              highlight/note/copy (per product decision) — there's no
              separate click-based menu on already-marked text. */}
          {selection && (
            <SelectionMenu
              top={selection.top}
              left={selection.left}
              theme={theme}
              copyLabel={copyLabel}
              onPlay={
                hasNarration
                  ? () => {
                      const passageId = selection.ranges[0].passageId;
                      const sectionId = passageLookup.sectionOf.get(passageId);
                      if (sectionId) {
                        setMode("listen");
                        seekToPassageForListening(sectionId, passageId);
                      }
                      dismissSelection();
                    }
                  : undefined
              }
              onHighlight={highlightSelection}
              onNote={noteFromSelection}
              onCopy={menuCopy}
              onDismiss={dismissSelection}
            />
          )}

          {notesPanel && (
            <>
              <div
                onClick={closeNotesPanel}
                className={`absolute inset-0 z-39 ${isMobile ? "bg-black/45" : "bg-black/25"}`}
              />
              <div
                className={`absolute top-0 bottom-0 z-40 ${isMobile ? "left-0 w-full" : "right-0 w-95"}`}
              >
                <NotesSidebar
                  bookId={book.id}
                  passageId={notesPanel.passageId}
                  getPassageText={getPassageText}
                  mode={notesPanel.mode}
                  annotationId={notesPanel.mode === "edit" ? notesPanel.annotationId : undefined}
                  pendingRanges={notesPanel.mode === "edit" ? notesPanel.ranges : undefined}
                  editingNoteId={notesPanel.mode === "edit" ? notesPanel.editingNoteId : undefined}
                  panelType={isMobile ? "sheet" : "side"}
                  citation={
                    currentSectionLabel
                      ? `${book.metadata.title} · ${currentSectionLabel}`
                      : book.metadata.title
                  }
                  onEditAnnotation={(annotationId, noteId) =>
                    onEditAnnotation(notesPanel.passageId, annotationId, noteId)
                  }
                  onClose={closeNotesPanel}
                />
              </div>
            </>
          )}

          {searchOpen && (
            <div className="absolute inset-0 z-50">
              <SearchModal
                book={book}
                currentSectionId={activeSectionForSidebar}
                onNavigate={(sectionId, passageId) => {
                  goToSection(sectionId, { animate: false });
                  requestAnimationFrame(() => {
                    getSlideEl(sectionId)
                      ?.querySelector(`[data-passage-id="${passageId}"]`)
                      ?.scrollIntoView({ behavior: "auto", block: "center" });
                  });
                }}
                onClose={() => setSearchOpen(false)}
              />
            </div>
          )}

          {noteOpen && (
            <FootnotePopover
              note={noteOpen.note}
              top={noteOpen.top}
              left={noteOpen.left}
              onClose={() => setNoteOpen(null)}
            />
          )}
        </div>
      </div>

      {isListen && (
        <div ref={playerContainerRef} className="flex-none w-full">
          <AudioPlayer
            variant="full"
            bookTitle={book.metadata.title}
            chapterLabel={audioSection.title ?? book.metadata.title}
            coverSrc={book.metadata.cover}
            narrators={narratorOptions}
            durationMs={audioSectionTrack?.durationMs ?? 0}
            onSeek={handleSeek}
            onClose={() => {
              audioPause();
              setMode("read");
            }}
          />
        </div>
      )}

      {currentPlayingPassageId && awayFromNarration && (
        <BackToCurrentButton bottom={playerHeight + 16} direction={nudgeDirection} onClick={jumpToNarration} />
      )}
    </div>
  );
}
