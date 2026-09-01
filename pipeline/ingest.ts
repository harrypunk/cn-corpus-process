/**
 * Shared ingest core: the pipeline every corpus job runs (list → filter →
 * read → parse → batch → write) plus the entry wiring (config, source/sink
 * composition, resource cleanup). Job files only declare their corpus dir,
 * path filter and parser.
 */

import { Chunk, Console, Effect, Stream } from "effect";
import { loadConfig } from "@src/config.ts";
import type { Parser } from "@src/parse/index.ts";
import {
  createSource,
  type DataSource,
  type SourceError,
  type SourceFile,
} from "@src/source/index.ts";
import { createSink, type Sink, type SinkError } from "@src/store/index.ts";

/** Tuning knobs for the ingest pipeline, normally from env (see loadConfig). */
export interface IngestOptions {
  /** Keep only listed files whose path passes this predicate; default keeps everything. */
  readonly keep?: (path: string) => boolean;
  /** Concurrent file reads. */
  readonly readConcurrency: number;
  /** Records per writeRaw batch. */
  readonly batchSize: number;
}

/**
 * List → filter → read → parse → batch → write; returns the number of records written.
 */
export function ingest(
  source: DataSource,
  parser: Parser,
  sink: Sink,
  options: IngestOptions,
): Effect.Effect<number, SourceError | SinkError> {
  const keep = options.keep ?? (() => true);
  return source.list().pipe(
    Stream.filter((file: SourceFile) => keep(file.path)),
    Stream.mapEffect((file) => source.read(file), { concurrency: options.readConcurrency }),
    Stream.mapConcat(parser.parse),
    Stream.grouped(options.batchSize),
    Stream.mapEffect((batch) =>
      Effect.as(sink.writeRaw(Chunk.toReadonlyArray(batch)), batch.length),
    ),
    Stream.runSum,
  );
}

/** What one corpus job declares; everything else is shared. */
export interface IngestJob {
  /** Corpus dir the job is scoped to (source listing prefix). */
  readonly corpusDir: string;
  /** Keep only listed files whose path passes this predicate. */
  readonly keep: (path: string) => boolean;
  /** Parser for the corpus' JSON structure. */
  readonly parser: Parser;
}

/** Entry wiring for one corpus job: config → source/sink → ingest → report. */
export async function runIngestJob(job: IngestJob): Promise<void> {
  const program = Effect.scoped(
    Effect.gen(function* () {
      const config = yield* Effect.sync(() => loadConfig());
      // The job is scoped to its corpus dir regardless of ETL_PATH_PREFIXES.
      const source = createSource({ ...config.source, prefixes: [job.corpusDir] });
      const sink = yield* Effect.acquireRelease(createSink(config.sink), (s) =>
        s.close().pipe(Effect.ignoreLogged),
      );

      const landed = yield* ingest(source, job.parser, sink, {
        keep: job.keep,
        ...config.ingest,
      });
      yield* Console.log(`source "${source.name}" -> sink "${sink.name}": ${landed} raw records`);
    }),
  );

  await Effect.runPromise(program).catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
