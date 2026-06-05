---
phase: 1
title: Snapshot Data Bridge
status: completed
priority: P1
effort: 0.5-1d
dependencies: []
---

# Phase 1: Snapshot Data Bridge

## Context Links
- Research: `../reports/researcher-260605-1904-appgroup-widgetkit-datasharing-report.md`
- Data contract: `shared/SCHEMA.md`
- Core: `src-tauri/src/ccusage.rs`, `src-tauri/src/blocks.rs`, `src-tauri/src/lib.rs`

## Overview
The Rust core writes a small JSON **snapshot** (today/week/month cost + trend + burn
rate) into the **widget's own sandbox container** so the sandboxed widget can read it.
This is the only phase that touches shared code; it is independently shippable (an
unread snapshot file is harmless) and the bulk of it compiles/tests on Linux.

## Key Insights
- The widget cannot call `get_usage`/`get_blocks` (separate sandboxed process) → a
  file is the bridge. Reuse the data those commands already produce — do NOT change
  their contracts.
- **Bridge path (MVP) = the widget's own container, NOT an App Group** (red-team
  blocker: free-team App Group ids get a `TEAMID.` prefix the Rust side can't match).
  The non-sandboxed Tauri app writes to the widget's deterministic container:
  `~/Library/Containers/com.agentmeter.app.widget/Data/Library/Application Support/agentmeter/snapshot.json`.
  The sandboxed widget reads its own container with no entitlement. App Groups are a
  Phase-4 (paid-team) concern.
- Keep the snapshot tiny and pre-computed (the widget renders, never calculates).

## Requirements
- Functional: a `snapshot.rs` module that serializes a `WidgetSnapshot` to the App
  Group path; called after each data revalidation so the file stays current.
- Non-functional: macOS-only write (`#[cfg(target_os = "macos")]`); best-effort (a
  write failure must never crash or block the app); no new heavy deps (serde_json is
  already in tree).

## Architecture
**Snapshot schema** (camelCase JSON, mirrors `shared/SCHEMA.md` style):
```jsonc
{
  "schemaVersion": 1,
  "generatedAt": "2026-06-05T12:00:00Z", // ISO-8601 UTC
  "today":   { "cost": 7.50, "tokens": 604308 },
  "week":    { "cost": 22.0 },
  "month":   { "cost": 120.0 },
  "trend":   { "pct": 38.0, "dir": "up" },  // today vs 7-day avg; dir = up|down|flat
  "burnRate": { "costPerHour": 4.25, "active": true } // active=false when no block
}
```

**Write trigger.** The frontend already revalidates on the configured interval
(`useUsageReports`). Two options:
- **(proposed, D1)** Add a Tauri command `write_widget_snapshot(snapshot)` the
  frontend calls right after each successful load — the frontend already holds all the
  data (`reports` + `activeBlock` + `trendVsAverage`), so Rust just serializes + writes.
  This mirrors the Phase-5 `set_tray_title` pattern (DRY, no second ccusage spawn) and
  is the recommended approach.
- (alt) Rust computes the snapshot itself on a timer (re-runs ccusage) — rejected:
  duplicate ccusage spawns, same anti-pattern fixed for the tray.

**Cadence (D1).** Piggyback on the existing revalidation (every 15/30/60s or manual).
Cheap (a small file write); the widget reads at WidgetKit's own coarse pace. After
writing, the host app can later (Phase 2/3) call `WidgetCenter.reloadAllTimelines()`.

**Platform scope (D2).** Write only on macOS (`#[cfg(target_os = "macos")]`); on other
OSes the command is a no-op. GNOME is dropped, so no Linux path (YAGNI).

## Related Code Files
- Create: `src-tauri/src/snapshot.rs` (`WidgetSnapshot` struct + `write(app, snapshot)`).
- Modify: `src-tauri/src/lib.rs` (register `write_widget_snapshot` command + `mod snapshot`),
  `src/lib/widget-snapshot.ts` (new TS helper to build the snapshot payload — or inline in App),
  `src/App.tsx` (call `invoke("write_widget_snapshot", { snapshot })` in the tray-sync effect or a sibling effect),
  `shared/SCHEMA.md` (add the WidgetSnapshot section + the widget-container path + the widget bundle id).
- Read: `src/lib/tray-title.ts` (parity for "today/week/month latest bucket"), `src/lib/trend.ts`.

## Implementation Steps
1. Define `WidgetSnapshot` (+ nested structs) in `snapshot.rs` with serde camelCase;
   add `write(app, snapshot) -> ()` that resolves the widget-container path
   (`$HOME/Library/Containers/com.agentmeter.app.widget/Data/Library/Application Support/agentmeter/snapshot.json`),
   `mkdir -p`s it, and writes atomically (write temp + rename).
   `#[cfg(target_os = "macos")]`; non-macOS = no-op.
2. Add command `write_widget_snapshot(app, snapshot: WidgetSnapshot)`; register it +
   `mod snapshot` in `lib.rs`.
3. Frontend: build the snapshot from `config.trayMetric`-independent data (`reports`
   daily/weekly/monthly latest cost via the same helper logic as `tray-title.ts`,
   `trendVsAverage(daily,7)`, `activeBlock`) and `invoke("write_widget_snapshot", …)`
   after each load (guard: only when data exists, like the tray effect).
4. Document the snapshot schema + App Group path in `shared/SCHEMA.md` (+ `SCHEMA-vi.md`).
5. Compile: `cd src-tauri && cargo check`; `pnpm build`. On Linux the write is a no-op —
   verify it compiles and the command is callable without error.

## Todo List
- [ ] `snapshot.rs` with `WidgetSnapshot` + atomic macOS write
- [ ] `write_widget_snapshot` command registered
- [ ] Frontend computes + invokes snapshot write after each revalidation
- [ ] `shared/SCHEMA.md` + `SCHEMA-vi.md` updated
- [ ] `cargo check` + `pnpm build` clean; no regression to tray/dashboard

## Success Criteria
- [ ] On macOS, the widget-container `snapshot.json` exists and updates on each
      revalidation with correct values.
- [ ] On Linux, the command is a no-op; build + existing tests stay green.
- [ ] `get_usage`/`get_blocks`/`UsageReport` contracts unchanged.

## Risk Assessment
- The widget container dir may not exist until the widget is first installed/run.
  Mitigation: the non-sandboxed app `mkdir -p`s the full path before writing (it can,
  being non-sandboxed). Document the ordering (install widget once, then the app's
  writes land). Verify the widget can read a file the app created in its container
  (it can — sandbox gates by path, not by writer).
- Snapshot/tray "today" semantics must match (latest daily bucket). Reuse the same
  helper logic as `tray-title.ts` to avoid drift.
- The widget bundle id (`com.agentmeter.app.widget`) is the single source of truth for
  the container path — it MUST match the Phase-2 target's bundle id exactly. Document
  it in `shared/SCHEMA.md`.

## Security Considerations
- Snapshot stays on device (privacy-local); contains only cost numbers already shown
  in the app. No secrets.
