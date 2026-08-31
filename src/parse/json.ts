/** Shared tolerant JSON helpers for corpus parsers. No validation, no cleansing. */

/** Parse a top-level JSON array of objects; anything else yields []. */
export function parseObjectArray(text: string): Record<string, unknown>[] {
  try {
    const data: unknown = JSON.parse(text);
    if (!Array.isArray(data)) return [];
    return data.filter((x): x is Record<string, unknown> => typeof x === "object" && x !== null);
  } catch {
    return [];
  }
}

/** Coerce to string; non-strings become "". */
export const str = (value: unknown): string => (typeof value === "string" ? value : "");

/** Join a string array with newlines; a plain string passes through; anything else becomes "". */
export const joinLines = (value: unknown): string =>
  Array.isArray(value)
    ? value.filter((x): x is string => typeof x === "string").join("\n")
    : str(value);
