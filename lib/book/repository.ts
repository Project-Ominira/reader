import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseBookDocument, type BookDocument } from "./schema";

const BOOKS_DIR = path.join(process.cwd(), "content", "books");

export class BookNotFoundError extends Error {
  constructor(slug: string) {
    super(`No book found for slug "${slug}"`);
    this.name = "BookNotFoundError";
  }
}

export class BookValidationError extends Error {
  constructor(slug: string, issues: string) {
    super(`Book "${slug}" failed schema validation:\n${issues}`);
    this.name = "BookValidationError";
  }
}

/**
 * Reads and validates a book by slug. Today this reads local JSON fixtures;
 * once books are published to a CDN, only this function's body changes
 * (local read -> `fetch(cdnUrl)`) — callers and the return type stay the same.
 */
export async function getBookDocument(slug: string): Promise<BookDocument> {
  let raw: string;
  try {
    raw = await readFile(path.join(BOOKS_DIR, `${slug}.json`), "utf-8");
  } catch {
    throw new BookNotFoundError(slug);
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (err) {
    throw new BookValidationError(slug, `not valid JSON (${(err as Error).message})`);
  }

  const parsed = parseBookDocument(json);
  if (!parsed.ok) {
    throw new BookValidationError(slug, parsed.error.message);
  }
  return parsed.data;
}

/**
 * Persists a book back to its JSON fixture — used by the audio admin panel
 * to write generated narration tracks in place. Validates before writing so
 * a bad in-memory mutation can't corrupt the file on disk.
 */
export async function writeBookDocument(slug: string, doc: BookDocument): Promise<void> {
  const parsed = parseBookDocument(doc);
  if (!parsed.ok) {
    throw new BookValidationError(slug, parsed.error.message);
  }
  await writeFile(path.join(BOOKS_DIR, `${slug}.json`), `${JSON.stringify(parsed.data, null, 2)}\n`, "utf-8");
}

/**
 * Lists every ingested/hand-authored book for the library index. A book
 * that fails to read or validate is skipped (and logged) rather than
 * taking the whole listing down — one bad file shouldn't 500 the homepage.
 */
export async function listBooks(): Promise<BookDocument[]> {
  let files: string[];
  try {
    files = await readdir(BOOKS_DIR);
  } catch {
    return [];
  }

  const books: BookDocument[] = [];
  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    const slug = file.slice(0, -".json".length);
    try {
      books.push(await getBookDocument(slug));
    } catch (err) {
      console.error(`Skipping ${file} in library listing: ${(err as Error).message}`);
    }
  }
  return books;
}
