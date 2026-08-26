/**
 * Author-biography loader. Upstream author files use two shapes:
 * - { name, desc }        (全唐诗 authors.*.json, 南唐 authors.json)
 * - { name, description } (宋词 author.song.json)
 */

import type { AuthorRecord, AuthorSource, RawRecord } from "../types.ts";
import { canonicalizeAuthor } from "../normalize/author.ts";
import { cleanLine } from "../normalize/text.ts";

export interface AuthorFileConfig {
  name: string;
  file: string;
  dynasty: string;
  /** Which raw field holds the biography text. */
  descField: "desc" | "description";
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
    for (const item of data as RawRecord[]) {
      if (item === null || typeof item !== "object") continue;
      const name = canonicalizeAuthor(item.name as string | undefined);
      if (name === "佚名") continue;
      const rawDesc = item[this.config.descField];
      const description = typeof rawDesc === "string" ? cleanLine(rawDesc) : null;
      yield {
        name,
        dynasty: this.config.dynasty,
        description: description && description.length > 0 ? description : null,
      };
    }
  }
}
