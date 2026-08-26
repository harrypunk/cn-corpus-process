/**
 * Small async-iterable transforms (map/filter/filterMap/tap/batch). These
 * are pure with respect to their elements — side effects belong in `tap`
 * callbacks or in the final consumer — and they stay lazy: elements flow
 * one at a time, so the whole corpus is never held in memory.
 */

export async function* mapAsync<T, U>(
  iter: AsyncIterable<T>,
  fn: (item: T) => U,
): AsyncGenerator<U> {
  for await (const item of iter) yield fn(item);
}

export async function* filterAsync<T>(
  iter: AsyncIterable<T>,
  pred: (item: T) => boolean,
): AsyncGenerator<T> {
  for await (const item of iter) {
    if (pred(item)) yield item;
  }
}

/** Map each item to a value or null; nulls are dropped from the output. */
export async function* filterMapAsync<T, U>(
  iter: AsyncIterable<T>,
  fn: (item: T) => U | null,
): AsyncGenerator<U> {
  for await (const item of iter) {
    const mapped = fn(item);
    if (mapped !== null) yield mapped;
  }
}

/** Pass items through unchanged while invoking fn on each (stats, logging). */
export async function* tapAsync<T>(
  iter: AsyncIterable<T>,
  fn: (item: T) => void,
): AsyncGenerator<T> {
  for await (const item of iter) {
    fn(item);
    yield item;
  }
}

/** Group items into fixed-size arrays (last batch may be smaller). */
export async function* batchAsync<T>(iter: AsyncIterable<T>, size: number): AsyncGenerator<T[]> {
  let batch: T[] = [];
  for await (const item of iter) {
    batch.push(item);
    if (batch.length >= size) {
      yield batch;
      batch = [];
    }
  }
  if (batch.length > 0) yield batch;
}
