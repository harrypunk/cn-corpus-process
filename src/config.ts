/** Central env-driven configuration. Bun loads .env automatically. */

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

export interface AppConfig {
  readonly source: SourceConfig;
  readonly sink: SinkConfig;
}

function required(env: Record<string, string | undefined>, key: string): string {
  const value = env[key];
  if (!value) throw new Error(`Missing required env var: ${key}`);
  return value;
}

/** Comma-separated corpus dir prefixes; empty = the whole source. */
function prefixes(env: Record<string, string | undefined>): readonly string[] {
  return (env.ETL_PATH_PREFIXES ?? "")
    .split(",")
    .map((s) => s.trim().replace(/\/+$/, ""))
    .filter((s) => s !== "");
}

function loadSource(env: Record<string, string | undefined>): SourceConfig {
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

function loadSink(env: Record<string, string | undefined>): SinkConfig {
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

export function loadConfig(env: Record<string, string | undefined> = process.env): AppConfig {
  return { source: loadSource(env), sink: loadSink(env) };
}
