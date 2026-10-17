import { randomUUID } from "node:crypto";
import "server-only";
import type { NewTocEntry } from "@/lib/db/toc";
import type { OutlineNode } from "@/lib/pdf/extractOutline.server";
import type { DetectedHeading } from "@/lib/pdf/detectHeadings.server";
import type { TocKind, TocSource } from "@/lib/db/types";

interface Draft {
  id: string;
  parentId: string | null;
  title: string;
  startPage: number;
  kind: TocKind;
}

function flattenOutline(nodes: OutlineNode[], parentId: string | null, out: Draft[]): void {
  for (const node of nodes) {
    const id = randomUUID();
    out.push({ id, parentId, title: node.title, startPage: node.startPage, kind: node.kind });
    flattenOutline(node.children, id, out);
  }
}

/** The nearest top-level entry at or before this page, to nest a heading under. */
function nearestPrecedingChapter(chapters: Draft[], startPage: number): Draft | null {
  let best: Draft | null = null;
  for (const c of chapters) {
    if (c.startPage <= startPage && (best === null || c.startPage > best.startPage)) {
      best = c;
    }
  }
  return best;
}

/**
 * Recomputes display order from actual page position rather than trusting
 * insertion order — Layer 2 "extras" get appended after all outline nodes
 * as they're discovered, so without this a chapter-10 outline entry would
 * sort before a chapter-3 "Exercises" line detected later in the same pass.
 */
function assignSortOrder(drafts: Draft[]): NewTocEntry[] {
  const childrenOf = new Map<string | null, Draft[]>();
  for (const d of drafts) {
    const list = childrenOf.get(d.parentId) ?? [];
    list.push(d);
    childrenOf.set(d.parentId, list);
  }
  for (const list of childrenOf.values()) list.sort((a, b) => a.startPage - b.startPage);

  const result: NewTocEntry[] = [];
  let counter = 0;
  const visit = (parentId: string | null) => {
    for (const d of childrenOf.get(parentId) ?? []) {
      result.push({ ...d, sortOrder: counter++ });
      visit(d.id);
    }
  };
  visit(null);
  return result;
}

/**
 * Combines the embedded outline (Layer 1, reliable when present) with the
 * heuristic heading scan (Layer 2, fills in exercises/review/reading detail
 * outlines rarely drill into). Layer 2 hits on a page the outline already
 * covers are dropped rather than duplicated.
 */
export function mergeToc(
  outline: OutlineNode[],
  detected: DetectedHeading[],
): { entries: NewTocEntry[]; tocSource: TocSource } {
  const drafts: Draft[] = [];

  if (outline.length > 0) {
    flattenOutline(outline, null, drafts);
    const outlinePages = new Set(drafts.map((d) => d.startPage));
    const topLevel = drafts.filter((d) => d.parentId === null);

    for (const h of detected) {
      if (outlinePages.has(h.startPage)) continue;
      const parent = nearestPrecedingChapter(topLevel, h.startPage);
      drafts.push({
        id: randomUUID(),
        parentId: parent?.id ?? null,
        title: h.title,
        startPage: h.startPage,
        kind: h.kind,
      });
    }
  } else {
    const chapters: Draft[] = detected
      .filter((h) => h.kind === "chapter")
      .map((h) => ({
        id: randomUUID(),
        parentId: null,
        title: h.title,
        startPage: h.startPage,
        kind: h.kind,
      }));
    drafts.push(...chapters);

    for (const h of detected) {
      if (h.kind === "chapter") continue; // already added above
      const parent = nearestPrecedingChapter(chapters, h.startPage);
      drafts.push({
        id: randomUUID(),
        parentId: parent?.id ?? null,
        title: h.title,
        startPage: h.startPage,
        kind: h.kind,
      });
    }
  }

  const entries = assignSortOrder(drafts);
  return { entries, tocSource: entries.length > 0 ? "auto" : "none" };
}
