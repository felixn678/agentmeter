import { useEffect, useState, type ReactNode } from "react";
import { CloseIcon } from "../dashboard-icons";
import {
  DEFAULT_SETTINGS,
  loadSettings,
  saveSettings,
  type Settings,
} from "../lib/settings";

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between py-1.5 text-sm">
      <span>{label}</span>
      {children}
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
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

function MoneyInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
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

export function SettingsPanel({ onClose }: { onClose: () => void }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    loadSettings().then((v) => {
      setSettings(v);
      setReady(true);
    });
  }, []);

  function update(patch: Partial<Settings>) {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      void saveSettings(next);
      return next;
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-4 pt-12"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[420px] rounded-[16px] border border-border bg-surface p-5 shadow-[var(--shadow)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[15px] font-semibold">Settings</h2>
          <button
            onClick={onClose}
            aria-label="Close settings"
            className="grid h-7 w-7 place-items-center rounded-md text-muted transition-colors hover:bg-inset hover:text-fg"
          >
            <CloseIcon />
          </button>
        </div>

        {ready && (
          <div className="flex flex-col gap-5">
            <section>
              <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-subtle">
                Budget
              </h3>
              <Row label="Daily budget">
                <MoneyInput value={settings.budgetDaily} onChange={(v) => update({ budgetDaily: v })} />
              </Row>
              <Row label="Monthly budget">
                <MoneyInput
                  value={settings.budgetMonthly}
                  onChange={(v) => update({ budgetMonthly: v })}
                />
              </Row>
              <p className="mt-1 text-[11px] text-subtle">Set 0 to disable a budget.</p>
            </section>

            <section>
              <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-subtle">
                Notifications
              </h3>
              <Row label="Budget alerts (80% / 100%)">
                <Toggle
                  checked={settings.alertsEnabled}
                  onChange={(v) => update({ alertsEnabled: v })}
                />
              </Row>
              <Row label="Daily summary">
                <Toggle
                  checked={settings.dailySummaryEnabled}
                  onChange={(v) => update({ dailySummaryEnabled: v })}
                />
              </Row>
              <p className="mt-1 text-[11px] text-subtle">
                All checks run locally — nothing leaves your machine.
              </p>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
