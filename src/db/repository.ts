/**
 * Persistence layer. All SQL lives here, expressed through Drizzle so the
 * rest of the codebase never touches queries. Callers wrap bulk work in
 * `transaction()` — batched inserts without one are orders of magnitude
 * slower.
 */

import { Database } from "bun:sqlite";
import { and, eq, isNull } from "drizzle-orm";
import { drizzle, type BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import type { AuthorRecord, Maybe, PoemRecord } from "../types.ts";
import * as schema from "./schema.ts";
import { SCHEMA_SQL } from "./schema.ts";

export class PoetryRepository {
  private readonly authorIdCache = new Map<string, number>();

  private constructor(
    private readonly db: BunSQLiteDatabase<typeof schema>,
    private readonly sqlite: Database,
  ) {}

  /** Open (creating if needed) the database at dbPath. */
  static async open(dbPath: string): Promise<PoetryRepository> {
    await mkdir(dirname(dbPath), { recursive: true });
    const sqlite = new Database(dbPath, { create: true });
    sqlite.run("PRAGMA journal_mode = WAL;");
    sqlite.run("PRAGMA synchronous = OFF;");
    sqlite.run(SCHEMA_SQL);
    return new PoetryRepository(drizzle(sqlite, { schema }), sqlite);
  }

  /** Run fn inside a single transaction. */
  transaction<T>(fn: () => T): T {
    return this.db.transaction(() => fn());
  }

  /** Insert or update an author biography. */
  upsertAuthor(author: AuthorRecord): void {
    this.db.insert(schema.authors).values(author).onConflictDoNothing().run();
    if (author.description) {
      this.db
        .update(schema.authors)
        .set({ description: author.description })
        .where(
          and(
            eq(schema.authors.name, author.name),
            this.dynastyEq(author.dynasty),
            isNull(schema.authors.description),
          ),
        )
        .run();
    }
    this.authorIdCache.delete(this.key(author.name, author.dynasty));
  }

  /** Resolve (name, dynasty) to an author id, creating the row if needed. */
  authorId(name: string, dynasty: Maybe<string>): number {
    const key = this.key(name, dynasty);
    const cached = this.authorIdCache.get(key);
    if (cached !== undefined) return cached;
    this.db.insert(schema.authors).values({ name, dynasty }).onConflictDoNothing().run();
    const row = this.db
      .select({ id: schema.authors.id })
      .from(schema.authors)
      .where(and(eq(schema.authors.name, name), this.dynastyEq(dynasty)))
      .get();
    if (!row) throw new Error(`author lookup failed: ${name} (${dynasty})`);
    this.authorIdCache.set(key, row.id);
    return row.id;
  }

  /** Insert a batch of poems as a single multi-row INSERT. */
  insertPoems(poems: PoemRecord[]): void {
    if (poems.length === 0) return;
    const rows = poems.map((poem) => ({
      authorId: this.authorId(poem.author, poem.dynasty),
      title: poem.title,
      content: poem.content,
      source: poem.source,
    }));
    this.db.insert(schema.poems).values(rows).run();
  }

  close(): void {
    this.sqlite.close();
  }

  private key(name: string, dynasty: Maybe<string>): string {
    return `${name}${dynasty}`;
  }

  /** eq() with NULL semantics: `dynasty IS NULL` when dynasty is null. */
  private dynastyEq(dynasty: Maybe<string>) {
    return dynasty === null ? isNull(schema.authors.dynasty) : eq(schema.authors.dynasty, dynasty);
  }
}
