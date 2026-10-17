import { mkdir } from "node:fs/promises";
import path from "node:path";

const dataDir = path.join(process.cwd(), "data");

/** Path stored in books.file_path — relative, so the project can move without breaking it. */
export function relativeBookPdfPath(bookId: string): string {
  return path.join("data", "books", bookId, "original.pdf");
}

export function absoluteBookPdfPath(bookId: string): string {
  return path.join(process.cwd(), relativeBookPdfPath(bookId));
}

export function absolutePathFor(relativeFilePath: string): string {
  return path.join(process.cwd(), relativeFilePath);
}

export async function ensureBookDir(bookId: string): Promise<void> {
  await mkdir(path.join(dataDir, "books", bookId), { recursive: true });
}

/** Cached PDFKit-rendered PNG for one page — never invalidated, since a book's source PDF never changes after upload. */
export function renderedPagePath(bookId: string, pageNumber: number): string {
  return path.join(dataDir, "books", bookId, "rendered", `${pageNumber}.png`);
}

export async function ensureRenderedDir(bookId: string): Promise<void> {
  await mkdir(path.join(dataDir, "books", bookId, "rendered"), { recursive: true });
}
