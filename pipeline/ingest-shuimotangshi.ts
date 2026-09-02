/**
 * Ingest job: 水墨唐诗 → poemsParser → raw sink. Run: `bun run ingest:shuimotangshi`.
 * Thin entry: declares corpus dir, path filter, parser — the pipeline lives in ./ingest.ts.
 */

import { Corpus } from "@src/corpus.ts";
import { poemsParser } from "@src/parse/index.ts";
import { runIngestJob } from "./ingest.ts";

/** Corpus dir this job ingests. */
const SHUIMOTANGSHI_DIR = "水墨唐诗";

/** The single verse file, relative to 水墨唐诗. */
const VERSE_FILE = "shuimotangshi.json";

/** 水墨唐诗 verse file only: shuimotangshi.json. */
function isShuimotangshiVerse(path: string): boolean {
  return path === `${SHUIMOTANGSHI_DIR}/${VERSE_FILE}`;
}

if (import.meta.main) {
  await runIngestJob({
    corpusDir: SHUIMOTANGSHI_DIR,
    corpusId: Corpus.SHUIMOTANGSHI,
    keep: isShuimotangshiVerse,
    parser: poemsParser,
  });
}
