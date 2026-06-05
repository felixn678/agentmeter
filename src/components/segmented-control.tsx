import { VIEWS, VIEW_LABELS, type View } from "../lib/usage-types";

// Today/Day/Week/Month control with an animated sliding pill (equal-width cells, no Radix).
export function SegmentedControl({
  value,
  onChange,
}: {
  value: View;
  onChange: (v: View) => void;
}) {
  const index = VIEWS.indexOf(value);
  return (
    <div
      className="relative grid w-[236px] grid-cols-4 rounded-[9px] bg-inset p-[3px]"
      role="tablist"
      aria-label="Time range"
    >
      <div
        className="pointer-events-none absolute top-[3px] bottom-[3px] left-[3px] w-[calc((100%-6px)/4)] rounded-[7px] bg-surface shadow-[var(--shadow)] transition-transform duration-[250ms] ease-[cubic-bezier(0.32,0.72,0,1)]"
        style={{ transform: `translateX(calc(${index} * 100%))` }}
      />
      {VIEWS.map((v) => (
        <button
          key={v}
          role="tab"
          aria-selected={v === value}
          onClick={() => onChange(v)}
          className="relative z-10 cursor-pointer rounded-[7px] py-1.5 text-center text-[13px] font-semibold text-muted transition-colors duration-200 hover:text-fg aria-selected:text-fg focus-visible:outline-2 focus-visible:outline-accent"
        >
          {VIEW_LABELS[v]}
        </button>
      ))}
    </div>
  );
}
