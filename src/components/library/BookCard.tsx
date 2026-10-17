import Link from "next/link";
import type { BookRow } from "@/lib/db/types";
import { DeleteBookButton } from "@/components/library/DeleteBookButton";

export function BookCard({ book }: { book: BookRow }) {
  const progress = book.page_count > 0 ? book.last_page_read / book.page_count : 0;

  return (
    <div className="group relative rounded-lg border border-slate-200 p-4 transition hover:border-slate-400 dark:border-slate-800 dark:hover:border-slate-600">
      <Link href={`/books/${book.id}`} className="block">
        <h2 className="font-medium leading-snug">{book.title}</h2>
        {(book.course || book.author) && (
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            {[book.course, book.author].filter(Boolean).join(" · ")}
          </p>
        )}
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
          <div
            className="h-full rounded-full bg-slate-900 dark:bg-slate-300"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>
        <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
          Page {book.last_page_read} of {book.page_count}
          {book.toc_source === "none" && " · no table of contents yet"}
        </p>
      </Link>
      <div className="absolute right-3 top-3 opacity-0 transition group-hover:opacity-100">
        <DeleteBookButton bookId={book.id} title={book.title} />
      </div>
    </div>
  );
}
