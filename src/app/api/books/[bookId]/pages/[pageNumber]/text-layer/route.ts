import { readFile } from "node:fs/promises";
import { getBookById } from "@/lib/db/books";
import { absolutePathFor } from "@/lib/storage/local";
import { extractTextLayer } from "@/lib/pdf/extractTextLayer.server";

/**
 * Raw positioned text for Page view's selection overlay (see
 * extractTextLayer.server.ts) — distinct from the reflow mode's `text`
 * route, which reconstructs paragraphs/headings instead of raw positions.
 * Recomputed per request, same "cheap enough" reasoning as the reflow route.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ bookId: string; pageNumber: string }> },
) {
  const { bookId, pageNumber: pageNumberParam } = await params;
  const book = getBookById(bookId);
  if (!book) {
    return Response.json({ error: "Book not found" }, { status: 404 });
  }

  const pageNumber = parseInt(pageNumberParam, 10);
  if (!Number.isInteger(pageNumber) || pageNumber < 1 || pageNumber > book.page_count) {
    return Response.json({ error: "Page number out of range" }, { status: 400 });
  }

  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const bytes = await readFile(absolutePathFor(book.file_path));
  const loadingTask = getDocument({ data: new Uint8Array(bytes), verbosity: 0 });

  try {
    const doc = await loadingTask.promise;
    const page = await doc.getPage(pageNumber);
    const result = await extractTextLayer(page);
    return Response.json(result);
  } catch (error) {
    console.error("Failed to extract text layer:", error);
    return Response.json({ error: "Couldn't extract text for this page." }, { status: 500 });
  } finally {
    await loadingTask.destroy();
  }
}
