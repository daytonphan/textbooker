import "server-only";
import { extractOutline } from "@/lib/pdf/extractOutline.server";
import { detectHeadings, type HeadingSensitivity } from "@/lib/pdf/detectHeadings.server";
import { mergeToc } from "@/lib/pdf/mergeToc";
import type { NewTocEntry } from "@/lib/db/toc";
import type { TocSource } from "@/lib/db/types";

export interface ProcessedUpload {
  pageCount: number;
  tocSource: TocSource;
  entries: NewTocEntry[];
}

/**
 * Runs the full structure-detection pipeline against uploaded PDF bytes:
 * embedded outline (Layer 1) merged with a heuristic heading scan (Layer 2).
 * A malformed/unparseable PDF still produces a usable book — `tocSource:
 * 'none'` and an empty entry list — the manual editor covers the rest.
 */
export async function processUpload(
  data: Uint8Array,
  sensitivity: HeadingSensitivity = "balanced",
): Promise<ProcessedUpload> {
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  // destroy() lives on the loading task (aborts requests, tears down the
  // worker), not on the resolved PDFDocumentProxy — keep the task reference.
  const loadingTask = getDocument({ data, verbosity: 0 });
  const doc = await loadingTask.promise;

  try {
    const pageCount = doc.numPages;

    let outline: Awaited<ReturnType<typeof extractOutline>> = [];
    try {
      outline = await extractOutline(doc);
    } catch {
      // Missing/corrupt outline shouldn't block the upload — Layer 2 and the
      // manual editor both still work without it.
    }

    let detected: Awaited<ReturnType<typeof detectHeadings>> = [];
    try {
      detected = await detectHeadings(doc, pageCount, sensitivity);
    } catch {
      // Same reasoning: a text-extraction failure on one book shouldn't
      // block the upload, just leave that book with a thinner auto-TOC.
    }

    const { entries, tocSource } = mergeToc(outline, detected);
    return { pageCount, tocSource, entries };
  } finally {
    await loadingTask.destroy();
  }
}
