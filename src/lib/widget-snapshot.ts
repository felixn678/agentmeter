// Snapshot the macOS WidgetKit widget reads.
//
// Mirrors the tray-title pattern: the frontend already holds today/week/month
// reports + the active block + computed trend, so we compose the payload here
// and just ask Rust to write it. No second ccusage spawn.
//
// On non-macOS the Rust command is a no-op (see `src-tauri/src/snapshot.rs`),
// so this helper stays cross-platform.

import type { ActiveBlock, Granularity } from "./usage-types";
import type { Reports } from "./use-usage-reports";
import { trendVsAverage } from "./trend";

export type BucketCost = { cost: number; tokens?: number };
export type SnapshotTrend = { pct: number; dir: "up" | "down" | "flat" };
export type BurnRate = { costPerHour: number; active: boolean };

export type WidgetSnapshot = {
  schemaVersion: 1;
  generatedAt: string;
  today: BucketCost;
  week: BucketCost;
  month: BucketCost;
  trend: SnapshotTrend | null;
  burnRate: BurnRate;
};

function latestBucket(reports: Reports, g: Granularity): BucketCost {
  const entries = reports[g]?.entries;
  if (!entries || entries.length === 0) return { cost: 0, tokens: 0 };
  const last = entries[entries.length - 1];
  return { cost: last.totalCost, tokens: last.totalTokens };
}

export function buildWidgetSnapshot(
  reports: Reports,
  activeBlock: ActiveBlock | null,
): WidgetSnapshot {
  const daily = reports.daily?.entries ?? [];
  const baseTrend = trendVsAverage(daily, 7);
  const trend: SnapshotTrend | null =
    baseTrend == null
      ? null
      : { pct: baseTrend.pct, dir: baseTrend.pct === 0 ? "flat" : baseTrend.dir };

  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    today: latestBucket(reports, "daily"),
    week: latestBucket(reports, "weekly"),
    month: latestBucket(reports, "monthly"),
    trend,
    burnRate: {
      costPerHour: activeBlock?.costPerHour ?? 0,
      active: activeBlock !== null,
    },
  };
}
