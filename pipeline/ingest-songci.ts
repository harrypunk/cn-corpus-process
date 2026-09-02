/**
 * Ingest job: 宋词 → ciParser → raw sink. Run: `bun run ingest:songci`.
 * Thin entry: declares corpus dir, path filter, parser — the pipeline lives in ./ingest.ts.
 */

import { Corpus } from "@src/corpus.ts";
import { ciParser } from "@src/parse/index.ts";
import { runIngestJob } from "./ingest.ts";

/** Corpus dir this job ingests. */
const SONGCI_DIR = "宋词";

/** 词 files, relative to 宋词: ci.song.*.json (author.song.json metadata excluded). */
const CI_SONG = /^ci\.song\.[^/]*\.json$/;

/** Standalone collections, relative to 宋词. */
const EXTRA_FILES: readonly string[] = ["宋词三百首.json"];

/** 宋词 verse files only: ci.song.*.json plus 宋词三百首.json. */
function isSongciVerse(path: string): boolean {
  if (!path.startsWith(`${SONGCI_DIR}/`)) return false;
  const rel = path.slice(SONGCI_DIR.length + 1);
  return CI_SONG.test(rel) || EXTRA_FILES.includes(rel);
}

if (import.meta.main) {
  await runIngestJob({
    corpusDir: SONGCI_DIR,
    corpusId: Corpus.SONGCI,
    keep: isSongciVerse,
    parser: ciParser,
  });
}
