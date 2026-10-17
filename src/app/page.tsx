import Link from "next/link";
import { getAllBooks } from "@/lib/db/books";
import { BookCard } from "@/components/library/BookCard";

export default function LibraryPage() {
  const books = getAllBooks();

  if (books.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
        <h1 className="text-lg font-medium">No books yet</h1>
        <p className="max-w-sm text-sm text-slate-500 dark:text-slate-400">
          Upload a PDF textbook to get a navigable table of contents — chapters, sections,
          exercises, and readings, all jumpable.
        </p>
        <Link
          href="/upload"
          className="mt-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-300"
        >
          Upload your first textbook
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl p-6">
      <h1 className="mb-4 text-lg font-medium">Your books</h1>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {books.map((book) => (
          <BookCard key={book.id} book={book} />
        ))}
      </div>
    </div>
  );
}
