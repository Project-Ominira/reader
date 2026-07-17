"use client";

import { Minus, Plus, X } from "lucide-react";
import {
  SCALE_MAX,
  SCALE_MIN,
  SCALE_STEP,
  useReaderStore,
  type Theme,
} from "@/stores/reader-store";

/** Row shell used by every control below: label on the left, control on the
 * right. */
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <span className="text-sm font-medium text-[var(--reader-text)] flex-none">{label}</span>
      {children}
    </div>
  );
}

/** A Minus/Plus pair flanking the current value on a shared 10-100 scale
 * (step 10) — the same plain number for font size, spacing, and width,
 * instead of an "A" glyph or an icon whose meaning has to be guessed. */
function ScaleStepper({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const atMin = value <= SCALE_MIN;
  const atMax = value >= SCALE_MAX;
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => onChange(Math.max(SCALE_MIN, value - SCALE_STEP))}
        disabled={atMin}
        className="w-6 h-6 rounded-full border border-[var(--reader-border)] bg-transparent cursor-pointer flex items-center justify-center text-[var(--reader-text)] disabled:opacity-30 disabled:cursor-default"
      >
        <Minus size={12} />
      </button>
      <span className="w-9 text-center text-xs font-semibold tabular-nums text-[var(--reader-text)]">
        {value}
      </span>
      <button
        onClick={() => onChange(Math.min(SCALE_MAX, value + SCALE_STEP))}
        disabled={atMax}
        className="w-6 h-6 rounded-full border border-[var(--reader-border)] bg-transparent cursor-pointer flex items-center justify-center text-[var(--reader-text)] disabled:opacity-30 disabled:cursor-default"
      >
        <Plus size={12} />
      </button>
    </div>
  );
}

type Props = {
  className?: string;
  style?: React.CSSProperties;
  onClose?: () => void;
};

/** Typography/theme popover — deliberately minimal for now (per product
 * decision): light/dark only (a segmented tab, not a native select — those
 * carry inconsistent browser chrome that reads at odds with the rest of
 * this panel), a single default font with no picker, and font size/spacing/
 * width all sharing one plain 10-100 stepper scale. */
export default function StylePanel({ className, style, onClose }: Props) {
  const fontSizeScale = useReaderStore((s) => s.fontSizeScale);
  const setFontSizeScale = useReaderStore((s) => s.setFontSizeScale);
  const theme = useReaderStore((s) => s.theme);
  const setTheme = useReaderStore((s) => s.setTheme);
  const lineSpacingScale = useReaderStore((s) => s.lineSpacingScale);
  const setLineSpacingScale = useReaderStore((s) => s.setLineSpacingScale);
  const contentWidthScale = useReaderStore((s) => s.contentWidthScale);
  const setContentWidthScale = useReaderStore((s) => s.setContentWidthScale);
  const resetToDefaults = useReaderStore((s) => s.resetToDefaults);

  return (
    <div
      style={style}
      className={`w-72 bg-[var(--reader-surface)] border border-[var(--reader-border)] rounded-lg shadow-lg p-4.5 box-border ${
        className ?? ""
      }`}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-semibold text-[var(--reader-text)]">Display</span>
        <button
          onClick={onClose}
          className="bg-transparent border-none cursor-pointer text-[var(--reader-text-muted)] w-6 h-6 flex items-center justify-center flex-none"
        >
          <X size={16} />
        </button>
      </div>

      <div className="h-px bg-[var(--reader-border)]" />

      <Row label="Theme">
        <div className="flex items-center gap-0.5 rounded-full bg-[var(--reader-surface-hover)] p-0.5">
          {(["light", "dark"] as Theme[]).map((id) => (
            <button
              key={id}
              onClick={() => setTheme(id)}
              className={`text-xs font-medium py-1.5 px-3.5 rounded-full cursor-pointer capitalize ${
                theme === id
                  ? "bg-brand-500 text-white"
                  : "bg-transparent text-[var(--reader-text-muted)]"
              }`}
            >
              {id}
            </button>
          ))}
        </div>
      </Row>

      <div className="h-px bg-[var(--reader-border)]" />

      <Row label="Font size">
        <ScaleStepper value={fontSizeScale} onChange={setFontSizeScale} />
      </Row>

      <div className="h-px bg-[var(--reader-border)]" />

      <Row label="Spacing">
        <ScaleStepper value={lineSpacingScale} onChange={setLineSpacingScale} />
      </Row>

      <div className="h-px bg-[var(--reader-border)]" />

      <Row label="Width">
        <ScaleStepper value={contentWidthScale} onChange={setContentWidthScale} />
      </Row>

      <div className="h-px bg-[var(--reader-border)] mb-3.5" />

      <button
        onClick={() => {
          resetToDefaults();
          onClose?.();
        }}
        className="w-full py-2.5 rounded-full border border-[var(--reader-border)] bg-transparent cursor-pointer text-sm text-[var(--reader-text-muted)]"
      >
        Reset to default
      </button>
    </div>
  );
}
