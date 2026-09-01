import { describe, expect, it } from "bun:test";
import { Effect, Stream } from "effect";
import { ciParser } from "@src/parse/index.ts";
import type { DataSource } from "@src/source/index.ts";
import type { RawRecord, Sink } from "@src/store/index.ts";
import { ingest, isSongciVerse } from "./ingest-songci.ts";

const fakeSource = (files: Record<string, string>): DataSource => ({
  name: "fake",
  list: () => Stream.fromIterable(Object.keys(files).map((path) => ({ path }))),
  read: (file) => Effect.succeed(files[file.path] ?? ""),
});

const fakeSink = () => {
  const written: RawRecord[] = [];
  const sink: Sink = {
    name: "fake",
    writeRaw: (records) => Effect.sync(() => written.push(...records)),
    close: () => Effect.void,
  };
  return { sink, written };
};

describe("isSongciVerse", () => {
  it("keeps ci.song.*.json and 宋词三百首.json under 宋词 only", () => {
    expect(isSongciVerse("宋词/ci.song.0.json")).toBe(true);
    expect(isSongciVerse("宋词/ci.song.21000.json")).toBe(true);
    expect(isSongciVerse("宋词/ci.song.2019y.json")).toBe(true);
    expect(isSongciVerse("宋词/宋词三百首.json")).toBe(true);
    expect(isSongciVerse("宋词/author.song.json")).toBe(false);
    expect(isSongciVerse("五代诗词/nantang/poetrys.json")).toBe(false);
  });
});

describe("ingest", () => {
  it("filters listed paths, parses with the given parser, lands all records", async () => {
    const source = fakeSource({
      "宋词/ci.song.0.json":
        '[{"rhythmic":"水调歌头","author":"苏轼","paragraphs":["明月几时有"]}]',
      "宋词/宋词三百首.json": '[{"rhythmic":"如梦令","author":"李清照","paragraphs":["x"]}]',
      "宋词/author.song.json": '[{"name":"苏轼","desc":"skip"}]',
    });
    const { sink, written } = fakeSink();

    const n = await Effect.runPromise(ingest(source, ciParser, sink, isSongciVerse));

    expect(n).toBe(2);
    expect(written).toContainEqual({ author: "苏轼", title: "水调歌头", content: "明月几时有" });
    expect(written).toContainEqual({ author: "李清照", title: "如梦令", content: "x" });
  });
});
