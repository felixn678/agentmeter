import type { Reports } from "./use-usage-reports";
import type { ActiveBlock, Granularity } from "./usage-types";
import type { TrayMetric } from "./settings";
import { fmtUsd } from "./format";

// Cost of the latest bucket for a granularity (entries are chronological), or null.
function latestCost(reports: Reports, g: Granularity): number | null {
  const entries = reports[g]?.entries;
  return entries && entries.length ? entries[entries.length - 1].totalCost : null;
}

// The string shown in the tray for the chosen metric. Computed from data the
// dashboard already loaded so the tray can refresh without re-spawning ccusage.
// Mirrors the *semantics* of the Rust startup fallback in src-tauri/src/lib.rs
// (same metric + latest-bucket choice; Intl formatting adds thousands separators
// the Rust launch number lacks, so values >= $1000 reformat on the first load).
export function trayTitle(
  metric: TrayMetric,
  reports: Reports,
  activeBlock: ActiveBlock | null,
): string {
  switch (metric) {
    case "week": {
      const v = latestCost(reports, "weekly");
      return v == null ? "$0.00" : fmtUsd(v);
    }
    case "month": {
      const v = latestCost(reports, "monthly");
      return v == null ? "$0.00" : fmtUsd(v);
    }
    case "burnRate":
      return activeBlock ? `${fmtUsd(activeBlock.costPerHour)}/hr` : "$0.00/hr";
    default: {
      const v = latestCost(reports, "daily");
      return v == null ? "$0.00" : fmtUsd(v);
    }
  }
}
