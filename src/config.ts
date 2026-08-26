/**
 * Runtime configuration, read from environment variables.
 * Bun auto-loads .env — copy .env.example to .env and adjust.
 */

import type { Dialect } from "./db/store.ts";
import type { Maybe } from "./types.ts";

export interface EtlConfig {
  /** Root directory of the upstream chinese-poetry checkout. Required. */
  root: string;
  /** Target database dialect. */
  dialect: Dialect;
  /** SQLite output path (dialect=sqlite only). */
  db: string;
  /** Connection URL (dialect=postgres/mysql). */
  databaseUrl: Maybe<string>;
  /** Stats report output path. */
  report: string;
  /** Restrict the run to a single corpus (null = all). */
  source: Maybe<string>;
}

const DIALECTS: readonly Dialect[] = ["sqlite", "postgres", "mysql"];

export function loadConfig(env: NodeJS.ProcessEnv = process.env): EtlConfig {
  const root = env.POETRY_ROOT;
  if (!root) {
    throw new Error(
      "POETRY_ROOT is not set. Copy .env.example to .env and point it at your chinese-poetry checkout.",
    );
  }
  const dialect = (env.ETL_DIALECT ?? "sqlite") as Dialect;
  if (!DIALECTS.includes(dialect)) {
    throw new Error(`ETL_DIALECT must be one of: ${DIALECTS.join(", ")} (got "${dialect}")`);
  }
  const databaseUrl = env.DATABASE_URL ?? null;
  if (dialect !== "sqlite" && !databaseUrl) {
    throw new Error(`DATABASE_URL is required when ETL_DIALECT=${dialect}`);
  }
  return {
    root,
    dialect,
    db: env.ETL_DB ?? "dist/poetry.db",
    databaseUrl,
    report: env.ETL_REPORT ?? "dist/report.json",
    source: env.ETL_SOURCE ?? null,
  };
}
