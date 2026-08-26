/**
 * Core domain types for the ETL pipeline.
 *
 * Raw* types mirror the upstream chinese-poetry JSON shapes (which vary per
 * corpus); PoemRecord / AuthorRecord are the normalized internal forms that
 * every source must produce before persistence.
 */

/** A raw record as parsed from an upstream JSON file, shape unknown. */
export type RawRecord = Record<string, unknown>;

/** Why a raw record was dropped during normalization. */
export type DropReason =
  | "empty_content"
  | "empty_title"
  | "invalid_chars"
  | "duplicate"
  | "not_an_object";

export interface PoemRecord {
  /** Canonical author name; "佚名" when unknown. */
  author: string;
  dynasty: string | null;
  title: string;
  /** Paragraphs joined with "\n", already text-cleaned. */
  content: string;
  /** Corpus identifier, e.g. "quantangshi", "songci". */
  source: string;
}

export interface AuthorRecord {
  name: string;
  dynasty: string | null;
  description: string | null;
}

/**
 * A corpus of poems. Implementations stream normalized records so the
 * pipeline never holds a whole corpus in memory.
 */
export interface PoemSource {
  /** Stable corpus identifier written to poems.source. */
  readonly name: string;
  /** Iterate raw records shard-by-shard (one array element at a time). */
  rawRecords(): AsyncGenerator<RawRecord>;
}

/**
 * Optional author-biography provider for a corpus.
 * Kept separate from PoemSource so corpora without bios stay simple.
 */
export interface AuthorSource {
  readonly name: string;
  authors(): AsyncGenerator<AuthorRecord>;
}
