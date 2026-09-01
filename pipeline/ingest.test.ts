import { describe, expect, it } from "bun:test";
import { Chunk, Effect, Stream } from "effect";
import type { Parser } from "@src/parse/index.ts";
import { SourceError, type DataSource } from "@src/source/index.ts";
import { ingestEvents } from "./ingest.ts";

/** One record per non-empty line, so tests control record counts via fixture lines. */
const linesParser: Parser = {
  name: "lines",
  parse: (text) =>
    text
      .split("\n")
      .filter((line) => line !== "")
      .map((line) => ({ author: "", title: "", content: line })),
};

/** Paths present in `files` read fine; anything else fails like a missing file would. */
const fakeSource = (files: Record<string, string>): DataSource => ({
  name: "fake",
  list: () => Stream.fromIterable(Object.keys(files).map((path) => ({ path }))),
  read: (file) =>
    file.path in files
      ? Effect.succeed(files[file.path] ?? "")
      : Effect.fail(
          new SourceError({ source: "fake", operation: "read", message: "boom", path: file.path }),
        ),
});

const collect = (files: Record<string, string>, keep?: (path: string) => boolean) =>
  Effect.runPromise(
    Stream.runCollect(ingestEvents(fakeSource(files), linesParser, { keep, readConcurrency: 2 })),
  ).then(Chunk.toReadonlyArray);

describe("ingestEvents", () => {
  it("emits FileListed then RecordsParsed per kept file, in listing order", async () => {
    const events = await collect({ "corpus/a.json": "l1\nl2", "corpus/b.json": "l3" });

    expect(events.map((e) => e._tag)).toEqual([
      "FileListed",
      "RecordsParsed",
      "FileListed",
      "RecordsParsed",
    ]);
    const parsed = events.filter((e) => e._tag === "RecordsParsed");
    expect(parsed.map((e) => e.records.length)).toEqual([2, 1]);
  });

  it("emits FileSkipped for filtered-out files without reading them", async () => {
    const events = await collect(
      { "corpus/a.json": "l1", "corpus/skip.json": "l2" },
      (path) => !path.includes("skip"),
    );

    expect(events.map((e) => e._tag)).toEqual(["FileListed", "RecordsParsed", "FileSkipped"]);
  });

  it("turns read failures into FileFailed events instead of failing the stream", async () => {
    const source = fakeSource({ "corpus/a.json": "l1" });
    const broken: DataSource = {
      ...source,
      list: () => Stream.fromIterable([{ path: "corpus/a.json" }, { path: "corpus/gone.json" }]),
    };

    const events = Chunk.toReadonlyArray(
      await Effect.runPromise(
        Stream.runCollect(ingestEvents(broken, linesParser, { readConcurrency: 1 })),
      ),
    );

    expect(events.map((e) => e._tag)).toEqual([
      "FileListed",
      "RecordsParsed",
      "FileListed",
      "FileFailed",
    ]);
    const failed = events.find((e) => e._tag === "FileFailed");
    expect(failed).toMatchObject({ file: { path: "corpus/gone.json" }, message: "boom" });
  });
});
