---
title: "macOS WidgetKit Widget (free/local now, Developer ID later)"
description: "Native macOS WidgetKit widget (small+medium) fed by a Rust-written snapshot; free/local signing now, paid Developer ID distribution deferred."
status: pending
priority: P2
branch: "master"
tags: [macos, widgetkit, swift, native]
blockedBy: []
blocks: []
created: "2026-06-05T12:14:32.913Z"
createdBy: "ck:plan"
source: skill
---

# macOS WidgetKit Widget (free/local now, Developer ID later)

## Overview

A native **macOS WidgetKit** widget (systemSmall + systemMedium) showing today's
cost, the today-vs-7-day-average trend, and the live burn rate `$/hr`. The widget is
**additive and macOS-only** — it must never regress the locked core (tray, dashboard,
analytics charts, the cross-platform Tauri floating widget window, budget
notifications, auto-updater) or the Linux build.

The widget runs in its own sandboxed process and **cannot call Tauri commands**, so
the Rust core writes a small JSON **snapshot** into a shared **App Group** container;
the Swift `TimelineProvider` reads it (DRY: reuses the existing `get_usage`/
`get_blocks` data; those contracts stay unchanged).

**Signing decision (user-confirmed):** build + test for **free** on the user's own Mac
now (free Apple ID "Apple Development" cert — NOT ad-hoc; the widget reads its own
sandbox container, no App Group). Paid **Apple Developer ID ($99/yr)** distribution to
all users is captured as a **future** phase, not built now. This Linux dev machine **cannot build or run WidgetKit** — all
Phase 2-4 build/verify steps are Mac-runnable and self-contained.

Supersedes the macOS half of the engagement plan's
[phase-04-native-widgets](../260605-1240-engagement-analytics-alerts-native-widgets/phase-04-native-widgets.md);
the GNOME extension is dropped (the cross-platform Tauri widget window already covers
Linux).

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | [Snapshot Data Bridge](./phase-01-snapshot-data-bridge.md) | Pending |
| 2 | [Swift WidgetKit Widget](./phase-02-swift-widgetkit-widget.md) | Pending |
| 3 | [Bundling & Local Build](./phase-03-bundling-local-build.md) | Pending |
| 4 | [Future: Developer ID Distribution](./phase-04-future-developer-id-distribution.md) | Pending |

Phase 1 is the only phase touching shared Rust code and is independently shippable on
its own (a snapshot file with no consumer is harmless). Phases 2-3 are Mac-only and
deliver the working local widget. Phase 4 is **deferred** future work (paid signing).

## Key Decisions (from research + red-team)

- **Bridge for the MVP = the widget's OWN sandbox container, NOT an App Group.**
  Red-team blocker: under a free Apple ID team, macOS App Group ids are auto-prefixed
  with the team id (`TEAMID.group.com.agentmeter.app`), so a Rust writer hardcoding
  `group.com.agentmeter.app` would write to a path the widget can't read. Avoid the
  whole class of bug: the non-sandboxed Tauri app writes the snapshot into the widget's
  deterministic container
  `~/Library/Containers/com.agentmeter.app.widget/Data/Library/Application Support/agentmeter/snapshot.json`;
  the sandboxed widget reads its own container freely (no entitlement, no group-id
  provisioning). This is the proven `tauri-plugin-widgets` pattern. **App Groups are
  deferred to Phase 4** (clean under a paid team with a registered group id).
- **Signing for the widget to load = the free-team "Apple Development" managed cert via
  Xcode-managed signing — NOT ad-hoc `-`.** Red-team blocker: ad-hoc signatures are
  rejected by PlugInKit, so an ad-hoc widget never appears in the gallery. A proper
  (even free-team) signature is required. Unsigned/ad-hoc = no widget.
- **No cross-process refresh push for the MVP.** Skip
  `WidgetCenter.reloadAllTimelines()` (would need a Rust→Swift bridge + same-team
  signing). The widget refreshes on its own `.after(~15min)` timeline and reads
  whatever snapshot is on disk. WidgetKit budget is ~40-70 reloads/day anyway, so coarse
  refresh is expected. (reloadAllTimelines becomes an option in Phase 4.)
- **Bundling:** a minimal Xcode project at `src-tauri/macos-widget/` builds the
  `.appex` via `xcodebuild`; a post-build script embeds it into the Tauri `.app`'s
  `Contents/PlugIns/` and re-signs deep (Tauri v2 has no `afterBundleCommand`). For the
  local milestone the `.app` is run directly — **no `.dmg` re-seal needed** (the
  red-team's DMG-reseal concern belongs to Phase 4 CI).
- **Min target:** macOS 11 (Big Sur) for widgets.

## Open Decisions (need user input — see each phase)

- **D1 (Phase 1):** snapshot write cadence — piggyback on the existing 30s/configurable
  revalidation, or throttle to match WidgetKit's coarse refresh? (Plan proposes: write
  on each revalidation, cheap; the widget reads at its own pace.)
- **D2 (Phase 1):** does the snapshot writer run only on macOS, or write on all OSes to
  a per-OS path (forward-compat if a Linux consumer ever returns)? (Plan proposes:
  macOS-only `#[cfg(target_os = "macos")]` to honor YAGNI — GNOME is dropped.)
- **D3 (Phase 4, deferred):** when/if to buy the $99 Developer ID — gates distribution.

## Dependencies

- Builds on the shipped data layer (`get_usage`, `get_blocks`, `ActiveBlock`,
  `shared/SCHEMA.md`) — extends, does not change it.
- Phase 4 touches `.github/workflows/release-build.yml` + `docs/release-runbook.md`
  (current macOS bundles are intentionally unsigned).
