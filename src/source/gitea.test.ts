import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { Chunk, Effect, Stream } from "effect";
import { createGiteaSource } from "./gitea.ts";

let server: ReturnType<typeof Bun.serve>;
let seenAuth: string | null = null;

const page1 = {
  tree: [
    { path: "a/one.json", type: "blob", size: 10 },
    { path: "a/skip.txt", type: "blob", size: 5 },
    { path: "a", type: "tree" },
  ],
  truncated: false,
  total_count: 4,
};
const page2 = {
  tree: [{ path: "b/two.json", type: "blob", size: 20 }],
  truncated: false,
  total_count: 4,
};

beforeAll(() => {
  server = Bun.serve({
    port: 0,
    fetch(req) {
      const url = new URL(req.url);
      seenAuth = req.headers.get("authorization");
      if (url.pathname === "/api/v1/repos/o/r/git/trees/main") {
        return Response.json(url.searchParams.get("page") === "2" ? page2 : page1);
      }
      if (url.pathname === "/api/v1/repos/o/r/raw/a/one.json") {
        if (url.searchParams.get("ref") !== "main") return new Response("bad ref", { status: 400 });
        return new Response('﻿[{"title":"静夜思"}]');
      }
      return new Response("not found", { status: 404 });
    },
  });
});

afterAll(() => {
  server.stop(true);
});

const options = () => ({
  baseUrl: `http://localhost:${server.port}`,
  owner: "o",
  repo: "r",
  ref: "main",
  token: "secret",
});

describe("GiteaSource", () => {
  it("lists *.json blobs across pages, with auth header", async () => {
    const source = createGiteaSource(options());
    const files = Chunk.toReadonlyArray(await Effect.runPromise(Stream.runCollect(source.list())));
    expect(files).toEqual([
      { path: "a/one.json", size: 10 },
      { path: "b/two.json", size: 20 },
    ]);
    expect(seenAuth).toBe("token secret");
  });

  it("prefixes limit listing to the given subdirectories", async () => {
    const source = createGiteaSource({ ...options(), prefixes: ["b"] });
    const files = Chunk.toReadonlyArray(await Effect.runPromise(Stream.runCollect(source.list())));
    expect(files.map((f) => f.path)).toEqual(["b/two.json"]);
  });

  it("multiple prefixes union their subdirectories", async () => {
    const source = createGiteaSource({ ...options(), prefixes: ["a", "b"] });
    const files = Chunk.toReadonlyArray(await Effect.runPromise(Stream.runCollect(source.list())));
    expect(files.map((f) => f.path)).toEqual(["a/one.json", "b/two.json"]);
  });

  it("reads raw file content with BOM stripped", async () => {
    const source = createGiteaSource(options());
    const text = await Effect.runPromise(source.read({ path: "a/one.json" }));
    expect(text).toBe('[{"title":"静夜思"}]');
  });

  it("surfaces HTTP errors as SourceError", async () => {
    const source = createGiteaSource(options());
    const exit = await Effect.runPromiseExit(source.read({ path: "a/missing.json" }));
    expect(exit._tag).toBe("Failure");
  });
});
