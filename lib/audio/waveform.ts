/**
 * Downsamples a decoded audio buffer into a fixed number of bars (each the
 * mean absolute amplitude of its slice, normalized 0-1 against the loudest
 * bar) — a plain-JS replacement for what a waveform-visualizer package
 * would compute, so a saved voice note's full-length shape can render
 * without pulling in a third-party dependency.
 */
export function computeWaveformBars(buffer: AudioBuffer, barCount: number): number[] {
  const raw = buffer.getChannelData(0);
  const blockSize = Math.max(1, Math.floor(raw.length / barCount));
  const bars: number[] = [];
  for (let i = 0; i < barCount; i++) {
    const start = i * blockSize;
    let sum = 0;
    for (let j = 0; j < blockSize; j++) sum += Math.abs(raw[start + j] ?? 0);
    bars.push(sum / blockSize);
  }
  const max = Math.max(...bars, 0.0001);
  return bars.map((v) => v / max);
}
