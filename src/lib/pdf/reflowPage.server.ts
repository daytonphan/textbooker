import "server-only";
import type { PDFPageProxy } from "pdfjs-dist/legacy/build/pdf.mjs";
import { classifyTitle } from "@/lib/pdf/classify";
import type { TocKind } from "@/lib/db/types";

/** pdfjs-dist doesn't publicly export TextItem — this covers the fields we use. */
interface PdfTextItem {
  str: string;
  height: number;
  hasEOL: boolean;
  transform: number[];
}

export interface ReflowBlock {
  kind: "heading" | "paragraph";
  text: string;
  indentLevel: number; // 0 = normal, 1 = a lettered/sub sub-item
  tocKind?: TocKind; // set only for kind: "heading"
}

interface Line {
  text: string;
  height: number; // this line's own median glyph height, not any single glyph's
  y: number;
}

// Same ratio detectHeadings.server.ts uses for the TOC — a heading inside a
// page should be recognized the same way regardless of which feature asks.
const HEADING_FONT_RATIO = 1.15;
const PARAGRAPH_GAP_RATIO = 1.8; // vs. this page's own typical line-to-line gap

// A numbered ("1.") or lettered ("a)") list marker at the start of a line is
// a far more reliable "this starts a new item" signal than vertical gap
// alone — list items are often spaced no differently than a wrapped line of
// prose, which a gap-only heuristic can't tell apart.
const NUMBERED_MARKER_RE = /^\d+[.)]\s/;
const LETTERED_MARKER_RE = /^[a-zA-Z][.)]\s/;

/**
 * Turns one page's raw text positions into readable blocks for the "Text"
 * reflow reading mode: paragraphs (grouped by vertical gap and list-marker
 * detection), and in-page headings (font-size ratio, same signal
 * detectHeadings.server.ts uses for the TOC). Heuristic by design — good
 * enough for comfortable reading, not a layout-analysis engine, same
 * philosophy as Layer 2 heading detection.
 */
export async function reflowPage(page: PDFPageProxy): Promise<ReflowBlock[]> {
  const lines = await collectLines(page);
  if (lines.length === 0) return [];

  const medianHeight = medianOf(lines.map((l) => l.height).filter((h) => h > 0));
  const typicalGap = medianOf(gapsOf(lines));

  const blocks: ReflowBlock[] = [];
  let buffer: Line[] = [];
  let bufferIndent = 0;

  function flush() {
    if (buffer.length === 0) return;
    const text = buffer
      .map((l) => l.text)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    if (text) {
      blocks.push({ kind: "paragraph", text, indentLevel: bufferIndent });
    }
    buffer = [];
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isHeading = medianHeight > 0 && line.height >= medianHeight * HEADING_FONT_RATIO;

    if (isHeading) {
      flush();
      blocks.push({
        kind: "heading",
        text: line.text,
        indentLevel: 0,
        tocKind: classifyTitle(line.text) ?? "other",
      });
      continue;
    }

    const prev = lines[i - 1];
    const gap = prev ? prev.y - line.y : 0;
    const startsNewItem = LETTERED_MARKER_RE.test(line.text) || NUMBERED_MARKER_RE.test(line.text);
    const isNewParagraph =
      !prev || startsNewItem || (typicalGap > 0 && gap > typicalGap * PARAGRAPH_GAP_RATIO);

    if (isNewParagraph) {
      flush();
      bufferIndent = LETTERED_MARKER_RE.test(line.text) ? 1 : 0;
    }
    buffer.push(line);
  }
  flush();

  return blocks;
}

async function collectLines(page: PDFPageProxy): Promise<Line[]> {
  const textContent = await page.getTextContent();
  const lines: Line[] = [];

  let text = "";
  let heights: number[] = [];
  let startY = 0;
  let started = false;
  const flushLine = () => {
    const trimmed = text.trim();
    if (trimmed) {
      lines.push({ text: trimmed, height: medianOf(heights.filter((h) => h > 0)), y: startY });
    }
    text = "";
    heights = [];
    started = false;
  };

  for (const item of textContent.items) {
    if (!isTextItem(item)) continue; // skip TextMarkedContent entries
    if (!started) {
      startY = item.transform[5];
      started = true;
    }
    text += item.str;
    heights.push(item.height);
    if (item.hasEOL) flushLine();
  }
  flushLine();

  return lines;
}

function gapsOf(lines: Line[]): number[] {
  const gaps: number[] = [];
  for (let i = 1; i < lines.length; i++) {
    const gap = lines[i - 1].y - lines[i].y;
    if (gap > 0) gaps.push(gap);
  }
  return gaps;
}

function isTextItem(item: unknown): item is PdfTextItem {
  return (
    typeof item === "object" &&
    item !== null &&
    "str" in item &&
    "height" in item &&
    "transform" in item
  );
}

function medianOf(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}
