import { load, type Store } from "@tauri-apps/plugin-store";

// User-editable preferences (Phase 3 = budget + notifications).
export type Settings = {
  budgetDaily: number; // USD; 0 = off
  budgetMonthly: number; // USD; 0 = off
  alertsEnabled: boolean;
  dailySummaryEnabled: boolean;
};

export const DEFAULT_SETTINGS: Settings = {
  budgetDaily: 0,
  budgetMonthly: 0,
  alertsEnabled: true,
  dailySummaryEnabled: true,
};

// Internal de-dup state so a threshold/summary only notifies once per period.
export type NotifState = {
  dayKey: string;
  dailyThreshold: number; // 0 | 80 | 100 already notified today
  monthKey: string;
  monthlyThreshold: number;
  lastSummaryDate: string;
};

export const EMPTY_NOTIF_STATE: NotifState = {
  dayKey: "",
  dailyThreshold: 0,
  monthKey: "",
  monthlyThreshold: 0,
  lastSummaryDate: "",
};

let storePromise: Promise<Store> | null = null;
function getStore(): Promise<Store> {
  return (storePromise ??= load("agentmeter.json"));
}

export async function loadSettings(): Promise<Settings> {
  const s = await getStore();
  return { ...DEFAULT_SETTINGS, ...(await s.get<Partial<Settings>>("settings")) };
}

export async function saveSettings(value: Settings): Promise<void> {
  const s = await getStore();
  await s.set("settings", value);
  await s.save();
}

export async function loadNotifState(): Promise<NotifState> {
  const s = await getStore();
  return { ...EMPTY_NOTIF_STATE, ...(await s.get<Partial<NotifState>>("notifState")) };
}

export async function saveNotifState(value: NotifState): Promise<void> {
  const s = await getStore();
  await s.set("notifState", value);
  await s.save();
}
