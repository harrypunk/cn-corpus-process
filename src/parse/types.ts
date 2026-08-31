import type { RawRecord } from "@src/store/types.ts";

/**
 * Parses one source file's text into raw records. Pure: no IO, no cleansing —
 * NFKC/繁简/dedup belong to Phase 3.
 */
export interface Parser {
  readonly name: string;
  /** Extract raw records. Total: malformed input yields []. */
  readonly parse: (text: string) => RawRecord[];
}
