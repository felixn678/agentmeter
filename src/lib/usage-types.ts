// Shared usage types — mirror the Rust structs in src-tauri/src/ccusage.rs (serde camelCase).

export type ModelBreakdown = {
  modelName: string;
  cost: number;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
};

export type UsageEntry = {
  period: string;
  agent: string;
  totalCost: number;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  modelsUsed: string[];
  modelBreakdowns: ModelBreakdown[];
};

export type Totals = { totalCost: number; totalTokens: number };
export type UsageReport = { entries: UsageEntry[]; totals: Totals };

// Live burn rate for the current 5-hour billing block (from ccusage `blocks`).
export type ActiveBlock = {
  costUsd: number;
  costPerHour: number;
  projectedCost: number;
  remainingMinutes: number;
};

// Granularity = what the Rust get_usage command accepts (unchanged contract).
export type Granularity = "daily" | "weekly" | "monthly";

// View = the UI tab set. "today" is a UI-only view that reuses daily data filtered to
// the current local date; it must NOT leak into the Rust granularity.
export type View = "today" | "daily" | "weekly" | "monthly";

export const VIEWS: View[] = ["today", "daily", "weekly", "monthly"];
export const VIEW_LABELS: Record<View, string> = {
  today: "Today",
  daily: "Day",
  weekly: "Week",
  monthly: "Month",
};

// Which Rust granularity backs a given UI view.
export const viewGranularity = (view: View): Granularity =>
  view === "today" ? "daily" : view;
