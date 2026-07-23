import MiniSearch from "minisearch";
import type { BookDocument, Section } from "@/lib/book/schema";

export type SearchDoc = {
  id: string; // passage id
  sectionId: string;
  sectionTitle: string;
  text: string;
};

export type SearchResult = {
  passageId: string;
  sectionId: string;
  sectionTitle: string;
  text: string;
};

export function flattenSections(sections: Section[]): Section[] {
  return sections.flatMap((s) => [s, ...flattenSections(s.children)]);
}

/**
 * Client-side, single-book search (MVP scope per reader.md). Cross-book
 * semantic search is server-side and explicitly deferred.
 */
export function buildBookIndex(book: BookDocument): MiniSearch<SearchDoc> {
  const documents: SearchDoc[] = flattenSections(book.sections).flatMap((section) =>
    section.passages.map((p) => ({
      id: p.id,
      sectionId: section.id,
      sectionTitle: section.title ?? book.metadata.title,
      text: p.text,
    }))
  );

  const index = new MiniSearch<SearchDoc>({
    fields: ["text"],
    storeFields: ["sectionId", "sectionTitle", "text"],
    searchOptions: { prefix: true, fuzzy: 0.2 },
  });
  index.addAll(documents);
  return index;
}

export function searchBook(index: MiniSearch<SearchDoc>, query: string): SearchResult[] {
  if (!query.trim()) return [];
  return index.search(query).map((r) => ({
    passageId: String(r.id),
    sectionId: r.sectionId as string,
    sectionTitle: r.sectionTitle as string,
    text: r.text as string,
  }));
}
