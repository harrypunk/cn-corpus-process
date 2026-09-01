/**
 * Independent consumers of the ingest event stream: sink writing, metrics
 * aggregation, progress logging. Each is a plain stream fold/drain — compose
 * them with Stream.broadcastedQueues and they never touch the pipeline.
 */

import { Chunk, Console, Effect, Option, Stream } from "effect";
import type { SourceError } from "@src/source/index.ts";
import { type Sink, type SinkError } from "@src/store/index.ts";
import type { IngestEvent } from "./events.ts";

type EventStream = Stream.Stream<IngestEvent, SourceError>;

/** Consume RecordsParsed events, batching records into sink.writeRaw; returns records written. */
export function sinkWriter(sink: Sink, batchSize: number) {
  return function (events: EventStream): Effect.Effect<number, SourceError | SinkError> {
    return events.pipe(
      Stream.filterMap((e) =>
        e._tag === "RecordsParsed" ? Option.some(e.records) : Option.none(),
      ),
      Stream.mapConcat((records) => records),
      Stream.grouped(batchSize),
      Stream.mapEffect((batch) =>
        Effect.as(sink.writeRaw(Chunk.toReadonlyArray(batch)), batch.length),
      ),
      Stream.runSum,
    );
  };
}

/** Aggregated run statistics; the final report is rendered from this. */
export interface IngestMetrics {
  /** Files kept by the filter. */
  readonly listed: number;
  /** Files filtered out. */
  readonly skipped: number;
  /** Files read and parsed without error. */
  readonly parsed: number;
  /** Files whose read failed. */
  readonly failed: number;
  /** Total records parsed. */
  readonly records: number;
  /** Paths of failed files, in order. */
  readonly failedFiles: readonly string[];
}

const zeroMetrics: IngestMetrics = {
  listed: 0,
  skipped: 0,
  parsed: 0,
  failed: 0,
  records: 0,
  failedFiles: [],
};

function reduce(m: IngestMetrics, e: IngestEvent): IngestMetrics {
  switch (e._tag) {
    case "FileListed":
      return { ...m, listed: m.listed + 1 };
    case "FileSkipped":
      return { ...m, skipped: m.skipped + 1 };
    case "RecordsParsed":
      return { ...m, parsed: m.parsed + 1, records: m.records + e.records.length };
    case "FileFailed":
      return { ...m, failed: m.failed + 1, failedFiles: [...m.failedFiles, e.file.path] };
  }
}

/** Fold events into IngestMetrics. */
export function metricsCollector(events: EventStream): Effect.Effect<IngestMetrics, SourceError> {
  return Stream.runFold(events, zeroMetrics, reduce);
}

const LOG_EVERY = 100;

/** Log failures immediately and a progress line every LOG_EVERY processed files. */
export function progressLogger(
  events: EventStream,
  log: (msg: string) => Effect.Effect<void> = Console.log,
): Effect.Effect<void, SourceError> {
  return events.pipe(
    Stream.mapAccum(
      0,
      (processed: number, e: IngestEvent): readonly [number, Option.Option<string>] => {
        if (e._tag === "FileFailed") {
          return [processed + 1, Option.some(`FAIL ${e.file.path}: ${e.message}`)];
        }
        if (e._tag === "RecordsParsed") {
          const n = processed + 1;
          return [n, n % LOG_EVERY === 0 ? Option.some(`${n} files processed`) : Option.none()];
        }
        return [processed, Option.none()];
      },
    ),
    Stream.filterMap((msg) => msg),
    Stream.mapEffect(log),
    Stream.runDrain,
  );
}
