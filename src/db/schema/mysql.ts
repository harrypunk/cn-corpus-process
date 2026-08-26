/**
 * MySQL schema. Mirrors schema/sqlite.ts with MySQL constraints:
 * indexed/unique columns must be varchar with a bounded length (utf8mb4
 * indexes are limited to 3072 bytes), so title/name/dynasty are varchar.
 * Requires the server/database to use utf8mb4 (中文!).
 */

import { index, int, mysqlTable, text, uniqueIndex, varchar } from "drizzle-orm/mysql-core";

export const authors = mysqlTable(
  "authors",
  {
    id: int("id").autoincrement().primaryKey(),
    name: varchar("name", { length: 191 }).notNull(),
    dynasty: varchar("dynasty", { length: 64 }).notNull().default(""),
    description: text("description"),
  },
  (t) => [uniqueIndex("authors_name_dynasty").on(t.name, t.dynasty)],
);

export const poems = mysqlTable(
  "poems",
  {
    id: int("id").autoincrement().primaryKey(),
    authorId: int("author_id")
      .notNull()
      .references(() => authors.id),
    title: varchar("title", { length: 512 }).notNull(),
    /** Paragraphs joined with "\n". */
    content: text("content").notNull(),
    /** Corpus identifier, e.g. "quantangshi". */
    source: varchar("source", { length: 64 }).notNull(),
  },
  (t) => [index("idx_poems_author").on(t.authorId), index("idx_poems_title").on(t.title)],
);
