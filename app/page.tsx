import Link from "next/link";
import { listBooks } from "@/lib/book/repository";

export default async function Home() {
  const books = await listBooks();

  return (
    <div className="min-h-screen bg-sand-50 px-6 py-12">
      <div className="max-w-3xl mx-auto">
        <span className="text-xs font-semibold tracking-wide uppercase text-sand-500">
          Ominira
        </span>
        <h1 className="text-2xl font-semibold font-serif text-sand-950 mt-1 mb-6">Library</h1>

        {books.length === 0 && (
          <p className="text-sm text-sand-600">
            No books ingested yet. Run{" "}
            <code className="bg-sand-100 px-1.5 py-0.5 rounded-xs">ingestion ingest &lt;epub_path&gt;</code>{" "}
            (see <code className="bg-sand-100 px-1.5 py-0.5 rounded-xs">/ingestion</code>) against
            an EPUB in <code className="bg-sand-100 px-1.5 py-0.5 rounded-xs">content/epub-source/</code>.
          </p>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-8">
          {books.map((book) => (
            <Link key={book.slug} href={`/read/${book.slug}`} className="block group">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={book.metadata.cover}
                alt={book.metadata.title}
                className="w-full aspect-[2/3] object-cover rounded-xs shadow-sm mb-2.5"
              />
              <div className="text-sm font-semibold text-sand-950 group-hover:text-brand-500 leading-tight">
                {book.metadata.title}
              </div>
              <div className="text-xs text-sand-600 mt-0.5">{book.metadata.author}</div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
