import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Chunk, Effect, Stream } from "effect";
import { createLocalFsSource } from "./local-fs.ts";

let root: string;

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), "poetry-src-"));
  await mkdir(join(root, "tang"), { recursive: true });
  await writeFile(join(root, "tang", "a.json"), '{"x":1}');
  await writeFile(join(root, "b.json"), '﻿[{"title":"静夜思"}]');
  await writeFile(join(root, "notes.txt"), "ignore me");
});

afterAll(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("LocalFsSource", () => {
  it("lists *.json recursively, sorted, skipping other files", async () => {
    const source = createLocalFsSource(root);
    const files = Chunk.toReadonlyArray(await Effect.runPromise(Stream.runCollect(source.list())));
    expect(files.map((f) => f.path)).toEqual(["b.json", "tang/a.json"]);
  });

  it("prefixes limit listing to the given dirs", async () => {
    const source = createLocalFsSource(root, ["tang"]);
    const files = Chunk.toReadonlyArray(await Effect.runPromise(Stream.runCollect(source.list())));
    expect(files.map((f) => f.path)).toEqual(["tang/a.json"]);
  });

  it("reads utf-8 text with BOM stripped", async () => {
    const source = createLocalFsSource(root);
    const text = await Effect.runPromise(source.read({ path: "b.json" }));
    expect(text).toBe('[{"title":"静夜思"}]');
  });

  it("fails with SourceError on a missing file", async () => {
    const source = createLocalFsSource(root);
    const exit = await Effect.runPromiseExit(source.read({ path: "nope.json" }));
    expect(exit._tag).toBe("Failure");
  });
});
