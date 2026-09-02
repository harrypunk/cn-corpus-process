/**
 * Corpus taxonomy: stable integer IDs stamped into raw_records.corpus_id.
 * Our own vocabulary — agnostic to upstream repo dir names and text content;
 * jobs map their corpus dir onto one of these IDs.
 */

export const Corpus = {
  WUDAI: 1,
  QUANTANGSHI: 2,
  SONGCI: 3,
  SHUIMOTANGSHI: 4,
  CAOCAO: 5,
  CHUCI: 6,
  NALAN: 7,
  SHIJING: 8,
} as const;

export type CorpusId = (typeof Corpus)[keyof typeof Corpus];
