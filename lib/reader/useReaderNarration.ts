import { useCallback, useEffect, useMemo, useState } from "react";
import type { BookDocument, Narrator, Passage, Section } from "@/lib/book/schema";
import { useAudioStore } from "@/stores/audio-store";
import { useLibraryStore } from "@/stores/library-store";
import { activeLineIndex, activeWordIndex, buildKaraokeLines, type KaraokeLine } from "@/lib/audio/karaoke";

export type NarratorOption = Narrator;

type PassageLookup = { byId: Map<string, Passage>; sectionOf: Map<string, string> };

/**
 * Owns pre-recorded narration playback for sections that ship a narrator
 * track (ingestion-time TTS — see ingestion.md). There is no live-TTS
 * fallback: a book with no narrators simply has no listen mode, not even the
 * browser's built-in voice — partial/synthetic narration was worse than
 * none. Reader.tsx only ever sees the result of this: which passage/word is
 * currently playing, and a handful of seek/navigate functions.
 */
export function useReaderNarration({
  book,
  sectionsById,
  passageLookup,
  mode,
  activeIndex,
  goTo,
  getSlideEl,
  playerContainerRef,
}: {
  book: BookDocument;
  sectionsById: Map<string, Section>;
  passageLookup: PassageLookup;
  mode: "read" | "listen";
  activeIndex: number;
  goTo: (index: number, opts?: { animate?: boolean }) => void;
  getSlideEl: (id: string) => HTMLDivElement | undefined;
  playerContainerRef: React.RefObject<HTMLDivElement | null>;
}) {
  const hasNarration = book.narrators.length > 0;
  const isListen = mode === "listen" && hasNarration;

  const audioSectionId = useLibraryStore((s) => s.books[book.id]?.position?.sectionId);

  const audioPlaying = useAudioStore((s) => s.isPlaying);
  const audioPlay = useAudioStore((s) => s.play);
  const audioTick = useAudioStore((s) => s.tick);
  const audioSeekTo = useAudioStore((s) => s.seekTo);
  const audioPause = useAudioStore((s) => s.pause);
  const audioCurrentTimeMs = useAudioStore((s) => s.currentTimeMs);

  const getPosition = useLibraryStore((s) => s.getPosition);
  const setPosition = useLibraryStore((s) => s.setPosition);

  // One narration per book for now (per product decision) — always the
  // book's first narrator, no switching UI. audio-store's narratorId/
  // setNarratorId fields stay shelved (unused here) for when multi-narrator
  // selection is re-enabled.
  const narratorId = book.narrators[0]?.id;

  const audioSection =
    sectionsById.get(audioSectionId ?? book.spine[0]) ?? sectionsById.get(book.spine[0])!;

  // Which spine position audio is on, vs which slide the reader is actually
  // looking at (activeIndex, from the carousel). The two are deliberately
  // independent — manual navigation never forces one to match the other —
  // but when they DO match, that's "the reader is following narration",
  // and auto-advance below uses that to decide whether to turn the page.
  const audioIndex = book.spine.indexOf(audioSection.id);
  const isFollowingNarration = isListen && activeIndex === audioIndex;

  const narratorOptions: NarratorOption[] = book.narrators;
  const audioSectionTrack = audioSection.audio?.narratorTracks.find((t) => t.narratorId === narratorId);
  const usesRecordedAudio = hasNarration && Boolean(audioSectionTrack);

  // Advances the shared playback clock while a recorded track plays.
  // Karaoke line/word position below is derived from it, not tracked
  // separately.
  useEffect(() => {
    if (mode !== "listen" || !usesRecordedAudio || !audioPlaying) return;
    const timer = setInterval(() => audioTick(380), 380);
    return () => clearInterval(timer);
  }, [mode, usesRecordedAudio, audioPlaying, audioTick]);

  // Seeks to the resume passage's first word (reader-issues #2) when
  // entering a section/narrator combination that has a track.
  useEffect(() => {
    if (mode !== "listen" || !usesRecordedAudio) return;
    const stored = getPosition(book.id);
    if (!stored || stored.sectionId !== audioSection.id) return;
    // Prefer the exact moment last heard, when one was saved; otherwise the
    // best available granularity is the resume passage's first word.
    if (stored.audioTimeMs !== undefined) {
      audioSeekTo(stored.audioTimeMs);
      return;
    }
    const resumePassageId = audioSection.passages[stored.passageIndex]?.id;
    const word = audioSection.audio?.words?.find((w) => w.passageId === resumePassageId);
    if (word) audioSeekTo(word.startMs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, usesRecordedAudio, audioSection.id]);

  // Podcast-style continuous narration (spec.md): once the active section's
  // track ends, advance to the next spine section. If that section has no
  // track for this narrator, playback simply has nothing to highlight/advance
  // until the reader picks a different section or narrator. If the reader
  // was following along (the visible slide matched the narrating section),
  // the page turns itself too — otherwise the reader stays wherever they
  // navigated to, and the back-to-current nudge is how they'd reconnect.
  useEffect(() => {
    if (mode !== "listen" || !usesRecordedAudio || !audioSectionTrack) return;
    if (audioCurrentTimeMs < audioSectionTrack.durationMs) return;
    const idx = book.spine.indexOf(audioSection.id);
    const nextId = book.spine[idx + 1];
    if (!nextId) {
      audioPause();
      return;
    }
    setPosition(book.id, { sectionId: nextId, passageIndex: 0, audioTimeMs: 0 });
    audioSeekTo(0);
    if (isFollowingNarration) goTo(idx + 1, { animate: true });
  }, [
    audioCurrentTimeMs,
    mode,
    usesRecordedAudio,
    audioSectionTrack,
    audioSection.id,
    book.spine,
    book.id,
    audioPause,
    setPosition,
    audioSeekTo,
    isFollowingNarration,
    goTo,
  ]);

  const karaokeLines: KaraokeLine[] = useMemo(() => {
    if (!usesRecordedAudio) return [];
    return buildKaraokeLines(audioSection.audio?.words);
  }, [audioSection, usesRecordedAudio]);

  const karaokeIdx = karaokeLines.length ? activeLineIndex(karaokeLines, audioCurrentTimeMs) : 0;
  const currentKaraokeLine = karaokeLines[karaokeIdx];

  // Which passage — and which word within it — is currently being narrated,
  // so the reading view itself (not a separate karaoke screen —
  // reader-issues.md #5/#7) can highlight the active word in place.
  const currentPlayingPassageId = isListen ? currentKaraokeLine?.words[0]?.passageId : undefined;

  const currentPlayingPassageWords =
    usesRecordedAudio && currentPlayingPassageId
      ? (audioSection.audio?.words ?? []).filter((w) => w.passageId === currentPlayingPassageId)
      : [];

  const currentWordIndex =
    !currentPlayingPassageId || !currentPlayingPassageWords.length
      ? undefined
      : activeWordIndex(
          { text: "", startMs: 0, endMs: 0, words: currentPlayingPassageWords },
          audioCurrentTimeMs
        );

  // Keeps the currently-narrated passage in view as playback advances —
  // only while the reader is actually following along (the narrating
  // section IS the visible slide). If they've manually turned elsewhere,
  // narration must never reach into an off-screen slide and change its
  // scroll position out from under them.
  useEffect(() => {
    if (!isFollowingNarration || !currentPlayingPassageId) return;
    const el = getSlideEl(audioSection.id)?.querySelector(`[data-passage-id="${currentPlayingPassageId}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [currentPlayingPassageId, isFollowingNarration, audioSection.id, getSlideEl]);

  // Persists resume position as playback advances (reader-issues #2).
  useEffect(() => {
    if (mode !== "listen" || !usesRecordedAudio || !currentKaraokeLine) return;
    const passageId = currentKaraokeLine.words[0]?.passageId;
    const passageIndex = audioSection.passages.findIndex((p) => p.id === passageId);
    if (passageIndex >= 0)
      setPosition(book.id, { sectionId: audioSection.id, passageIndex, audioTimeMs: audioCurrentTimeMs });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, usesRecordedAudio, currentKaraokeLine, audioSection.id]);

  // Click-a-passage-to-narrate-from-there (reader-issues.md #1.3/#1.5) — a
  // no-op when the target section has no track for the current narrator.
  // Can only ever target the currently-visible slide, so this is also the
  // reader's explicit "resync audio to where I am" gesture — after this,
  // audioIndex necessarily matches activeIndex again.
  const seekToPassageForListening = useCallback(
    (sectionId: string, passageId: string) => {
      const targetSection = sectionsById.get(sectionId);
      const targetTrack = targetSection?.audio?.narratorTracks.find((t) => t.narratorId === narratorId);
      if (!targetSection || !targetTrack) return;
      const passageIndex = targetSection.passages.findIndex((p) => p.id === passageId);
      const word = (targetSection.audio?.words ?? []).find((w) => w.passageId === passageId);
      if (passageIndex >= 0)
        setPosition(book.id, { sectionId, passageIndex, audioTimeMs: word?.startMs ?? 0 });
      audioSeekTo(word?.startMs ?? 0);
      audioPlay();
    },
    [sectionsById, narratorId, setPosition, book.id, audioSeekTo, audioPlay]
  );

  // Click-a-specific-word-to-narrate-from-there — the word-granularity
  // counterpart above.
  const handleWordClick = useCallback(
    (passageId: string, wordIndex: number) => {
      const sectionId = passageLookup.sectionOf.get(passageId);
      const targetSection = sectionId ? sectionsById.get(sectionId) : undefined;
      const targetTrack = targetSection?.audio?.narratorTracks.find((t) => t.narratorId === narratorId);
      if (!sectionId || !targetSection || !targetTrack) return;
      const passageIndex = targetSection.passages.findIndex((p) => p.id === passageId);
      if (passageIndex < 0) return;
      const word = (targetSection.audio?.words ?? []).filter((w) => w.passageId === passageId)[wordIndex];
      setPosition(book.id, { sectionId, passageIndex, audioTimeMs: word?.startMs ?? 0 });
      if (word) audioSeekTo(word.startMs);
      audioPlay();
    },
    [passageLookup, sectionsById, narratorId, setPosition, book.id, audioSeekTo, audioPlay]
  );

  const handleSeek = useCallback((ms: number) => audioSeekTo(Math.max(0, ms)), [audioSeekTo]);

  // "Back to narration" (reader-issues.md #8) — the nudge that appears once
  // the reader has manually turned away from whichever section is actually
  // playing. This only ever makes sense while listening: audio playing
  // somewhere is a plain fact to navigate back to, unlike plain reading
  // (no playback, just a resume-position guess) where the same nudge read
  // as the app second-guessing a reader who may have turned away on
  // purpose — confusing enough that it's not worth having outside audio at
  // all, which is why this lives here rather than as its own
  // reader-wide hook.
  const awayFromNarration = isListen && !isFollowingNarration;
  const nudgeDirection: "up" | "down" = audioIndex < activeIndex ? "up" : "down";

  const jumpToNarration = useCallback(() => {
    goTo(audioIndex, { animate: false });
    if (!currentPlayingPassageId) return;
    requestAnimationFrame(() => {
      getSlideEl(audioSection.id)
        ?.querySelector(`[data-passage-id="${currentPlayingPassageId}"]`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }, [goTo, audioIndex, audioSection.id, currentPlayingPassageId, getSlideEl]);

  // Only subscribes while the player is actually mounted; the render site
  // ignores playerHeight whenever !isListen, so there's no need to reset it
  // back to 0 here.
  const [playerHeight, setPlayerHeight] = useState(0);
  useEffect(() => {
    if (!isListen) return;
    const el = playerContainerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => setPlayerHeight(entries[0].contentRect.height));
    ro.observe(el);
    return () => ro.disconnect();
  }, [isListen, playerContainerRef]);

  return {
    isListen,
    hasNarration,
    audioSection,
    audioSectionTrack,
    usesRecordedAudio,
    narratorOptions,
    currentPlayingPassageId,
    currentWordIndex,
    audioIndex,
    isFollowingNarration,
    seekToPassageForListening,
    handleWordClick,
    handleSeek,
    awayFromNarration,
    nudgeDirection,
    jumpToNarration,
    playerHeight,
  };
}
