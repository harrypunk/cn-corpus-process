/**
 * SQLite persistence layer (bun:sqlite). Owns the connection, schema
 * setup, and batched inserts. Callers wrap work in transactions via
 * `transaction()` — bulk inserts without one are orders of magnitude slower.
 */

import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { AuthorRecord, PoemRecord } from "../types.ts";
import { SCHEMA_SQL } from "./schema.ts";

export class PoetryRepository {
  private readonly db: Database;
  private readonly insertAuthorStmt;
  private readonly selectAuthorStmt;
  private readonly insertPoemStmt;
  private readonly authorIdCache = new Map<string, number>();

  constructor(dbPath: string) {
    mkdirSync(dirname(dbPath), { recursive: true });
    this.db = new Database(dbPath, { create: true });
    this.db.exec("PRAGMA journal_mode = WAL;");
    this.db.exec("PRAGMA synchronous = OFF;");
    this.db.exec(SCHEMA_SQL);
    this.insertAuthorStmt = this.db.prepare(
      "INSERT OR IGNORE INTO authors (name, dynasty, description) VALUES (?, ?, ?)",
    );
    this.selectAuthorStmt = this.db.prepare(
      "SELECT id FROM authors WHERE name = ? AND dynasty IS ?",
    );
    this.insertPoemStmt = this.db.prepare(
      "INSERT INTO poems (author_id, title, content, source) VALUES (?, ?, ?, ?)",
    );
  }

  /** Run fn inside a single transaction. */
  transaction<T>(fn: () => T): T {
    return this.db.transaction(fn)();
  }

  /** Insert or update an author biography. */
  upsertAuthor(author: AuthorRecord): void {
    this.insertAuthorStmt.run(author.name, author.dynasty, author.description);
    if (author.description) {
      this.db.run(
        "UPDATE authors SET description = ? WHERE name = ? AND dynasty IS ? AND description IS NULL",
        [author.description, author.name, author.dynasty],
      );
    }
    this.authorIdCache.delete(`${author.name}${author.dynasty}`);
  }

  /** Resolve (name, dynasty) to an author id, creating the row if needed. */
  authorId(name: string, dynasty: string | null): number {
    const key = `${name}${dynasty}`;
    const cached = this.authorIdCache.get(key);
    if (cached !== undefined) return cached;
    this.insertAuthorStmt.run(name, dynasty, null);
    const row = this.selectAuthorStmt.get(name, dynasty) as { id: number };
    this.authorIdCache.set(key, row.id);
    return row.id;
  }

  insertPoem(poem: PoemRecord): void {
    this.insertPoemStmt.run(
      this.authorId(poem.author, poem.dynasty),
      poem.title,
      poem.content,
      poem.source,
    );
  }

  close(): void {
    this.db.close();
  }
}
