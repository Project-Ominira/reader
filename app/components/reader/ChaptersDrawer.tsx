"use client";

import { useMemo } from "react";
import { Users, X } from "lucide-react";
import type { BookDocument, Section } from "@/lib/book/schema";
import { READING_NOW_PLACEHOLDER } from "@/lib/reader/constants";

type Props = {
  book: BookDocument;
  scrollPct: number;
  activeSectionId: string;
  isMobile: boolean;
  onNavigate: (sectionId: string) => void;
  onClose: () => void;
};

type SidebarRow = { section: Section; depth: number };

/**
 * Chapters/TOC drawer — an overlay over the content column, anchored at the
 * screen edge (the icon rail sits at a lower z-index and is simply covered
 * while this is open).
 *
 * Flattens the real content tree into rows (reader-issues #1) — arbitrary
 * depth, not hardcoded to Part>Chapter. A section with children renders as a
 * group header; a leaf renders as a navigable row, unless the source book's
 * own nav never listed it (title absent — front/back matter like a
 * half-title page), in which case it's real spine content but not shown
 * here, same as the book's own table of contents doesn't list it.
 */
export default function ChaptersDrawer({
  book,
  scrollPct,
  activeSectionId,
  isMobile,
  onNavigate,
  onClose,
}: Props) {
  const sidebarRows = useMemo(() => {
    const flatten = (sections: Section[], depth: number): SidebarRow[] =>
      sections.flatMap((s) => {
        const isGroup = s.children.length > 0;
        if (!isGroup && !s.title) return [];
        return [{ section: s, depth }, ...flatten(s.children, depth + 1)];
      });
    return flatten(book.sections, 0);
  }, [book.sections]);

  return (
    <>
      <div onClick={onClose} className="absolute top-0 right-0 bottom-0 left-0 bg-black/30 z-39" />
      <div className="absolute top-0 bottom-0 left-0 z-40 w-80 max-w-[85vw]">
        <div className="w-full h-full bg-[var(--reader-surface)] border-r border-[var(--reader-border)] shadow-lg flex flex-col overflow-hidden box-border">
          <div className="flex items-center justify-between pt-4 px-4 pb-3 flex-none">
            <span className="text-sm font-semibold text-[var(--reader-text)]">Contents</span>
            <button
              onClick={onClose}
              className="bg-transparent border-none cursor-pointer text-[var(--reader-text-muted)]"
            >
              <X size={16} />
            </button>
          </div>

          <div className="px-4 pb-3.5 flex gap-3 flex-none">
            <img
              src={book.metadata.cover}
              alt="cover"
              className="w-10 h-14 object-cover rounded-xs flex-none shadow-sm"
            />
            <div className="min-w-0 flex flex-col justify-center gap-1">
              <div className="text-sm font-semibold font-serif text-[var(--reader-text)] leading-tight truncate">
                {book.metadata.title}
              </div>
              <div className="text-xs text-[var(--reader-text-muted)] truncate">
                {book.metadata.author}
              </div>
              <div className="flex items-center gap-1 text-[11px] font-medium text-[var(--reader-text-muted)]">
                <span>{Math.round(scrollPct * 100)}% complete</span>
                <span>·</span>
                <Users size={11} />
                <span>{READING_NOW_PLACEHOLDER} reading now</span>
              </div>
            </div>
          </div>
          <div className="px-4 pb-3.5 flex-none">
            <div className="h-1.5 rounded-full bg-[var(--reader-surface-hover)] overflow-hidden">
              <div
                className="h-full bg-brand-500 rounded-full"
                style={{ width: `${Math.round(scrollPct * 100)}%` }}
              />
            </div>
          </div>

          <div className="h-px bg-[var(--reader-border)] flex-none" />

          <div className="om-scroll flex-1 overflow-y-auto px-2.5 py-2.5">
            {sidebarRows.map(({ section, depth }) => {
              const isGroup = section.children.length > 0;
              const hasContent = section.passages.length > 0;
              const isCurrent = section.id === activeSectionId;
              if (isGroup) {
                return (
                  <div
                    key={section.id}
                    style={{ paddingLeft: depth * 14 }}
                    className="pt-3.5 first:pt-0 pb-1.5 px-2.5 text-[11px] font-semibold tracking-wide uppercase text-[var(--reader-text-subtle)]"
                  >
                    {section.title}
                  </div>
                );
              }
              return (
                <div
                  key={section.id}
                  onClick={() => {
                    if (hasContent) onNavigate(section.id);
                    if (isMobile) onClose();
                  }}
                  style={{ paddingLeft: 10 + depth * 14 }}
                  className={`flex items-center py-2.5 pr-2.5 rounded-sm mb-0.5 ${
                    hasContent ? "cursor-pointer" : "cursor-default opacity-50"
                  } ${isCurrent ? "bg-brand-500/10" : "bg-transparent"}`}
                >
                  <span
                    className={`flex-1 text-xs text-capitalize ${
                      isCurrent ? "font-medium text-brand-500" : "font-normal text-[var(--reader-text)]"
                    }`}
                  >
                    {section.title}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
