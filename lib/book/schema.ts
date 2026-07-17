import { z } from "zod";
import { BookDocumentSchema } from "./schema.generated";
import type { BookDocument } from "./schema.generated";

export { BookDocumentSchema };
export type { BookDocument };

// Named aliases derived from the single generated BookDocument type — not separate
// definitions, so there's nothing here that can drift from schema/book-document.schema.json.
// There is no separate Chapter/Part type: a chapter is just a Section with passages
// and no children; a part is just a Section with children and no passages of its own.
export type Section = BookDocument["sections"][number];
export type Passage = Section["passages"][number];
export type Mark = NonNullable<Passage["marks"]>[number];
export type Narrator = BookDocument["narrators"][number];
export type BookMetadata = BookDocument["metadata"];
export type Note = BookDocument["notes"][number];

export type ParseBookDocumentResult =
  | { ok: true; data: BookDocument }
  | { ok: false; error: z.ZodError };

/**
 * Never trust a fetched book JSON blob just because it round-tripped through
 * our own pipeline once — validate on every load, ingestion and runtime alike.
 */
export function parseBookDocument(raw: unknown): ParseBookDocumentResult {
  const result = BookDocumentSchema.safeParse(raw);
  if (!result.success) {
    return { ok: false, error: result.error };
  }
  return { ok: true, data: result.data };
}
