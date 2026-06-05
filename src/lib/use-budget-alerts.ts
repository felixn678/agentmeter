import { useEffect } from "react";
import type { Reports } from "./use-usage-reports";
import { localDateOf, todayLocalDate } from "./today";
import { evaluate } from "./budget";
import { trendVsAverage } from "./trend";
import { notify } from "./notifications";
import { loadNotifState, saveNotifState, type Settings } from "./settings";

const SPIKE_FACTOR = 2; // today's cost >= 2x the recent average counts as a spike
const SPIKE_MIN_USD = 1; // ignore "spikes" on trivial absolute spend (avoids noise)

// Runs on every data update (the revalidation tick): evaluates budget thresholds,
// daily summary, and cost spikes, then fires OS notifications — de-duped via the
// persisted notif state. Settings come from the live app config (no extra disk read).
export function useBudgetAlerts(reports: Reports, settings: Settings) {
  const daily = reports.daily;
  const monthly = reports.monthly;

  useEffect(() => {
    if (!daily) return;
    if (!settings.alertsEnabled && !settings.dailySummaryEnabled && !settings.costSpikeEnabled) {
      return;
    }
    let cancelled = false;

    (async () => {
      const today = todayLocalDate();
      const todaySpend = daily.entries.find((e) => e.period === today)?.totalCost ?? 0;

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yKey = localDateOf(yesterday);
      const yesterdaySpend = daily.entries.find((e) => e.period === yKey)?.totalCost ?? 0;

      const monthEntries = monthly?.entries ?? [];
      const monthSpend = monthEntries.length ? monthEntries[monthEntries.length - 1].totalCost : 0;

      // Spike = today (the latest day) is at least SPIKE_FACTOR above the prior 7-day
      // average. Only trust the trend when today is actually the latest entry, and
      // require a non-trivial absolute spend so micro-amounts don't trip an alert.
      const todayIsLatest = daily.entries[daily.entries.length - 1]?.period === today;
      const trend = trendVsAverage(daily.entries, 7);
      const costSpike =
        todayIsLatest &&
        todaySpend >= SPIKE_MIN_USD &&
        trend !== null &&
        trend.dir === "up" &&
        trend.pct >= (SPIKE_FACTOR - 1) * 100;

      const state = await loadNotifState();
      const { notifications, state: nextState } = evaluate(settings, state, {
        todaySpend,
        monthSpend,
        yesterdaySpend,
        costSpike,
        now: new Date(),
      });

      if (cancelled) return;
      for (const n of notifications) {
        await notify(n.title, n.body);
      }
      await saveNotifState(nextState);
    })();

    return () => {
      cancelled = true;
    };
  }, [daily, monthly, settings]);
}
