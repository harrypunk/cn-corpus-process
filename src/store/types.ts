import { Data, Effect } from "effect";

/** One poem/prose record as parsed from source JSON, before any cleansing. */
export interface RawRecord {
  readonly author: string;
  readonly title: string;
  readonly content: string;
}

export type SinkOperation = "init" | "write" | "close";

export class SinkError extends Data.TaggedError("SinkError")<{
  readonly sink: string;
  readonly operation: SinkOperation;
  readonly message: string;
  readonly cause?: unknown;
}> {}

/** Curry a SinkError constructor bound to one sink name. */
export const sinkError =
  (sink: string) =>
  (operation: SinkOperation, cause: unknown): SinkError =>
    new SinkError({ sink, operation, message: String(cause), cause });

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
