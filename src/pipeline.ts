/**
 * ETL orchestrator. Wires sources → normalization → repository and records
 * stats. Each source is processed independently; one bad corpus cannot
 * abort the whole run.
 */

import { rm } from "node:fs/promises";
import { PoetryRepository } from "./db/repository.ts";
import { Deduper } from "./normalize/dedup.ts";
import { normalizeRecord, type FieldMapping } from "./normalize/record.ts";
import { StatsCollector } from "./stats.ts";
import type { AuthorRecord, AuthorSource, PoemSource } from "./types.ts";

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
      const authors: AuthorRecord[] = [];
      for await (const author of source.authors()) authors.push(author);
      this.repo.transaction(() => {
        for (const author of authors) this.repo.upsertAuthor(author);
      });
      console.log(`authors:${source.name} upserted=${authors.length}`);
    }
  }

  async runPoems(source: PoemSource, mapping: FieldMapping): Promise<void> {
    const dedup = this.dedup;
    let batch: Parameters<PoetryRepository["insertPoem"]>[0][] = [];

    const flush = () => {
      if (batch.length === 0) return;
      const toInsert = batch;
      batch = [];
      this.repo.transaction(() => {
        for (const poem of toInsert) this.repo.insertPoem(poem);
      });
    };

    for await (const raw of source.rawRecords()) {
      this.stats.countRead(source.name);
      const result = normalizeRecord(raw, mapping);
      if (!result.ok) {
        this.stats.countDropped(source.name, result.reason);
        continue;
      }
      const { record } = result;
      if (!dedup.isNew(record.author, record.title, record.content)) {
        this.stats.countDropped(source.name, "duplicate");
        continue;
      }
      batch.push(record);
      this.stats.countWritten(source.name);
      if (batch.length >= BATCH_SIZE) flush();
    }
    flush();
  }
}

export async function createRepository(options: PipelineOptions): Promise<PoetryRepository> {
  if (options.fresh) {
    for (const suffix of ["", "-wal", "-shm"]) {
      // force: true ignores missing files
      await rm(options.dbPath + suffix, { force: true });
    }
  }
  return PoetryRepository.open(options.dbPath);
}
