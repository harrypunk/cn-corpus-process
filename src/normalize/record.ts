/**
 * Turns a RawRecord into a normalized PoemRecord (or a DropReason).
 * Field-name differences between corpora are handled by FieldMapping,
 * so this one normalizer serves every JSON source.
 */

import { DropReason, type Maybe, type NormalizeResult, type RawRecord } from "../types.ts";
import { canonicalizeAuthor } from "./author.ts";
import type { Deduper } from "./dedup.ts";
import { cleanParagraphs, cleanTitle, containsReplacementChar } from "./text.ts";

export interface FieldMapping {
  /** Field holding the paragraph array: "paragraphs" | "content" | "para". */
  paragraphs: string;
  /** Field holding the title; defaults to "title". */
  title?: string;
  /** Fallback title field (e.g. "rhythmic" for ci/qu poems). */
  titleFallback?: string;
  /** Field holding the author; defaults to "author". */
  author?: string;
  /** Fixed author when the corpus has none (e.g. 曹操诗集). */
  fixedAuthor?: string;
  dynasty: Maybe<string>;
  source: string;
}

/** Pure: coerce a raw field to a string array, or null when unusable. */
export function asStringArray(value: unknown): Maybe<string[]> {
  if (!Array.isArray(value)) return null;
  const strings = value.filter((v): v is string => typeof v === "string");
  return strings.length > 0 ? strings : null;
}

/** Pure: coerce a raw field to a string, or null when absent/mistyped. */
export function asString(value: unknown): Maybe<string> {
  return typeof value === "string" ? value : null;
}

/** Pure: pick the title, falling back to the configured fallback field. */
function pickTitle(raw: RawRecord, map: FieldMapping): Maybe<string> {
  return (
    asString(raw[map.title ?? "title"]) ??
    (map.titleFallback ? asString(raw[map.titleFallback]) : null)
  );
}

/** Pure: pick the author, honoring the mapping's fixed author. */
function pickAuthor(raw: RawRecord, map: FieldMapping): string {
  return canonicalizeAuthor(map.fixedAuthor ?? asString(raw[map.author ?? "author"]));
}

export function normalizeRecord(raw: RawRecord, map: FieldMapping): NormalizeResult {
  const paragraphs = asStringArray(raw[map.paragraphs]);
  if (!paragraphs) return { ok: false, reason: DropReason.EmptyContent };

  const title = cleanTitle(pickTitle(raw, map) ?? "");
  if (!title) return { ok: false, reason: DropReason.EmptyTitle };

  const cleaned = cleanParagraphs(paragraphs);
  if (!cleaned) return { ok: false, reason: DropReason.EmptyContent };

  const content = cleaned.join("\n");
  if (containsReplacementChar(content)) {
    return { ok: false, reason: DropReason.InvalidChars };
  }

  return {
    ok: true,
    record: {
      author: pickAuthor(raw, map),
      dynasty: map.dynasty,
      title,
      content,
      source: map.source,
    },
  };
}

/**
 * Full per-record decision: normalize, then reject duplicates via the
 * supplied Deduper. Pure apart from the Deduper's internal seen-set,
 * which the caller owns (pass a shared one for cross-corpus dedup).
 */
export function makeClassifier(
  map: FieldMapping,
  dedup: Deduper,
): (raw: RawRecord) => NormalizeResult {
  return (raw) => {
    const result = normalizeRecord(raw, map);
    if (!result.ok) return result;
    const { author, title, content } = result.record;
    if (!dedup.isNew(author, title, content)) {
      return { ok: false, reason: DropReason.Duplicate };
    }
    return result;
  };
}
