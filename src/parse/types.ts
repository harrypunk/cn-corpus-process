import type { ParsedRecord } from "@src/store/types.ts";

/**
 * Parses one source file's text into raw records. Pure: no IO, no cleansing —
 * NFKC/繁简/dedup belong to Phase 3. Provenance (the source tag) is stamped
 * by the pipeline, not by parsers.
 */
export interface Parser {
  readonly name: string;
  /** Extract raw records. Total: malformed input yields []. */
  readonly parse: (text: string) => ParsedRecord[];
}
