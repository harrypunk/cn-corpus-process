/**
 * Ingest job: 宋词 → ciParser → raw sink.
 * Run: `bun run ingest:songci`. One file per job lives here; layers stay in src/.
 *
 * Path routing lives in the job, not the parsers: the job picks which listed
 * files to keep and which parser understands them.
 */

import { Chunk, Console, Effect, Stream } from "effect";
import { loadConfig } from "@src/config.ts";
import { ciParser, type Parser } from "@src/parse/index.ts";
import {
  createSource,
  type DataSource,
  type SourceError,
  type SourceFile,
} from "@src/source/index.ts";
import { createSink, type Sink, type SinkError } from "@src/store/index.ts";

const READ_CONCURRENCY = 8;
const BATCH_SIZE = 500;

/** Corpus dir this job ingests. */
const SONGCI_DIR = "宋词";

/** 词 files, relative to 宋词: ci.song.*.json (author.song.json metadata excluded). */
const CI_SONG = /^ci\.song\.[^/]*\.json$/;

/** Standalone collections, relative to 宋词. */
const EXTRA_FILES: readonly string[] = ["宋词三百首.json"];

/** 宋词 verse files only: ci.song.*.json plus 宋词三百首.json. */
export function isSongciVerse(path: string): boolean {
  if (!path.startsWith(`${SONGCI_DIR}/`)) return false;
  const rel = path.slice(SONGCI_DIR.length + 1);
  return CI_SONG.test(rel) || EXTRA_FILES.includes(rel);
}

/**
 * List → filter → read → parse → batch → write; returns the number of records written.
 * `keep` decides which listed files to ingest; default keeps everything.
 */
export function ingest(
  source: DataSource,
  parser: Parser,
  sink: Sink,
  keep: (path: string) => boolean = () => true,
): Effect.Effect<number, SourceError | SinkError> {
  return source.list().pipe(
    Stream.filter((file: SourceFile) => keep(file.path)),
    Stream.mapEffect((file) => source.read(file), { concurrency: READ_CONCURRENCY }),
    Stream.mapConcat(parser.parse),
    Stream.grouped(BATCH_SIZE),
    Stream.mapEffect((batch) =>
      Effect.as(sink.writeRaw(Chunk.toReadonlyArray(batch)), batch.length),
    ),
    Stream.runSum,
  );
}

if (import.meta.main) {
  const program = Effect.scoped(
    Effect.gen(function* () {
      const config = yield* Effect.sync(() => loadConfig());
      // This job is scoped to 宋词 regardless of ETL_PATH_PREFIXES.
      const source = createSource({ ...config.source, prefixes: [SONGCI_DIR] });
      const sink = yield* Effect.acquireRelease(createSink(config.sink), (s) =>
        s.close().pipe(Effect.ignoreLogged),
      );

      const landed = yield* ingest(source, ciParser, sink, isSongciVerse);
      yield* Console.log(`source "${source.name}" -> sink "${sink.name}": ${landed} raw records`);
    }),
  );

  await Effect.runPromise(program).catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
