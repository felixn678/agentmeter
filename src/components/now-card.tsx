import type { ActiveBlock } from "../lib/usage-types";
import { fmtUsd } from "../lib/format";

function fmtRemaining(minutes: number): string {
  if (minutes <= 0) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// Live burn rate for the current 5-hour billing block.
export function NowCard({ block }: { block: ActiveBlock }) {
  return (
    <div className="rounded-[14px] border border-border bg-surface px-[18px] py-4 shadow-[var(--shadow)]">
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" />
            <span className="inline-flex h-1.5 w-1.5 rounded-full bg-accent" />
          </span>
          Now · this 5h block
        </span>
        <span className="text-[11px] text-subtle tabular-nums">{fmtRemaining(block.remainingMinutes)} left</span>
      </div>
      <div className="mt-1.5 flex items-end justify-between gap-3">
        <div className="flex items-baseline gap-2">
          <span className="text-[26px] font-bold leading-none tracking-[-0.02em] tabular-nums">
            {fmtUsd(block.costUsd)}
          </span>
          <span className="text-sm font-semibold text-accent tabular-nums">
            {fmtUsd(block.costPerHour)}/hr
          </span>
        </div>
        <span className="text-[11px] text-subtle tabular-nums">
          ~{fmtUsd(block.projectedCost)} projected
        </span>
      </div>
    </div>
  );
}
