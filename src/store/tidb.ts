import { bigint, longtext, mysqlTable, varchar } from "drizzle-orm/mysql-core";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { Effect } from "effect";
import { sinkError, type Sink, type SinkError } from "./types.ts";

const rawRecords = mysqlTable("raw_records", {
  id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
  author: varchar("author", { length: 191 }).notNull(),
  title: varchar("title", { length: 512 }).notNull(),
  // longtext: whole poems are small, but raw staging should never reject content
  content: longtext("content").notNull(),
});

const DDL = `
CREATE TABLE IF NOT EXISTS raw_records (
  id bigint NOT NULL AUTO_INCREMENT PRIMARY KEY,
  author varchar(191) NOT NULL,
  title varchar(512) NOT NULL,
  content longtext NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`;

/** Sink over TiDB (MySQL protocol) via a connection pool. */
export function createTidbSink(url: string): Effect.Effect<Sink, SinkError> {
  const name = `tidb:${url.replace(/^(\w+:\/\/)[^@]*@/, "$1***@")}`;
  const fail = sinkError(name);

  return Effect.gen(function* () {
    const pool = mysql.createPool(url);
    yield* Effect.tryPromise({ try: () => pool.query(DDL), catch: (c) => fail("init", c) });
    const db = drizzle(pool);

    return {
      name,
      writeRaw: (records) =>
        records.length === 0
          ? Effect.void
          : Effect.tryPromise({
              try: () => db.insert(rawRecords).values(records.map((r) => ({ ...r }))),
              catch: (cause) => fail("write", cause),
            }),
      close: () => Effect.tryPromise({ try: () => pool.end(), catch: (c) => fail("close", c) }),
    };
  });
}
