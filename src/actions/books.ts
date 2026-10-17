"use server";

import { rm } from "node:fs/promises";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { deleteBook, getBookById, updateLastPageRead } from "@/lib/db/books";
import { absolutePathFor } from "@/lib/storage/local";

export async function updateReadingProgress(bookId: string, page: number) {
  const book = getBookById(bookId);
  if (!book) return;
  const clamped = Math.min(Math.max(page, 1), book.page_count);
  updateLastPageRead(bookId, clamped);
  // Deliberately no revalidatePath here: this fires on every page turn, and
  // re-rendering the route each time would fight the reader's own local state.
}

export async function deleteBookAction(bookId: string) {
  const book = getBookById(bookId);
  if (!book) return;
  deleteBook(bookId); // cascades toc_entries + bookmarks via FK
  await rm(absolutePathFor(book.file_path), { force: true });
  revalidatePath("/");
  redirect("/");
}
