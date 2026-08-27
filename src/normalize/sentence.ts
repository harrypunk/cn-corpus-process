/**
 * Sentence splitting for game mechanics. A poem's content (paragraphs
 * joined with "\n") is split into logical sentences: text terminated by
 * 。！？ (or end of line). The terminal punctuation is dropped; internal
 * clause punctuation (，、；) is kept.
 *
 * `parts` counts comma-separated clauses (separators + 1) — e.g.
 * "床前明月光，疑是地上霜" has 2 parts — so the game can filter by
 * sentence complexity.
 */

export interface SentenceSplit {
  text: string;
  parts: number;
}

const SENTENCE_END = /[。！？!?]+/g;
const CLAUSE_SEP = /[，、；,;]/g;

/** Pure: split poem content into sentences (order preserved). */
export function splitSentences(content: string): SentenceSplit[] {
  return content
    .split("\n")
    .flatMap((line) => line.split(SENTENCE_END))
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map((text) => ({ text, parts: (text.match(CLAUSE_SEP)?.length ?? 0) + 1 }));
}
