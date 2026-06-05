import { useState } from "react";
import { CloseIcon } from "../../dashboard-icons";
import type { Settings } from "../../lib/settings";
import { NotificationsSettings } from "./notifications-settings";
import { TraySettings } from "./tray-settings";
import { DataSettings } from "./data-settings";
import { GeneralSettings } from "./general-settings";

type Category = "general" | "notifications" | "tray" | "data";

const CATEGORIES: { id: Category; label: string }[] = [
  { id: "general", label: "General" },
  { id: "notifications", label: "Notifications" },
  { id: "tray", label: "Tray display" },
  { id: "data", label: "Data" },
];

type Props = {
  config: Settings;
  update: (patch: Partial<Settings>) => void;
  onRefresh: () => void;
  onClose: () => void;
};

// Categorized settings: a left category list + right panel, in a modal overlay.
export function SettingsHub({ config, update, onRefresh, onClose }: Props) {
  const [active, setActive] = useState<Category>("general");

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-4 pt-10"
      onClick={onClose}
    >
      <div
        className="flex h-[460px] w-full max-w-[560px] overflow-hidden rounded-[16px] border border-border bg-surface shadow-[var(--shadow)]"
        onClick={(e) => e.stopPropagation()}
      >
        <nav className="w-[150px] shrink-0 border-r border-border bg-inset/40 p-2">
          <div className="px-2 py-2 text-[11px] font-semibold uppercase tracking-wide text-subtle">
            Settings
          </div>
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              onClick={() => setActive(c.id)}
              aria-current={c.id === active}
              className={`mb-0.5 w-full rounded-lg px-3 py-2 text-left text-[13px] transition-colors ${
                c.id === active ? "bg-accent-soft font-medium text-accent" : "text-muted hover:bg-inset hover:text-fg"
              }`}
            >
              {c.label}
            </button>
          ))}
        </nav>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="text-[14px] font-semibold">
              {CATEGORIES.find((c) => c.id === active)?.label}
            </h2>
            <button
              onClick={onClose}
              aria-label="Close settings"
              className="grid h-7 w-7 place-items-center rounded-md text-muted transition-colors hover:bg-inset hover:text-fg"
            >
              <CloseIcon />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-4">
            {active === "general" && <GeneralSettings config={config} update={update} />}
            {active === "notifications" && (
              <NotificationsSettings config={config} update={update} />
            )}
            {active === "tray" && <TraySettings config={config} update={update} />}
            {active === "data" && (
              <DataSettings config={config} update={update} onRefresh={onRefresh} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
