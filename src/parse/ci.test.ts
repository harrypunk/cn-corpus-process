import { describe, expect, it } from "bun:test";
import { ciParser } from "./ci.ts";

describe("ciParser", () => {
  it("maps rhythmic to title and drops notes", () => {
    const text = JSON.stringify([
      {
        rhythmic: "应天长",
        paragraphs: ["一钩初月临妆镜，蝉鬓凤钗慵不整。", "重帘静，层楼迥，惆怅落花风不定。"],
        notes: ["初月--新月。"],
        author: "李璟",
      },
    ]);
    expect(ciParser.parse(text)).toEqual([
      {
        author: "李璟",
        title: "应天长",
        content: "一钩初月临妆镜，蝉鬓凤钗慵不整。\n重帘静，层楼迥，惆怅落花风不定。",
      },
    ]);
  });

  it("prefers title over rhythmic and defaults missing author", () => {
    const text = JSON.stringify([
      { rhythmic: "应天长", title: "应天长·一钩初月", paragraphs: ["x"] },
    ]);
    expect(ciParser.parse(text)).toEqual([{ author: "", title: "应天长·一钩初月", content: "x" }]);
  });
});
