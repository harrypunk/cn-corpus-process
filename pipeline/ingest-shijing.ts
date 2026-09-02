/**
 * Ingest job: 诗经 → mappedParser → raw sink. Run: `bun run ingest:shijing`.
 * Thin entry: declares corpus dir, path filter, parser — the pipeline lives in ./ingest.ts.
 */

import { Corpus } from "@src/corpus.ts";
import { mappedParser } from "@src/parse/index.ts";
import { runIngestJob } from "./ingest.ts";

/** Corpus dir this job ingests. */
const SHIJING_DIR = "诗经";

/** No author in the data; title carries chapter/section context ("国风·周南·关雎"). */
const parser = mappedParser("shijing", {
  title: "title",
  paragraphs: "content",
  titlePrefix: ["chapter", "section"],
});

if (import.meta.main) {
  await runIngestJob({
    corpusDir: SHIJING_DIR,
    corpusId: Corpus.SHIJING,
    keep: (path) => path === `${SHIJING_DIR}/shijing.json`,
    parser,
  });
}
