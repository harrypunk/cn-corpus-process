import type { RawRecord } from "@src/store/types.ts";
import { joinLines, parseObjectArray, str } from "./json.ts";
import type { Parser } from "./types.ts";

/** {author, title, paragraphs[]} poem arrays, e.g. 全唐诗/poet.tang.*.json, 元曲/yuanqu.json. */
export const poemsParser: Parser = {
  name: "poems",
  parse: (text): RawRecord[] =>
    parseObjectArray(text).map((r) => ({
      author: str(r.author),
      title: str(r.title),
      content: joinLines(r.paragraphs),
    })),
};
