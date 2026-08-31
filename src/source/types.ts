import { Data, Effect, Stream } from "effect";

/** A file candidate discovered by a DataSource. */
export interface SourceFile {
  /** Source-relative POSIX path, e.g. "全唐诗/poet.tang.0.json". */
  readonly path: string;
  /** Byte size, when the source knows it cheaply. */
  readonly size?: number;
}

export class SourceError extends Data.TaggedError("SourceError")<{
  readonly source: string;
  readonly operation: "list" | "read";
  readonly message: string;
  readonly path?: string;
  readonly cause?: unknown;
}> {}

/**
 * A raw-text provider. Loaders turn bytes into UTF-8 text and nothing more:
 * no JSON parsing, no normalization — that is the parse/normalize layers' job.
 */
export interface DataSource {
  readonly name: string;
  /** Candidate files (e.g. *.json), in deterministic order. */
  readonly list: () => Stream.Stream<SourceFile, SourceError>;
  /** File contents as UTF-8 text with BOM stripped. */
  readonly read: (file: SourceFile) => Effect.Effect<string, SourceError>;
}

/** Keep paths under any prefix; an empty list keeps everything. Prefixes carry no trailing slash. */
export const underPrefixes = (path: string, prefixes: readonly string[]): boolean =>
  prefixes.length === 0 || prefixes.some((prefix) => path.startsWith(`${prefix}/`));
