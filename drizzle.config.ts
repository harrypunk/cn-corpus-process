/**
 * drizzle-kit config. One config for all dialects, selected via DIALECT env:
 *
 *   DIALECT=sqlite     bun run db:generate   (default)
 *   DIALECT=postgresql bun run db:generate
 *   DIALECT=mysql      bun run db:generate
 *
 * Migrations land in drizzle/<dialect>/ and are applied at store open time.
 */

import { defineConfig } from "drizzle-kit";

const dialect = (process.env.DIALECT ?? "sqlite") as "sqlite" | "postgresql" | "mysql";
const schemaFile = { sqlite: "sqlite", postgresql: "pg", mysql: "mysql" }[dialect];

export default defineConfig({
  dialect,
  schema: `./src/db/schema/${schemaFile}.ts`,
  out: `./drizzle/${dialect}`,
});
