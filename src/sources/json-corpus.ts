/**
 * Generic PoemSource for corpora stored as JSON arrays, possibly sharded
 * across many files (e.g. 全唐诗 poet.tang.*.json). Each file is parsed
 * and yielded record-by-record, so memory stays bounded by one shard.
 */

import { Glob } from "bun";
import type { PoemSource, RawRecord } from "../types.ts";

export interface JsonCorpusConfig {
  /** Corpus identifier written to poems.source. */
  name: string;
  /** Glob patterns (relative to rootDir) for the shard files. */
  patterns: string[];
  /** Root directory of the upstream checkout. */
  rootDir: string;
}

/** Pure: keep only object-shaped entries. */
const isRecord = (item: unknown): item is RawRecord =>
  item !== null && typeof item === "object" && !Array.isArray(item);

/** Pure: parse one shard file into raw records. */
async function readShard(path: string): Promise<RawRecord[]> {
  const data: unknown = await Bun.file(path).json();
  return Array.isArray(data) ? data.filter(isRecord) : [];
}

async function listShards(config: JsonCorpusConfig): Promise<string[]> {
  const perPattern = await Promise.all(
    config.patterns.map(async (pattern) => {
      const files = await Array.fromAsync(
        new Glob(pattern).scan({ cwd: config.rootDir, onlyFiles: true }),
      );
      return files.map((f) => `${config.rootDir}/${f}`);
    }),
  );
  return perPattern.flat().sort();
}

export class JsonCorpusSource implements PoemSource {
  readonly name: string;

  constructor(private readonly config: JsonCorpusConfig) {
    this.name = config.name;
  }

  async *rawRecords(): AsyncGenerator<RawRecord> {
    // sequential on purpose: one shard in memory at a time
    for (const file of await listShards(this.config)) {
      yield* await readShard(file);
    }
  }
}
