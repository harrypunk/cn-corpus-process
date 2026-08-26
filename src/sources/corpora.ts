/**
 * Registry of all upstream corpora. Each entry pairs a JsonCorpusConfig
 * (which files to read) with a FieldMapping (how to interpret the records).
 * Adding a new corpus = adding one entry here.
 */

import type { FieldMapping } from "../normalize/record.ts";
import type { JsonCorpusConfig } from "./json-corpus.ts";
import { JsonAuthorSource, type AuthorFileConfig } from "./json-authors.ts";
import type { AuthorSource } from "../types.ts";

export interface CorpusEntry {
  corpus: JsonCorpusConfig;
  mapping: FieldMapping;
}

export function corpusEntries(rootDir: string): CorpusEntry[] {
  const src = (name: string, patterns: string[]): JsonCorpusConfig => ({
    name,
    patterns,
    rootDir,
  });
  return [
    {
      corpus: src("quantangshi", ["全唐诗/poet.tang.*.json"]),
      mapping: { paragraphs: "paragraphs", dynasty: "tang", source: "quantangshi" },
    },
    {
      corpus: src("quansongshi", ["全唐诗/poet.song.*.json"]),
      mapping: { paragraphs: "paragraphs", dynasty: "song", source: "quansongshi" },
    },
    {
      // ci records carry no "title"; the tune name (rhythmic) is the title.
      corpus: src("songci", ["宋词/ci.song.*.json"]),
      mapping: {
        paragraphs: "paragraphs",
        title: "rhythmic",
        dynasty: "song",
        source: "songci",
      },
    },
    {
      corpus: src("yuanqu", ["元曲/yuanqu.json"]),
      mapping: { paragraphs: "paragraphs", dynasty: "yuan", source: "yuanqu" },
    },
    {
      // 诗经/楚辞 use "content" instead of "paragraphs".
      corpus: src("shijing", ["诗经/shijing.json"]),
      mapping: {
        paragraphs: "content",
        fixedAuthor: "佚名",
        dynasty: "xianqin",
        source: "shijing",
      },
    },
    {
      corpus: src("chuci", ["楚辞/chuci.json"]),
      mapping: {
        paragraphs: "content",
        dynasty: "xianqin",
        source: "chuci",
      },
    },
    {
      corpus: src("caocao", ["曹操诗集/caocao.json"]),
      mapping: {
        paragraphs: "paragraphs",
        fixedAuthor: "曹操",
        dynasty: "han",
        source: "caocao",
      },
    },
    {
      corpus: src("shuimo", ["水墨唐诗/shuimotangshi.json"]),
      mapping: { paragraphs: "paragraphs", dynasty: "tang", source: "shuimo" },
    },
    {
      // 纳兰性德 uses "para" instead of "paragraphs".
      corpus: src("nalanxingde", ["纳兰性德/纳兰性德诗集.json"]),
      mapping: {
        paragraphs: "para",
        fixedAuthor: "纳兰性德",
        dynasty: "qing",
        source: "nalanxingde",
      },
    },
    {
      corpus: src("huajianji", ["五代诗词/huajianji/huajianji-*-juan.json"]),
      mapping: { paragraphs: "paragraphs", dynasty: "wudai", source: "huajianji" },
    },
    {
      corpus: src("nantang", ["五代诗词/nantang/poetrys.json"]),
      mapping: {
        paragraphs: "paragraphs",
        titleFallback: "rhythmic",
        dynasty: "wudai",
        source: "nantang",
      },
    },
  ];
}

const AUTHOR_FILES: AuthorFileConfig[] = [
  { name: "authors-tang", file: "全唐诗/authors.tang.json", dynasty: "tang", descField: "desc" },
  {
    name: "authors-song-shi",
    file: "全唐诗/authors.song.json",
    dynasty: "song",
    descField: "desc",
  },
  {
    name: "authors-song-ci",
    file: "宋词/author.song.json",
    dynasty: "song",
    descField: "description",
  },
  {
    name: "authors-nantang",
    file: "五代诗词/nantang/authors.json",
    dynasty: "wudai",
    descField: "desc",
  },
];

export function authorSources(rootDir: string): AuthorSource[] {
  return AUTHOR_FILES.map((c) => new JsonAuthorSource(c, rootDir));
}
