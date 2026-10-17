import { readFile } from "node:fs/promises";
import { getBookById } from "@/lib/db/books";
import { absolutePathFor } from "@/lib/storage/local";
import { reflowPage } from "@/lib/pdf/reflowPage.server";

/**
 * On-demand text extraction for the reader's "Text" reflow mode — one
 * page's worth of readable blocks, not the whole book. Recomputed on every
 * request rather than cached: timed against a real 48MB, 564-page book at
 * ~30-40ms warm, well within "cheap enough" for a per-toggle fetch.
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
    const blocks = await reflowPage(page);
    return Response.json({ blocks });
  } catch (error) {
    console.error("Failed to reflow page:", error);
    return Response.json({ error: "Couldn't extract text for this page." }, { status: 500 });
  } finally {
    await loadingTask.destroy();
  }
}
