import type { RawRecord } from "@src/store/types.ts";

/**
 * Parses one source file's text into raw records. Pure: no IO, no cleansing —
 * NFKC/繁简/dedup belong to Phase 3.
 */
export interface Parser {
  readonly name: string;
  /** Whether this parser claims the given source-relative path. */
  readonly match: (path: string) => boolean;
  /** Extract raw records. Total: malformed input yields []. */
  readonly parse: (text: string) => RawRecord[];
}
