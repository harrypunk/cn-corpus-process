/**
 * Search-form normalization: produce a simplified-Chinese, NFKC-normalized
 * copy of a text for keyword matching. The original text is untouched and
 * always used for display; this column exists purely for querying.
 *
 * Traditional → simplified is lossy in the safe direction (many-to-one:
 * 發/髮 both become 发), so simplified is the right search basis.
 */

import OpenCC from "opencc-js";

// tw→cn preset: char-level traditional→simplified conversion.
const t2s = OpenCC.Converter({ from: "tw", to: "cn" });

export function toSearchText(text: string): string {
  return t2s(text.normalize("NFKC"));
}
