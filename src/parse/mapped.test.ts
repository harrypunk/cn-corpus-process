import { describe, expect, it } from "bun:test";
import { mappedParser } from "./mapped.ts";

describe("mappedParser", () => {
  it("maps the lines field named by the mapping (楚辞 uses content)", () => {
    const parser = mappedParser("chuci", { title: "title", paragraphs: "content" });
    const text = JSON.stringify([{ title: "离骚", author: "屈原", content: ["帝高阳之苗裔兮"] }]);
    expect(parser.parse(text)).toEqual([
      { author: "屈原", title: "离骚", content: "帝高阳之苗裔兮" },
    ]);
  });

  it("supports the para field (纳兰性德)", () => {
    const parser = mappedParser("nalan", { title: "title", paragraphs: "para" });
    const text = JSON.stringify([
      { title: "长相思·山一程", author: "纳兰性德", para: ["山一程，水一程", "风一更，雪一更"] },
    ]);
    expect(parser.parse(text)).toEqual([
      { author: "纳兰性德", title: "长相思·山一程", content: "山一程，水一程\n风一更，雪一更" },
    ]);
  });

  it("falls back to defaultAuthor when records have none (曹操诗集)", () => {
    const parser = mappedParser("caocao", {
      title: "title",
      paragraphs: "paragraphs",
      defaultAuthor: "曹操",
    });
    const text = JSON.stringify([{ title: "度关山", paragraphs: ["天地间，人为贵。"] }]);
    expect(parser.parse(text)).toEqual([
      { author: "曹操", title: "度关山", content: "天地间，人为贵。" },
    ]);
  });

  it("prepends titlePrefix fields joined with · (诗经 chapter/section)", () => {
    const parser = mappedParser("shijing", {
      title: "title",
      paragraphs: "content",
      titlePrefix: ["chapter", "section"],
    });
    const text = JSON.stringify([
      { title: "关雎", chapter: "国风", section: "周南", content: ["关关雎鸠，在河之洲。"] },
    ]);
    expect(parser.parse(text)).toEqual([
      { author: "", title: "国风·周南·关雎", content: "关关雎鸠，在河之洲。" },
    ]);
  });

  it("yields [] for malformed or non-array JSON", () => {
    const parser = mappedParser("x", { title: "title", paragraphs: "content" });
    expect(parser.parse("not json")).toEqual([]);
    expect(parser.parse('{"a":1}')).toEqual([]);
  });
});
