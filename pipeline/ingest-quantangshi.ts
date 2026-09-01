/**
 * Ingest job: 全唐诗 → poemsParser → raw sink. Run: `bun run ingest:quantangshi`.
 * Thin entry: declares corpus dir, path filter, parser — the pipeline lives in ./ingest.ts.
 */

import { poemsParser } from "@src/parse/index.ts";
import { runIngestJob } from "./ingest.ts";

/** Corpus dir this job ingests. */
const QUANTANGSHI_DIR = "全唐诗";

/** Poem files, relative to 全唐诗: poet.tang.*.json / poet.song.*.json. */
const POET_JSON = /^poet\.(?:tang|song)\.[^/]*\.json$/;

/** Standalone collections, relative to 全唐诗. */
const EXTRA_FILES: readonly string[] = ["唐诗三百首.json", "唐诗补录.json"];

/** 全唐诗 verse files only: poet.tang/poet.song JSON plus the standalone collections. */
function isQuantangshiVerse(path: string): boolean {
  if (!path.startsWith(`${QUANTANGSHI_DIR}/`)) return false;
  const rel = path.slice(QUANTANGSHI_DIR.length + 1);
  return POET_JSON.test(rel) || EXTRA_FILES.includes(rel);
}

if (import.meta.main) {
  await runIngestJob({ corpusDir: QUANTANGSHI_DIR, keep: isQuantangshiVerse, parser: poemsParser });
}
