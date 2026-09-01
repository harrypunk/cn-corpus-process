/**
 * Shared ingest core: the event producer every corpus job runs (list → filter
 * → read → parse, emitting IngestEvents) plus the entry wiring (config,
 * source/sink composition, subscriber fan-out, final report). Job files only
 * declare their corpus dir, path filter and parser.
 */

import { Console, Effect, Stream } from "effect";
import { loadConfig } from "@src/config.ts";
import type { Parser } from "@src/parse/index.ts";
import {
  createSource,
  type DataSource,
  type SourceError,
  type SourceFile,
} from "@src/source/index.ts";
import { createSink } from "@src/store/index.ts";
import type { IngestEvent } from "./events.ts";
import { metricsCollector, progressLogger, sinkWriter, type IngestMetrics } from "./observers.ts";

/** How many broadcast chunks the slowest subscriber may lag before back-pressuring. */
const BROADCAST_LAG = 16;

/** Producer options: which files to keep and how many to read concurrently. */
export interface IngestEventsOptions {
  /** Keep only listed files whose path passes this predicate; default keeps everything. */
  readonly keep?: (path: string) => boolean;
  /** Concurrent file reads. */
  readonly readConcurrency: number;
}

/**
 * List → filter → read → parse, as a stream of IngestEvents. Read failures
 * become FileFailed events (the run continues); only listing failures land in
 * the error channel. The producer emits and nothing more — writing, metrics
 * and logging are subscribers (see observers.ts).
 */
export function ingestEvents(
  source: DataSource,
  parser: Parser,
  options: IngestEventsOptions,
): Stream.Stream<IngestEvent, SourceError> {
  const keep = options.keep ?? (() => true);
  const readAndParse = (file: SourceFile): Effect.Effect<readonly IngestEvent[]> =>
    source.read(file).pipe(
      Effect.map((text): readonly IngestEvent[] => [
        { _tag: "RecordsParsed", file, records: parser.parse(text) },
      ]),
      Effect.catchAll((error): Effect.Effect<readonly IngestEvent[]> =>
        Effect.succeed([{ _tag: "FileFailed", file, message: error.message }]),
      ),
    );

  return source.list().pipe(
    Stream.mapConcat((file): readonly IngestEvent[] => [
      keep(file.path) ? { _tag: "FileListed", file } : { _tag: "FileSkipped", file },
    ]),
    Stream.mapEffect(
      (e): Effect.Effect<readonly IngestEvent[]> =>
        e._tag === "FileListed"
          ? Effect.map(readAndParse(e.file), (rest) => [e, ...rest])
          : Effect.succeed([e]),
      { concurrency: options.readConcurrency },
    ),
    Stream.mapConcat((events) => events),
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

function formatReport(source: string, sink: string, written: number, m: IngestMetrics): string {
  const summary =
    `source "${source}" -> sink "${sink}": ${written} raw records ` +
    `(${m.listed} files, ${m.skipped} skipped, ${m.parsed} parsed, ${m.failed} failed)`;
  if (m.failedFiles.length === 0) return summary;
  return `${summary}\nfailed files:\n${m.failedFiles.map((p) => `  ${p}`).join("\n")}`;
}

/** Entry wiring for one corpus job: config → source/sink → events → subscribers → report. */
export async function runIngestJob(job: IngestJob): Promise<void> {
  const program = Effect.scoped(
    Effect.gen(function* () {
      const config = yield* Effect.sync(() => loadConfig());
      // The job is scoped to its corpus dir regardless of ETL_PATH_PREFIXES.
      const source = createSource({ ...config.source, prefixes: [job.corpusDir] });
      const sink = yield* Effect.acquireRelease(createSink(config.sink), (s) =>
        s.close().pipe(Effect.ignoreLogged),
      );

      const events = ingestEvents(source, job.parser, {
        keep: job.keep,
        readConcurrency: config.ingest.readConcurrency,
      });

      // One producer, three independent subscribers.
      const [toSink, toMetrics, toLog] = yield* Stream.broadcastedQueues(events, 3, BROADCAST_LAG);
      const [written, metrics] = yield* Effect.all(
        [
          sinkWriter(sink, config.ingest.batchSize)(Stream.flattenTake(Stream.fromQueue(toSink))),
          metricsCollector(Stream.flattenTake(Stream.fromQueue(toMetrics))),
          progressLogger(Stream.flattenTake(Stream.fromQueue(toLog))),
        ],
        { concurrency: "unbounded" },
      );

      yield* Console.log(formatReport(source.name, sink.name, written, metrics));
    }),
  );

  await Effect.runPromise(program).catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
