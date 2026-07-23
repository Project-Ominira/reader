import { listBooks } from "@/lib/book/repository";
import { computeAudioStatus, firstNarratorTrackSrc } from "@/lib/audio/status";
import AudioAdminTable, { type AudioAdminRow } from "./AudioAdminTable";

export const dynamic = "force-dynamic";

export default async function AdminAudioPage() {
  const books = await listBooks();
  const rows: AudioAdminRow[] = books
    .map((book) => ({
      slug: book.slug,
      title: book.metadata.title,
      author: book.metadata.author,
      cover: book.metadata.cover,
      status: computeAudioStatus(book),
      previewSrc: firstNarratorTrackSrc(book),
    }))
    .sort((a, b) => a.title.localeCompare(b.title));

  const readyCount = rows.filter((r) => r.status === "ready").length;
  const partialCount = rows.filter((r) => r.status === "partial").length;

  return (
    <main className="max-w-3xl mx-auto px-6 py-10">
      <div className="flex items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--reader-text)] tracking-tight mb-1">
            Book audio
          </h1>
          <p className="text-sm text-[var(--reader-text-muted)]">
            Narration via a local Kokoro-FastAPI server, one default voice for every book.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-none">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-500/10 rounded-full px-2.5 py-1">
            {readyCount} ready
          </span>
          {partialCount > 0 && (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 bg-amber-50 dark:text-amber-400 dark:bg-amber-500/10 rounded-full px-2.5 py-1">
              {partialCount} partial
            </span>
          )}
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--reader-text-muted)] bg-[var(--reader-surface-hover)] rounded-full px-2.5 py-1">
            {rows.length} total
          </span>
        </div>
      </div>
      <AudioAdminTable books={rows} />
    </main>
  );
}
