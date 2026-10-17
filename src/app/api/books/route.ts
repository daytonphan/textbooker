import { randomUUID } from "node:crypto";
import { rm, writeFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { createBook } from "@/lib/db/books";
import { insertTocEntries } from "@/lib/db/toc";
import { absoluteBookPdfPath, ensureBookDir, relativeBookPdfPath } from "@/lib/storage/local";
import { processUpload } from "@/lib/pdf/processUpload.server";

// A Server Action would cap this at 1MB by default (Next.js's serverActions
// body-size limit) — file uploads go through a plain Route Handler instead,
// which has no such framework-imposed cap.
export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file");
  const title = formData.get("title");

  if (!(file instanceof File) || file.type !== "application/pdf") {
    return NextResponse.json({ error: "A PDF file is required." }, { status: 400 });
  }
  if (typeof title !== "string" || title.trim().length === 0) {
    return NextResponse.json({ error: "A title is required." }, { status: 400 });
  }
  const author = asOptionalString(formData.get("author"));
  const course = asOptionalString(formData.get("course"));

  const id = randomUUID();
  await ensureBookDir(id);
  const filePath = absoluteBookPdfPath(id);
  const bytes = new Uint8Array(await file.arrayBuffer());
  const fileSizeBytes = bytes.byteLength;
  await writeFile(filePath, bytes);

  try {
    // Captured fileSizeBytes above: pdf.js's worker transport transfers (detaches)
    // this buffer while parsing, so bytes.byteLength reads back as 0 afterward.
    const { pageCount, tocSource, entries } = await processUpload(bytes);

    createBook({
      id,
      title: title.trim(),
      author,
      course,
      filePath: relativeBookPdfPath(id),
      fileSizeBytes,
      pageCount,
      tocSource,
    });
    if (entries.length > 0) {
      insertTocEntries(id, entries);
    }

    return NextResponse.json({ id, tocSource }, { status: 201 });
  } catch (error) {
    await rm(filePath, { force: true });
    console.error("Failed to process uploaded PDF:", error);
    return NextResponse.json(
      { error: "Couldn't read that PDF — it may be corrupted or password-protected." },
      { status: 422 },
    );
  }
}

function asOptionalString(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
