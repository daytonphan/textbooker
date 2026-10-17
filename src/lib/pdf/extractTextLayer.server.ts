import "server-only";
import type { PDFPageProxy } from "pdfjs-dist/legacy/build/pdf.mjs";

/** pdfjs-dist doesn't publicly export TextItem — this covers the fields we use. */
interface PdfTextItem {
  str: string;
  width: number;
  height: number;
  fontName: string;
  transform: number[];
}

export interface OverlayItem {
  str: string;
  left: number; // all four already in top-left-origin page-point space —
  top: number; // the client applies one scale factor and is done, no
  width: number; // PDF-coordinate math on the client at all
  height: number;
}

export interface TextLayerResult {
  pageWidth: number;
  pageHeight: number;
  items: OverlayItem[];
}

const DEFAULT_ASCENT = 0.85; // used when a font's metrics don't report one

/**
 * Raw positioned text for the Page-view selection overlay — deliberately
 * simpler than reflowPage.server.ts: no line-grouping, no paragraph/heading
 * reconstruction, just "where does each run of text sit." The overlay is
 * always invisible (selection only, never displayed), so approximate
 * vertical placement is fine — unlike the old blank-canvas stopgap, which
 * had to look right because it was sometimes the only visible content.
 */
export async function extractTextLayer(page: PDFPageProxy): Promise<TextLayerResult> {
  const viewport = page.view; // [x0, y0, x1, y1]
  const pageWidth = viewport[2] - viewport[0];
  const pageHeight = viewport[3] - viewport[1];

  const textContent = await page.getTextContent();
  const items: OverlayItem[] = [];

  for (const item of textContent.items) {
    if (!isTextItem(item) || !item.str.trim()) continue;
    const ascent = textContent.styles[item.fontName]?.ascent ?? DEFAULT_ASCENT;
    const left = item.transform[4];
    const baselineY = item.transform[5];
    const top = pageHeight - baselineY - item.height * ascent;
    items.push({ str: item.str, left, top, width: item.width, height: item.height });
  }

  return { pageWidth, pageHeight, items };
}

function isTextItem(item: unknown): item is PdfTextItem {
  return (
    typeof item === "object" &&
    item !== null &&
    "str" in item &&
    "width" in item &&
    "height" in item &&
    "fontName" in item &&
    "transform" in item
  );
}
