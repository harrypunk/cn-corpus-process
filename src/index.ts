/**
 * ETL entry point. Configuration comes from environment variables
 * (see src/config.ts and .env.example) — no CLI flags.
 */

import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { loadConfig } from "./config.ts";
import { Pipeline, createRepository } from "./pipeline.ts";
import { authorSources, corpusEntries, mappingFor, poemSources } from "./sources/corpora.ts";
import { StatsCollector } from "./stats.ts";

async function main(): Promise<void> {
  const config = loadConfig();
  const repo = createRepository({ dbPath: config.db, fresh: true });
  const stats = new StatsCollector();
  const pipeline = new Pipeline(repo, stats);

  try {
    await pipeline.runAuthors(authorSources(config.root));

    const entries = corpusEntries(config.root).filter(
      (e) => config.source === null || e.corpus.name === config.source,
    );
    if (entries.length === 0) {
      throw new Error(`no corpus matched ETL_SOURCE=${config.source}`);
    }
    for (const entry of entries) {
      const mapping = mappingFor(config.root, entry.corpus.name);
      if (!mapping) throw new Error(`no mapping for ${entry.corpus.name}`);
      console.log(`processing ${entry.corpus.name} ...`);
      const source = poemSources(config.root).find((s) => s.name === entry.corpus.name);
      if (!source) throw new Error(`no source for ${entry.corpus.name}`);
      await pipeline.runPoems(source, mapping);
    }
  } finally {
    repo.close();
  }

  stats.print();
  mkdirSync(dirname(config.report), { recursive: true });
  await Bun.write(config.report, JSON.stringify(stats.toJSON(), null, 2));
  console.log(`\nreport written to ${config.report}`);
  console.log(`database written to ${config.db}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
