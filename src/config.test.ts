import { describe, expect, it } from "bun:test";
import { loadConfig } from "./config.ts";

describe("loadConfig", () => {
  it("defaults to the fs source", () => {
    expect(loadConfig({ POETRY_ROOT: "/data" }).source).toEqual({
      kind: "fs",
      root: "/data",
      prefixes: [],
    });
  });

  it("requires POETRY_ROOT for fs", () => {
    expect(() => loadConfig({})).toThrow("POETRY_ROOT");
  });

  it("parses gitea config with defaults", () => {
    const config = loadConfig({
      ETL_SOURCE_KIND: "gitea",
      GITEA_BASE_URL: "https://gitea.lan/",
      GITEA_OWNER: "me",
      GITEA_REPO: "poetry",
    });
    expect(config.source).toEqual({
      kind: "gitea",
      baseUrl: "https://gitea.lan",
      owner: "me",
      repo: "poetry",
      ref: "master",
      token: undefined,
      prefixes: [],
    });
  });

  it("honours gitea overrides", () => {
    const config = loadConfig({
      ETL_SOURCE_KIND: "gitea",
      GITEA_BASE_URL: "https://gitea.lan",
      GITEA_OWNER: "me",
      GITEA_REPO: "poetry",
      GITEA_REF: "dev",
      GITEA_TOKEN: "t",
      ETL_PATH_PREFIXES: "全唐诗, 元曲/",
    });
    expect(config.source).toMatchObject({
      ref: "dev",
      token: "t",
      prefixes: ["全唐诗", "元曲"],
    });
  });

  it("rejects an unknown source kind", () => {
    expect(() => loadConfig({ ETL_SOURCE_KIND: "s3" })).toThrow("ETL_SOURCE_KIND");
  });

  it("defaults to the pglite sink", () => {
    expect(loadConfig({ POETRY_ROOT: "/data" }).sink).toEqual({
      kind: "pglite",
      dataDir: "./dist/pglite",
    });
  });

  it("requires DATABASE_URL for tidb", () => {
    expect(() => loadConfig({ POETRY_ROOT: "/data", ETL_SINK_KIND: "tidb" })).toThrow(
      "DATABASE_URL",
    );
  });

  it("parses tidb sink config", () => {
    const config = loadConfig({
      POETRY_ROOT: "/data",
      ETL_SINK_KIND: "tidb",
      DATABASE_URL: "mysql://root:@db.lan:4000/test",
    });
    expect(config.sink).toEqual({ kind: "tidb", url: "mysql://root:@db.lan:4000/test" });
  });

  it("rejects an unknown sink kind", () => {
    expect(() => loadConfig({ POETRY_ROOT: "/data", ETL_SINK_KIND: "kafka" })).toThrow(
      "ETL_SINK_KIND",
    );
  });

  it("defaults ingest tuning to 8 / 500 / 100", () => {
    expect(loadConfig({ POETRY_ROOT: "/data" }).ingest).toEqual({
      readConcurrency: 8,
      batchSize: 500,
      logInterval: 100,
    });
  });

  it("honours ingest tuning overrides", () => {
    const config = loadConfig({
      POETRY_ROOT: "/data",
      ETL_READ_CONCURRENCY: "16",
      ETL_BATCH_SIZE: "1000",
      ETL_LOG_INTERVAL: "50",
    });
    expect(config.ingest).toEqual({ readConcurrency: 16, batchSize: 1000, logInterval: 50 });
  });

  it("rejects non-positive ingest tuning", () => {
    expect(() => loadConfig({ POETRY_ROOT: "/data", ETL_BATCH_SIZE: "0" })).toThrow(
      "ETL_BATCH_SIZE",
    );
    expect(() => loadConfig({ POETRY_ROOT: "/data", ETL_READ_CONCURRENCY: "x" })).toThrow(
      "ETL_READ_CONCURRENCY",
    );
    expect(() => loadConfig({ POETRY_ROOT: "/data", ETL_LOG_INTERVAL: "-1" })).toThrow(
      "ETL_LOG_INTERVAL",
    );
  });
});
