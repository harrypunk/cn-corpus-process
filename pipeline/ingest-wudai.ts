/**
 * Ingest job: 五代诗词 → ciParser → raw sink. Run: `bun run ingest:wudai`.
 * Thin entry: declares corpus dir, path filter, parser — the pipeline lives in ./ingest.ts.
 */

import { ciParser } from "@src/parse/index.ts";
import { runIngestJob } from "./ingest.ts";

/** Corpus dir this job ingests. */
const WUDAI_DIR = "五代诗词";

/** 花间集 verse files, relative to 五代诗词: huajianji/huajianji-*-juan.json (skips preface/index). */
const HUAJIANJI_JUAN = /^huajianji\/huajianji-[^/]*-juan\.json$/;

/** 南唐 verse file, relative to 五代诗词. */
const NANTANG_POETRYS = "nantang/poetrys.json";

/** 五代 verse files only: 花间集 juan files plus 南唐 poetrys.json. */
function isWudaiVerse(path: string): boolean {
  if (!path.startsWith(`${WUDAI_DIR}/`)) return false;
  const rel = path.slice(WUDAI_DIR.length + 1);
  return HUAJIANJI_JUAN.test(rel) || rel === NANTANG_POETRYS;
}

if (import.meta.main) {
  await runIngestJob({ corpusDir: WUDAI_DIR, keep: isWudaiVerse, parser: ciParser });
}
