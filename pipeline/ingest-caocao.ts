/**
 * Ingest job: 曹操诗集 → mappedParser → raw sink. Run: `bun run ingest:caocao`.
 * Thin entry: declares corpus dir, path filter, parser — the pipeline lives in ./ingest.ts.
 */

import { mappedParser } from "@src/parse/index.ts";
import { runIngestJob } from "./ingest.ts";

/** Corpus dir this job ingests. */
const CAOCAO_DIR = "曹操诗集";

/** Records have no author field; every poem is 曹操's. */
const parser = mappedParser("caocao", {
  title: "title",
  paragraphs: "paragraphs",
  defaultAuthor: "曹操",
});

if (import.meta.main) {
  await runIngestJob({
    corpusDir: CAOCAO_DIR,
    keep: (path) => path === `${CAOCAO_DIR}/caocao.json`,
    parser,
  });
}
