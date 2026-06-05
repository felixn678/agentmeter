import { describe, expect, it } from "vitest";
import { trayTitle } from "./tray-title";
import type { Reports } from "./use-usage-reports";
import type { ActiveBlock, UsageEntry } from "./usage-types";

const entry = (period: string, totalCost: number): UsageEntry => ({
  period,
  agent: "all",
  totalCost,
  totalTokens: 0,
  inputTokens: 0,
  outputTokens: 0,
  cacheCreationTokens: 0,
  cacheReadTokens: 0,
  modelsUsed: [],
  modelBreakdowns: [],
});

const reports: Reports = {
  daily: { entries: [entry("2026-06-04", 3), entry("2026-06-05", 7.5)], totals: { totalCost: 10.5, totalTokens: 0 } },
  weekly: { entries: [entry("2026-W22", 40), entry("2026-W23", 22)], totals: { totalCost: 62, totalTokens: 0 } },
  monthly: { entries: [entry("2026-06", 120)], totals: { totalCost: 120, totalTokens: 0 } },
};

const block: ActiveBlock = { costUsd: 5, costPerHour: 4.25, projectedCost: 9, remainingMinutes: 60 };

describe("trayTitle", () => {
  it("shows the latest daily bucket for 'today'", () => {
    expect(trayTitle("today", reports, null)).toBe("$7.50");
  });

  it("shows the latest weekly/monthly bucket", () => {
    expect(trayTitle("week", reports, null)).toBe("$22.00");
    expect(trayTitle("month", reports, null)).toBe("$120.00");
  });

  it("shows the burn rate per hour", () => {
    expect(trayTitle("burnRate", reports, block)).toBe("$4.25/hr");
  });

  it("falls back when data is missing", () => {
    expect(trayTitle("today", {}, null)).toBe("$0.00");
    expect(trayTitle("burnRate", reports, null)).toBe("$0.00/hr");
  });
});
