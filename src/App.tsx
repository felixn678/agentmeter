import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { MeterIcon, WarningIcon, EmptyIcon } from "./dashboard-icons";
import { Card } from "./components/ui/card";
import { SegmentedControl } from "./components/segmented-control";
import { CostTrendChart } from "./components/charts/cost-trend-chart";
import { ModelBreakdownChart } from "./components/charts/model-breakdown-chart";
import {
  VIEW_LABELS,
  viewGranularity,
  type View,
  type UsageEntry,
  type UsageReport,
} from "./lib/usage-types";
import { dotColor, fmtTokensCompact, fmtTokensFull, fmtUsd, shortModel } from "./lib/format";
import { useCountUp } from "./lib/use-count-up";
import { latestTrend } from "./lib/trend";
import { todayLocalDate } from "./lib/today";

function EntryRow({ entry }: { entry: UsageEntry }) {
  return (
    <li className="rounded-[11px] border border-border bg-surface px-3.5 py-3 shadow-[var(--shadow)] transition-[transform,border-color] hover:-translate-y-px hover:border-border-strong active:scale-[0.99]">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-semibold tabular-nums">{entry.period}</span>
        <span className="text-[15px] font-bold tabular-nums">{fmtUsd(entry.totalCost)}</span>
      </div>
      <div className="mt-0.5 text-xs text-subtle tabular-nums">
        {fmtTokensCompact(entry.totalTokens)} tokens
      </div>
      <div className="mt-2.5 flex flex-col gap-1.5 border-t border-border pt-2.5">
        {entry.modelBreakdowns.map((m) => (
          <div key={m.modelName} className="grid grid-cols-[auto_1fr_auto] items-center gap-2 text-xs">
            <span
              className="h-[7px] w-[7px] rounded-full"
              style={{ background: dotColor(m.modelName) }}
            />
            <span className="truncate text-muted">{shortModel(m.modelName)}</span>
            <span className="font-semibold tabular-nums text-muted">{fmtUsd(m.cost)}</span>
          </div>
        ))}
      </div>
    </li>
  );
}

function SkeletonList() {
  return (
    <ul className="flex flex-col gap-2" aria-hidden="true">
      {[0, 1, 2, 3].map((i) => (
        <li
          key={i}
          className="shimmer h-[58px] rounded-[11px] border border-border bg-surface shadow-[var(--shadow)]"
        />
      ))}
    </ul>
  );
}

function StatSkeleton() {
  return <span className="shimmer inline-block h-[28px] w-28 rounded-md bg-inset" />;
}

function EmptyState({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="px-4 py-10 text-center text-subtle">
      <div className="flex justify-center">
        <EmptyIcon />
      </div>
      <p className="mb-1 mt-3 text-sm font-semibold text-muted">{title}</p>
      <p className="mx-auto max-w-[280px] text-[12.5px] leading-relaxed">{hint}</p>
    </div>
  );
}

function App() {
  const [view, setView] = useState<View>("today");
  const [report, setReport] = useState<UsageReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Today reuses daily data, so it shares the daily fetch — keyed on granularity, not view.
  const granularity = viewGranularity(view);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    invoke<UsageReport>("get_usage", { granularity })
      .then((r) => !cancelled && setReport(r))
      .catch((e) => !cancelled && setError(String(e)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [granularity]);

  const isToday = view === "today";
  const todayEntry =
    report && isToday
      ? report.entries.find((e) => e.period === todayLocalDate()) ?? null
      : null;

  // Hero source differs per view: today's single day vs the range totals.
  const heroCost = isToday ? todayEntry?.totalCost ?? 0 : report?.totals.totalCost ?? 0;
  const heroTokens = isToday ? todayEntry?.totalTokens ?? 0 : report?.totals.totalTokens ?? 0;
  const animatedCost = useCountUp(heroCost);
  const heroSubLabel = isToday ? "Today" : `${VIEW_LABELS[view]} totals`;
  const trend = report ? latestTrend(report.entries) : null;

  // Per-view data slices.
  const donutEntries = isToday ? (todayEntry ? [todayEntry] : []) : report?.entries ?? [];
  const trendChartEntries = isToday ? report?.entries.slice(-7) ?? [] : report?.entries ?? [];
  const listEntries = isToday
    ? todayEntry
      ? [todayEntry]
      : []
    : report
      ? [...report.entries].reverse()
      : [];

  const hasContent =
    !error && report !== null && (isToday ? todayEntry !== null : report.entries.length > 0);
  const emptyToday = !loading && !error && report !== null && isToday && todayEntry === null;
  const emptyRange =
    !loading && !error && report !== null && !isToday && report.entries.length === 0;

  return (
    <main className="mx-auto max-w-[600px] px-[18px] pb-7 pt-5">
      <header className="mb-[18px] flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-accent-soft text-accent">
            <MeterIcon />
          </span>
          <h1 className="text-base font-[650] tracking-[-0.01em]">agentmeter</h1>
        </div>
        <SegmentedControl value={view} onChange={setView} />
      </header>

      <section className="mb-5 grid grid-cols-[1.4fr_1fr] gap-3">
        <Card className="stat-hero flex flex-col gap-1.5 px-[18px] py-4">
          <span className="text-xs font-medium text-muted">Total cost</span>
          <span className="text-[34px] font-bold leading-[1.05] tracking-[-0.02em] tabular-nums">
            {report ? fmtUsd(animatedCost) : <StatSkeleton />}
          </span>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-subtle">{heroSubLabel}</span>
            {trend && hasContent && (
              <span
                className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums"
                style={
                  trend.dir === "up"
                    ? { background: "var(--accent-soft)", color: "var(--accent)" }
                    : { background: "rgba(48,209,88,0.18)", color: "#22a35a" }
                }
                title={isToday ? "Today vs previous day" : `Latest ${VIEW_LABELS[view]} vs previous`}
              >
                {trend.dir === "up" ? "↑" : "↓"} {trend.pct > 999 ? "999+" : trend.pct.toFixed(0)}%
              </span>
            )}
          </div>
        </Card>
        <Card className="flex min-w-0 flex-col gap-1.5 px-[18px] py-4">
          <span className="text-xs font-medium text-muted">Total tokens</span>
          <span className="truncate text-[22px] font-bold leading-[1.1] tracking-[-0.02em] tabular-nums">
            {report ? fmtTokensFull(heroTokens) : <StatSkeleton />}
          </span>
        </Card>
      </section>

      {hasContent && (
        <section className="mb-5 flex flex-col gap-3">
          <Card className="px-4 py-4">
            <div className="mb-2 text-xs font-medium text-muted">
              {isToday ? "Cost trend · last 7 days" : "Cost trend"}
            </div>
            <CostTrendChart key={view} entries={trendChartEntries} emphasizeLast={isToday} />
          </Card>
          <Card className="px-4 py-4">
            <div className="mb-3 text-xs font-medium text-muted">By model</div>
            <ModelBreakdownChart entries={donutEntries} />
          </Card>
        </section>
      )}

      {error && (
        <Card
          className="flex gap-2.5 border-[color-mix(in_srgb,var(--danger)_28%,transparent)] bg-danger-soft px-3.5 py-3 text-danger"
          role="alert"
        >
          <WarningIcon />
          <div>
            <strong className="text-[13px]">Couldn't load usage</strong>
            <p className="mt-0.5 break-words text-xs text-muted">{error}</p>
          </div>
        </Card>
      )}

      {loading && !report && <SkeletonList />}

      {emptyToday && (
        <EmptyState
          title="No usage today yet"
          hint="Run a coding agent (Claude Code, Codex, Gemini) and today's cost will show up here."
        />
      )}
      {emptyRange && (
        <EmptyState
          title="No usage yet"
          hint="Run a coding agent (Claude Code, Codex, Gemini) and your costs will show up here."
        />
      )}

      {hasContent && (
        <ul className="flex flex-col gap-2">
          {listEntries.map((e) => (
            <EntryRow key={e.period} entry={e} />
          ))}
        </ul>
      )}
    </main>
  );
}

export default App;
