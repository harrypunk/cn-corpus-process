/**
 * CLI entry point.
 *
 *   bun run src/index.ts [--root <dir>] [--db <path>] [--source <name>]
 *                        [--report <path>]
 *
 * Defaults: --root ../fork/chinese-poetry --db dist/poetry.db
 *           --report dist/report.json, full rebuild.
 */

import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { Pipeline, createRepository } from "./pipeline.ts";
import {
  authorSources,
  corpusEntries,
  mappingFor,
  poemSources,
} from "./sources/corpora.ts";
import { StatsCollector } from "./stats.ts";

interface CliOptions {
  root: string;
  db: string;
  report: string;
  source: string | null;
}

function parseArgs(argv: string[]): CliOptions {
  const opts: CliOptions = {
    root: "../fork/chinese-poetry",
    db: "dist/poetry.db",
    report: "dist/report.json",
    source: null,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = () => {
      const v = argv[++i];
      if (v === undefined) throw new Error(`missing value for ${arg}`);
      return v;
    };
    switch (arg) {
      case "--root": opts.root = next(); break;
      case "--db": opts.db = next(); break;
      case "--report": opts.report = next(); break;
      case "--source": opts.source = next(); break;
      default:
        throw new Error(`unknown argument: ${arg}`);
    }
  }
  return opts;
}

async function main(): Promise<void> {
  const opts = parseArgs(Bun.argv.slice(2));
  const repo = createRepository({ dbPath: opts.db, fresh: true });
  const stats = new StatsCollector();
  const pipeline = new Pipeline(repo, stats);

  try {
    await pipeline.runAuthors(authorSources(opts.root));

    const entries = corpusEntries(opts.root).filter(
      (e) => opts.source === null || e.corpus.name === opts.source,
    );
    if (entries.length === 0) {
      throw new Error(`no corpus matched --source ${opts.source}`);
    }
    for (const entry of entries) {
      const mapping = mappingFor(opts.root, entry.corpus.name);
      if (!mapping) throw new Error(`no mapping for ${entry.corpus.name}`);
      console.log(`processing ${entry.corpus.name} ...`);
      const source = poemSources(opts.root).find(
        (s) => s.name === entry.corpus.name,
      );
      if (!source) throw new Error(`no source for ${entry.corpus.name}`);
      await pipeline.runPoems(source, mapping);
    }
  } finally {
    repo.close();
  }

  stats.print();
  mkdirSync(dirname(opts.report), { recursive: true });
  await Bun.write(opts.report, JSON.stringify(stats.toJSON(), null, 2));
  console.log(`\nreport written to ${opts.report}`);
  console.log(`database written to ${opts.db}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
