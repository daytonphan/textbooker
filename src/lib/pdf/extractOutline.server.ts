import "server-only";
import type { PDFDocumentProxy } from "pdfjs-dist/legacy/build/pdf.mjs";
import { classifyTitle } from "@/lib/pdf/classify";
import type { TocKind } from "@/lib/db/types";

export interface OutlineNode {
  title: string;
  startPage: number; // 1-indexed
  kind: TocKind;
  children: OutlineNode[];
}

/** Layer 1: the PDF's own embedded bookmark tree, when it has one. */
export async function extractOutline(doc: PDFDocumentProxy): Promise<OutlineNode[]> {
  const rawOutline = await doc.getOutline();
  if (!rawOutline || rawOutline.length === 0) return [];

  type PageRef = Parameters<PDFDocumentProxy["getPageIndex"]>[0];

  async function resolveStartPage(dest: string | unknown[] | null): Promise<number | null> {
    if (dest == null) return null; // external link (url set instead of dest) or unresolvable
    const resolved = typeof dest === "string" ? await doc.getDestination(dest) : dest;
    const ref = resolved?.[0] as PageRef | undefined;
    if (!ref) return null;
    try {
      return (await doc.getPageIndex(ref)) + 1;
    } catch {
      return null; // malformed destination ref — skip rather than fail the whole upload
    }
  }

  async function walk(
    nodes: Awaited<ReturnType<PDFDocumentProxy["getOutline"]>>,
    depth: number,
  ): Promise<OutlineNode[]> {
    const result: OutlineNode[] = [];
    for (const node of nodes ?? []) {
      const startPage = await resolveStartPage(node.dest);
      const children = node.items?.length ? await walk(node.items, depth + 1) : [];
      if (startPage == null) {
        // Can't place this node on a page (e.g. a pure external link) — drop it
        // but keep any children that do resolve, promoted to this depth.
        result.push(...children);
        continue;
      }
      result.push({
        title: node.title.trim(),
        startPage,
        kind: classifyTitle(node.title) ?? (depth === 0 ? "chapter" : "section"),
        children,
      });
    }
    return result;
  }

  return walk(rawOutline, 0);
}
