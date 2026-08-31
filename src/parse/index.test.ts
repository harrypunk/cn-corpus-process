import { describe, expect, it } from "bun:test";
import { parseFile } from "./index.ts";

describe("parseFile", () => {
  it("routes by path", () => {
    const text = '[{"author":"李璟","rhythmic":"应天长","paragraphs":["x"]}]';
    expect(parseFile("五代诗词/nantang/poetrys.json", text)).toEqual([
      { author: "李璟", title: "应天长", content: "x" },
    ]);
    expect(
      parseFile("全唐诗/poet.tang.0.json", '[{"author":"a","title":"t","paragraphs":["p"]}]'),
    ).toEqual([{ author: "a", title: "t", content: "p" }]);
  });

  it("skips files no parser claims (metadata, strains, loader)", () => {
    expect(parseFile("rank/ci/ci.song.rank.0.json", '[{"baidu":1}]')).toEqual([]);
    expect(parseFile("strains/json/poet.song.0.json", '[{"strains":["仄仄平平"]}]')).toEqual([]);
    expect(parseFile("loader/datas.json", "{}")).toEqual([]);
  });
});
