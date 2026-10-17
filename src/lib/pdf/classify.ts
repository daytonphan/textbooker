import type { TocKind } from "@/lib/db/types";

/**
 * Shared keyword/pattern classifier used by both detection layers (embedded
 * outline titles and heuristic heading lines) so "Exercises" is recognized
 * the same way regardless of which layer found it. Returns null when the
 * title doesn't match any known pattern — callers decide their own fallback.
 */
export function classifyTitle(title: string): TocKind | null {
  const t = title.trim();

  // Numbered headings are extremely common ("5.2 Exercises", "5.4 Chapter
  // Summary") — check keywords against the text *after* the number, not just
  // the raw string, or every keyword check below would silently never match.
  const subsectionMatch = /^\d+(\.\d+)+\s+(\S.*)$/.exec(t); // e.g. "5.3 Conditional Probability"
  const chapterNumberMatch = subsectionMatch ? null : /^\d+\s+([A-Z]\S*.*)$/.exec(t); // e.g. "5 Probability"
  const remainder = subsectionMatch?.[2] ?? chapterNumberMatch?.[1] ?? t;

  if (/^(exercises?|problems?|practice problems?)\b/i.test(remainder)) return "exercises";
  if (/^(chapter review|review problems?|summary|chapter summary|key terms)\b/i.test(remainder)) {
    return "review";
  }
  if (/^(further reading|additional reading|reading)\b/i.test(remainder)) return "reading";
  if (/^chapter\s+\d+/i.test(t)) return "chapter";
  if (subsectionMatch) return "section";
  if (chapterNumberMatch) return "chapter";
  return null;
}
