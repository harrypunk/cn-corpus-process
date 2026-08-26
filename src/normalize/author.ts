/**
 * Author-name canonicalization: map the various "unknown" spellings found
 * across corpora onto one canonical name so they collapse into a single
 * authors row.
 */

export const ANONYMOUS = "佚名";

const ANONYMOUS_VARIANTS = new Set([
  "",
  "佚名",
  "无名氏",
  "unknown",
  "Unknown",
  "UNKNOWN",
  "不详",
  "阙名",
]);

export function canonicalizeAuthor(name: string | null | undefined): string {
  const trimmed = (name ?? "").replace(/\r/g, "").trim();
  return ANONYMOUS_VARIANTS.has(trimmed) ? ANONYMOUS : trimmed;
}
