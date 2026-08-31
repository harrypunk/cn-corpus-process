import type { Dirent } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { Effect, Order, Stream } from "effect";
import { stripBom } from "./text.ts";
import { sourceError, underPrefixes, type DataSource, type SourceFile } from "./types.ts";

/** Anything with a name, so byName works on Dirents and plain objects alike. */
interface Named {
  readonly name: string;
}

/** Decides whether a source-relative path is part of the listing. */
type PathMatcher = (path: string) => boolean;

/** Order.string is a code-unit comparison: locale-independent, so listing order is deterministic. */
const byName = (a: Named, b: Named): number => Order.string(a.name, b.name);

/** Entries of one directory, sorted by name. Failures stay raw; the caller maps them. */
const entriesOf = (dir: string): Effect.Effect<Dirent[], unknown> =>
  Effect.tryPromise({
    try: () => readdir(dir, { withFileTypes: true }),
    catch: (cause) => cause,
  }).pipe(Effect.map((entries) => entries.sort(byName)));

/** Every file under `dir` accepted by `match`, depth-first in sorted-entry order. */
const walk = (dir: string, root: string, match: PathMatcher): Stream.Stream<SourceFile, unknown> =>
  Stream.fromEffect(entriesOf(dir)).pipe(
    Stream.mapConcat((entries) => entries),
    Stream.flatMap((entry) => {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) return walk(full, root, match);
      if (!entry.isFile()) return Stream.empty;
      const rel = relative(root, full).split(sep).join("/");
      return match(rel) ? Stream.succeed({ path: rel }) : Stream.empty;
    }),
  );

/** DataSource over a local chinese-poetry checkout; `prefixes` limits listing ([] = whole root). */
export function createLocalFsSource(root: string, prefixes: readonly string[] = []): DataSource {
  const match: PathMatcher = (path) => path.endsWith(".json") && underPrefixes(path, prefixes);
  const fail = sourceError(`fs:${root}`);

  return {
    name: `fs:${root}`,
    list: () => walk(root, root, match).pipe(Stream.mapError((cause) => fail("list", cause))),
    read: (file) =>
      Effect.tryPromise({
        try: () => readFile(join(root, file.path), "utf8"),
        catch: (cause) => fail("read", cause, file.path),
      }).pipe(Effect.map(stripBom)),
  };
}
