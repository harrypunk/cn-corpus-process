/**
 * Phase 1 smoke entry: resolve the configured DataSource, list its files and
 * print a count plus a small sample. Parsing/normalization land in Phase 2.
 */

import { Chunk, Console, Effect, Stream } from "effect";
import { loadConfig } from "./config.ts";
import { createSource } from "./source/index.ts";

const SAMPLE = 10;

const program = Effect.gen(function* () {
  const config = yield* Effect.sync(() => loadConfig());
  const source = createSource(config.source);

  const files = Chunk.toReadonlyArray(yield* Stream.runCollect(source.list()));
  yield* Console.log(`source "${source.name}": ${files.length} files`);
  for (const file of files.slice(0, SAMPLE)) {
    yield* Console.log(`  ${file.path}`);
  }
  if (files.length > SAMPLE) {
    yield* Console.log(`  ... and ${files.length - SAMPLE} more`);
  }
});

await Effect.runPromise(program).catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
