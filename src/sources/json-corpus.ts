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

export class JsonCorpusSource implements PoemSource {
  readonly name: string;

  constructor(private readonly config: JsonCorpusConfig) {
    this.name = config.name;
  }

  async *rawRecords(): AsyncGenerator<RawRecord> {
    for (const pattern of this.config.patterns) {
      const glob = new Glob(pattern);
      const files = await Array.fromAsync(glob.scan({ cwd: this.config.rootDir, onlyFiles: true }));
      files.sort();
      for (const file of files) {
        const data: unknown = await Bun.file(`${this.config.rootDir}/${file}`).json();
        if (!Array.isArray(data)) continue;
        for (const item of data) {
          if (item !== null && typeof item === "object") {
            yield item as RawRecord;
          }
        }
      }
    }
  }
}
