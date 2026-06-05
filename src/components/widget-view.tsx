import { invoke } from "@tauri-apps/api/core";
import { useUsageReports } from "../lib/use-usage-reports";
import { useAppConfig } from "../lib/use-app-config";
import { todayLocalDate } from "../lib/today";
import { fmtUsd } from "../lib/format";
import { trendVsAverage } from "../lib/trend";
import { CloseIcon, MeterIcon } from "../dashboard-icons";

// Compact floating widget (a separate frameless/transparent Tauri window).
// Shows just today's cost, trend vs 7-day average, and the live burn rate.
export function WidgetView() {
  const { config } = useAppConfig();
  const { reports, activeBlock } = useUsageReports({
    intervalMs: config.fetchIntervalSec * 1000,
    pauseWhenHidden: config.pauseWhenHidden,
  });
  const daily = reports.daily ?? null;
  const today = todayLocalDate();
  const todayCost = daily?.entries.find((e) => e.period === today)?.totalCost ?? 0;
  const trend = daily ? trendVsAverage(daily.entries, 7) : null;

  return (
    // Generous transparent padding around the card so the soft shadow renders fully
    // (without it, the window bounds clip the blur into a hard dark rectangle).
    <div className="flex h-screen w-screen select-none p-7">
      <div
        data-tauri-drag-region
        className="flex flex-1 cursor-default flex-col justify-between rounded-[16px] border border-border bg-surface px-4 py-3 shadow-[0_6px_22px_rgba(0,0,0,0.16)]"
      >
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted">
            <span className="text-accent">
              <MeterIcon size={13} />
            </span>
            Today
          </span>
          <button
            onClick={() => invoke("toggle_widget")}
            aria-label="Hide widget"
            className="grid h-5 w-5 place-items-center rounded text-subtle transition-colors hover:bg-inset hover:text-fg"
          >
            <CloseIcon size={13} />
          </button>
        </div>

        <div className="flex items-end justify-between gap-2">
          <span className="text-[30px] font-bold leading-none tracking-[-0.02em] tabular-nums">
            {fmtUsd(todayCost)}
          </span>
          {trend && (
            <span
              className="pb-0.5 text-[11px] font-semibold tabular-nums"
              style={{ color: trend.dir === "up" ? "var(--accent)" : "#22a35a" }}
            >
              {trend.dir === "up" ? "↑" : "↓"} {trend.pct > 999 ? "999+" : trend.pct.toFixed(0)}%
            </span>
          )}
        </div>

        <div className="text-[11px] text-subtle tabular-nums">
          {activeBlock ? `${fmtUsd(activeBlock.costPerHour)}/hr right now` : "—"}
        </div>
      </div>
    </div>
  );
}
