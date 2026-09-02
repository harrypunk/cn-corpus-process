import type { ParsedRecord } from "@src/store/types.ts";
import { joinLines, parseObjectArray, str } from "./json.ts";
import type { Parser } from "./types.ts";

/** Which JSON fields map onto a RawRecord, for corpora with no unified schema. */
export interface FieldMapping {
  /** Field holding the title. */
  readonly title: string;
  /** Field holding the lines array (paragraphs / content / para / ...). */
  readonly paragraphs: string;
  /** Field holding the author; defaults to "author". */
  readonly author?: string;
  /** Author for records that have none (e.g. 曹操诗集 is all 曹操). */
  readonly defaultAuthor?: string;
  /** Fields prepended to the title, joined with "·" (e.g. 诗经 chapter/section). */
  readonly titlePrefix?: readonly string[];
}

/** Parser for {title, lines[], author?}-shaped arrays whose field names vary per corpus. */
export function mappedParser(name: string, m: FieldMapping): Parser {
  const authorField = m.author ?? "author";
  const titleFields = [...(m.titlePrefix ?? []), m.title];

  return {
    name,
    parse: (text): ParsedRecord[] =>
      parseObjectArray(text).map((r) => ({
        author: str(r[authorField]) || (m.defaultAuthor ?? ""),
        title: titleFields
          .map((f) => str(r[f]))
          .filter((s) => s !== "")
          .join("·"),
        content: joinLines(r[m.paragraphs]),
      })),
  };
}
