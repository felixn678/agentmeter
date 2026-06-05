import { useEffect } from "react";
import type { Reports } from "./use-usage-reports";
import { localDateOf, todayLocalDate } from "./today";
import { evaluate } from "./budget";
import { notify } from "./notifications";
import { loadNotifState, loadSettings, saveNotifState } from "./settings";

// Runs on every data update (the 30s revalidation): evaluates budget thresholds +
// daily summary and fires OS notifications, de-duped via the persisted notif state.
export function useBudgetAlerts(reports: Reports) {
  const daily = reports.daily;
  const monthly = reports.monthly;

  useEffect(() => {
    if (!daily) return;
    let cancelled = false;

    (async () => {
      const settings = await loadSettings();
      if (!settings.alertsEnabled && !settings.dailySummaryEnabled) return;

      const today = todayLocalDate();
      const todaySpend = daily.entries.find((e) => e.period === today)?.totalCost ?? 0;

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yKey = localDateOf(yesterday);
      const yesterdaySpend = daily.entries.find((e) => e.period === yKey)?.totalCost ?? 0;

      const monthEntries = monthly?.entries ?? [];
      const monthSpend = monthEntries.length ? monthEntries[monthEntries.length - 1].totalCost : 0;

      const state = await loadNotifState();
      const { notifications, state: nextState } = evaluate(settings, state, {
        todaySpend,
        monthSpend,
        yesterdaySpend,
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
  }, [daily, monthly]);
}
