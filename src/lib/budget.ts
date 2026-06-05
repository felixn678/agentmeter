import { localDateOf } from "./today";
import type { NotifState, Settings } from "./settings";
import { fmtUsd } from "./format";

export type Notification = { title: string; body: string };

export type BudgetInputs = {
  todaySpend: number;
  monthSpend: number;
  yesterdaySpend: number | null;
  costSpike: boolean; // today's cost is well above the recent average
  now: Date;
};

const SUMMARY_HOUR = 9; // daily summary fires after 09:00 local

// Pure: given spends + settings + previous de-dup state, decide which notifications
// to fire and the new de-dup state. No side effects (caller sends + persists).
export function evaluate(
  settings: Settings,
  prev: NotifState,
  inputs: BudgetInputs,
): { notifications: Notification[]; state: NotifState } {
  const dayKey = localDateOf(inputs.now);
  const monthKey = dayKey.slice(0, 7); // YYYY-MM
  const state: NotifState = { ...prev };
  const notifications: Notification[] = [];

  // Reset per-period de-dup counters when the period rolls over.
  if (state.dayKey !== dayKey) {
    state.dayKey = dayKey;
    state.dailyThreshold = 0;
  }
  if (state.monthKey !== monthKey) {
    state.monthKey = monthKey;
    state.monthlyThreshold = 0;
  }

  if (settings.alertsEnabled) {
    const levels = [...settings.thresholds].sort((a, b) => b - a); // highest first
    crossThreshold("daily", settings.budgetDaily, inputs.todaySpend, levels, state, notifications);
    crossThreshold("monthly", settings.budgetMonthly, inputs.monthSpend, levels, state, notifications);
  }

  if (
    settings.dailySummaryEnabled &&
    inputs.now.getHours() >= SUMMARY_HOUR &&
    state.lastSummaryDate !== dayKey &&
    inputs.yesterdaySpend != null
  ) {
    notifications.push({
      title: "agentmeter — daily summary",
      body: `Yesterday you spent ${fmtUsd(inputs.yesterdaySpend)}.`,
    });
    state.lastSummaryDate = dayKey;
  }

  if (settings.costSpikeEnabled && inputs.costSpike && state.lastSpikeDate !== dayKey) {
    notifications.push({
      title: "agentmeter — cost spike",
      body: `Today's spend (${fmtUsd(inputs.todaySpend)}) is well above your recent average.`,
    });
    state.lastSpikeDate = dayKey;
  }

  return { notifications, state };
}

// Fire the highest configured threshold the spend has crossed but not yet alerted on.
// The de-dup state stores the highest % already notified, so each level fires once.
function crossThreshold(
  period: "daily" | "monthly",
  budget: number,
  spend: number,
  levels: number[],
  state: NotifState,
  out: Notification[],
): void {
  if (budget <= 0 || levels.length === 0) return;
  const key = period === "daily" ? "dailyThreshold" : "monthlyThreshold";
  const reached = state[key];
  const pct = (spend / budget) * 100;
  const label = period === "daily" ? "daily" : "monthly";

  const crossed = levels.find((lvl) => pct >= lvl && reached < lvl);
  if (crossed === undefined) return;

  if (crossed >= 100) {
    out.push({
      title: "agentmeter — budget reached",
      body: `You've hit your ${label} budget: ${fmtUsd(spend)} / ${fmtUsd(budget)}.`,
    });
  } else {
    out.push({
      title: "agentmeter — budget warning",
      body: `${Math.round(pct)}% of your ${label} budget: ${fmtUsd(spend)} / ${fmtUsd(budget)}.`,
    });
  }
  state[key] = crossed;
}
