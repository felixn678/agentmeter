import { useState, type PointerEvent } from "react";
import type { UsageEntry } from "../../lib/usage-types";
import { fmtUsd } from "../../lib/format";
import { areaPath, linePath, toPoints } from "./chart-utils";

const W = 300;
const H = 90;

// Cost-over-time area/line chart. Hover overlay (HTML) avoids viewBox stroke distortion.
// `emphasizeLast` persistently marks the final point (used by the Today view, where the
// trend is shown as recent-days context with today highlighted).
export function CostTrendChart({
  entries,
  emphasizeLast = false,
}: {
  entries: UsageEntry[];
  emphasizeLast?: boolean;
}) {
  const [hover, setHover] = useState<number | null>(null);

  if (entries.length === 0) {
    return <p className="text-xs text-subtle">No data</p>;
  }

  const values = entries.map((e) => e.totalCost);
  const points = toPoints(values, W, H);
  const baseline = H - 8;
  const denom = Math.max(1, entries.length - 1);
  const last = entries.length - 1;

  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    setHover(Math.round(ratio * denom));
  };

  const active = hover != null ? entries[hover] : null;
  const activePt = hover != null ? points[hover] : null;
  const leftPct = hover != null ? (hover / denom) * 100 : 0;
  const showEnd = emphasizeLast && hover == null;
  const endLeftPct = (last / denom) * 100;

  return (
    <div
      className="relative h-[90px] w-full touch-none"
      onPointerMove={onMove}
      onPointerLeave={() => setHover(null)}
    >
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-full w-full">
        <defs>
          <linearGradient id="costFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaPath(points, baseline)} fill="url(#costFill)" />
        <path
          className="line-draw"
          d={linePath(points)}
          pathLength="1"
          fill="none"
          stroke="var(--accent)"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      {showEnd && (
        <>
          <div
            className="pointer-events-none absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface bg-accent"
            style={{ left: `${endLeftPct}%`, top: `${points[last].y}px` }}
          />
          <div className="pointer-events-none absolute right-0 top-0 rounded-md border border-border bg-surface px-2 py-1 text-[11px] shadow-[var(--shadow)]">
            <span className="text-subtle">Latest </span>
            <span className="font-semibold tabular-nums">{fmtUsd(entries[last].totalCost)}</span>
          </div>
        </>
      )}

      {activePt && (
        <>
          <div
            className="pointer-events-none absolute top-0 bottom-0 w-px bg-border-strong"
            style={{ left: `${leftPct}%` }}
          />
          <div
            className="pointer-events-none absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface bg-accent"
            style={{ left: `${leftPct}%`, top: `${activePt.y}px` }}
          />
        </>
      )}

      {active && (
        <div
          className="pointer-events-none absolute -top-1 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md border border-border bg-surface px-2 py-1 text-[11px] shadow-[var(--shadow)]"
          style={{ left: `${leftPct}%` }}
        >
          <div className="font-semibold tabular-nums">{fmtUsd(active.totalCost)}</div>
          <div className="text-subtle tabular-nums">{active.period}</div>
        </div>
      )}
    </div>
  );
}
