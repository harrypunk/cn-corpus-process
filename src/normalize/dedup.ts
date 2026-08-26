/**
 * Content-hash deduplication. The corpora overlap heavily (跨集互抄), so
 * identical (author, title, content) triples are kept only once.
 */

export class Deduper {
  private seen = new Set<string>();

  /** Returns true the first time a key is seen, false on repeats. */
  isNew(author: string, title: string, content: string): boolean {
    const key = `${author}${title}${content}`;
    if (this.seen.has(key)) return false;
    this.seen.add(key);
    return true;
  }

  get size(): number {
    return this.seen.size;
  }
}
