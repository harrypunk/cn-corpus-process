import { describe, expect, it } from "bun:test";
import { poemsParser } from "./poems.ts";

describe("poemsParser", () => {
  it("maps author/title/paragraphs, joining paragraph lines", () => {
    const text = JSON.stringify([
      {
        author: "太宗皇帝",
        title: "帝京篇十首 一",
        paragraphs: ["秦川雄帝宅，函谷壯皇居。", "綺殿千尋起，離宮百雉餘。"],
        id: "3ad6d468-7ff1-4a7b-8b24-a27d70d00ed4",
      },
    ]);
    expect(poemsParser.parse(text)).toEqual([
      {
        author: "太宗皇帝",
        title: "帝京篇十首 一",
        content: "秦川雄帝宅，函谷壯皇居。\n綺殿千尋起，離宮百雉餘。",
      },
    ]);
  });

  it("yields [] for malformed or non-array JSON", () => {
    expect(poemsParser.parse("not json")).toEqual([]);
    expect(poemsParser.parse('{"datasets":{}}')).toEqual([]);
  });
});
