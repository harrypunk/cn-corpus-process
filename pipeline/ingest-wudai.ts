/**
 * Ingest job: 五代诗词/huajianji (花间集) → ciParser → raw sink.
 * Run: `bun run ingest`. One file per job lives here; layers stay in src/.
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
const WUDAI_DIR = "五代诗词";

/** 花间集 verse files, relative to 五代诗词: huajianji/huajianji-*-juan.json (skips preface/index). */
const HUAJIANJI_JUAN = /^huajianji\/huajianji-[^/]*-juan\.json$/;

/** 南唐 verse file, relative to 五代诗词. */
const NANTANG_POETRYS = "nantang/poetrys.json";

/** 五代 verse files only: 花间集 juan files plus 南唐 poetrys.json. */
export function isWudaiVerse(path: string): boolean {
  if (!path.startsWith(`${WUDAI_DIR}/`)) return false;
  const rel = path.slice(WUDAI_DIR.length + 1);
  return HUAJIANJI_JUAN.test(rel) || rel === NANTANG_POETRYS;
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
      // This job is scoped to 五代诗词 regardless of ETL_PATH_PREFIXES.
      const source = createSource({ ...config.source, prefixes: [WUDAI_DIR] });
      const sink = yield* Effect.acquireRelease(createSink(config.sink), (s) =>
        s.close().pipe(Effect.ignoreLogged),
      );

      const landed = yield* ingest(source, ciParser, sink, isWudaiVerse);
      yield* Console.log(`source "${source.name}" -> sink "${sink.name}": ${landed} raw records`);
    }),
  );

  await Effect.runPromise(program).catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
