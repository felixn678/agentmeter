// Shared formatting + model helpers used across the dashboard and charts.

export const fmtUsd = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });

export const fmtTokensFull = (n: number) => n.toLocaleString("en-US");

export const fmtTokensCompact = (n: number) =>
  Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n);

// Strip a trailing date suffix (e.g. "claude-haiku-4-5-20251001" -> "claude-haiku-4-5").
export const shortModel = (name: string) => name.replace(/-\d{6,8}$/, "");

// Stable warm-leaning dot color per model name (matches the orange accent theme).
export const MODEL_DOT_COLORS = ["#ff7a00", "#ff9f0a", "#ffcc00", "#ff6482", "#ff453a", "#bf5af2"];
export const dotColor = (name: string) => {
  const sum = [...name].reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return MODEL_DOT_COLORS[sum % MODEL_DOT_COLORS.length];
};
