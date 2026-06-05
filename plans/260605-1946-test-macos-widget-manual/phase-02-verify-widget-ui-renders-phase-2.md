---
phase: 2
title: "Verify widget UI renders (Phase-2)"
status: pending
priority: P1
effort: "15-20min"
dependencies: [1]
---

# Phase 2: Verify widget UI renders

## Overview
Build the Swift widget extension via XcodeGen + xcodebuild, install it under
a host `.app` so PlugInKit discovers it, and add the widget from the macOS
gallery to confirm it renders the snapshot.

> **⚠️ macOS 15 (Sequoia) + free Apple ID — verified blocked at PlugInKit.**
> The build (Step 1-5) succeeds end-to-end and `codesign --verify --deep --strict`
> passes, but `pluginkit -m -p com.apple.widgetkit-extension` never lists
> the widget and Notification Center → Edit Widgets does not find it.
> Sequoia tightened extension-validation: PlugInKit requires the host bundle
> to clear `spctl` assessment, and a free-team `Apple Development` cert is
> `rejected` by Gatekeeper (`source=Unnotarized Developer ID`). `sudo spctl
> --master-disable` is gated behind a System Settings confirmation on Sequoia
> and even when granted is not guaranteed to satisfy PlugInKit's extension
> path. The only fully-reliable unblock is **paid Apple Developer ID +
> notarization** (Phase 4 of the widget plan). Steps 6-7 below are documented
> for completeness but expected to NOT find the widget on macOS 15 free-team.

## Prerequisites

- Phase 1 verified (snapshot file is being written).
- **macOS 14 (Sonoma) or newer** on the host machine running the widget —
  the extension uses SwiftUI's `containerBackground` which is 14+ only. The
  host Tauri app still runs on macOS 11; only the widget needs 14.
- Xcode 15+ installed, signed in to Settings → Accounts with your Apple ID.
- `xcodegen` installed: `brew install xcodegen`.

## Implementation Steps

### Step 1 — Generate the Xcode project

```sh
cd src-tauri/macos-widget
xcodegen generate
ls AgentmeterWidget.xcodeproj/project.pbxproj
```

**Expected:** `project.pbxproj` exists. XcodeGen prints `Generated project at AgentmeterWidget.xcodeproj`.

### Step 2 — Build the `.appex`

```sh
./build-appex.sh
```

**Expected last line:** `✓ Built: <path>/AgentmeterWidget.appex`.

If you see `No 'Apple Development' identity found`: open Xcode → Settings →
Accounts → click your Apple ID → **Manage Certificates** → tap `+` →
**Apple Development**, then re-run.

If `containerBackground` errors appear: confirm `project.yml` says
`deploymentTarget.macOS: "14.0"`.

### Step 3 — Build the host app + embed the widget

From the repo root:

```sh
cd ../..
pnpm widget:build:mac
```

**Expected last lines:**
```
✓ Verified: <path>/agentmeter.app
Next steps:
  cp -R "<path>/agentmeter.app" /Applications/
```

The script chains: `build-appex.sh` → `pnpm tauri build` → `embed-widget.sh`.
The last step runs `codesign --verify --deep --strict`.

### Step 4 — Install into `/Applications`

PlugInKit will not discover the widget if the host `.app` lives under
`target/`. Always copy to `/Applications/`.

```sh
APP="$(pwd)/src-tauri/target/release/bundle/macos/agentmeter.app"
# remove any previous install so codesign doesn't merge old + new bundles
rm -rf /Applications/agentmeter.app
cp -R "$APP" /Applications/
xattr -dr com.apple.quarantine /Applications/agentmeter.app
open -a /Applications/agentmeter.app
```

> **Don't install from the `.dmg` Tauri produced.** It was sealed *before*
> the embed step, so it contains the un-embedded app.

### Step 5 — Confirm the appex is discoverable by PlugInKit

```sh
pluginkit -m -p com.apple.widgetkit-extension | grep com.agentmeter
```

**Expected:** one line like
```
+    com.agentmeter.app.widget(1.0)
```

If empty: the widget extension isn't registered. Usually means the `.app`
isn't in `/Applications/` or codesign verification failed. Re-run from
step 4, or `killall cfprefsd && killall pluginkit` to flush caches.

### Step 6 — Add the widget from the gallery

1. Two-finger swipe from the right edge of the trackpad to open
   **Notification Center**.
2. Scroll to the bottom → **Edit Widgets**.
3. In the search field, type **agentmeter**.
4. Drag the **Small** or **Medium** widget into Notification Center.

(macOS 14+ Desktop widgets: right-click Desktop → **Edit Widgets** instead
of opening Notification Center.)

**Expected:**
- **Small:** today's cost ($X.XX) in the big number, brand-orange dot in the
  header, trend arrow + percentage below.
- **Medium:** same on the left, plus **Week / Month / Burn** column on the
  right. Burn shows `$X.XX/hr` or "Burn (idle)" + "—" when no active block.

### Step 7 — Confirm live updates

Edit usage (run a coding-agent CLI for a minute to bump today's cost), wait
~15 minutes for the WidgetKit timeline to refresh, and confirm the widget
picks up new numbers.

For an immediate force-refresh during testing:

```sh
# kill + relaunch the widget extension
pluginkit -e use -p com.apple.widgetkit-extension -i com.agentmeter.app.widget
```

## Success Criteria

- [ ] `xcodegen generate` produces a `.xcodeproj` without error.
- [ ] `build-appex.sh` exits 0 and prints an `.appex` path.
- [ ] `pnpm widget:build:mac` exits 0 and ends with `✓ Verified:`.
- [ ] `pluginkit -m -p com.apple.widgetkit-extension | grep com.agentmeter`
      returns the widget bundle id.
- [ ] **agentmeter** appears in the Notification Center widget gallery
      under "Edit Widgets".
- [ ] Small + Medium widget render the values from `snapshot.json` (cross-check
      with `cat .../snapshot.json | jq .today.cost`).
- [ ] Light and dark mode both legible (toggle via System Settings → Appearance).

## Common Failures + Fixes

| Symptom | Cause | Fix |
|---|---|---|
| `xcodegen: command not found` | not installed | `brew install xcodegen` |
| Build error `'containerBackground' is only available in macOS 14.0 or newer` | deployment target slipped back to 11 | edit `project.yml` → `deploymentTarget.macOS: "14.0"`; rerun `xcodegen generate` |
| Build error `requires a development team` | Xcode hasn't picked up your Apple ID | Settings → Accounts → sign in; re-run `build-appex.sh` |
| `pluginkit -m` returns nothing | `.app` is outside `/Applications/`, or codesign failed | `cp -R` to `/Applications/`; check `codesign --verify --deep --strict /Applications/agentmeter.app` |
| Widget appears blank in the gallery preview | provider's `.preview` failed (rare); usually OK after dragging in | drag it in anyway — the live entry uses `load()`, not `placeholder` |
| Widget shows zeros even after dragging in | snapshot file missing | re-do Phase 1; the widget reads its own container, so the snapshot must be present after the host app has run |
| Widget shows `—` for burn rate forever | no active ccusage block | expected when you haven't run a coding-agent CLI in the last 5 hours |
| Widget vanishes after ~7 days | free-team cert expired | re-run `pnpm widget:build:mac` to mint a new cert, then redo Step 4 |
