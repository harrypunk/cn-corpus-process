import type { RawRecord } from "@src/store/types.ts";
import { joinLines, parseObjectArray, str } from "./json.ts";
import type { Parser } from "./types.ts";

/** {rhythmic, author?, paragraphs[], notes?} 词 arrays, e.g. 五代诗词. Title falls back to rhythmic. */
export const ciParser: Parser = {
  name: "ci",
  parse: (text): RawRecord[] =>
    parseObjectArray(text).map((r) => ({
      author: str(r.author),
      title: str(r.title) || str(r.rhythmic),
      content: joinLines(r.paragraphs),
    })),
};
