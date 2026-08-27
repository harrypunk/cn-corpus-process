/**
 * Database schema, defined with Drizzle. These table definitions are the
 * single source of truth: migrations under drizzle/ are generated from
 * them (`bun run db:generate`) and applied at open time.
 */

import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const authors = sqliteTable(
  "authors",
  {
    id: integer("id").primaryKey(),
    name: text("name").notNull(),
    dynasty: text("dynasty").notNull().default(""),
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
