import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { MeterIcon, WarningIcon, EmptyIcon } from "./dashboard-icons";
import { Card } from "./components/ui/card";
import { Button } from "./components/ui/button";

// These types mirror the Rust structs in src-tauri/src/ccusage.rs (serde camelCase).
type ModelBreakdown = {
  modelName: string;
  cost: number;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
};

type UsageEntry = {
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

type Totals = { totalCost: number; totalTokens: number };
type UsageReport = { entries: UsageEntry[]; totals: Totals };

type Granularity = "daily" | "weekly" | "monthly";

const GRANULARITIES: Granularity[] = ["daily", "weekly", "monthly"];
const GRANULARITY_LABELS: Record<Granularity, string> = {
  daily: "Day",
  weekly: "Week",
  monthly: "Month",
};

const fmtUsd = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });
const fmtTokensFull = (n: number) => n.toLocaleString("en-US");
const fmtTokensCompact = (n: number) =>
  Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n);

// Strip a trailing date suffix (e.g. "claude-haiku-4-5-20251001" -> "claude-haiku-4-5").
const shortModel = (name: string) => name.replace(/-\d{6,8}$/, "");

// Stable muted dot color per model name.
const MODEL_DOT_COLORS = ["#0a84ff", "#30d158", "#ff9f0a", "#bf5af2", "#ff375f", "#64d2ff"];
const dotColor = (name: string) => {
  const sum = [...name].reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return MODEL_DOT_COLORS[sum % MODEL_DOT_COLORS.length];
};

function EntryRow({ entry }: { entry: UsageEntry }) {
  return (
    <li className="rounded-[11px] border border-border bg-surface px-3.5 py-3 shadow-[var(--shadow)] transition-[transform,border-color] hover:-translate-y-px hover:border-border-strong">
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
  return <span className="shimmer inline-block h-[26px] w-24 rounded-md bg-inset" />;
}

function App() {
  const [granularity, setGranularity] = useState<Granularity>("daily");
  const [report, setReport] = useState<UsageReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const entries = report ? [...report.entries].reverse() : []; // newest first
  const isEmpty = !loading && !error && report !== null && entries.length === 0;

  return (
    <main className="mx-auto max-w-[600px] px-[18px] pb-7 pt-5">
      <header className="mb-[18px] flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-accent-soft text-accent">
            <MeterIcon />
          </span>
          <h1 className="text-base font-[650] tracking-[-0.01em]">agentmeter</h1>
        </div>
        <div
          className="inline-flex gap-0.5 rounded-[9px] bg-inset p-[3px]"
          role="tablist"
          aria-label="Time range"
        >
          {GRANULARITIES.map((g) => (
            <Button
              key={g}
              variant="segment"
              role="tab"
              aria-selected={g === granularity}
              onClick={() => setGranularity(g)}
            >
              {GRANULARITY_LABELS[g]}
            </Button>
          ))}
        </div>
      </header>

      <section className="mb-5 grid grid-cols-[1.4fr_1fr] gap-3">
        <Card className="stat-hero flex flex-col gap-1.5 px-[18px] py-4">
          <span className="text-xs font-medium text-muted">Total cost</span>
          <span className="text-[32px] font-bold leading-[1.1] tracking-[-0.02em] tabular-nums">
            {report ? fmtUsd(report.totals.totalCost) : <StatSkeleton />}
          </span>
          <span className="text-[11px] text-subtle">{GRANULARITY_LABELS[granularity]} totals</span>
        </Card>
        <Card className="flex min-w-0 flex-col gap-1.5 px-[18px] py-4">
          <span className="text-xs font-medium text-muted">Total tokens</span>
          <span className="truncate text-[22px] font-bold leading-[1.1] tracking-[-0.02em] tabular-nums">
            {report ? fmtTokensFull(report.totals.totalTokens) : <StatSkeleton />}
          </span>
        </Card>
      </section>

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

      {isEmpty && (
        <div className="px-4 py-10 text-center text-subtle">
          <div className="flex justify-center">
            <EmptyIcon />
          </div>
          <p className="mb-1 mt-3 text-sm font-semibold text-muted">No usage yet</p>
          <p className="mx-auto max-w-[280px] text-[12.5px] leading-relaxed">
            Run a coding agent (Claude Code, Codex, Gemini) and your costs will show up here.
          </p>
        </div>
      )}

      {entries.length > 0 && (
        <ul className="flex flex-col gap-2">
          {entries.map((e) => (
            <EntryRow key={e.period} entry={e} />
          ))}
        </ul>
      )}
    </main>
  );
}

export default App;
