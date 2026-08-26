import { describe, expect, test } from "bun:test";
import { canonicalizeAuthor, ANONYMOUS } from "./author.ts";
import { Deduper } from "./dedup.ts";
import { cleanLine, cleanParagraphs, cleanTitle, containsReplacementChar } from "./text.ts";
import { normalizeRecord, type FieldMapping } from "./record.ts";

describe("cleanLine", () => {
  test("trims and strips CR", () => {
    expect(cleanLine("  天地英雄气，\r\n")).toBe("天地英雄气，");
  });
  test("collapses full-width spaces", () => {
    expect(cleanLine("举头　望　明月")).toBe("举头 望 明月");
  });
  test("removes explicit annotation markers", () => {
    expect(cleanLine("黄河远上白云间（注：一作黄沙）")).toBe("黄河远上白云间");
    expect(cleanLine("黄河远上白云间〖注：一作黄沙〗")).toBe("黄河远上白云间");
  });
  test("keeps ordinary parentheses", () => {
    expect(cleanLine("渭城曲（送元二使安西）")).toBe("渭城曲（送元二使安西）");
  });
});

describe("cleanParagraphs", () => {
  test("drops lines that become empty", () => {
    expect(cleanParagraphs(["  ", "你好", "\r"])).toEqual(["你好"]);
  });
  test("returns null when nothing survives", () => {
    expect(cleanParagraphs(["", "  "])).toBeNull();
  });
});

describe("cleanTitle", () => {
  test("null on empty", () => {
    expect(cleanTitle("   ")).toBeNull();
  });
});

describe("containsReplacementChar", () => {
  test("detects corruption marker", () => {
    expect(containsReplacementChar("千山鸟飞绝")).toBe(false);
    expect(containsReplacementChar("千山鸟飞\uFFFD绝")).toBe(true);
  });
});

describe("canonicalizeAuthor", () => {
  test("maps unknown variants to 佚名", () => {
    for (const v of ["", null, undefined, "无名氏", "unknown", "不详"]) {
      expect(canonicalizeAuthor(v as string | null)).toBe(ANONYMOUS);
    }
  });
  test("keeps real names, trimmed", () => {
    expect(canonicalizeAuthor(" 李白 ")).toBe("李白");
  });
});

describe("Deduper", () => {
  test("first occurrence is new, repeat is not", () => {
    const d = new Deduper();
    expect(d.isNew("李白", "静夜思", "床前明月光")).toBe(true);
    expect(d.isNew("李白", "静夜思", "床前明月光")).toBe(false);
    expect(d.isNew("杜甫", "静夜思", "床前明月光")).toBe(true);
  });
});

describe("normalizeRecord", () => {
  const map: FieldMapping = {
    paragraphs: "paragraphs",
    dynasty: "tang",
    source: "quantangshi",
  };

  test("happy path joins paragraphs", () => {
    const r = normalizeRecord(
      { author: "李白", title: "静夜思", paragraphs: ["床前明月光", "疑是地上霜"] },
      map,
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.record.content).toBe("床前明月光\n疑是地上霜");
      expect(r.record.dynasty).toBe("tang");
    }
  });

  test("drops empty content", () => {
    const r = normalizeRecord({ author: "李白", title: "x", paragraphs: [] }, map);
    expect(r).toEqual({ ok: false, reason: "empty_content" });
  });

  test("drops missing title", () => {
    const r = normalizeRecord({ author: "李白", paragraphs: ["床前明月光"] }, map);
    expect(r).toEqual({ ok: false, reason: "empty_title" });
  });

  test("drops corrupted content", () => {
    const r = normalizeRecord({ author: "李白", title: "x", paragraphs: ["千山\uFFFD黑"] }, map);
    expect(r).toEqual({ ok: false, reason: "invalid_chars" });
  });

  test("title fallback and fixed author", () => {
    const m: FieldMapping = {
      paragraphs: "para",
      titleFallback: "rhythmic",
      fixedAuthor: "曹操",
      dynasty: "han",
      source: "caocao",
    };
    const r = normalizeRecord({ rhythmic: "短歌行", para: ["对酒当歌"] }, m);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.record.title).toBe("短歌行");
      expect(r.record.author).toBe("曹操");
    }
  });
});
