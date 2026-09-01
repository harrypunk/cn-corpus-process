import { describe, expect, it } from "bun:test";
import { Effect, Stream } from "effect";
import type { RawRecord, Sink } from "@src/store/index.ts";
import type { IngestEvent } from "./events.ts";
import { metricsCollector, progressLogger, sinkWriter } from "./observers.ts";

const record = (content: string): RawRecord => ({ author: "", title: "", content });

const parsed = (path: string, contents: string[]): IngestEvent => ({
  _tag: "RecordsParsed",
  file: { path },
  records: contents.map(record),
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

describe("sinkWriter", () => {
  it("batches only RecordsParsed records into writeRaw", async () => {
    const { sink, batches } = fakeSink();
    const events = Stream.fromIterable<IngestEvent>([
      { _tag: "FileListed", file: { path: "a" } },
      parsed("a", ["l1", "l2", "l3"]),
      { _tag: "FileSkipped", file: { path: "b" } },
      parsed("b", ["l4", "l5"]),
    ]);

    const written = await Effect.runPromise(sinkWriter(sink, 2)(events));

    expect(written).toBe(5);
    expect(batches.map((b) => b.length)).toEqual([2, 2, 1]);
    expect(batches.flat().map((r) => r.content)).toEqual(["l1", "l2", "l3", "l4", "l5"]);
  });
});

describe("metricsCollector", () => {
  it("folds events into counts plus the failed-file list", async () => {
    const events = Stream.fromIterable<IngestEvent>([
      { _tag: "FileListed", file: { path: "a" } },
      parsed("a", ["l1", "l2"]),
      { _tag: "FileListed", file: { path: "b" } },
      { _tag: "FileFailed", file: { path: "b" }, message: "boom" },
      { _tag: "FileSkipped", file: { path: "c" } },
    ]);

    const metrics = await Effect.runPromise(metricsCollector(events));

    expect(metrics).toEqual({
      listed: 2,
      skipped: 1,
      parsed: 1,
      failed: 1,
      records: 2,
      failedFiles: ["b"],
    });
  });
});

describe("progressLogger", () => {
  const collectLogs = async (events: Stream.Stream<IngestEvent>): Promise<string[]> => {
    const logs: string[] = [];
    await Effect.runPromise(progressLogger(events, (msg) => Effect.sync(() => logs.push(msg))));
    return logs;
  };

  it("logs every failure immediately", async () => {
    const logs = await collectLogs(
      Stream.fromIterable<IngestEvent>([
        parsed("a", ["l1"]),
        { _tag: "FileFailed", file: { path: "b" }, message: "boom" },
      ]),
    );

    expect(logs).toEqual(["FAIL b: boom"]);
  });

  it("logs a progress line every 100 processed files", async () => {
    const events = Stream.fromIterable<IngestEvent>(
      Array.from({ length: 200 }, (_, i) => parsed(`f${i}`, ["l"])),
    );

    const logs = await collectLogs(events);

    expect(logs).toEqual(["100 files processed", "200 files processed"]);
  });
});
