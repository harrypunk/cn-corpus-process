/**
 * ETL orchestrator. Wires sources → normalization → repository as a lazy
 * stream pipeline: pure transforms (map/filter) in the middle, side effects
 * (stats, DB writes) only in tap callbacks and the final consumer. Each
 * source is processed independently; one bad corpus cannot abort the run.
 */

import { rm } from "node:fs/promises";
import { PoetryRepository } from "./db/repository.ts";
import { Deduper } from "./normalize/dedup.ts";
import { makeClassifier, type FieldMapping } from "./normalize/record.ts";
import { StatsCollector } from "./stats.ts";
import { batchAsync, filterMapAsync, mapAsync, tapAsync } from "./stream.ts";
import type { AuthorSource, PoemSource } from "./types.ts";

/** How many poems are buffered per transaction batch. */
const BATCH_SIZE = 1000;

export interface PipelineOptions {
  dbPath: string;
  /** Rebuild the DB from scratch (delete the existing file first). */
  fresh: boolean;
}

export class Pipeline {
  /** Dedup is global: corpora overlap (e.g. 水墨唐诗 ⊂ 全唐诗). */
  private readonly dedup = new Deduper();

  constructor(
    private readonly repo: PoetryRepository,
    private readonly stats: StatsCollector,
  ) {}

  async runAuthors(sources: AuthorSource[]): Promise<void> {
    for (const source of sources) {
      const authors = await Array.fromAsync(source.authors());
      this.repo.transaction(() => authors.forEach((a) => this.repo.upsertAuthor(a)));
      console.log(`authors:${source.name} upserted=${authors.length}`);
    }
  }

  async runPoems(source: PoemSource, mapping: FieldMapping): Promise<void> {
    // pure: raw -> NormalizeResult (normalize + dedup decision)
    const classify = makeClassifier(mapping, this.dedup);

    const counted = tapAsync(source.rawRecords(), () => this.stats.countRead(source.name));
    const results = mapAsync(counted, classify);
    const dropsLogged = tapAsync(results, (r) => {
      if (!r.ok) this.stats.countDropped(source.name, r.reason);
    });
    const poems = tapAsync(
      filterMapAsync(dropsLogged, (r) => (r.ok ? r.record : null)),
      () => this.stats.countWritten(source.name),
    );

    // the only effectful stage: batch insert in one transaction per batch
    for await (const batch of batchAsync(poems, BATCH_SIZE)) {
      this.repo.transaction(() => batch.forEach((p) => this.repo.insertPoem(p)));
    }
  }
}

export async function createRepository(options: PipelineOptions): Promise<PoetryRepository> {
  if (options.fresh) {
    // force: true ignores missing files
    await Promise.all(["", "-wal", "-shm"].map((s) => rm(options.dbPath + s, { force: true })));
  }
  return PoetryRepository.open(options.dbPath);
}
