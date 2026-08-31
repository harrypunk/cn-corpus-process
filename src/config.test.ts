import { describe, expect, it } from "bun:test";
import { loadConfig } from "./config.ts";

describe("loadConfig", () => {
  it("defaults to the fs source", () => {
    expect(loadConfig({ POETRY_ROOT: "/data" }).source).toEqual({ kind: "fs", root: "/data" });
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
      pathPrefix: "",
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
      GITEA_PATH_PREFIX: "全唐诗",
    });
    expect(config.source).toMatchObject({ ref: "dev", token: "t", pathPrefix: "全唐诗" });
  });

  it("rejects an unknown source kind", () => {
    expect(() => loadConfig({ ETL_SOURCE_KIND: "s3" })).toThrow("ETL_SOURCE_KIND");
  });
});
