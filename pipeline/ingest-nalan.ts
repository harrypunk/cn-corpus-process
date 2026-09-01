/**
 * Ingest job: 纳兰性德 → mappedParser → raw sink. Run: `bun run ingest:nalan`.
 * Thin entry: declares corpus dir, path filter, parser — the pipeline lives in ./ingest.ts.
 */

import { mappedParser } from "@src/parse/index.ts";
import { runIngestJob } from "./ingest.ts";

/** Corpus dir this job ingests. */
const NALAN_DIR = "纳兰性德";

/** Lines live in `para`, not `paragraphs`. */
const parser = mappedParser("nalan", { title: "title", paragraphs: "para" });

if (import.meta.main) {
  await runIngestJob({
    corpusDir: NALAN_DIR,
    keep: (path) => path === `${NALAN_DIR}/纳兰性德诗集.json`,
    parser,
  });
}
