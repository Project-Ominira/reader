import { create } from "zustand";

/**
 * Playback state lives outside the Reader component tree on purpose: the
 * product spec requires narration to keep playing across navigation and
 * while backgrounded, podcast-style. There's only one route today, so the
 * <AudioPlayer/> that reads this store still happens to mount inside
 * Reader — but nothing here assumes that, so lifting it to the root layout
 * later (once there's a second route to navigate to) is a pure move, no
 * state redesign.
 */
type AudioState = {
  isPlaying: boolean;
  currentTimeMs: number;
  narratorId: string;
  speed: number;

  play: () => void;
  pause: () => void;
  toggle: () => void;
  seekTo: (ms: number) => void;
  tick: (deltaMs: number) => void;
  setNarratorId: (id: string) => void;
  setSpeed: (speed: number) => void;
};

// Empty until useReaderNarration seeds it with the loaded book's first
// narrator — there's no default/fallback voice: a book with no narrators
// has no listen mode at all, so an unmatched id is a fine idle state.
export const useAudioStore = create<AudioState>((set) => ({
  isPlaying: false,
  currentTimeMs: 0,
  narratorId: "",
  speed: 1,

  play: () => set({ isPlaying: true }),
  pause: () => set({ isPlaying: false }),
  toggle: () => set((s) => ({ isPlaying: !s.isPlaying })),
  seekTo: (ms) => set({ currentTimeMs: Math.max(0, ms) }),
  tick: (deltaMs) =>
    set((s) => (s.isPlaying ? { currentTimeMs: s.currentTimeMs + deltaMs * s.speed } : {})),
  // Switching narrator switches timelines entirely (a different recording,
  // or the live TTS engine) — the old currentTimeMs has no meaning on the
  // new one, so reset it rather than leaving playback looking corrupted.
  setNarratorId: (narratorId) => set({ narratorId, currentTimeMs: 0 }),
  setSpeed: (speed) => set({ speed }),
}));
