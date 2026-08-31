import { describe, expect, it } from "bun:test";
import { Effect, Stream } from "effect";
import type { DataSource } from "@src/source/index.ts";
import type { RawRecord, Sink } from "@src/store/index.ts";
import { ingest } from "./ingest.ts";

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

describe("ingest", () => {
  it("parses claimed files, skips unclaimed, lands all records", async () => {
    const source = fakeSource({
      "全唐诗/poet.tang.0.json": '[{"author":"a","title":"t","paragraphs":["p1","p2"]}]',
      "五代诗词/nantang/poetrys.json": '[{"rhythmic":"应天长","paragraphs":["x"]}]',
      "rank/ci/x.json": '[{"baidu":1}]',
    });
    const { sink, written } = fakeSink();

    const n = await Effect.runPromise(ingest(source, sink));

    expect(n).toBe(2);
    expect(written).toContainEqual({ author: "a", title: "t", content: "p1\np2" });
    expect(written).toContainEqual({ author: "", title: "应天长", content: "x" });
  });
});
