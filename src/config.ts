/** Central env-driven configuration. Bun loads .env automatically. */

export interface FsSourceConfig {
  readonly kind: "fs";
  readonly root: string;
}

export interface GiteaSourceConfig {
  readonly kind: "gitea";
  readonly baseUrl: string;
  readonly owner: string;
  readonly repo: string;
  readonly ref: string;
  readonly token?: string;
  readonly pathPrefix: string;
}

export type SourceConfig = FsSourceConfig | GiteaSourceConfig;

export interface AppConfig {
  readonly source: SourceConfig;
}

function required(env: Record<string, string | undefined>, key: string): string {
  const value = env[key];
  if (!value) throw new Error(`Missing required env var: ${key}`);
  return value;
}

export function loadConfig(env: Record<string, string | undefined> = process.env): AppConfig {
  const kind = env.ETL_SOURCE_KIND ?? "fs";
  switch (kind) {
    case "fs":
      return { source: { kind, root: required(env, "POETRY_ROOT") } };
    case "gitea":
      return {
        source: {
          kind,
          baseUrl: required(env, "GITEA_BASE_URL").replace(/\/+$/, ""),
          owner: required(env, "GITEA_OWNER"),
          repo: required(env, "GITEA_REPO"),
          ref: env.GITEA_REF ?? "master",
          token: env.GITEA_TOKEN || undefined,
          pathPrefix: env.GITEA_PATH_PREFIX ?? "",
        },
      };
    default:
      throw new Error(
        `Unknown ETL_SOURCE_KIND: ${JSON.stringify(kind)} (expected "fs" or "gitea")`,
      );
  }
}
