"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import type { BookDocument } from "@/lib/book/schema";
import { buildBookIndex, searchBook, type SearchResult } from "@/lib/search/bookIndex";

function highlight(text: string, q: string) {
  if (!q) return text;
  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark
        style={{ background: "var(--reader-highlight)" }}
        className="text-inherit rounded-[2px]"
      >
        {text.slice(idx, idx + q.length)}
      </mark>
      {text.slice(idx + q.length)}
    </>
  );
}

type Props = {
  book: BookDocument;
  currentSectionId?: string;
  onNavigate?: (sectionId: string, passageId: string) => void;
  onClose?: () => void;
};

export default function SearchModal({ book, currentSectionId, onNavigate, onClose }: Props) {
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "chapter" | "notes" | "discourse">("all");
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const index = useMemo(() => buildBookIndex(book), [book]);
  const allResults = useMemo(() => searchBook(index, query), [index, query]);
  const chapterResults = useMemo(
    () => allResults.filter((r) => r.sectionId === currentSectionId),
    [allResults, currentSectionId]
  );
  // Notes and cross-reader discourse aren't backed by real data yet — this
  // only searches the book itself, per reader.md's MVP search scope.
  const notesResults: SearchResult[] = [];
  const discourseResults: SearchResult[] = [];

  const counts = {
    all: allResults.length,
    chapter: chapterResults.length,
    notes: notesResults.length,
    discourse: discourseResults.length,
  };

  const resultsByTab: Record<typeof activeTab, SearchResult[]> = {
    all: allResults,
    chapter: chapterResults,
    notes: notesResults,
    discourse: discourseResults,
  };
  const filtered = resultsByTab[activeTab];

  const tabs: { id: typeof activeTab; label: string }[] = [
    { id: "all", label: `All (${counts.all})` },
    { id: "chapter", label: `In this chapter (${counts.chapter})` },
    { id: "notes", label: `Notes (${counts.notes})` },
    { id: "discourse", label: `Discourse (${counts.discourse})` },
  ];

  return (
    <div
      className={`w-full h-full box-border bg-black/45 flex justify-center ${
        isMobile ? "items-stretch p-0" : "items-start py-16 px-6"
      }`}
    >
      <div
        className={`w-full bg-[var(--reader-surface)] shadow-lg flex flex-col box-border overflow-hidden ${
          isMobile ? "h-full rounded-none" : "max-w-[640px] h-[640px] rounded-lg"
        }`}
      >
        <div className="flex items-center gap-2.5 px-5 py-4 border-b border-[var(--reader-border)] flex-none">
          <Search size={18} className="text-[var(--reader-text-muted)]" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search this book..."
            className="flex-1 border-none outline-none text-md font-semibold text-[var(--reader-text)] bg-transparent"
          />
          {query && (
            <span
              onClick={() => setQuery("")}
              className="cursor-pointer text-[var(--reader-text-muted)]"
            >
              <X size={16} />
            </span>
          )}
          <span
            onClick={onClose}
            className="cursor-pointer text-sm font-medium text-[var(--reader-text-muted)] whitespace-nowrap"
          >
            {isMobile ? "Cancel" : "Close"}
          </span>
        </div>

        {/* <div className="flex gap-2 px-5 py-3 border-b border-[var(--reader-border)] flex-none overflow-x-auto">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex-none py-1.5 px-3.5 rounded-full border text-sm font-medium whitespace-nowrap cursor-pointer ${
                activeTab === t.id
                  ? "bg-brand-500 text-white border-brand-500"
                  : "bg-transparent text-[var(--reader-text)] border-[var(--reader-border)]"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div> */}

        <div className="om-scroll flex-1 overflow-y-auto px-5 py-4">
          {/* <div className="text-xs font-semibold tracking-wide uppercase text-[var(--reader-text-muted)] mb-2.5">
            Results
          </div> */}
          {filtered.map((r) => (
            <div
              key={r.passageId}
              onClick={() => {
                onNavigate?.(r.sectionId, r.passageId);
                onClose?.();
              }}
              className="py-3 border-b border-[var(--reader-border)] cursor-pointer"
            >
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-semibold text-[var(--reader-text)]">
                  {book.metadata.title}
                </span>
                <span className="text-sm text-[var(--reader-text-muted)]">— {book.metadata.author}</span>
              </div>
              <div className="text-xs font-medium text-[var(--reader-text-muted)] my-0.5 mb-1.5">
                {r.sectionTitle}
              </div>
              <span className="text-[15px] leading-[1.65] font-serif text-[var(--reader-text)]">
                {highlight(r.text, query)}
              </span>
            </div>
          ))}
          {query.trim() && filtered.length === 0 && (
            <p className="text-sm text-[var(--reader-text-muted)] text-center py-10">
              No results for &ldquo;{query}&rdquo;.
            </p>
          )}
          {/* {!query.trim() && (
            <p className="text-sm text-[var(--reader-text-muted)] text-center py-10">
              Type to search {book.metadata.title}.
            </p>
          )} */}
        </div>
      </div>
    </div>
  );
}
