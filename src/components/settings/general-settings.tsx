import type { Settings } from "../../lib/settings";
import { MoneyInput, Row, Section } from "./settings-controls";

type Props = { config: Settings; update: (patch: Partial<Settings>) => void };

// General category: the daily/monthly budgets that drive the budget alerts.
export function GeneralSettings({ config, update }: Props) {
  return (
    <div className="flex flex-col gap-5">
      <Section title="Budgets">
        <Row label="Daily budget">
          <MoneyInput value={config.budgetDaily} onChange={(v) => update({ budgetDaily: v })} />
        </Row>
        <Row label="Monthly budget">
          <MoneyInput value={config.budgetMonthly} onChange={(v) => update({ budgetMonthly: v })} />
        </Row>
      </Section>
      <p className="text-[11px] text-subtle">Set 0 to disable a budget. Alerts use these in Notifications.</p>
    </div>
  );
}
