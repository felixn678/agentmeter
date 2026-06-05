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

## WidgetSnapshot (macOS WidgetKit bridge)

Native widgets do NOT call ccusage directly — they live in a separate
sandboxed process. The Tauri app writes a small precomputed snapshot file the
widget reads. Schema:

```jsonc
{
  "schemaVersion": 1,
  "generatedAt": "2026-06-05T12:00:00Z",   // ISO-8601 UTC
  "today":   { "cost": 7.50, "tokens": 604308 },
  "week":    { "cost": 22.0, "tokens": 4231590 },
  "month":   { "cost": 120.0, "tokens": 19284731 },
  "trend":   { "pct": 38.0, "dir": "up" }, // today vs 7-day avg; dir = up|down|flat; null when n<2 days
  "burnRate": { "costPerHour": 4.25, "active": true }
}
```

**Source of truth:** the Rust struct in
[`../src-tauri/src/snapshot.rs`](../src-tauri/src/snapshot.rs); the frontend
helper in `src/lib/widget-snapshot.ts` mirrors it. Writes are atomic
(`snapshot.json.tmp` → rename).

### Bridge path (macOS, MVP)

```
~/Library/Containers/com.agentmeter.app.widget/Data/Library/Application Support/agentmeter/snapshot.json
```

- Widget bundle id: **`com.agentmeter.app.widget`** — single source of truth
  for the path; the Phase-2 Xcode target must use this exact id.
- The non-sandboxed Tauri app `mkdir -p`s the container path (it can; only the
  widget is sandboxed). If the widget extension has not been installed yet, the
  app's write still lands so the first widget timeline reload finds the file.
- The sandboxed widget reads its **own** container freely — no entitlement, no
  App Group provisioning, no Apple Developer team prefix mismatch.

App Groups (a portable `group.com.agentmeter.shared` container with explicit
entitlements) are deferred to the paid-Developer-ID phase; free Apple teams
auto-prefix App Group ids with the team id, which a Rust writer using a fixed
id cannot match.

### Linux / Windows

The Rust command compiles cross-platform but the write is a no-op outside
macOS (`#[cfg(target_os = "macos")]`). The cross-platform floating widget
window in the Tauri app already covers Linux; GNOME extension is dropped.
