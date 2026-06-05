import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import "./App.css";

// These types mirror the Rust structs in src-tauri/src/ccusage.rs (serde camelCase).
type ModelBreakdown = {
  modelName: string;
  cost: number;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
};

type UsageEntry = {
  period: string;
  agent: string;
  totalCost: number;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  modelsUsed: string[];
  modelBreakdowns: ModelBreakdown[];
};

type Totals = { totalCost: number; totalTokens: number };
type UsageReport = { entries: UsageEntry[]; totals: Totals };

type Granularity = "daily" | "weekly" | "monthly";

const GRANULARITY_LABELS: Record<Granularity, string> = {
  daily: "Day",
  weekly: "Week",
  monthly: "Month",
};

const fmtUsd = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });
const fmtTokens = (n: number) => n.toLocaleString("en-US");

function App() {
  const [granularity, setGranularity] = useState<Granularity>("daily");
  const [report, setReport] = useState<UsageReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    invoke<UsageReport>("get_usage", { granularity })
      .then((r) => !cancelled && setReport(r))
      .catch((e) => !cancelled && setError(String(e)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [granularity]);

  const entries = report ? [...report.entries].reverse() : []; // newest first

  return (
    <main className="container">
      <header className="topbar">
        <h1>agentmeter</h1>
        <div className="seg">
          {(["daily", "weekly", "monthly"] as Granularity[]).map((g) => (
            <button
              key={g}
              className={g === granularity ? "active" : ""}
              onClick={() => setGranularity(g)}
            >
              {GRANULARITY_LABELS[g]}
            </button>
          ))}
        </div>
      </header>

      {report && (
        <section className="summary">
          <div className="stat">
            <span className="label">Total cost</span>
            <span className="value">{fmtUsd(report.totals.totalCost)}</span>
          </div>
          <div className="stat">
            <span className="label">Total tokens</span>
            <span className="value">{fmtTokens(report.totals.totalTokens)}</span>
          </div>
        </section>
      )}

      {loading && <p className="muted">Running ccusage…</p>}
      {error && <p className="error">⚠ {error}</p>}

      <ul className="entries">
        {entries.map((e) => (
          <li key={e.period} className="entry">
            <div className="entry-head">
              <span className="period">{e.period}</span>
              <span className="cost">{fmtUsd(e.totalCost)}</span>
            </div>
            <div className="entry-sub muted">
              {fmtTokens(e.totalTokens)} tokens · {e.modelsUsed.join(", ") || "—"}
            </div>
            {e.modelBreakdowns.length > 1 && (
              <div className="models">
                {e.modelBreakdowns.map((m) => (
                  <div key={m.modelName} className="model-row">
                    <span>{m.modelName}</span>
                    <span>{fmtUsd(m.cost)}</span>
                  </div>
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}

export default App;
