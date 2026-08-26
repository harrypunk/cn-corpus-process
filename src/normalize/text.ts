/**
 * Pure text-cleaning helpers. Each function is small and independently
 * testable; `cleanParagraphs` composes them for poem bodies.
 */

/** Unicode replacement char — a telltale of upstream encoding corruption. */
export const REPLACEMENT_CHAR = "\uFFFD";

export function containsReplacementChar(text: string): boolean {
  return text.includes(REPLACEMENT_CHAR);
}

/**
 * Conservative per-line cleanup:
 * - strip CR and trim
 * - collapse full-width spaces to a single normal space
 * - remove bracketed annotation markers like （注：…）〖注：…〗
 *   (only when explicitly marked as a note; real parentheses stay)
 */
export function cleanLine(line: string): string {
  let s = line.replace(/\r/g, "").trim();
  s = s.replace(/[（(]\s*注[:：][^）)]*[）)]/g, "");
  s = s.replace(/〖\s*注[:：][^〗]*〗/g, "");
  s = s.replace(/　+/g, " ");
  return s.trim();
}

/**
 * Clean a paragraph list: clean each line, drop lines that became empty.
 * Returns null when nothing survives (caller should drop the record).
 */
export function cleanParagraphs(paragraphs: string[]): string[] | null {
  const cleaned = paragraphs.map(cleanLine).filter((l) => l.length > 0);
  return cleaned.length > 0 ? cleaned : null;
}

/** Clean a title; returns null when the result is empty. */
export function cleanTitle(title: string): string | null {
  const t = cleanLine(title);
  return t.length > 0 ? t : null;
}
