import { db } from "@/lib/db/client";
import type { TocEntryRow, TocKind } from "@/lib/db/types";

export interface NewTocEntry {
  id: string;
  parentId: string | null;
  title: string;
  startPage: number;
  kind: TocKind;
  sortOrder: number;
}

const insertStmt = db.prepare(
  `insert into toc_entries (id, book_id, parent_id, title, start_page, kind, sort_order)
   values (@id, @bookId, @parentId, @title, @startPage, @kind, @sortOrder)`,
);

/**
 * `parent_id` is a self-referencing foreign key, so a child row can't be
 * inserted before its parent exists. Callers (especially the manual editor,
 * which round-trips whatever order the UI happens to hold) don't guarantee
 * parent-before-child order, so sort defensively rather than trust them.
 */
function parentsBeforeChildren(entries: NewTocEntry[]): NewTocEntry[] {
  const byId = new Map(entries.map((e) => [e.id, e]));
  const placed = new Set<string>();
  const ordered: NewTocEntry[] = [];
  let remaining = entries;

  while (remaining.length > 0) {
    const [ready, notReady] = partition(
      remaining,
      (e) => e.parentId === null || !byId.has(e.parentId) || placed.has(e.parentId),
    );
    if (ready.length === 0) {
      throw new Error("toc_entries has a cyclic or otherwise unresolvable parent_id chain");
    }
    for (const e of ready) placed.add(e.id);
    ordered.push(...ready);
    remaining = notReady;
  }
  return ordered;
}

function partition<T>(items: T[], predicate: (item: T) => boolean): [T[], T[]] {
  const yes: T[] = [];
  const no: T[] = [];
  for (const item of items) (predicate(item) ? yes : no).push(item);
  return [yes, no];
}

export function insertTocEntries(bookId: string, entries: NewTocEntry[]) {
  const ordered = parentsBeforeChildren(entries);
  const insertAll = db.transaction((rows: NewTocEntry[]) => {
    for (const row of rows) {
      insertStmt.run({ bookId, ...row });
    }
  });
  insertAll(ordered);
}

export function getTocEntriesForBook(bookId: string): TocEntryRow[] {
  return db
    .prepare(
      `select * from toc_entries where book_id = ? order by sort_order asc`,
    )
    .all(bookId) as TocEntryRow[];
}

/** Full delete-and-reinsert — simpler and safer than diffing at this row count. */
export function replaceTocEntries(bookId: string, entries: NewTocEntry[]) {
  const ordered = parentsBeforeChildren(entries);
  const replace = db.transaction((rows: NewTocEntry[]) => {
    db.prepare(`delete from toc_entries where book_id = ?`).run(bookId);
    for (const row of rows) {
      insertStmt.run({ bookId, ...row });
    }
  });
  replace(ordered);
}
