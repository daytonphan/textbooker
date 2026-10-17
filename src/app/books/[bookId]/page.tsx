import { notFound } from "next/navigation";
import { getBookById } from "@/lib/db/books";
import { getTocEntriesForBook } from "@/lib/db/toc";
import { getBookmarksForBook } from "@/lib/db/bookmarks";
import { ReaderClient } from "@/components/reader/ReaderClient";

export default async function BookReaderPage(props: PageProps<"/books/[bookId]">) {
  const { bookId } = await props.params;
  const book = getBookById(bookId);
  if (!book) notFound();

  const tocEntries = getTocEntriesForBook(bookId);
  const bookmarks = getBookmarksForBook(bookId);

  return <ReaderClient book={book} tocEntries={tocEntries} bookmarks={bookmarks} />;
}
