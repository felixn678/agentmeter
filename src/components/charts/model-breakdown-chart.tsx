import type { UsageEntry } from "../../lib/usage-types";
import { dotColor, fmtUsd, shortModel } from "../../lib/format";

type Slice = { name: string; cost: number };

// Aggregate $ per model across the range; bucket the long tail into "Others" (no-pie-overuse).
function aggregate(entries: UsageEntry[]): Slice[] {
  const map = new Map<string, number>();
  for (const e of entries) {
    for (const m of e.modelBreakdowns) {
      map.set(m.modelName, (map.get(m.modelName) ?? 0) + m.cost);
    }
  }
  const all = [...map.entries()]
    .map(([name, cost]) => ({ name, cost }))
    .sort((a, b) => b.cost - a.cost);
  if (all.length <= 5) return all;
  const others = all.slice(5).reduce((s, x) => s + x.cost, 0);
  return [...all.slice(0, 5), { name: "Others", cost: others }];
}

const SIZE = 120;
const R = 52;
const STROKE = 16;
const C = 2 * Math.PI * R;
const colorOf = (name: string) => (name === "Others" ? "var(--subtle)" : dotColor(name));

export function ModelBreakdownChart({ entries }: { entries: UsageEntry[] }) {
  const slices = aggregate(entries);
  const total = slices.reduce((s, x) => s + x.cost, 0);
  if (total <= 0) return <p className="text-xs text-subtle">No data</p>;

  let offset = 0;
  return (
    <div className="flex items-center gap-4">
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="shrink-0">
        <g transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}>
          {slices.map((s) => {
            const len = (s.cost / total) * C;
            const dash = -offset;
            offset += len;
            return (
              <circle
                key={s.name}
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={R}
                fill="none"
                stroke={colorOf(s.name)}
                strokeWidth={STROKE}
                strokeDasharray={`${len} ${C - len}`}
                strokeDashoffset={dash}
              >
                <title>
                  {shortModel(s.name)}: {fmtUsd(s.cost)} ({((s.cost / total) * 100).toFixed(0)}%)
                </title>
              </circle>
            );
          })}
        </g>
        <text
          x="50%"
          y="50%"
          textAnchor="middle"
          dominantBaseline="central"
          className="text-[15px] font-bold"
          style={{ fill: "var(--fg)", fontVariantNumeric: "tabular-nums" }}
        >
          {fmtUsd(total)}
        </text>
      </svg>

      <ul className="flex min-w-0 flex-col gap-1.5 text-xs">
        {slices.map((s) => (
          <li key={s.name} className="grid grid-cols-[auto_1fr_auto] items-center gap-2">
            <span
              className="h-[7px] w-[7px] shrink-0 rounded-full"
              style={{ background: colorOf(s.name) }}
            />
            <span className="truncate text-muted">{shortModel(s.name)}</span>
            <span className="font-semibold tabular-nums">
              {((s.cost / total) * 100).toFixed(0)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
