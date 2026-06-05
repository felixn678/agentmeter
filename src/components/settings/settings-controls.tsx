import type { ReactNode } from "react";

// Shared primitives for the settings screens, kept on-theme with the dashboard.

export function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2 text-sm">
      <div className="min-w-0">
        <div>{label}</div>
        {hint && <div className="mt-0.5 text-[11px] text-subtle">{hint}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative h-[22px] w-[38px] shrink-0 rounded-full transition-colors ${
        checked ? "bg-accent" : "bg-inset"
      }`}
    >
      <span
        className={`absolute top-[2px] h-[18px] w-[18px] rounded-full bg-surface shadow-[var(--shadow)] transition-transform ${
          checked ? "translate-x-[18px]" : "translate-x-[2px]"
        }`}
      />
    </button>
  );
}

export function MoneyInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-1 rounded-md border border-border bg-inset px-2 py-1 text-sm">
      <span className="text-subtle">$</span>
      <input
        type="number"
        min={0}
        step={1}
        value={value || ""}
        placeholder="0"
        onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
        className="w-16 bg-transparent text-right tabular-nums outline-none"
      />
    </div>
  );
}

export type Choice<T> = { value: T; label: string };

// A compact segmented picker for a small set of mutually-exclusive options.
export function ChoiceGroup<T extends string | number>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: Choice<T>[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex rounded-lg bg-inset p-0.5">
      {options.map((o) => (
        <button
          key={String(o.value)}
          onClick={() => onChange(o.value)}
          aria-pressed={o.value === value}
          className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
            o.value === value ? "bg-surface text-fg shadow-[var(--shadow)]" : "text-muted hover:text-fg"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-subtle">{title}</h3>
      <div className="divide-y divide-border">{children}</div>
    </section>
  );
}
