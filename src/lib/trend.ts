import type { UsageEntry } from "./usage-types";

export type Trend = { pct: number; dir: "up" | "down" };

// Compare the most recent period's cost to the average of the prior `window`
// periods (entries are chronological). Averaging is far more stable than
// comparing to a single previous period, which can swing wildly.
export function trendVsAverage(entries: UsageEntry[], window = 7): Trend | null {
  if (entries.length < 2) return null;
  const latest = entries[entries.length - 1].totalCost;
  const prior = entries.slice(Math.max(0, entries.length - 1 - window), entries.length - 1);
  if (prior.length === 0) return null;
  const avg = prior.reduce((sum, e) => sum + e.totalCost, 0) / prior.length;
  if (avg <= 0) return null;
  const pct = ((latest - avg) / avg) * 100;
  return { pct: Math.abs(pct), dir: latest >= avg ? "up" : "down" };
}
