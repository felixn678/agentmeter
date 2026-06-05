import type { Settings } from "../../lib/settings";
import { Row, Section, Toggle } from "./settings-controls";

const PRESET_THRESHOLDS = [80, 100];

type Props = { config: Settings; update: (patch: Partial<Settings>) => void };

// Notifications category: master alerts toggle, which budget % levels fire,
// daily summary, and cost-spike alerts.
export function NotificationsSettings({ config, update }: Props) {
  const customValue = config.thresholds.find((t) => !PRESET_THRESHOLDS.includes(t)) ?? 0;

  function togglePreset(level: number) {
    const has = config.thresholds.includes(level);
    const next = has
      ? config.thresholds.filter((t) => t !== level)
      : [...config.thresholds, level];
    update({ thresholds: next });
  }

  function setCustom(value: number) {
    const presets = config.thresholds.filter((t) => PRESET_THRESHOLDS.includes(t));
    update({ thresholds: value > 0 ? [...presets, value] : presets });
  }

  return (
    <div className="flex flex-col gap-5">
      <Section title="Budget alerts">
        <Row label="Enable budget alerts" hint="Notify when spend crosses a budget level">
          <Toggle checked={config.alertsEnabled} onChange={(v) => update({ alertsEnabled: v })} />
        </Row>
        {config.alertsEnabled && (
          <div className="py-2">
            <div className="mb-2 text-[12px] text-muted">Fire at these % of budget:</div>
            <div className="flex flex-wrap items-center gap-2">
              {PRESET_THRESHOLDS.map((lvl) => {
                const on = config.thresholds.includes(lvl);
                return (
                  <button
                    key={lvl}
                    onClick={() => togglePreset(lvl)}
                    aria-pressed={on}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                      on
                        ? "border-accent bg-accent-soft text-accent"
                        : "border-border text-muted hover:text-fg"
                    }`}
                  >
                    {lvl}%
                  </button>
                );
              })}
              <div className="flex items-center gap-1 rounded-full border border-border bg-inset px-2.5 py-1 text-xs">
                <input
                  type="number"
                  min={1}
                  max={500}
                  value={customValue || ""}
                  placeholder="custom"
                  onChange={(e) => setCustom(Math.max(0, Math.min(500, Number(e.target.value) || 0)))}
                  className="w-14 bg-transparent text-right tabular-nums outline-none"
                />
                <span className="text-subtle">%</span>
              </div>
            </div>
          </div>
        )}
      </Section>

      <Section title="Other notifications">
        <Row label="Daily summary" hint="A recap of yesterday's spend each morning">
          <Toggle
            checked={config.dailySummaryEnabled}
            onChange={(v) => update({ dailySummaryEnabled: v })}
          />
        </Row>
        <Row label="Cost spike alert" hint="When today is well above your recent average">
          <Toggle
            checked={config.costSpikeEnabled}
            onChange={(v) => update({ costSpikeEnabled: v })}
          />
        </Row>
      </Section>

      <p className="text-[11px] text-subtle">All checks run locally — nothing leaves your machine.</p>
    </div>
  );
}
