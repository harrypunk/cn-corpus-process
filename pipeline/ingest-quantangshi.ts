/**
 * Ingest job: 全唐诗 → poemsParser → raw sink.
 * Run: `bun run ingest:quantangshi`. One file per job lives here; layers stay in src/.
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
const QUANTANGSHI_DIR = "全唐诗";

/** Poem files, relative to 全唐诗: poet.tang.*.json / poet.song.*.json. */
const POET_JSON = /^poet\.(?:tang|song)\.[^/]*\.json$/;

/** Standalone collections, relative to 全唐诗. */
const EXTRA_FILES: readonly string[] = ["唐诗三百首.json", "唐诗补录.json"];

/** 全唐诗 verse files only: poet.tang/poet.song JSON plus the standalone collections. */
export function isQuantangshiVerse(path: string): boolean {
  if (!path.startsWith(`${QUANTANGSHI_DIR}/`)) return false;
  const rel = path.slice(QUANTANGSHI_DIR.length + 1);
  return POET_JSON.test(rel) || EXTRA_FILES.includes(rel);
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
      // This job is scoped to 全唐诗 regardless of ETL_PATH_PREFIXES.
      const source = createSource({ ...config.source, prefixes: [QUANTANGSHI_DIR] });
      const sink = yield* Effect.acquireRelease(createSink(config.sink), (s) =>
        s.close().pipe(Effect.ignoreLogged),
      );

      const landed = yield* ingest(source, poemsParser, sink, isQuantangshiVerse);
      yield* Console.log(`source "${source.name}" -> sink "${sink.name}": ${landed} raw records`);
    }),
  );

  await Effect.runPromise(program).catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
