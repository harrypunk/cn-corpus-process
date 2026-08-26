/**
 * Author-biography loader. Upstream author files use two shapes:
 * - { name, desc }        (全唐诗 authors.*.json, 南唐 authors.json)
 * - { name, description } (宋词 author.song.json)
 *
 * `toAuthorRecord` is pure; the generator only applies it and filters out
 * unusable entries.
 */

import type { AuthorRecord, AuthorSource, RawRecord } from "../types.ts";
import { canonicalizeAuthor, ANONYMOUS } from "../normalize/author.ts";
import { cleanLine } from "../normalize/text.ts";

export interface AuthorFileConfig {
  name: string;
  file: string;
  dynasty: string;
  /** Which raw field holds the biography text. */
  descField: "desc" | "description";
}

/** Pure: raw author entry -> AuthorRecord, or null when unusable. */
export function toAuthorRecord(config: AuthorFileConfig, item: RawRecord): AuthorRecord | null {
  const name = canonicalizeAuthor(item.name as string | undefined);
  if (name === ANONYMOUS) return null;
  const rawDesc = item[config.descField];
  const description = typeof rawDesc === "string" ? cleanLine(rawDesc) : "";
  return {
    name,
    dynasty: config.dynasty,
    description: description.length > 0 ? description : null,
  };
}

export class JsonAuthorSource implements AuthorSource {
  readonly name: string;

  constructor(
    private readonly config: AuthorFileConfig,
    private readonly rootDir: string,
  ) {
    this.name = config.name;
  }

  async *authors(): AsyncGenerator<AuthorRecord> {
    const data: unknown = await Bun.file(`${this.rootDir}/${this.config.file}`).json();
    if (!Array.isArray(data)) return;
    const records = data
      .filter((item): item is RawRecord => item !== null && typeof item === "object")
      .map((item) => toAuthorRecord(this.config, item))
      .filter((r): r is AuthorRecord => r !== null);
    yield* records;
  }
}
