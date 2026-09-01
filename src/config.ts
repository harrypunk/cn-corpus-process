/** Central env-driven configuration. Bun loads .env automatically. */

type Env = Record<string, string | undefined>;

export interface FsSourceConfig {
  readonly kind: "fs";
  readonly root: string;
  /** Limit listing to these root-relative dirs; [] = the whole root. */
  readonly prefixes: readonly string[];
}

export interface GiteaSourceConfig {
  readonly kind: "gitea";
  readonly baseUrl: string;
  readonly owner: string;
  readonly repo: string;
  readonly ref: string;
  readonly token?: string;
  /** Limit listing to these repo-relative dirs; [] = the whole repo. */
  readonly prefixes: readonly string[];
}

export type SourceConfig = FsSourceConfig | GiteaSourceConfig;

export interface PgliteSinkConfig {
  readonly kind: "pglite";
  readonly dataDir: string;
}

export interface TidbSinkConfig {
  readonly kind: "tidb";
  readonly url: string;
}

export type SinkConfig = PgliteSinkConfig | TidbSinkConfig;

export interface IngestConfig {
  /** Concurrent file reads during ingest. */
  readonly readConcurrency: number;
  /** Records per writeRaw batch. */
  readonly batchSize: number;
}

export interface AppConfig {
  readonly source: SourceConfig;
  readonly sink: SinkConfig;
  readonly ingest: IngestConfig;
}

function required(env: Env, key: string): string {
  const value = env[key];
  if (!value) throw new Error(`Missing required env var: ${key}`);
  return value;
}

/** Positive integer env var with a fallback default. */
function positiveInt(env: Env, key: string, fallback: number): number {
  const raw = env[key];
  if (!raw) return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) {
    throw new Error(`Invalid ${key}: ${JSON.stringify(raw)} (positive integer expected)`);
  }
  return n;
}

/** Comma-separated corpus dir prefixes; empty = the whole source. */
function prefixes(env: Env): readonly string[] {
  return (env.ETL_PATH_PREFIXES ?? "")
    .split(",")
    .map((s) => s.trim().replace(/\/+$/, ""))
    .filter((s) => s !== "");
}

function loadSource(env: Env): SourceConfig {
  const kind = env.ETL_SOURCE_KIND ?? "fs";
  switch (kind) {
    case "fs":
      return { kind, root: required(env, "POETRY_ROOT"), prefixes: prefixes(env) };
    case "gitea":
      return {
        kind,
        baseUrl: required(env, "GITEA_BASE_URL").replace(/\/+$/, ""),
        owner: required(env, "GITEA_OWNER"),
        repo: required(env, "GITEA_REPO"),
        ref: env.GITEA_REF ?? "master",
        token: env.GITEA_TOKEN || undefined,
        prefixes: prefixes(env),
      };
    default:
      throw new Error(
        `Unknown ETL_SOURCE_KIND: ${JSON.stringify(kind)} (expected "fs" or "gitea")`,
      );
  }
}

function loadSink(env: Env): SinkConfig {
  const kind = env.ETL_SINK_KIND ?? "pglite";
  switch (kind) {
    case "pglite":
      return { kind, dataDir: env.PGLITE_DATA_DIR ?? "./dist/pglite" };
    case "tidb":
      return { kind, url: required(env, "DATABASE_URL") };
    default:
      throw new Error(
        `Unknown ETL_SINK_KIND: ${JSON.stringify(kind)} (expected "pglite" or "tidb")`,
      );
  }
}

export function loadConfig(env: Env = process.env): AppConfig {
  return {
    source: loadSource(env),
    sink: loadSink(env),
    ingest: {
      readConcurrency: positiveInt(env, "ETL_READ_CONCURRENCY", 8),
      batchSize: positiveInt(env, "ETL_BATCH_SIZE", 500),
    },
  };
}
