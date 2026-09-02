/**
 * Ingest job: 楚辞 → mappedParser → raw sink. Run: `bun run ingest:chuci`.
 * Thin entry: declares corpus dir, path filter, parser — the pipeline lives in ./ingest.ts.
 */

import { Corpus } from "@src/corpus.ts";
import { mappedParser } from "@src/parse/index.ts";
import { runIngestJob } from "./ingest.ts";

/** Corpus dir this job ingests. */
const CHUCI_DIR = "楚辞";

/** Lines live in `content`, not `paragraphs`. */
const parser = mappedParser("chuci", { title: "title", paragraphs: "content" });

if (import.meta.main) {
  await runIngestJob({
    corpusDir: CHUCI_DIR,
    corpusId: Corpus.CHUCI,
    keep: (path) => path === `${CHUCI_DIR}/chuci.json`,
    parser,
  });
}
