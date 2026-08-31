import { describe, expect, it } from "bun:test";
import { Effect, Stream } from "effect";
import { ciParser } from "@src/parse/index.ts";
import type { DataSource } from "@src/source/index.ts";
import type { RawRecord, Sink } from "@src/store/index.ts";
import { ingest, isWudaiVerse } from "./ingest-wudai.ts";

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

describe("isWudaiVerse", () => {
  it("keeps huajianji-*-juan.json and nantang/poetrys.json under 五代诗词 only", () => {
    expect(isWudaiVerse("五代诗词/huajianji/huajianji-1-juan.json")).toBe(true);
    expect(isWudaiVerse("五代诗词/huajianji/huajianji-10-juan.json")).toBe(true);
    expect(isWudaiVerse("五代诗词/nantang/poetrys.json")).toBe(true);
    expect(isWudaiVerse("五代诗词/huajianji/huajianji-0-xu.json")).toBe(false);
    expect(isWudaiVerse("五代诗词/nantang/poets.json")).toBe(false);
    expect(isWudaiVerse("全唐诗/poet.tang.0.json")).toBe(false);
  });
});

describe("ingest", () => {
  it("filters listed paths, parses with the given parser, lands all records", async () => {
    const source = fakeSource({
      "五代诗词/huajianji/huajianji-1-juan.json":
        '[{"rhythmic":"菩萨蛮","author":"温庭筠","paragraphs":["x"]}]',
      "五代诗词/huajianji/huajianji-2-juan.json": '[{"rhythmic":"浣溪沙","paragraphs":["y"]}]',
      "五代诗词/nantang/poetrys.json": '[{"rhythmic":"应天长","paragraphs":["z"]}]',
      "五代诗词/huajianji/huajianji-0-xu.json": '[{"rhythmic":"序","paragraphs":["skip"]}]',
    });
    const { sink, written } = fakeSink();

    const n = await Effect.runPromise(ingest(source, ciParser, sink, isWudaiVerse));

    expect(n).toBe(3);
    expect(written).toContainEqual({ author: "温庭筠", title: "菩萨蛮", content: "x" });
    expect(written).toContainEqual({ author: "", title: "浣溪沙", content: "y" });
    expect(written).toContainEqual({ author: "", title: "应天长", content: "z" });
  });

  it("keeps every listed file when no filter is given", async () => {
    const source = fakeSource({
      "五代诗词/nantang/poetrys.json": '[{"rhythmic":"应天长","paragraphs":["z"]}]',
    });
    const { sink, written } = fakeSink();

    const n = await Effect.runPromise(ingest(source, ciParser, sink));

    expect(n).toBe(1);
    expect(written).toContainEqual({ author: "", title: "应天长", content: "z" });
  });
});
