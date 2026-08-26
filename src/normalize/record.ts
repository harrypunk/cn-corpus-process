/**
 * Turns a RawRecord into a normalized PoemRecord (or a DropReason).
 * Field-name differences between corpora are handled by FieldMapping,
 * so this one normalizer serves every JSON source.
 */

import type { DropReason, PoemRecord, RawRecord } from "../types.ts";
import { canonicalizeAuthor } from "./author.ts";
import {
  cleanParagraphs,
  cleanTitle,
  containsReplacementChar,
} from "./text.ts";

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
  dynasty: string | null;
  source: string;
}

export type NormalizeResult =
  | { ok: true; record: PoemRecord }
  | { ok: false; reason: DropReason };

function asStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const strings = value.filter((v): v is string => typeof v === "string");
  return strings.length > 0 ? strings : null;
}

export function normalizeRecord(
  raw: RawRecord,
  map: FieldMapping,
): NormalizeResult {
  const paragraphs = asStringArray(raw[map.paragraphs]);
  if (!paragraphs) return { ok: false, reason: "empty_content" };

  const rawTitle =
    (raw[map.title ?? "title"] as string | undefined) ??
    (map.titleFallback ? (raw[map.titleFallback] as string | undefined) : undefined);
  const title = cleanTitle(rawTitle ?? "");
  if (!title) return { ok: false, reason: "empty_title" };

  const cleaned = cleanParagraphs(paragraphs);
  if (!cleaned) return { ok: false, reason: "empty_content" };

  const content = cleaned.join("\n");
  if (containsReplacementChar(content)) {
    return { ok: false, reason: "invalid_chars" };
  }

  const author = canonicalizeAuthor(
    map.fixedAuthor ?? (raw[map.author ?? "author"] as string | undefined),
  );

  return {
    ok: true,
    record: { author, dynasty: map.dynasty, title, content, source: map.source },
  };
}
