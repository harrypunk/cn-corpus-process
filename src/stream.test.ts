import { describe, expect, test } from "bun:test";
import { batchAsync, filterAsync, filterMapAsync, mapAsync, tapAsync } from "./stream.ts";
import { Deduper } from "./normalize/dedup.ts";
import { makeClassifier, type FieldMapping } from "./normalize/record.ts";

async function* from<T>(items: T[]): AsyncGenerator<T> {
  yield* items;
}

describe("mapAsync / filterAsync", () => {
  test("map transforms each item", async () => {
    expect(await Array.fromAsync(mapAsync(from([1, 2, 3]), (n) => n * 2))).toEqual([2, 4, 6]);
  });

  test("filter keeps matching items", async () => {
    expect(await Array.fromAsync(filterAsync(from([1, 2, 3, 4]), (n) => n % 2 === 0))).toEqual([
      2, 4,
    ]);
  });
});

describe("filterMapAsync", () => {
  test("maps and drops nulls", async () => {
    const out = await Array.fromAsync(
      filterMapAsync(from([1, 2, 3, 4]), (n) => (n % 2 === 0 ? n * 10 : null)),
    );
    expect(out).toEqual([20, 40]);
  });
});

describe("tapAsync", () => {
  test("passes items through and invokes callback once per item", async () => {
    const seen: number[] = [];
    const out = await Array.fromAsync(tapAsync(from([1, 2]), (n) => seen.push(n)));
    expect(out).toEqual([1, 2]);
    expect(seen).toEqual([1, 2]);
  });
});

describe("batchAsync", () => {
  test("groups into fixed-size arrays, last batch smaller", async () => {
    expect(await Array.fromAsync(batchAsync(from([1, 2, 3, 4, 5]), 2))).toEqual([
      [1, 2],
      [3, 4],
      [5],
    ]);
  });

  test("empty input yields nothing", async () => {
    expect(await Array.fromAsync(batchAsync(from([]), 2))).toEqual([]);
  });
});

describe("makeClassifier", () => {
  const map: FieldMapping = { paragraphs: "paragraphs", dynasty: "tang", source: "t" };

  test("marks second identical record as duplicate", () => {
    const classify = makeClassifier(map, new Deduper());
    const raw = { author: "李白", title: "静夜思", paragraphs: ["床前明月光"] };
    expect(classify(raw).ok).toBe(true);
    expect(classify(raw)).toEqual({ ok: false, reason: "duplicate" });
  });

  test("shared deduper rejects across mappings", () => {
    const dedup = new Deduper();
    const a = makeClassifier(map, dedup);
    const b = makeClassifier({ ...map, source: "other" }, dedup);
    const raw = { author: "李白", title: "静夜思", paragraphs: ["床前明月光"] };
    expect(a(raw).ok).toBe(true);
    expect(b(raw)).toEqual({ ok: false, reason: "duplicate" });
  });
});
