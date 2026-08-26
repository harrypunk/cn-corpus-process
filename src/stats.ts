/**
 * Per-source run statistics. Counts every record read, written, and dropped
 * (by reason) so cleaning rules can be audited and iterated on.
 */

import type { DropReason } from "./types.ts";

export interface SourceStats {
  read: number;
  written: number;
  dropped: Partial<Record<DropReason, number>>;
}

export class StatsCollector {
  private readonly perSource = new Map<string, SourceStats>();

  private entry(source: string): SourceStats {
    let s = this.perSource.get(source);
    if (!s) {
      s = { read: 0, written: 0, dropped: {} };
      this.perSource.set(source, s);
    }
    return s;
  }

  countRead(source: string): void {
    this.entry(source).read++;
  }

  countWritten(source: string): void {
    this.entry(source).written++;
  }

  countDropped(source: string, reason: DropReason): void {
    const s = this.entry(source);
    s.dropped[reason] = (s.dropped[reason] ?? 0) + 1;
  }

  toJSON(): Record<string, SourceStats> {
    return Object.fromEntries(this.perSource);
  }

  print(): void {
    for (const [source, s] of this.perSource) {
      const dropped = Object.entries(s.dropped)
        .map(([reason, n]) => `${reason}=${n}`)
        .join(", ");
      console.log(
        `${source.padEnd(14)} read=${s.read} written=${s.written}` +
          (dropped ? ` dropped: ${dropped}` : ""),
      );
    }
  }
}
