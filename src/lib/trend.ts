import type { UsageEntry } from "./usage-types";

export type Trend = { pct: number; dir: "up" | "down" };

// Compare the most recent period's cost to the previous one (entries are chronological).
export function latestTrend(entries: UsageEntry[]): Trend | null {
  if (entries.length < 2) return null;
  const last = entries[entries.length - 1].totalCost;
  const prev = entries[entries.length - 2].totalCost;
  if (prev <= 0) return null;
  const pct = ((last - prev) / prev) * 100;
  return { pct: Math.abs(pct), dir: last >= prev ? "up" : "down" };
}
