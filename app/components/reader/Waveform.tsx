"use client";

import { useEffect, useRef } from "react";

type BarStyleProps = {
  width: number;
  height: number;
  barWidth?: number;
  gap?: number;
};

// Canvas fillStyle can't resolve a `var(--x)` reference the way a DOM style
// can — it wants an already-computed color. Colors here are handed in as
// plain strings so callers can pass the reader's own CSS custom properties
// (theme-correct in both light/dark) without needing to know that; this
// reads the computed value off the canvas itself, which inherits those
// properties from its themed ancestors same as any other element would.
function resolveColor(el: Element, color: string): string {
  const match = /^var\((--[\w-]+)\)$/.exec(color.trim());
  if (!match) return color;
  const resolved = getComputedStyle(el).getPropertyValue(match[1]).trim();
  return resolved || color;
}

/** Draws a fixed set of pre-computed bars (a decoded, already-recorded
 * clip) — `progress` (0-1) colors the played portion differently, the
 * WhatsApp-style "how far through this voice note am I" cue. */
export function WaveformBars({
  bars,
  progress = 0,
  barColor = "rgb(184, 184, 184)",
  barPlayedColor,
  width,
  height,
  barWidth = 2,
  gap = 1.5,
}: BarStyleProps & { bars: number[]; progress?: number; barColor?: string; barPlayedColor?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || width <= 0 || height <= 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const resolvedBarColor = resolveColor(canvas, barColor);
    const resolvedPlayedColor = barPlayedColor ? resolveColor(canvas, barPlayedColor) : undefined;

    const step = barWidth + gap;
    const barCount = Math.max(1, Math.floor(width / step));
    for (let i = 0; i < barCount; i++) {
      const amp = bars.length ? bars[Math.floor((i / barCount) * bars.length)] : 0;
      const barH = Math.max(2, amp * height);
      const x = i * step;
      const y = (height - barH) / 2;
      ctx.fillStyle = resolvedPlayedColor && i / barCount < progress ? resolvedPlayedColor : resolvedBarColor;
      ctx.fillRect(x, y, barWidth, barH);
    }
  }, [bars, progress, barColor, barPlayedColor, width, height, barWidth, gap]);

  return <canvas ref={canvasRef} style={{ width, height, display: "block" }} />;
}

/** Live recording meter — reads the in-progress MediaStream via an
 * AnalyserNode and redraws on every animation frame. A second, independent
 * consumer of the same stream MediaRecorder is already capturing; analysis
 * and recording don't interfere with each other. */
export function LiveWaveform({
  stream,
  barColor = "var(--color-brand-500)",
  width,
  height,
  barWidth = 2,
  gap = 1.5,
}: BarStyleProps & { stream: MediaStream; barColor?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || width <= 0 || height <= 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const audioCtx = new AudioContext();
    const source = audioCtx.createMediaStreamSource(stream);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);

    const resolvedBarColor = resolveColor(canvas, barColor);
    const step = barWidth + gap;
    const barCount = Math.max(1, Math.floor(width / step));
    let raf = 0;

    const draw = () => {
      analyser.getByteFrequencyData(data);
      ctx.clearRect(0, 0, width, height);
      for (let i = 0; i < barCount; i++) {
        const value = data[Math.floor((i / barCount) * data.length)] / 255;
        const barH = Math.max(2, value * height);
        const x = i * step;
        const y = (height - barH) / 2;
        ctx.fillStyle = resolvedBarColor;
        ctx.fillRect(x, y, barWidth, barH);
      }
      raf = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(raf);
      source.disconnect();
      analyser.disconnect();
      audioCtx.close().catch(() => {});
    };
  }, [stream, barColor, width, height, barWidth, gap]);

  return <canvas ref={canvasRef} style={{ width, height, display: "block" }} />;
}
