import { load, type Store } from "@tauri-apps/plugin-store";

// What the tray title shows. Mirrors the Rust match in src-tauri/src/lib.rs.
export type TrayMetric = "today" | "week" | "month" | "burnRate";

// Revalidation cadence in seconds; 0 means manual (no auto-refresh).
export type FetchInterval = 0 | 15 | 30 | 60;

// All user-editable preferences, persisted as one versioned object.
export type Settings = {
  schemaVersion: number;
  // General — budgets (USD; 0 = off)
  budgetDaily: number;
  budgetMonthly: number;
  // Notifications
  alertsEnabled: boolean;
  thresholds: number[]; // budget % levels that fire an alert, e.g. [80, 100]
  dailySummaryEnabled: boolean;
  costSpikeEnabled: boolean;
  // Tray
  trayMetric: TrayMetric;
  // Data
  fetchIntervalSec: FetchInterval;
  pauseWhenHidden: boolean;
};

export const SCHEMA_VERSION = 2;

export const DEFAULT_SETTINGS: Settings = {
  schemaVersion: SCHEMA_VERSION,
  budgetDaily: 0,
  budgetMonthly: 0,
  alertsEnabled: true,
  thresholds: [80, 100],
  dailySummaryEnabled: true,
  costSpikeEnabled: true,
  trayMetric: "today",
  fetchIntervalSec: 30,
  pauseWhenHidden: false,
};

// Internal de-dup state so a threshold/summary/spike only notifies once per period.
export type NotifState = {
  dayKey: string;
  dailyThreshold: number; // highest % already notified today
  monthKey: string;
  monthlyThreshold: number;
  lastSummaryDate: string;
  lastSpikeDate: string;
};

export const EMPTY_NOTIF_STATE: NotifState = {
  dayKey: "",
  dailyThreshold: 0,
  monthKey: "",
  monthlyThreshold: 0,
  lastSummaryDate: "",
  lastSpikeDate: "",
};

let storePromise: Promise<Store> | null = null;
function getStore(): Promise<Store> {
  return (storePromise ??= load("agentmeter.json"));
}

// Spreading DEFAULT_SETTINGS over the stored object migrates any older shape
// (e.g. the budget-only v1) by filling in new fields without losing saved values.
export async function loadSettings(): Promise<Settings> {
  const s = await getStore();
  const stored = (await s.get<Partial<Settings>>("settings")) ?? {};
  return { ...DEFAULT_SETTINGS, ...stored, schemaVersion: SCHEMA_VERSION };
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
