/**
 * ETL orchestrator. Wires sources → normalization → store as a lazy
 * Effect Stream: pure transforms (map/filterMap) in the middle, side
 * effects (stats, DB writes) only in taps and the final sink. Each source
 * is processed independently; one bad corpus cannot abort the run.
 */

import { Effect, Option, Stream } from "effect";
import type { PoetryStore } from "./db/store.ts";
import { Deduper } from "./normalize/dedup.ts";
import { makeClassifier, type FieldMapping } from "./normalize/record.ts";
import { StatsCollector } from "./stats.ts";
import type { AuthorSource, PoemSource } from "./types.ts";

/** How many poems are buffered per transaction batch. */
const BATCH_SIZE = 1000;

const toStream = <A>(iter: AsyncIterable<A>): Stream.Stream<A, Error> =>
  Stream.fromAsyncIterable(iter, (e) => (e instanceof Error ? e : new Error(String(e))));

export class Pipeline {
  /** Dedup is global: corpora overlap (e.g. 水墨唐诗 ⊂ 全唐诗). */
  private readonly dedup = new Deduper();

  constructor(
    private readonly store: PoetryStore,
    private readonly stats: StatsCollector,
  ) {}

  async runAuthors(sources: AuthorSource[]): Promise<void> {
    for (const source of sources) {
      const authors = await Effect.runPromise(Stream.runCollect(toStream(source.authors())));
      await this.store.upsertAuthors([...authors]);
      console.log(`authors:${source.name} upserted=${authors.length}`);
    }
  }

  async runPoems(source: PoemSource, mapping: FieldMapping): Promise<void> {
    // pure: raw -> NormalizeResult (normalize + dedup decision)
    const classify = makeClassifier(mapping, this.dedup);

    const program = toStream(source.rawRecords()).pipe(
      Stream.tap(() => Effect.sync(() => this.stats.countRead(source.name))),
      Stream.map(classify),
      Stream.tap((r) =>
        Effect.sync(() => {
          if (!r.ok) this.stats.countDropped(source.name, r.reason);
        }),
      ),
      Stream.filterMap((r) => (r.ok ? Option.some(r.record) : Option.none())),
      Stream.tap(() => Effect.sync(() => this.stats.countWritten(source.name))),
      Stream.grouped(BATCH_SIZE),
      // the only effectful stage: one multi-row INSERT per batch
      Stream.runForEach((batch) => Effect.promise(() => this.store.insertPoems([...batch]))),
    );

    await Effect.runPromise(program);
  }
}
