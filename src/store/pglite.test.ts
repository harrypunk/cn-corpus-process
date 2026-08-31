import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, describe, expect, it } from "bun:test";
import { Effect } from "effect";
import { createPgliteSink } from "./pglite.ts";

let dir: string;

afterAll(async () => {
  if (dir) await rm(dir, { recursive: true, force: true });
});

describe("PgliteSink", () => {
  it("inserts raw records; insert-only staging means re-runs duplicate", async () => {
    dir = await mkdtemp(join(tmpdir(), "pglite-sink-test-"));
    const sink = await Effect.runPromise(createPgliteSink(dir));
    const batch = [
      { author: "李璟", title: "应天长", content: "一钩初月临妆镜" },
      { author: "太宗皇帝", title: "帝京篇十首 一", content: "秦川雄帝宅" },
    ];

    await Effect.runPromise(sink.writeRaw(batch));
    await Effect.runPromise(sink.writeRaw(batch));
    await Effect.runPromise(sink.close());

    const check = new PGlite(dir);
    const result = await check.query("SELECT author, title, content FROM raw_records ORDER BY id");
    await check.close();

    expect(result.rows).toEqual([...batch, ...batch]);
  });
});
