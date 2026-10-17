import type { TocEntryRow, TocKind } from "@/lib/db/types";

export interface TocTreeNode extends TocEntryRow {
  children: TocTreeNode[];
}

export function buildTocTree(flat: TocEntryRow[]): TocTreeNode[] {
  const byId = new Map<string, TocTreeNode>();
  for (const entry of flat) byId.set(entry.id, { ...entry, children: [] });

  const roots: TocTreeNode[] = [];
  for (const entry of flat) {
    const node = byId.get(entry.id);
    if (!node) continue;
    const parent = entry.parent_id ? byId.get(entry.parent_id) : undefined;
    if (parent) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots; // rows already arrive in sort_order via the SQL query
}

/** The entry a reader is "currently in" — the latest one starting at or before this page. */
export function findCurrentEntry(flat: TocEntryRow[], page: number): TocEntryRow | null {
  let best: TocEntryRow | null = null;
  for (const entry of flat) {
    if (entry.start_page <= page && (best === null || entry.start_page > best.start_page)) {
      best = entry;
    }
  }
  return best;
}

export function findNextEntryOfKind(
  flat: TocEntryRow[],
  kind: TocKind,
  afterPage: number,
): TocEntryRow | null {
  let best: TocEntryRow | null = null;
  for (const entry of flat) {
    if (entry.kind !== kind || entry.start_page <= afterPage) continue;
    if (best === null || entry.start_page < best.start_page) best = entry;
  }
  return best;
}

export const KIND_LABELS: Record<TocKind, string> = {
  chapter: "Chapter",
  section: "Section",
  exercises: "Exercises",
  review: "Review",
  reading: "Reading",
  other: "",
};

export const KIND_BADGE_CLASSES: Record<TocKind, string> = {
  chapter: "text-slate-600 dark:text-slate-400",
  section: "text-slate-500 dark:text-slate-400",
  exercises: "text-amber-700 bg-amber-100 dark:text-amber-300 dark:bg-amber-950",
  review: "text-purple-700 bg-purple-100 dark:text-purple-300 dark:bg-purple-950",
  reading: "text-teal-700 bg-teal-100 dark:text-teal-300 dark:bg-teal-950",
  other: "text-slate-500 dark:text-slate-400",
};
