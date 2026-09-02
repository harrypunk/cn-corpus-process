import { Data, Effect } from "effect";
import type { CorpusId } from "@src/corpus.ts";

/** Record fields as parsed from source JSON, before any cleansing or provenance. */
export interface ParsedRecord {
  readonly author: string;
  readonly title: string;
  readonly content: string;
}

/** A ParsedRecord stamped with its corpus ID (see src/corpus.ts) — the raw_records row shape. */
export interface RawRecord extends ParsedRecord {
  readonly corpusId: CorpusId;
}

export type SinkOperation = "init" | "write" | "close";

export class SinkError extends Data.TaggedError("SinkError")<{
  readonly sink: string;
  readonly operation: SinkOperation;
  readonly message: string;
}> {}

/** Curry a SinkError constructor bound to one sink name. */
export const sinkError =
  (sink: string) =>
  (operation: SinkOperation, cause: unknown): SinkError =>
    new SinkError({ sink, operation, message: String(cause) });

/**
 * A raw-data landing target. Sinks persist what parse produced and nothing
 * more: no normalization — Phase 3 reads back from here.
 *
 * Insert-only staging: re-running the pipeline inserts duplicates on purpose
 * (no natural key at this stage); cleansing/dedup is Phase 3's job.
 */
export interface Sink {
  readonly name: string;
  /** Insert a batch of raw records. */
  readonly writeRaw: (records: readonly RawRecord[]) => Effect.Effect<void, SinkError>;
  /** Release connections and other resources. */
  readonly close: () => Effect.Effect<void, SinkError>;
}
