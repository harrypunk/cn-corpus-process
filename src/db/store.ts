/**
 * Multi-dialect persistence layer. `PoetryStore` is the async interface the
 * pipeline depends on; `createStore` picks an implementation by dialect.
 *
 * Dialect notes:
 * - sqlite    — bun:sqlite driver, synchronous under the hood
 * - postgres  — Bun's native SQL client (drizzle-orm/bun-sql)
 * - mysql     — mysql2 driver (utf8mb4 required for 中文)
 *
 * Migrations (drizzle/<dialect>/) are generated from src/db/schema/* and
 * applied automatically on open.
 */

import { Database } from "bun:sqlite";
import { SQL } from "bun";
import { and, eq, isNull } from "drizzle-orm";
import { drizzle as drizzleSqlite } from "drizzle-orm/bun-sqlite";
import { migrate as migrateSqlite } from "drizzle-orm/bun-sqlite/migrator";
import { drizzle as drizzlePg } from "drizzle-orm/bun-sql";
import { migrate as migratePg } from "drizzle-orm/bun-sql/migrator";
import { drizzle as drizzleMysql } from "drizzle-orm/mysql2";
import { migrate as migrateMysql } from "drizzle-orm/mysql2/migrator";
import mysql from "mysql2/promise";
import { mkdir, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { AuthorRecord, Maybe, PoemRecord } from "../types.ts";
import * as sqliteSchema from "./schema/sqlite.ts";
import * as pgSchema from "./schema/pg.ts";
import * as mysqlSchema from "./schema/mysql.ts";

export type Dialect = "sqlite" | "postgres" | "mysql";

/** The async persistence interface the pipeline depends on. */
export interface PoetryStore {
  upsertAuthors(authors: AuthorRecord[]): Promise<void>;
  insertPoems(poems: PoemRecord[]): Promise<void>;
  close(): Promise<void>;
}

const MIGRATIONS = join(import.meta.dir, "../../drizzle");

/** AuthorRecord with dynasty normalized to "" (schema is NOT NULL). */
type AuthorRow = Omit<AuthorRecord, "dynasty"> & { dynasty: string };

interface PoemRow {
  authorId: number;
  title: string;
  titleSearch: string;
  content: string;
  contentSearch: string;
  source: string;
}

/**
 * Shared upsert/lookup logic, parameterized by the dialect-specific query
 * primitives. The drizzle types differ per dialect, so the injected
 * primitives use loose structural types on purpose — all dialect-specific
 * knowledge is confined to the factories below.
 */
abstract class BaseStore implements PoetryStore {
  private readonly authorIdCache = new Map<string, number>();

  async upsertAuthors(authors: AuthorRecord[]): Promise<void> {
    await this.inTransaction(async (tx) => {
      for (const author of authors) await this.upsertOne(tx, author);
    });
  }

  async insertPoems(poems: PoemRecord[]): Promise<void> {
    if (poems.length === 0) return;
    const rows: PoemRow[] = [];
    for (const poem of poems) {
      rows.push({
        authorId: await this.authorId(poem.author, poem.dynasty),
        title: poem.title,
        titleSearch: poem.titleSearch,
        content: poem.content,
        contentSearch: poem.contentSearch,
        source: poem.source,
      });
    }
    await this.inTransaction((tx) => this.insertPoemRows(tx, rows));
  }

  /** Resolve (name, dynasty) to an author id, creating the row if needed. */
  private async authorId(name: string, dynasty: Maybe<string>): Promise<number> {
    const key = `${name}${dynasty}`;
    const cached = this.authorIdCache.get(key);
    if (cached !== undefined) return cached;
    await this.insertAuthorIgnore(this.client, { name, dynasty: dynasty ?? "", description: null });
    const id = await this.selectAuthorId(this.client, name, dynasty ?? "");
    if (id === undefined) throw new Error(`author lookup failed: ${name} (${dynasty})`);
    this.authorIdCache.set(key, id);
    return id;
  }

  private async upsertOne(tx: unknown, author: AuthorRecord): Promise<void> {
    // dynasty is NOT NULL DEFAULT '' in the schema; nulls are normalized
    // here so the (name, dynasty) unique key works on every dialect
    // (SQL UNIQUE treats NULLs as distinct on sqlite/postgres)
    const row = { ...author, dynasty: author.dynasty ?? "" };
    await this.insertAuthorIgnore(tx, row);
    if (row.description) {
      await this.updateAuthorDesc(tx, row);
      this.authorIdCache.delete(`${row.name}${row.dynasty}`);
    }
  }

  /** The non-transactional client, used for idempotent author lookups. */
  protected abstract get client(): unknown;

  /** Insert an author row, ignoring (name, dynasty) conflicts. */
  protected abstract insertAuthorIgnore(client: unknown, row: AuthorRow): Promise<void>;

  /** Fill in description only when the existing row has none. */
  protected abstract updateAuthorDesc(client: unknown, author: AuthorRow): Promise<void>;

  protected abstract selectAuthorId(
    client: unknown,
    name: string,
    dynasty: string,
  ): Promise<number | undefined>;

  protected abstract insertPoemRows(client: unknown, rows: PoemRow[]): Promise<void>;

  protected abstract inTransaction<T>(fn: (tx: unknown) => Promise<T>): Promise<T>;

  abstract close(): Promise<void>;
}

/** SQLite implementation (bun:sqlite; drizzle calls are synchronous). */
class SqliteStore extends BaseStore {
  constructor(
    private readonly db: ReturnType<typeof drizzleSqlite<typeof sqliteSchema>>,
    private readonly sqlite: Database,
  ) {
    super();
  }

  protected get client(): unknown {
    return this.db;
  }

  protected async insertAuthorIgnore(client: unknown, row: AuthorRow): Promise<void> {
    (client as SqliteStore["db"])
      .insert(sqliteSchema.authors)
      .values(row)
      .onConflictDoNothing()
      .run();
  }

  protected async updateAuthorDesc(client: unknown, author: AuthorRow): Promise<void> {
    (client as SqliteStore["db"])
      .update(sqliteSchema.authors)
      .set({ description: author.description })
      .where(
        and(
          eq(sqliteSchema.authors.name, author.name),
          eq(sqliteSchema.authors.dynasty, author.dynasty),
          isNull(sqliteSchema.authors.description),
        ),
      )
      .run();
  }

  protected async selectAuthorId(
    client: unknown,
    name: string,
    dynasty: string,
  ): Promise<number | undefined> {
    const row = (client as SqliteStore["db"])
      .select({ id: sqliteSchema.authors.id })
      .from(sqliteSchema.authors)
      .where(and(eq(sqliteSchema.authors.name, name), eq(sqliteSchema.authors.dynasty, dynasty)))
      .get();
    return row?.id;
  }

  protected async insertPoemRows(client: unknown, rows: PoemRow[]): Promise<void> {
    (client as SqliteStore["db"]).insert(sqliteSchema.poems).values(rows).run();
  }

  protected async inTransaction<T>(fn: (tx: unknown) => Promise<T>): Promise<T> {
    // drizzle's sqlite transaction() requires a sync callback, but our fn
    // is async. The drizzle calls inside are synchronous on this driver, so
    // bracketing with manual BEGIN/COMMIT around the awaited fn is correct:
    // no other DB work can interleave between the microtask hops.
    this.sqlite.run("BEGIN");
    try {
      const result = await fn(this.db);
      this.sqlite.run("COMMIT");
      return result;
    } catch (e) {
      this.sqlite.run("ROLLBACK");
      throw e;
    }
  }

  async close(): Promise<void> {
    this.sqlite.close();
  }
}

/** Postgres/MySQL implementation; insert-ignore syntax differs per flavor. */
class AsyncDrizzleStore extends BaseStore {
  constructor(
    private readonly db: never,
    private readonly tables: typeof pgSchema | typeof mysqlSchema,
    private readonly flavor: "postgres" | "mysql",
    private readonly closeClient: () => Promise<void>,
  ) {
    super();
  }

  protected get client(): unknown {
    return this.db;
  }

  protected async insertAuthorIgnore(client: unknown, row: AuthorRow): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const builder = (client as any).insert(this.tables.authors);
    // ignore() lives on the insert builder and must precede values()
    const q = this.flavor === "mysql" ? builder.ignore().values(row) : builder.values(row);
    if (this.flavor === "mysql") await q;
    else await q.onConflictDoNothing();
  }

  protected async updateAuthorDesc(client: unknown, author: AuthorRow): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (client as any)
      .update(this.tables.authors)
      .set({ description: author.description })
      .where(
        and(
          eq(this.tables.authors.name, author.name),
          eq(this.tables.authors.dynasty, author.dynasty),
          isNull(this.tables.authors.description),
        ),
      );
  }

  protected async selectAuthorId(
    client: unknown,
    name: string,
    dynasty: string,
  ): Promise<number | undefined> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows = await (client as any)
      .select({ id: this.tables.authors.id })
      .from(this.tables.authors)
      .where(and(eq(this.tables.authors.name, name), eq(this.tables.authors.dynasty, dynasty)))
      .limit(1);
    return rows[0]?.id;
  }

  protected async insertPoemRows(client: unknown, rows: PoemRow[]): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (client as any).insert(this.tables.poems).values(rows);
  }

  protected async inTransaction<T>(fn: (tx: unknown) => Promise<T>): Promise<T> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (this.db as any).transaction(fn);
  }

  async close(): Promise<void> {
    await this.closeClient();
  }
}

export interface StoreOptions {
  dialect: Dialect;
  /** SQLite file path (dialect=sqlite). */
  dbPath?: string;
  /** Connection URL (dialect=postgres/mysql). */
  databaseUrl?: string;
  /** Rebuild from scratch: delete the sqlite file / truncate the tables. */
  fresh?: boolean;
}

export async function createStore(options: StoreOptions): Promise<PoetryStore> {
  switch (options.dialect) {
    case "sqlite": {
      const dbPath = options.dbPath;
      if (!dbPath) throw new Error("sqlite dialect requires a db path");
      if (options.fresh) {
        // force: true ignores missing files
        await Promise.all(["", "-wal", "-shm"].map((s) => rm(dbPath + s, { force: true })));
      }
      await mkdir(dirname(dbPath), { recursive: true });
      const sqlite = new Database(dbPath, { create: true });
      sqlite.run("PRAGMA journal_mode = WAL;");
      sqlite.run("PRAGMA synchronous = OFF;");
      const db = drizzleSqlite(sqlite, { schema: sqliteSchema });
      migrateSqlite(db, { migrationsFolder: join(MIGRATIONS, "sqlite") });
      return new SqliteStore(db, sqlite);
    }
    case "postgres": {
      if (!options.databaseUrl) throw new Error("postgres dialect requires a database URL");
      const client = new SQL(options.databaseUrl);
      const db = drizzlePg(client, { schema: pgSchema });
      await migratePg(db, { migrationsFolder: join(MIGRATIONS, "postgresql") });
      if (options.fresh) {
        await db.delete(pgSchema.poems);
        await db.delete(pgSchema.authors);
      }
      return new AsyncDrizzleStore(db as never, pgSchema, "postgres", async () => {
        await client.close();
      });
    }
    case "mysql": {
      if (!options.databaseUrl) throw new Error("mysql dialect requires a database URL");
      // mysql2 defaults to a latin1-ish handshake; force utf8mb4 or 中文 garbles
      const url = options.databaseUrl.includes("charset=")
        ? options.databaseUrl
        : options.databaseUrl + (options.databaseUrl.includes("?") ? "&" : "?") + "charset=utf8mb4";
      const pool = mysql.createPool(url);
      const db = drizzleMysql(pool, { schema: mysqlSchema, mode: "default" });
      await migrateMysql(db, { migrationsFolder: join(MIGRATIONS, "mysql") });
      if (options.fresh) {
        await db.delete(mysqlSchema.poems);
        await db.delete(mysqlSchema.authors);
      }
      return new AsyncDrizzleStore(db as never, mysqlSchema, "mysql", async () => {
        await pool.end();
      });
    }
  }
}
