"use client";

import { useTransition } from "react";
import { deleteBookAction } from "@/actions/books";

export function DeleteBookButton({ bookId, title }: { bookId: string; title: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        if (!confirm(`Delete "${title}"? This can't be undone.`)) return;
        startTransition(() => {
          deleteBookAction(bookId);
        });
      }}
      className="rounded-md px-2 py-1 text-xs text-slate-500 hover:bg-red-50 hover:text-red-700 disabled:opacity-50 dark:text-slate-400 dark:hover:bg-red-950 dark:hover:text-red-400"
    >
      {isPending ? "Deleting…" : "Delete"}
    </button>
  );
}
