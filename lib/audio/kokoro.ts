// Client for a local Kokoro-FastAPI server (https://github.com/remsky/Kokoro-FastAPI),
// e.g. `docker run -p 8880:8880 ghcr.io/remsky/kokoro-fastapi-cpu:latest`.

const BASE_URL = process.env.KOKORO_BASE_URL ?? "http://localhost:8880";
const DEFAULT_VOICE = process.env.KOKORO_VOICE ?? "af_heart";

export class KokoroError extends Error {}

type CaptionedSpeechResponse = {
  audio: string; // base64-encoded per response_format
  timestamps?: { word: string; start_time: number; end_time: number }[];
};

export type SynthesisResult = { audio: Buffer; durationMs: number };

/**
 * Calls /dev/captioned_speech rather than the plain OpenAI-compatible
 * /v1/audio/speech — same request shape, but the response also carries
 * word-level timestamps, whose last entry's end_time doubles as the clip's
 * own duration. That means no ffprobe/ffmpeg dependency just to measure
 * what we generated (the per-word data itself goes unused for now — see
 * SectionAudio.words, deferred until generation moves to per-passage calls).
 */
export async function synthesizeSection(text: string): Promise<SynthesisResult> {
  const res = await fetch(`${BASE_URL}/dev/captioned_speech`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "kokoro",
      input: text,
      voice: DEFAULT_VOICE,
      response_format: "mp3",
      stream: false,
    }),
  });
  if (!res.ok) {
    throw new KokoroError(
      `Kokoro /dev/captioned_speech failed (${res.status}): ${await res.text()} — is the Kokoro-FastAPI container running on ${BASE_URL}?`
    );
  }

  const body: CaptionedSpeechResponse = await res.json();
  const audio = Buffer.from(body.audio, "base64");
  const lastTimestamp = body.timestamps?.at(-1);
  const durationMs = lastTimestamp ? Math.round(lastTimestamp.end_time * 1000) : 0;
  return { audio, durationMs };
}
