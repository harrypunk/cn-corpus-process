import { readdir, readFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { Effect, Stream } from "effect";
import { stripBom } from "./text.ts";
import { SourceError, type DataSource, type SourceFile } from "./types.ts";

export interface LocalFsOptions {
  /** Keep only matching files. Default: `*.json`. */
  readonly match?: (path: string) => boolean;
}

/** Code-unit comparison: locale-independent, so listing order is deterministic. */
const byName = (a: { name: string }, b: { name: string }): number =>
  a.name < b.name ? -1 : a.name > b.name ? 1 : 0;

async function* walk(
  dir: string,
  root: string,
  match: (path: string) => boolean,
): AsyncGenerator<SourceFile> {
  const entries = (await readdir(dir, { withFileTypes: true })).sort(byName);
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(full, root, match);
    } else if (entry.isFile()) {
      const rel = relative(root, full).split(sep).join("/");
      if (match(rel)) yield { path: rel };
    }
  }
}

/** DataSource over a local chinese-poetry checkout. */
export function createLocalFsSource(root: string, options: LocalFsOptions = {}): DataSource {
  const match = options.match ?? ((path: string) => path.endsWith(".json"));
  const fail = (operation: "list" | "read", cause: unknown, path?: string) =>
    new SourceError({ source: `fs:${root}`, operation, message: String(cause), cause, path });

  return {
    name: `fs:${root}`,
    list: () => Stream.fromAsyncIterable(walk(root, root, match), (cause) => fail("list", cause)),
    read: (file) =>
      Effect.tryPromise({
        try: async () => stripBom(await readFile(join(root, file.path), "utf8")),
        catch: (cause) => fail("read", cause, file.path),
      }),
  };
}
