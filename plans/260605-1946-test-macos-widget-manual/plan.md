---
title: "Manual test plan for macOS WidgetKit widget"
description: ""
status: pending
priority: P2
branch: "master"
tags: []
blockedBy: []
blocks: []
created: "2026-06-05T13:01:58.622Z"
createdBy: "ck:plan"
source: skill
---

# Manual test plan for macOS WidgetKit widget

## Overview

Step-by-step manual test runbook for the macOS WidgetKit widget shipped in
the [`260605-1900-macos-widgetkit-widget`](../260605-1900-macos-widgetkit-widget/plan.md)
plan. Run these on a Mac after `git pull`.

Order matters: phase-1 (snapshot writer) is independently verifiable without
any Swift code. phase-2 needs a built `.appex` from `pnpm widget:build:mac`.
phase-3 chains everything end-to-end.

## Prerequisites (one-time)

```sh
git pull
pnpm install
bash scripts/fetch-ccusage-sidecars.sh   # if src-tauri/binaries/ is empty
xcode-select -p                          # must print a path (Xcode CLT installed)
brew install xcodegen                    # only needed for phase-2 + 3
```

Sign in to **Xcode → Settings → Accounts** with your Apple ID before phase-2.

## Quick diagnostic flow chart

```
Widget doesn't show in gallery / shows blank
  │
  ├─ Is host app on macOS 14+?
  │   └─ no → widget extension won't load. Widget needs macOS 14+
  │            (containerBackground). Host app still runs on macOS 11.
  │
  ├─ Did you install from .dmg?
  │   └─ yes → that .dmg is pre-embed (sealed before widget was added).
  │            Re-copy the `.app` from target/release/bundle/macos/
  │            into /Applications/
  │
  ├─ Is the .app running from /Applications/?
  │   └─ no → PlugInKit discovery often fails outside /Applications/.
  │            cp -R the .app and relaunch
  │
  ├─ Is the snapshot file present?
  │   ls ~/Library/Containers/com.agentmeter.app.widget/Data/Library/Application\ Support/agentmeter/snapshot.json
  │   └─ missing → host app hasn't written yet. Open the dashboard window
  │                  so the revalidation effect fires.
  │
  ├─ Is the snapshot parseable?
  │   cat ".../snapshot.json" | jq .
  │   └─ jq error → corrupted; restart the host app to rewrite
  │
  ├─ Is the cert still valid?
  │   security find-identity -v -p codesigning | grep "Apple Development"
  │   └─ "0 valid identities" → free-team cert expired (7-day window).
  │            Re-run pnpm widget:build:mac to renew + reinstall
  │
  └─ Last resort: kill PlugInKit cache
       killall cfprefsd; pluginkit -v -m -p com.apple.widgetkit-extension
       (then re-add widget in Notification Center)
```

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | [Verify snapshot file write (Phase-1)](./phase-01-verify-snapshot-file-write-phase-1.md) | Pending |
| 2 | [Verify widget UI renders (Phase-2)](./phase-02-verify-widget-ui-renders-phase-2.md) | Pending |
| 3 | [Verify end-to-end build pipeline (Phase-3)](./phase-03-verify-end-to-end-build-pipeline-phase-3.md) | Pending |

## Dependencies

<!-- Cross-plan dependencies -->
