"use server";

import { readFile } from "node:fs/promises";
import { revalidatePath } from "next/cache";
import { getBookById, updateTocSource } from "@/lib/db/books";
import { getTocEntriesForBook, replaceTocEntries } from "@/lib/db/toc";
import { absolutePathFor } from "@/lib/storage/local";
import { extractOutline, type OutlineNode } from "@/lib/pdf/extractOutline.server";
import {
  detectHeadings,
  type DetectedHeading,
  type HeadingSensitivity,
} from "@/lib/pdf/detectHeadings.server";
import { mergeToc } from "@/lib/pdf/mergeToc";
import type { TocEntryRow, TocKind, TocSource } from "@/lib/db/types";

export interface TocEntryInput {
  id: string; // client-generated (crypto.randomUUID()) for both existing and newly-added rows
  parentId: string | null;
  title: string;
  startPage: number;
  kind: TocKind;
}

export async function saveTocEntries(bookId: string, entries: TocEntryInput[]) {
  const book = getBookById(bookId);
  if (!book) throw new Error("Book not found");

  for (const entry of entries) {
    if (entry.title.trim().length === 0) {
      throw new Error("Every entry needs a title.");
    }
    if (!Number.isInteger(entry.startPage) || entry.startPage < 1 || entry.startPage > book.page_count) {
      throw new Error(`Page ${entry.startPage} is outside this book's range (1–${book.page_count}).`);
    }
  }

  const ids = new Set(entries.map((e) => e.id));
  for (const entry of entries) {
    if (entry.parentId !== null && !ids.has(entry.parentId)) {
      throw new Error("An entry references a parent that isn't in this save.");
    }
  }

  const rows = entries.map((entry, index) => ({
    id: entry.id,
    parentId: entry.parentId,
    title: entry.title.trim(),
    startPage: entry.startPage,
    kind: entry.kind,
    sortOrder: index,
  }));
  replaceTocEntries(bookId, rows);

  const newSource: TocSource = book.toc_source === "none" ? "manual" : "mixed";
  updateTocSource(bookId, newSource);

  revalidatePath(`/books/${bookId}`);
  revalidatePath(`/books/${bookId}/toc`);
}

/** Drops a node (and its whole subtree) that starts before minPage — front matter is
 *  usually flat, but filtering recursively keeps this correct even if it isn't. */
function filterOutlineByMinPage(nodes: OutlineNode[], minPage: number): OutlineNode[] {
  return nodes
    .filter((n) => n.startPage >= minPage)
    .map((n) => ({ ...n, children: filterOutlineByMinPage(n.children, minPage) }));
}

/**
 * Re-runs auto-detection from scratch (outline + heading scan) at a chosen
 * sensitivity, optionally skipping everything before `minPage`, and
 * replaces the current table of contents — the "adjust granularity" escape
 * hatch instead of hand-deleting dozens of misdetected entries one at a
 * time. Discards manual edits made since the last save; the confirm dialog
 * lives client-side, before this is called.
 *
 * `minPage` exists specifically for front matter (title pages, publisher
 * pages): those often carry huge decorative type — one real book had
 * "PROBABILITY" at 72pt, more than 7x body text — which no sensitivity
 * setting can distinguish from a real heading by size alone, since it's
 * legitimately that large. Skipping those pages outright is the only
 * approach that actually fixes it, and the PDF's own embedded outline
 * (Layer 1) frequently bookmarks the same front-matter clutter, so this
 * filters both layers, not just the heuristic one.
 *
 * `restrictToTopOfPage`: only consider lines near the top of a page as
 * heading candidates at all, regardless of size/keyword match — useful
 * for books where real headings reliably start at the top and everything
 * else large (boxed formulas, figure captions) sits further down.
 */
export async function regenerateToc(
  bookId: string,
  sensitivity: HeadingSensitivity,
  minPage: number = 1,
  restrictToTopOfPage: boolean = false,
): Promise<TocEntryRow[]> {
  const book = getBookById(bookId);
  if (!book) throw new Error("Book not found");
  if (!Number.isInteger(minPage) || minPage < 1 || minPage > book.page_count) {
    throw new Error(`Start page must be between 1 and ${book.page_count}.`);
  }

  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const bytes = await readFile(absolutePathFor(book.file_path));
  const loadingTask = getDocument({ data: new Uint8Array(bytes), verbosity: 0 });

  try {
    const doc = await loadingTask.promise;
    const rawOutline = await extractOutline(doc).catch((): OutlineNode[] => []);
    const rawDetected = await detectHeadings(
      doc,
      book.page_count,
      sensitivity,
      restrictToTopOfPage,
    ).catch((): DetectedHeading[] => []);
    const outline = filterOutlineByMinPage(rawOutline, minPage);
    const detected = rawDetected.filter((h) => h.startPage >= minPage);
    const { entries, tocSource } = mergeToc(outline, detected);

    replaceTocEntries(bookId, entries);
    updateTocSource(bookId, tocSource);

    revalidatePath(`/books/${bookId}`);
    revalidatePath(`/books/${bookId}/toc`);
    return getTocEntriesForBook(bookId);
  } finally {
    await loadingTask.destroy();
  }
}
