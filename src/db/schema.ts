/**
 * Database schema, defined with Drizzle. These table definitions are the
 * single source of truth used by the repository for typed queries; the DDL
 * below is executed once at open time (no migration tooling needed for a
 * file-based pipeline DB).
 */

import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const authors = sqliteTable(
  "authors",
  {
    id: integer("id").primaryKey(),
    name: text("name").notNull(),
    dynasty: text("dynasty"),
    description: text("description"),
  },
  (t) => [uniqueIndex("authors_name_dynasty").on(t.name, t.dynasty)],
);

export const poems = sqliteTable(
  "poems",
  {
    id: integer("id").primaryKey(),
    authorId: integer("author_id")
      .notNull()
      .references(() => authors.id),
    title: text("title").notNull(),
    /** Paragraphs joined with "\n". */
    content: text("content").notNull(),
    /** Corpus identifier, e.g. "quantangshi". */
    source: text("source").notNull(),
  },
  (t) => [index("idx_poems_author").on(t.authorId), index("idx_poems_title").on(t.title)],
);

export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS authors (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  dynasty TEXT,
  description TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS authors_name_dynasty ON authors(name, dynasty);

CREATE TABLE IF NOT EXISTS poems (
  id INTEGER PRIMARY KEY,
  author_id INTEGER NOT NULL REFERENCES authors(id),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  source TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_poems_author ON poems(author_id);
CREATE INDEX IF NOT EXISTS idx_poems_title ON poems(title);
`;
