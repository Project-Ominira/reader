"use server";

import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { revalidatePath } from "next/cache";
import { getBookDocument, writeBookDocument } from "@/lib/book/repository";
import { synthesizeSection } from "@/lib/audio/kokoro";
import { spokenPassageText } from "@/lib/audio/narrationText";
import { flattenSections } from "@/lib/search/bookIndex";
import type { Section } from "@/lib/book/schema";

const DEFAULT_NARRATOR_ID = "kokoro-default";
const DEFAULT_NARRATOR_NAME = process.env.KOKORO_NARRATOR_NAME ?? "Narrator";
const AUDIO_PUBLIC_DIR = path.join(process.cwd(), "public", "audio");

function sectionScript(section: Section): string {
  const parts = section.title ? [section.title] : [];
  for (const passage of section.passages) {
    if (passage.type === "image") continue;
    parts.push(spokenPassageText(passage));
  }
  return parts.join("\n\n").trim();
}

export type GenerateResult = { ok: true } | { ok: false; error: string };

/**
 * Regenerates every section's narration for one book, sequentially (one
 * Kokoro request at a time — this hits a single local TTS process, not a
 * pool). Overwrites any existing tracks, which is the "regenerate" path too.
 */
export async function generateBookAudio(slug: string): Promise<GenerateResult> {
  try {
    const book = await getBookDocument(slug);
    const sectionsById = new Map(flattenSections(book.sections).map((s) => [s.id, s]));

    for (const sectionId of book.spine) {
      const section = sectionsById.get(sectionId);
      const text = section ? sectionScript(section) : "";
      if (!section || !text) continue;

      const { audio, durationMs } = await synthesizeSection(text);
      const destPath = path.join(AUDIO_PUBLIC_DIR, slug, `${sectionId}.mp3`);
      await mkdir(path.dirname(destPath), { recursive: true });
      await writeFile(destPath, audio);

      section.audio = {
        narratorTracks: [
          { narratorId: DEFAULT_NARRATOR_ID, src: `/audio/${slug}/${sectionId}.mp3`, durationMs },
        ],
      };
    }

    if (!book.narrators.some((n) => n.id === DEFAULT_NARRATOR_ID)) {
      book.narrators = [...book.narrators, { id: DEFAULT_NARRATOR_ID, name: DEFAULT_NARRATOR_NAME }];
    }

    await writeBookDocument(slug, book);
    revalidatePath("/admin/audio");
    revalidatePath(`/read/${slug}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
