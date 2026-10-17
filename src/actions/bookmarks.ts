"use server";

import { revalidatePath } from "next/cache";
import { addBookmark, getBookmarkForPage, removeBookmark } from "@/lib/db/bookmarks";

export async function toggleBookmark(bookId: string, page: number) {
  const existing = getBookmarkForPage(bookId, page);
  if (existing) {
    removeBookmark(existing.id);
  } else {
    addBookmark(bookId, page, null);
  }
  revalidatePath(`/books/${bookId}`);
}

export async function removeBookmarkAction(bookId: string, bookmarkId: string) {
  removeBookmark(bookmarkId);
  revalidatePath(`/books/${bookId}`);
}
