import { describe, expect, it } from "bun:test";
import { Effect, Stream } from "effect";
import type { Parser } from "@src/parse/index.ts";
import type { DataSource } from "@src/source/index.ts";
import type { RawRecord, Sink } from "@src/store/index.ts";
import { ingest } from "./ingest.ts";

const fakeSource = (files: Record<string, string>): DataSource => ({
  name: "fake",
  list: () => Stream.fromIterable(Object.keys(files).map((path) => ({ path }))),
  read: (file) => Effect.succeed(files[file.path] ?? ""),
});

const fakeSink = () => {
  const batches: RawRecord[][] = [];
  const sink: Sink = {
    name: "fake",
    writeRaw: (records) => Effect.sync(() => batches.push([...records])),
    close: () => Effect.void,
  };
  return { sink, batches };
};

/** One record per non-empty line, so tests control record counts via fixture lines. */
const linesParser: Parser = {
  name: "lines",
  parse: (text) =>
    text
      .split("\n")
      .filter((line) => line !== "")
      .map((line) => ({ author: "", title: "", content: line })),
};

describe("ingest", () => {
  it("filters listed paths, parses with the given parser, lands all records", async () => {
    const source = fakeSource({
      "corpus/a.json": "line1\nline2",
      "corpus/skip.json": "line3",
    });
    const { sink, batches } = fakeSink();

    const n = await Effect.runPromise(
      ingest(source, linesParser, sink, (path) => !path.includes("skip")),
    );

    expect(n).toBe(2);
    expect(batches.flat().map((r) => r.content)).toEqual(["line1", "line2"]);
  });

  it("keeps every listed file when no filter is given", async () => {
    const source = fakeSource({ "corpus/a.json": "line1", "corpus/b.json": "line2" });
    const { sink, batches } = fakeSink();

    const n = await Effect.runPromise(ingest(source, linesParser, sink));

    expect(n).toBe(2);
    expect(batches.flat()).toHaveLength(2);
  });

  it("writes in batches of 500", async () => {
    const lines = Array.from({ length: 1200 }, (_, i) => `line${i}`).join("\n");
    const source = fakeSource({ "corpus/big.json": lines });
    const { sink, batches } = fakeSink();

    const n = await Effect.runPromise(ingest(source, linesParser, sink));

    expect(n).toBe(1200);
    expect(batches.map((b) => b.length)).toEqual([500, 500, 200]);
  });
});
