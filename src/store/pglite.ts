import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { bigserial, pgTable, text } from "drizzle-orm/pg-core";
import { Effect } from "effect";
import { sinkError, type Sink, type SinkError } from "./types.ts";

const rawRecords = pgTable("raw_records", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  author: text("author").notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(),
});

const DDL = `
CREATE TABLE IF NOT EXISTS raw_records (
  id bigserial PRIMARY KEY,
  author text NOT NULL,
  title text NOT NULL,
  content text NOT NULL
)`;

/** Sink over embedded Postgres (PGlite, WASM) — zero external services. */
export function createPgliteSink(dataDir: string): Effect.Effect<Sink, SinkError> {
  const name = `pglite:${dataDir}`;
  const fail = sinkError(name);

  return Effect.gen(function* () {
    const client = new PGlite(dataDir);
    yield* Effect.tryPromise({ try: () => client.exec(DDL), catch: (c) => fail("init", c) });
    const db = drizzle(client);

    return {
      name,
      writeRaw: (records) =>
        records.length === 0
          ? Effect.void
          : Effect.tryPromise({
              try: () => db.insert(rawRecords).values(records.map((r) => ({ ...r }))),
              catch: (cause) => fail("write", cause),
            }),
      close: () => Effect.tryPromise({ try: () => client.close(), catch: (c) => fail("close", c) }),
    };
  });
}
