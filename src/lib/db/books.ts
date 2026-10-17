import { db } from "@/lib/db/client";
import type { BookRow, TocSource } from "@/lib/db/types";

export function createBook(book: {
  id: string;
  title: string;
  author: string | null;
  course: string | null;
  filePath: string;
  fileSizeBytes: number;
  pageCount: number;
  tocSource: TocSource;
}) {
  db.prepare(
    `insert into books (id, title, author, course, file_path, file_size_bytes, page_count, toc_source)
     values (@id, @title, @author, @course, @filePath, @fileSizeBytes, @pageCount, @tocSource)`,
  ).run(book);
}

export function getAllBooks(): BookRow[] {
  return db
    .prepare(
      `select * from books
       order by (last_read_at is null), last_read_at desc, created_at desc`,
    )
    .all() as BookRow[];
}

export function getBookById(id: string): BookRow | undefined {
  return db.prepare(`select * from books where id = ?`).get(id) as BookRow | undefined;
}

export function updateLastPageRead(id: string, page: number) {
  db.prepare(
    `update books set last_page_read = ?, last_read_at = datetime('now') where id = ?`,
  ).run(page, id);
}

export function updateTocSource(id: string, tocSource: TocSource) {
  db.prepare(`update books set toc_source = ? where id = ?`).run(tocSource, id);
}

export function deleteBook(id: string) {
  db.prepare(`delete from books where id = ?`).run(id);
}
