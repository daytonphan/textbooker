import "server-only";
import type { PDFDocumentProxy } from "pdfjs-dist/legacy/build/pdf.mjs";
import { classifyTitle } from "@/lib/pdf/classify";
import type { TocKind } from "@/lib/db/types";

/** pdfjs-dist doesn't publicly export TextItem — this covers the fields we use. */
interface PdfTextItem {
  str: string;
  height: number;
  hasEOL: boolean;
  transform: number[];
}

export interface DetectedHeading {
  title: string;
  startPage: number; // 1-indexed
  kind: TocKind;
}

interface Line {
  text: string;
  height: number;
  page: number;
  y: number; // PDF space, origin bottom-left — larger y is closer to the top
  pageHeight: number;
}

export type HeadingSensitivity = "fewer" | "balanced" | "more";

/** vs. this page-set's median *body-text* line height — see MIN_BODY_LINE_WORDS below */
const SENSITIVITY_PRESETS: Record<HeadingSensitivity, { large: number; chapter: number }> = {
  fewer: { large: 1.4, chapter: 1.75 }, // only clearly-larger headings — fewer false positives, may miss subtler subsections
  balanced: { large: 1.15, chapter: 1.4 },
  more: { large: 1.05, chapter: 1.25 }, // catches subtler size bumps — more entries, more noise
};

const MAX_HEADING_WORDS = 10;
const MAX_HEADING_CHARS = 80;
const MAX_KEYWORD_MATCH_WORDS = 6; // keyword hits still need to look like a heading, not a body sentence

// Font size alone can't tell a real heading from a chart axis label ("n =
// 10"), an inline equation ("k <= np + p"), or a boxed formula's symbols —
// all of those are also short and often large. Requiring most characters
// to be letters filters those out while keeping real titles.
const MIN_ALPHA_RATIO = 0.6;

// A title-like line that repeats, word-for-word except for a page number,
// across several different pages is a running header, not real content —
// the single largest source of noise on a normal body page, bigger than
// any sensitivity setting fixes on its own. Two-sided books commonly put
// the page number on the *outer* edge of each page, which alternates
// sides between even and odd pages — e.g. this book's section header is
// "Section 2.1. The Binomial Distribution 89" (page number trailing) but
// its chapter header is "12 Chapter 1. Introduction" (page number
// leading) — so both ends need stripping, not just one.
const RUNNING_HEADER_MIN_PAGES = 4;

// A page's median line height, computed over *every* line, is easily skewed
// by title/cover pages: a handful of short, large decorative lines (a name,
// a publisher logo) can outweigh actual body prose in a per-page median.
// Restricting the baseline to longer, sentence-like lines makes it track
// real body text instead — this is what was actually causing "Springer",
// author names, etc. to misfire as headings, independent of sensitivity.
const MIN_BODY_LINE_WORDS = 6;

// With restrictToTopOfPage enabled, only lines in this top fraction of the
// page are eligible heading candidates at all — a positional filter,
// independent of size/keyword/repetition, for books where real headings
// reliably start at the top (chapter openers, running section titles) and
// everything else that's just large (boxed formulas, figure captions) sits
// further down the page.
const TOP_OF_PAGE_FRACTION = 0.2;

/**
 * Layer 2: scans every page's text for lines that look like headings —
 * short, and either matching a known keyword/pattern or set in noticeably
 * larger type than the page's body text. This is deliberately heuristic
 * (expected to misfire occasionally); the manual TOC editor is the
 * correction path, not a fallback bolted on as an afterthought.
 */
export async function detectHeadings(
  doc: PDFDocumentProxy,
  pageCount: number,
  sensitivity: HeadingSensitivity = "balanced",
  restrictToTopOfPage: boolean = false,
): Promise<DetectedHeading[]> {
  const { large: LARGE_FONT_RATIO, chapter: CHAPTER_FONT_RATIO } = SENSITIVITY_PRESETS[sensitivity];
  const lines = await collectLines(doc, pageCount);
  if (lines.length === 0) return [];

  // The body-text baseline always uses every line, regardless of the
  // top-of-page restriction — narrowing the *candidates* shouldn't also
  // narrow (and thin out) what "normal" text height means on this page.
  const bodyLines = lines.filter((l) => wordCountOf(l.text) >= MIN_BODY_LINE_WORDS);
  const baselineLines = bodyLines.length >= 20 ? bodyLines : lines;
  const median = medianOf(baselineLines.map((l) => l.height).filter((h) => h > 0));

  const candidateLines = restrictToTopOfPage
    ? lines.filter((l) => l.y >= l.pageHeight * (1 - TOP_OF_PAGE_FRACTION))
    : lines;

  const headings: DetectedHeading[] = [];

  for (const line of candidateLines) {
    const wordCount = wordCountOf(line.text);
    if (wordCount === 0 || wordCount > MAX_HEADING_WORDS || line.text.length > MAX_HEADING_CHARS) {
      continue;
    }

    const keywordKind = classifyTitle(line.text);
    if (keywordKind) {
      if (wordCount <= MAX_KEYWORD_MATCH_WORDS) {
        headings.push({ title: line.text, startPage: line.page, kind: keywordKind });
      }
      continue;
    }

    if (median > 0 && line.height >= median * LARGE_FONT_RATIO && looksLikeTitle(line.text)) {
      const kind: TocKind = line.height >= median * CHAPTER_FONT_RATIO ? "chapter" : "section";
      headings.push({ title: line.text, startPage: line.page, kind });
    }
  }

  return dropRunningHeaders(headings);
}

function looksLikeTitle(text: string): boolean {
  const nonSpace = text.replace(/\s/g, "");
  if (nonSpace.length === 0) return false;
  const letters = nonSpace.match(/[a-zA-Z]/g)?.length ?? 0;
  return letters / nonSpace.length >= MIN_ALPHA_RATIO;
}

/** Strips a page number from either end, e.g. "...Distribution 89" and "12 Chapter 1. Introduction" both -> "...Distribution" / "Chapter 1. Introduction". */
function stripPageNumber(text: string): string {
  return text.replace(/^\d+\s*/, "").replace(/\s*\d+$/, "").trim();
}

function dropRunningHeaders(headings: DetectedHeading[]): DetectedHeading[] {
  const pagesByNormalizedTitle = new Map<string, Set<number>>();
  for (const h of headings) {
    const norm = stripPageNumber(h.title);
    if (!pagesByNormalizedTitle.has(norm)) pagesByNormalizedTitle.set(norm, new Set());
    pagesByNormalizedTitle.get(norm)!.add(h.startPage);
  }
  const runningHeaders = new Set(
    [...pagesByNormalizedTitle.entries()]
      .filter(([, pages]) => pages.size >= RUNNING_HEADER_MIN_PAGES)
      .map(([norm]) => norm),
  );
  return headings.filter((h) => !runningHeaders.has(stripPageNumber(h.title)));
}

async function collectLines(doc: PDFDocumentProxy, pageCount: number): Promise<Line[]> {
  const lines: Line[] = [];

  for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
    const page = await doc.getPage(pageNum);
    const textContent = await page.getTextContent();
    const pageHeight = page.view[3] - page.view[1];

    let buffer = "";
    let maxHeight = 0;
    let startY: number | null = null;
    const flush = () => {
      const text = buffer.trim();
      if (text && startY !== null) {
        lines.push({ text, height: maxHeight, page: pageNum, y: startY, pageHeight });
      }
      buffer = "";
      maxHeight = 0;
      startY = null;
    };

    for (const item of textContent.items) {
      if (!isTextItem(item)) continue; // skip TextMarkedContent entries
      if (startY === null) startY = item.transform[5];
      buffer += item.str;
      if (item.height > maxHeight) maxHeight = item.height;
      if (item.hasEOL) flush();
    }
    flush();
  }

  return lines;
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

function wordCountOf(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

function medianOf(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}
