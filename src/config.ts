/**
 * Runtime configuration, read from environment variables.
 * Bun auto-loads .env — copy .env.example to .env and adjust.
 */

import type { Maybe } from "./types.ts";

export interface EtlConfig {
  /** Root directory of the upstream chinese-poetry checkout. Required. */
  root: string;
  /** Output SQLite database path. */
  db: string;
  /** Stats report output path. */
  report: string;
  /** Restrict the run to a single corpus (null = all). */
  source: Maybe<string>;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): EtlConfig {
  const root = env.POETRY_ROOT;
  if (!root) {
    throw new Error(
      "POETRY_ROOT is not set. Copy .env.example to .env and point it at your chinese-poetry checkout.",
    );
  }
  return {
    root,
    db: env.ETL_DB ?? "dist/poetry.db",
    report: env.ETL_REPORT ?? "dist/report.json",
    source: env.ETL_SOURCE ?? null,
  };
}
