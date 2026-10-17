import { readFile } from "node:fs/promises";
import { getBookById } from "@/lib/db/books";
import { absolutePathFor } from "@/lib/storage/local";
import { renderPageToPng } from "@/lib/pdf/renderNativePage.server";

/**
 * Serves a page rendered via macOS PDFKit (see renderNativePage.server.ts)
 * — cached after the first request, so repeat views are an instant file
 * read rather than a re-render.
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

  try {
    const pngPath = await renderPageToPng(bookId, pageNumber, absolutePathFor(book.file_path));
    const bytes = await readFile(pngPath);
    return new Response(bytes, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    console.error("Failed to render page:", error);
    return Response.json({ error: "Couldn't render this page." }, { status: 500 });
  }
}
