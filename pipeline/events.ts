/**
 * Events emitted by the ingest pipeline. Subscribers (observers.ts) consume
 * these independently — the producer in ingest.ts knows nothing about them.
 */

import type { SourceFile } from "@src/source/index.ts";
import type { RawRecord } from "@src/store/index.ts";

export interface FileListed {
  readonly _tag: "FileListed";
  readonly file: SourceFile;
}

export interface FileSkipped {
  readonly _tag: "FileSkipped";
  readonly file: SourceFile;
}

export interface RecordsParsed {
  readonly _tag: "RecordsParsed";
  readonly file: SourceFile;
  /** May be empty: the file parsed but yielded no records. */
  readonly records: readonly RawRecord[];
}

export interface FileFailed {
  readonly _tag: "FileFailed";
  readonly file: SourceFile;
  readonly message: string;
}

export type IngestEvent = FileListed | FileSkipped | RecordsParsed | FileFailed;
