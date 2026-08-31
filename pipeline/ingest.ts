/**
 * Ingest job: source → parse → raw sink. Run: `bun run ingest`.
 * One file per job lives here; layers stay in src/.
 */

import { Chunk, Console, Effect, Stream } from "effect";
import { loadConfig } from "@src/config.ts";
import { parseFile } from "@src/parse/index.ts";
import { createSource, type DataSource, type SourceError } from "@src/source/index.ts";
import { createSink, type Sink, type SinkError } from "@src/store/index.ts";

const READ_CONCURRENCY = 8;
const BATCH_SIZE = 500;

/** List → read → parse → batch → write; returns the number of records written. */
export function ingest(
  source: DataSource,
  sink: Sink,
): Effect.Effect<number, SourceError | SinkError> {
  return source.list().pipe(
    Stream.mapEffect(
      (file) => Effect.map(source.read(file), (text) => parseFile(file.path, text)),
      { concurrency: READ_CONCURRENCY },
    ),
    Stream.mapConcat((records) => records),
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
      const source = createSource(config.source);
      const sink = yield* Effect.acquireRelease(createSink(config.sink), (s) =>
        s.close().pipe(Effect.ignoreLogged),
      );

      const landed = yield* ingest(source, sink);
      yield* Console.log(`source "${source.name}" -> sink "${sink.name}": ${landed} raw records`);
    }),
  );

  await Effect.runPromise(program).catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
