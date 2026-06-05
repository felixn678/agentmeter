# Data contract

> 🌐 Tiếng Việt: [SCHEMA-vi.md](SCHEMA-vi.md)

Every agentmeter UI — tray, dashboard, and (later phases) the native widgets on
macOS/GNOME — consumes the **same** data structure described here. The source of
truth is the Rust structs in [`../src-tauri/src/ccusage.rs`](../src-tauri/src/ccusage.rs);
this file just restates it so non-Rust components (Swift, GJS) can follow along.

Serde serializes to **camelCase** JSON.

## UsageReport

```jsonc
{
  "entries": [ UsageEntry, ... ],  // ascending chronological order
  "totals":  Totals
}
```

## UsageEntry

```jsonc
{
  "period": "2026-06-05",          // period label (day | week | month)
  "agent": "all",                  // "all" or an agent name
  "totalCost": 1.0424905,          // USD
  "totalTokens": 604308,
  "inputTokens": 7898,
  "outputTokens": 21839,
  "cacheCreationTokens": 29520,
  "cacheReadTokens": 545051,
  "modelsUsed": ["claude-opus-4-8"],
  "modelBreakdowns": [ ModelBreakdown, ... ]
}
```

## ModelBreakdown

```jsonc
{
  "modelName": "claude-opus-4-8",
  "cost": 1.0424905,
  "inputTokens": 7898,
  "outputTokens": 21839,
  "cacheCreationTokens": 29520,
  "cacheReadTokens": 545051
}
```

## Totals

```jsonc
{
  "totalCost": 16.214109,
  "totalTokens": 16058796,
  "inputTokens": 15849,
  "outputTokens": 206032,
  "cacheCreationTokens": 533149,
  "cacheReadTokens": 15303766
}
```

## Note for native widgets (Phase 4)

Native widgets do NOT call ccusage directly. The Rust core periodically computes
and writes a JSON snapshot (using the schema above) to the OS standard location
(e.g. `~/.local/state/agentmeter/latest.json` on Linux, an App Group container on
macOS); the widget only reads that file. The exact path will be finalized when
Phase 4 begins.
