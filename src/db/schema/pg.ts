/** Postgres schema. Mirrors schema/sqlite.ts; text columns are unbounded. */

import { index, integer, pgTable, serial, text, uniqueIndex } from "drizzle-orm/pg-core";

export const authors = pgTable(
  "authors",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    dynasty: text("dynasty").notNull().default(""),
    description: text("description"),
  },
  (t) => [uniqueIndex("authors_name_dynasty").on(t.name, t.dynasty)],
);

export const poems = pgTable(
  "poems",
  {
    id: serial("id").primaryKey(),
    authorId: integer("author_id")
      .notNull()
      .references(() => authors.id),
    title: text("title").notNull(),
    /** Simplified+NFKC search form. */
    titleSearch: text("title_search").notNull(),
    /** Paragraphs joined with "\n". */
    content: text("content").notNull(),
    /** Simplified+NFKC search form. */
    contentSearch: text("content_search").notNull(),
    /** Corpus identifier, e.g. "quantangshi". */
    source: text("source").notNull(),
  },
  (t) => [
    index("idx_poems_author").on(t.authorId),
    index("idx_poems_title").on(t.title),
    index("idx_poems_title_search").on(t.titleSearch),
  ],
);

export const sentences = pgTable(
  "sentences",
  {
    id: serial("id").primaryKey(),
    poemId: integer("poem_id")
      .notNull()
      .references(() => poems.id),
    /** 0-based position within the poem. */
    seq: integer("seq").notNull(),
    /** Original text (display). */
    text: text("text").notNull(),
    /** Simplified+NFKC form (search). */
    textSearch: text("text_search").notNull(),
    /** Number of comma-separated clauses. */
    parts: integer("parts").notNull(),
  },
  (t) => [index("idx_sentences_poem").on(t.poemId)],
);
