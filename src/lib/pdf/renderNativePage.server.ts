import "server-only";
import { execFile } from "node:child_process";
import { access } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { ensureRenderedDir, renderedPagePath } from "@/lib/storage/local";

const execFileAsync = promisify(execFile);
const NATIVE_BINARY = path.join(process.cwd(), "native", "bin", "render_page");

/**
 * Renders one page to a cached PNG via macOS's own PDFKit — the same engine
 * Preview uses, so output matches Preview exactly (including PDF spec edge
 * cases pdf.js renders differently, like invisible text on OCR'd pages).
 * Cached forever once rendered: a book's source PDF never changes after
 * upload, so there's nothing to invalidate.
 */
export async function renderPageToPng(
  bookId: string,
  pageNumber: number,
  absolutePdfPath: string,
): Promise<string> {
  const cachePath = renderedPagePath(bookId, pageNumber);

  try {
    await access(cachePath);
    return cachePath;
  } catch {
    // Not cached yet — fall through and render it.
  }

  await ensureRenderedDir(bookId);
  try {
    await execFileAsync(NATIVE_BINARY, [absolutePdfPath, String(pageNumber), cachePath]);
  } catch (error) {
    throw new Error(
      `Native render failed for page ${pageNumber}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  return cachePath;
}
