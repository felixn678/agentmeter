import type { FetchInterval, Settings } from "../../lib/settings";
import { ChoiceGroup, Row, Section, Toggle, type Choice } from "./settings-controls";

const INTERVAL_OPTIONS: Choice<FetchInterval>[] = [
  { value: 15, label: "15s" },
  { value: 30, label: "30s" },
  { value: 60, label: "60s" },
  { value: 0, label: "Manual" },
];

type Props = {
  config: Settings;
  update: (patch: Partial<Settings>) => void;
  onRefresh: () => void;
};

// Data category: how often usage data revalidates, plus a manual refresh when auto
// is off, and whether to pause refreshing while the window is hidden.
export function DataSettings({ config, update, onRefresh }: Props) {
  const isManual = config.fetchIntervalSec === 0;

  return (
    <div className="flex flex-col gap-5">
      <Section title="Refresh">
        <Row label="Auto-refresh interval" hint="How often usage data reloads">
          <ChoiceGroup
            value={config.fetchIntervalSec}
            options={INTERVAL_OPTIONS}
            onChange={(v) => update({ fetchIntervalSec: v })}
          />
        </Row>
        {isManual && (
          <Row label="Manual mode" hint="Auto-refresh is off — reload on demand">
            <button
              onClick={onRefresh}
              className="rounded-md border border-border bg-inset px-3 py-1 text-xs font-medium text-fg transition-colors hover:border-border-strong"
            >
              Refresh now
            </button>
          </Row>
        )}
        <Row label="Pause when hidden" hint="Skip refreshing while the window is closed to the tray">
          <Toggle
            checked={config.pauseWhenHidden}
            onChange={(v) => update({ pauseWhenHidden: v })}
          />
        </Row>
      </Section>
    </div>
  );
}
