import { describe, expect, it } from "bun:test";
import { Effect, Stream } from "effect";
import { poemsParser } from "@src/parse/index.ts";
import type { DataSource } from "@src/source/index.ts";
import type { RawRecord, Sink } from "@src/store/index.ts";
import { ingest, isShuimotangshiVerse } from "./ingest-shuimotangshi.ts";

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

describe("isShuimotangshiVerse", () => {
  it("keeps only 水墨唐诗/shuimotangshi.json", () => {
    expect(isShuimotangshiVerse("水墨唐诗/shuimotangshi.json")).toBe(true);
    expect(isShuimotangshiVerse("水墨唐诗/other.json")).toBe(false);
    expect(isShuimotangshiVerse("全唐诗/poet.tang.0.json")).toBe(false);
  });
});

describe("ingest", () => {
  it("lands shuimotangshi records, ignoring the prologue field", async () => {
    const source = fakeSource({
      "水墨唐诗/shuimotangshi.json":
        '[{"author":"刘禹锡","title":"蜀先主庙","paragraphs":["天地英雄气","势分三足鼎"],"prologue":"skip"}]',
      "水墨唐诗/README.json": "{}",
    });
    const { sink, written } = fakeSink();

    const n = await Effect.runPromise(ingest(source, poemsParser, sink, isShuimotangshiVerse));

    expect(n).toBe(1);
    expect(written).toContainEqual({
      author: "刘禹锡",
      title: "蜀先主庙",
      content: "天地英雄气\n势分三足鼎",
    });
  });
});
