/** DDL for the poetry database. Single source of truth for the schema. */

export const SCHEMA_SQL = `
CREATE TABLE authors (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  dynasty TEXT,
  description TEXT,
  UNIQUE(name, dynasty)
);

CREATE TABLE poems (
  id INTEGER PRIMARY KEY,
  author_id INTEGER NOT NULL REFERENCES authors(id),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  source TEXT NOT NULL
);

CREATE INDEX idx_poems_author ON poems(author_id);
CREATE INDEX idx_poems_title ON poems(title);
`;
