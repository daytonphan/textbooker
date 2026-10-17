import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { getBookById } from "@/lib/db/books";
import { absolutePathFor } from "@/lib/storage/local";

/**
 * Streams the PDF from local disk with HTTP Range support. This matters
 * specifically because the whole point of this app is *large* files —
 * without Range support, pdf.js falls back to downloading the entire file
 * before showing page 1.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ bookId: string }> },
) {
  const { bookId } = await params;
  const book = getBookById(bookId);
  if (!book) {
    return Response.json({ error: "Book not found" }, { status: 404 });
  }

  const filePath = absolutePathFor(book.file_path);
  const { size } = await stat(filePath);

  const rangeHeader = request.headers.get("range");
  const range = rangeHeader ? parseRange(rangeHeader, size) : null;

  if (rangeHeader && !range) {
    return new Response(null, {
      status: 416,
      headers: { "Content-Range": `bytes */${size}` },
    });
  }

  const start = range?.start ?? 0;
  const end = range?.end ?? size - 1;

  const nodeStream = createReadStream(filePath, { start, end });
  const webStream = Readable.toWeb(nodeStream) as ReadableStream;

  return new Response(webStream, {
    status: range ? 206 : 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(end - start + 1),
      "Accept-Ranges": "bytes",
      "Cache-Control": "private, max-age=3600",
      ...(range ? { "Content-Range": `bytes ${start}-${end}/${size}` } : {}),
    },
  });
}

function parseRange(header: string, size: number): { start: number; end: number } | null {
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match) return null;

  const [, startStr, endStr] = match;
  if (!startStr && !endStr) return null;

  let start: number;
  let end: number;
  if (!startStr) {
    // Suffix range, e.g. "bytes=-500" — the last 500 bytes.
    start = Math.max(size - parseInt(endStr, 10), 0);
    end = size - 1;
  } else {
    start = parseInt(startStr, 10);
    end = endStr ? parseInt(endStr, 10) : size - 1;
  }

  if (Number.isNaN(start) || Number.isNaN(end) || start > end || start < 0 || end >= size) {
    return null;
  }
  return { start, end };
}
