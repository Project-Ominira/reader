"use client";

import { ArrowDown, ArrowUp } from "lucide-react";

type Props = {
  bottom: number;
  direction: "up" | "down";
  onClick: () => void;
};

export default function BackToCurrentButton({ bottom, direction, onClick }: Props) {
  return (
    <button
      onClick={onClick}
      title="Back to current"
      // A clear gap above the player bar (not an overlap into it) so this
      // reads as its own floating control, not an attached part of the
      // player.
      style={{ bottom }}
      className="fixed left-1/2 -translate-x-1/2 z-30 w-10 h-10 flex items-center justify-center bg-[var(--reader-surface)] text-[var(--reader-text)] border border-[var(--reader-border)] rounded-full cursor-pointer shadow-lg"
    >
      {direction === "up" ? <ArrowUp size={18} /> : <ArrowDown size={18} />}
    </button>
  );
}
