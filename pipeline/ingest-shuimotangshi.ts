/**
 * Ingest job: 水墨唐诗 (shui-motangshi.json) → poemsParser → raw sink.
 * Run: `bun run ingest:shuimotangshi`. One file per job lives here; layers stay in src/.
 *
 * Path routing lives in the job, not the parsers: the job picks which listed
 * files to keep and which parser understands them.
 */

import { Chunk, Console, Effect, Stream } from "effect";
import { loadConfig } from "@src/config.ts";
import { poemsParser, type Parser } from "@src/parse/index.ts";
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
const SHUIMOTANGSHI_DIR = "水墨唐诗";

/** The single verse file, relative to 水墨唐诗. */
const VERSE_FILE = "shuimotangshi.json";

/** 水墨唐诗 verse file only: shuimotangshi.json. */
export function isShuimotangshiVerse(path: string): boolean {
  return path === `${SHUIMOTANGSHI_DIR}/${VERSE_FILE}`;
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
      // This job is scoped to 水墨唐诗 regardless of ETL_PATH_PREFIXES.
      const source = createSource({ ...config.source, prefixes: [SHUIMOTANGSHI_DIR] });
      const sink = yield* Effect.acquireRelease(createSink(config.sink), (s) =>
        s.close().pipe(Effect.ignoreLogged),
      );

      const landed = yield* ingest(source, poemsParser, sink, isShuimotangshiVerse);
      yield* Console.log(`source "${source.name}" -> sink "${sink.name}": ${landed} raw records`);
    }),
  );

  await Effect.runPromise(program).catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
