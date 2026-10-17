import { randomUUID } from "node:crypto";
import { db } from "@/lib/db/client";
import type { BookmarkRow } from "@/lib/db/types";

export function getBookmarksForBook(bookId: string): BookmarkRow[] {
  return db
    .prepare(`select * from bookmarks where book_id = ? order by page asc`)
    .all(bookId) as BookmarkRow[];
}

export function getBookmarkForPage(bookId: string, page: number): BookmarkRow | undefined {
  return db
    .prepare(`select * from bookmarks where book_id = ? and page = ?`)
    .get(bookId, page) as BookmarkRow | undefined;
}

export function addBookmark(bookId: string, page: number, label: string | null): BookmarkRow {
  const id = randomUUID();
  db.prepare(
    `insert into bookmarks (id, book_id, page, label) values (?, ?, ?, ?)`,
  ).run(id, bookId, page, label);
  return { id, book_id: bookId, page, label, created_at: new Date().toISOString() };
}

export function removeBookmark(id: string) {
  db.prepare(`delete from bookmarks where id = ?`).run(id);
}
