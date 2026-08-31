import { Data, Effect, Stream } from "effect";

/** A file that a DataSource has found and can read. */
export interface SourceFile {
  /** Path relative to the source root, using "/" separators, e.g. "全唐诗/poet.tang.0.json". */
  readonly path: string;
  /** Size in bytes, if the source can report it without extra IO. */
  readonly size?: number;
}

export type SourceOperation = "list" | "read";

export class SourceError extends Data.TaggedError("SourceError")<{
  readonly source: string;
  readonly operation: SourceOperation;
  readonly message: string;
  readonly path?: string;
}> {}

/**
 * Build an error factory for one source, so call sites don't repeat the source name:
 *   const fail = sourceError("fs:/data");
 *   fail("read", err, file.path) // => SourceError { source: "fs:/data", ... }
 */
export function sourceError(source: string) {
  return function (operation: SourceOperation, cause: unknown, path?: string): SourceError {
    return new SourceError({ source, operation, message: String(cause), path });
  };
}

/**
 * Provides raw text files from somewhere (local disk, gitea, ...).
 * A source only turns bytes into UTF-8 text — JSON parsing and text
 * normalization belong to the parse/normalize layers, not here.
 */
export interface DataSource {
  readonly name: string;
  /** All candidate files (e.g. *.json), always in the same deterministic order. */
  readonly list: () => Stream.Stream<SourceFile, SourceError>;
  /** Full contents of a file as UTF-8 text, with any BOM removed. */
  readonly read: (file: SourceFile) => Effect.Effect<string, SourceError>;
}

/**
 * True if `path` sits inside one of the given directory prefixes.
 * An empty prefix list means "no filter", i.e. everything matches.
 * Prefixes are directory names without a trailing slash, e.g. "全唐诗".
 */
export function underPrefixes(path: string, prefixes: readonly string[]): boolean {
  return prefixes.length === 0 || prefixes.some((prefix) => path.startsWith(`${prefix}/`));
}
