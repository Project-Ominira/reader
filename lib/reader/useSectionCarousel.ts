import { useCallback, useEffect, useRef, useState } from "react";

// Swipe must be clearly horizontal and past this distance before it's read as
// "turn the page" — otherwise an ordinary vertical scroll/drag inside a tall
// section would get misread as a page turn.
const MIN_SWIPE_PX = 60;
const HORIZONTAL_DOMINANCE = 1.5;

/**
 * Drives the section-carousel reader: which section (spine entry) is the
 * active "slide", how to move between slides, and the same chrome
 * hide/show + scroll-progress tracking useReaderChrome used to own — now
 * rebound to whichever slide is currently active instead of one shared
 * scroll container, since each section now owns its own vertical scroll.
 *
 * Two earlier approaches to the *visual* transition both got chased into
 * dead ends: a hand-rolled `transform: translateX` (fractional-pixel seams
 * near the header) and then Embla Carousel (a horizontal carousel whose
 * slides are ALSO independently tall, vertically-scrolling regions isn't a
 * shape those libraries are built for — it kept producing new rendering
 * bugs, not fewer). The fix is to stop trying to animate a slide-past
 * transition at all: only the active section is ever mounted, and moving to
 * another one is a plain React remount with a quick CSS fade (BookContent's
 * `key={section.id}` + the `reader-fade-in` animation), not a translated
 * DOM. Swipe/arrow/edge-click/keyboard are all still just *inputs* that
 * call `next`/`prev`/`goTo` — this hook only ever tracks an index and
 * detects gestures, it doesn't render anything itself.
 *
 * `goTo`/`goToSection` default to an animated (smooth-transition) move,
 * matching an adjacent swipe/arrow/edge-click turn. Passing
 * `{ animate: false }` (chapters-drawer jumps, search jumps, the
 * back-to-current nudge, Home/End) teleports instead — a multi-section
 * jump has no meaningful "in-between" to animate through. With no
 * translated DOM left, both paths behave identically except for whether
 * the fade-in plays; `animate` is threaded through mostly so callers don't
 * need to change and so a future "skip the fade on a teleport" tweak has
 * somewhere to hang.
 */
export function useSectionCarousel({
  sectionIds,
  onScroll,
  onNavigate,
  disabled,
}: {
  sectionIds: string[];
  onScroll?: () => void;
  /** Fires whenever `goTo` actually changes the active index (not on every
   * call — only when the clamped target differs from the current slide),
   * regardless of which of the many paths (keyboard, swipe, chapters
   * drawer, search, resume, narration auto-advance, back-to-current)
   * triggered it. */
  onNavigate?: () => void;
  disabled?: boolean;
}) {
  const total = sectionIds.length;

  const [activeIndex, setActiveIndex] = useState(0);
  const activeIndexRef = useRef(0);
  useEffect(() => {
    activeIndexRef.current = activeIndex;
  }, [activeIndex]);

  const goTo = useCallback(
    (index: number, opts?: { animate?: boolean }) => {
      void opts;
      const clamped = Math.min(Math.max(index, 0), total - 1);
      if (clamped !== activeIndexRef.current) onNavigate?.();
      setActiveIndex(clamped);
    },
    [total, onNavigate]
  );
  const goToSection = useCallback(
    (id: string, opts?: { animate?: boolean }) => {
      const idx = sectionIds.indexOf(id);
      if (idx >= 0) goTo(idx, opts);
    },
    [sectionIds, goTo]
  );
  const next = useCallback(() => goTo(activeIndexRef.current + 1, { animate: true }), [goTo]);
  const prev = useCallback(() => goTo(activeIndexRef.current - 1, { animate: true }), [goTo]);

  // Slide DOM refs, registered by whichever single section is currently
  // mounted, so other hooks (resume, narration follow-scroll and its
  // back-to-narration nudge, search) can scroll within a specific slide
  // once it's active. Only ever holds one entry at a time now, but stays a
  // Map keyed by id rather than a single ref — every caller already
  // navigates first and looks the element up a frame later (see
  // useResumeScroll, useReaderNarration), so this shape didn't need to
  // change when rendering did.
  const slideEls = useRef(new Map<string, HTMLDivElement>());
  const registerCallbacks = useRef(new Map<string, (el: HTMLDivElement | null) => void>());
  const registerSlide = useCallback((id: string) => {
    let cb = registerCallbacks.current.get(id);
    if (!cb) {
      cb = (el) => {
        if (el) slideEls.current.set(id, el);
        else slideEls.current.delete(id);
      };
      registerCallbacks.current.set(id, cb);
    }
    return cb;
  }, []);
  const getSlideEl = useCallback((id: string) => slideEls.current.get(id), []);

  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 860);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const [chromeHidden, setChromeHidden] = useState(false);
  const [scrollPct, setScrollPct] = useState(0);
  const lastScrollTopRef = useRef(0);
  const activeSectionId = sectionIds[activeIndex];

  useEffect(() => {
    const el = activeSectionId ? slideEls.current.get(activeSectionId) : undefined;
    if (!el) return;
    const handleScroll = () => {
      const top = el.scrollTop;
      const last = lastScrollTopRef.current;
      if (top <= 0 || top < last - 4) setChromeHidden(false);
      else if (top > last + 4) setChromeHidden(true);
      lastScrollTopRef.current = top;
      const max = el.scrollHeight - el.clientHeight;
      const intraFraction = max > 0 ? Math.min(1, Math.max(0, top / max)) : 0;
      setScrollPct(total > 0 ? (activeIndex + intraFraction) / total : 0);
      onScroll?.();
    };
    // Reset the baseline to this slide's own current position — otherwise
    // the first delta after a page turn compares two unrelated slides'
    // scrollTop. Deliberately does NOT call handleScroll() here: that would
    // run the chrome hide/show branch against a scrollTop of 0 on every
    // fresh/unscrolled slide and force the header to reveal — animating
    // in right as the page turn is still settling, which is exactly what
    // produced an earlier seam-like glitch near the header. A page turn
    // should leave chrome visibility exactly as it was; only actual
    // scrolling (the listener below) should change it.
    lastScrollTopRef.current = el.scrollTop;
    const max = el.scrollHeight - el.clientHeight;
    const intraFraction = max > 0 ? Math.min(1, Math.max(0, el.scrollTop / max)) : 0;
    setScrollPct(total > 0 ? (activeIndex + intraFraction) / total : 0);
    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex, activeSectionId, total]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (disabled) return;
      if (e.key === "ArrowRight" || e.key === "PageDown" || e.key === " ") {
        e.preventDefault();
        next();
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        prev();
      } else if (e.key === "Home") goTo(0, { animate: false });
      else if (e.key === "End") goTo(total - 1, { animate: false });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [disabled, next, prev, goTo, total]);

  // Pointer-based swipe gesture *detection* — this is purely an input
  // signal (did the reader drag far enough, mostly horizontally, to mean
  // "turn the page"), never a rendering transform. next()/prev() do the
  // rest via the plain state-driven remount above.
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (disabled) return;
      touchStart.current = { x: e.clientX, y: e.clientY };
    },
    [disabled]
  );
  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      const start = touchStart.current;
      touchStart.current = null;
      if (disabled || !start) return;
      // A drag that produced an active text selection was a highlight
      // gesture, not a page-turn swipe — leave it alone.
      const sel = window.getSelection();
      if (sel && !sel.isCollapsed && sel.toString().trim()) return;
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      if (Math.abs(dx) < MIN_SWIPE_PX || Math.abs(dx) < Math.abs(dy) * HORIZONTAL_DOMINANCE) return;
      if (dx < 0) next();
      else prev();
    },
    [disabled, next, prev]
  );

  return {
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
  };
}
