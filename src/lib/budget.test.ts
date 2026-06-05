import { describe, expect, it } from "vitest";
import { evaluate, type BudgetInputs } from "./budget";
import { EMPTY_NOTIF_STATE, type Settings } from "./settings";

const BASE: Settings = {
  schemaVersion: 2,
  budgetDaily: 100,
  budgetMonthly: 1000,
  alertsEnabled: true,
  thresholds: [80, 100],
  dailySummaryEnabled: false,
  costSpikeEnabled: false,
  trayMetric: "today",
  fetchIntervalSec: 30,
  pauseWhenHidden: false,
};

const inputs = (over: Partial<BudgetInputs> = {}): BudgetInputs => ({
  todaySpend: 0,
  monthSpend: 0,
  yesterdaySpend: null,
  costSpike: false,
  now: new Date(2026, 5, 5, 10, 0, 0), // 10:00, past the summary hour
  ...over,
});

describe("evaluate — budget thresholds", () => {
  it("fires the highest crossed threshold once, then de-dups", () => {
    const first = evaluate(BASE, EMPTY_NOTIF_STATE, inputs({ todaySpend: 85 }));
    expect(first.notifications).toHaveLength(1);
    expect(first.notifications[0].title).toContain("warning");
    expect(first.state.dailyThreshold).toBe(80);

    const second = evaluate(BASE, first.state, inputs({ todaySpend: 90 }));
    expect(second.notifications).toHaveLength(0); // still in the 80 band, already alerted
  });

  it("escalates to 100% when budget is reached", () => {
    const at80 = evaluate(BASE, EMPTY_NOTIF_STATE, inputs({ todaySpend: 85 }));
    const at100 = evaluate(BASE, at80.state, inputs({ todaySpend: 100 }));
    expect(at100.notifications).toHaveLength(1);
    expect(at100.notifications[0].title).toContain("reached");
    expect(at100.state.dailyThreshold).toBe(100);
  });

  it("fires only the highest level once when spend jumps past several at once", () => {
    const settings = { ...BASE, thresholds: [50, 80, 100] };
    const r = evaluate(settings, EMPTY_NOTIF_STATE, inputs({ todaySpend: 120 }));
    expect(r.notifications).toHaveLength(1); // anti-spam: not one per crossed level
    expect(r.notifications[0].title).toContain("reached");
    expect(r.state.dailyThreshold).toBe(100);
    // Lower levels are now considered already-handled.
    const again = evaluate(settings, r.state, inputs({ todaySpend: 130 }));
    expect(again.notifications).toHaveLength(0);
  });

  it("honors a custom threshold level", () => {
    const settings = { ...BASE, thresholds: [50] };
    const r = evaluate(settings, EMPTY_NOTIF_STATE, inputs({ todaySpend: 55 }));
    expect(r.notifications).toHaveLength(1);
    expect(r.state.dailyThreshold).toBe(50);
  });

  it("stays silent when alerts are disabled", () => {
    const settings = { ...BASE, alertsEnabled: false };
    const r = evaluate(settings, EMPTY_NOTIF_STATE, inputs({ todaySpend: 100 }));
    expect(r.notifications).toHaveLength(0);
  });

  it("ignores a zero (disabled) budget", () => {
    const settings = { ...BASE, budgetDaily: 0 };
    const r = evaluate(settings, EMPTY_NOTIF_STATE, inputs({ todaySpend: 999 }));
    expect(r.notifications).toHaveLength(0);
  });
});

describe("evaluate — cost spike", () => {
  it("fires once per day when enabled and spiking", () => {
    const settings = { ...BASE, alertsEnabled: false, costSpikeEnabled: true };
    const first = evaluate(settings, EMPTY_NOTIF_STATE, inputs({ costSpike: true, todaySpend: 50 }));
    expect(first.notifications.some((n) => n.title.includes("spike"))).toBe(true);

    const second = evaluate(settings, first.state, inputs({ costSpike: true, todaySpend: 60 }));
    expect(second.notifications.some((n) => n.title.includes("spike"))).toBe(false);
  });

  it("does not fire when the toggle is off", () => {
    const settings = { ...BASE, alertsEnabled: false, costSpikeEnabled: false };
    const r = evaluate(settings, EMPTY_NOTIF_STATE, inputs({ costSpike: true }));
    expect(r.notifications).toHaveLength(0);
  });
});

describe("evaluate — daily summary", () => {
  it("fires once after the summary hour when yesterday's spend is known", () => {
    const settings = { ...BASE, alertsEnabled: false, dailySummaryEnabled: true };
    const first = evaluate(settings, EMPTY_NOTIF_STATE, inputs({ yesterdaySpend: 12.5 }));
    expect(first.notifications.some((n) => n.title.includes("summary"))).toBe(true);

    const second = evaluate(settings, first.state, inputs({ yesterdaySpend: 12.5 }));
    expect(second.notifications.some((n) => n.title.includes("summary"))).toBe(false);
  });
});
