import { Effect } from "effect";
import type { SinkConfig } from "../config.ts";
import { createPgliteSink } from "./pglite.ts";
import { createTidbSink } from "./tidb.ts";
import type { Sink, SinkError } from "./types.ts";

export * from "./types.ts";
export { createPgliteSink, createTidbSink };

/** Build the Sink selected by config. */
export function createSink(config: SinkConfig): Effect.Effect<Sink, SinkError> {
  switch (config.kind) {
    case "pglite":
      return createPgliteSink(config.dataDir);
    case "tidb":
      return createTidbSink(config.url);
  }
}
