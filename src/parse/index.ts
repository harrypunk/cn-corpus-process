import type { RawRecord } from "@src/store/types.ts";
import { ciParser } from "./ci.ts";
import { poemsParser } from "./poems.ts";
import type { Parser } from "./types.ts";

export * from "./types.ts";
export { ciParser, poemsParser };

/** First matching parser wins; keep patterns disjoint. */
const parsers: readonly Parser[] = [poemsParser, ciParser];

/**
 * Parse a source file into raw records. Files no parser claims (metadata like
 * rank/, strains/, loader/) yield [] — they carry no poem content.
 */
export function parseFile(path: string, text: string): RawRecord[] {
  const parser = parsers.find((p) => p.match(path));
  return parser ? parser.parse(text) : [];
}
