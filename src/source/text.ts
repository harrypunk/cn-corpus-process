/** Strip a leading UTF-8 BOM, which some corpus files carry. */
export function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}
