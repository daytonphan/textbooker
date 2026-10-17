import { notFound } from "next/navigation";
import { getBookById } from "@/lib/db/books";
import { getTocEntriesForBook } from "@/lib/db/toc";
import { TocEditorClient } from "@/components/toc-editor/TocEditorClient";

export default async function TocEditorPage(props: PageProps<"/books/[bookId]/toc">) {
  const { bookId } = await props.params;
  const book = getBookById(bookId);
  if (!book) notFound();

  const entries = getTocEntriesForBook(bookId);
  return <TocEditorClient book={book} initialEntries={entries} />;
}
