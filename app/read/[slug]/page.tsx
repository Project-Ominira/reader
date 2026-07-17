import { notFound } from "next/navigation";
import Reader from "@/app/components/Reader";
import { BookNotFoundError, getBookDocument } from "@/lib/book/repository";

export default async function ReadBookPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  let book;
  try {
    book = await getBookDocument(slug);
  } catch (err) {
    if (err instanceof BookNotFoundError) {
      notFound();
    }
    // BookValidationError and anything unexpected surface through error.tsx
    throw err;
  }
  return <Reader book={book} />;
}
