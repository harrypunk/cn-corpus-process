import { describe, expect, it } from "bun:test";
import { Effect, Stream } from "effect";
import { poemsParser } from "@src/parse/index.ts";
import type { DataSource } from "@src/source/index.ts";
import type { RawRecord, Sink } from "@src/store/index.ts";
import { ingest, isQuantangshiVerse } from "./ingest-quantangshi.ts";

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

describe("isQuantangshiVerse", () => {
  it("keeps poet.tang/poet.song JSON and the standalone collections under 全唐诗 only", () => {
    expect(isQuantangshiVerse("全唐诗/poet.tang.0.json")).toBe(true);
    expect(isQuantangshiVerse("全唐诗/poet.tang.57.json")).toBe(true);
    expect(isQuantangshiVerse("全唐诗/poet.song.0.json")).toBe(true);
    expect(isQuantangshiVerse("全唐诗/唐诗三百首.json")).toBe(true);
    expect(isQuantangshiVerse("全唐诗/唐诗补录.json")).toBe(true);
    expect(isQuantangshiVerse("全唐诗/README.json")).toBe(false);
    expect(isQuantangshiVerse("五代诗词/nantang/poetrys.json")).toBe(false);
  });
});

describe("ingest", () => {
  it("filters listed paths, parses with the given parser, lands all records", async () => {
    const source = fakeSource({
      "全唐诗/poet.tang.0.json":
        '[{"author":"太宗皇帝","title":"帝京篇十首 一","paragraphs":["p1","p2"]}]',
      "全唐诗/唐诗三百首.json": '[{"author":"李白","title":"静夜思","paragraphs":["q"]}]',
      "五代诗词/nantang/poetrys.json": '[{"rhythmic":"应天长","paragraphs":["skip"]}]',
    });
    const { sink, written } = fakeSink();

    const n = await Effect.runPromise(ingest(source, poemsParser, sink, isQuantangshiVerse));

    expect(n).toBe(2);
    expect(written).toContainEqual({
      author: "太宗皇帝",
      title: "帝京篇十首 一",
      content: "p1\np2",
    });
    expect(written).toContainEqual({ author: "李白", title: "静夜思", content: "q" });
  });
});
