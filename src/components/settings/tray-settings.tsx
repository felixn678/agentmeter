import type { Settings, TrayMetric } from "../../lib/settings";
import { ChoiceGroup, Row, Section, type Choice } from "./settings-controls";

const METRIC_OPTIONS: Choice<TrayMetric>[] = [
  { value: "today", label: "Today" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "burnRate", label: "$/hr" },
];

type Props = { config: Settings; update: (patch: Partial<Settings>) => void };

// Tray category: pick which metric the tray title shows. Changing the metric updates
// the config; the dashboard's tray-sync effect repaints the tray title from it.
export function TraySettings({ config, update }: Props) {
  function setMetric(metric: TrayMetric) {
    update({ trayMetric: metric });
  }

  return (
    <div className="flex flex-col gap-5">
      <Section title="Tray display">
        <Row label="Tray shows" hint="The number in your menu bar / system tray">
          <ChoiceGroup value={config.trayMetric} options={METRIC_OPTIONS} onChange={setMetric} />
        </Row>
      </Section>
      <p className="text-[11px] text-subtle">
        On GNOME the tray needs the AppIndicator extension to show text.
      </p>
    </div>
  );
}
