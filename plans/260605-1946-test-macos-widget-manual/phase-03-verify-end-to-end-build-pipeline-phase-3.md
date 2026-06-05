---
phase: 3
title: "Verify end-to-end build pipeline (Phase-3)"
status: pending
priority: P2
effort: "10min"
dependencies: [1, 2]
---

# Phase 3: Verify end-to-end build pipeline

## Overview
After phase-1 + phase-2 prove the moving parts work in isolation, confirm
the full one-shot pipeline (`pnpm widget:build:mac`) is reproducible and
idempotent: re-running it on a clean tree produces a verified, embedded
`.app`, and the Linux build path is unaffected.

## Implementation Steps

### Step 1 — Reset to a clean state

```sh
# Throw away last test's build output
rm -rf src-tauri/macos-widget/AgentmeterWidget.xcodeproj
rm -rf src-tauri/macos-widget/build
rm -rf src-tauri/target/release/bundle
rm -rf /Applications/agentmeter.app
```

### Step 2 — Run the one-shot pipeline

```sh
time pnpm widget:build:mac
```

**Expected:**
- the script generates the xcodeproj, builds the appex, runs
  `pnpm tauri build` (~5–10 min cold), then embeds + re-signs the `.app`.
- final two lines:
  ```
  ✓ Verified: <path>/agentmeter.app
  Next steps:
    cp -R "<path>/agentmeter.app" /Applications/
  ```
- exit code 0.

### Step 3 — Confirm the embedded structure

```sh
APP=src-tauri/target/release/bundle/macos/agentmeter.app

# The widget extension lives in PlugIns/
ls "$APP/Contents/PlugIns"
# Expected: AgentmeterWidget.appex

# Codesign verify (the embed script also does this — re-run as a sanity check)
codesign --verify --deep --strict --verbose=2 "$APP"
# Expected: "valid on disk" + "satisfies its Designated Requirement"

# Confirm the appex bundle id
plutil -extract CFBundleIdentifier raw \
  "$APP/Contents/PlugIns/AgentmeterWidget.appex/Contents/Info.plist"
# Expected: com.agentmeter.app.widget

# Confirm widget is set up as a widgetkit extension
plutil -extract NSExtension.NSExtensionPointIdentifier raw \
  "$APP/Contents/PlugIns/AgentmeterWidget.appex/Contents/Info.plist"
# Expected: com.apple.widgetkit-extension
```

### Step 4 — Install and live-test

```sh
cp -R src-tauri/target/release/bundle/macos/agentmeter.app /Applications/
xattr -dr com.apple.quarantine /Applications/agentmeter.app
open -a /Applications/agentmeter.app
```

Confirm the host app's tray icon appears and the snapshot file is being
written (phase-1 success criteria still hold).

Then add the widget from Notification Center (phase-2 step 6).

### Step 5 — Idempotency check

Re-run the pipeline without resetting:

```sh
pnpm widget:build:mac
```

**Expected:** exits 0; output `.app` is structurally identical (the appex is
re-embedded, the app is re-signed). No `codesign` errors about double-signing.

### Step 6 — Confirm Linux build path is untouched

On any Linux box (or in a Linux container if you only have a Mac):

```sh
pnpm tauri build
```

**Expected:** the build succeeds as before; `src-tauri/macos-widget/` is
present in the repo but completely ignored by `tauri build`. No reference
to it in the Cargo build graph.

For an additional cross-OS sanity check:

```sh
pnpm widget:build:mac
# Expected on Linux: "widget:build:mac is macOS-only" + exit 1
```

## Success Criteria

- [ ] Cold one-shot run completes in <15 min and ends with `✓ Verified:`.
- [ ] `Contents/PlugIns/AgentmeterWidget.appex` exists.
- [ ] `codesign --verify --deep --strict` exits 0.
- [ ] `plutil -extract CFBundleIdentifier ...` returns `com.agentmeter.app.widget`.
- [ ] Widget renders snapshot data after install (phase-2 success holds).
- [ ] Re-running the pipeline is idempotent.
- [ ] Linux `pnpm tauri build` still works; `pnpm widget:build:mac` errors
      cleanly on Linux.

## Common Failures + Fixes

| Symptom | Cause | Fix |
|---|---|---|
| `pnpm tauri build` fails on the ccusage sidecar step | binaries not fetched | `bash scripts/fetch-ccusage-sidecars.sh` then retry |
| `codesign --verify` reports "code object is not signed at all" | embed script ran but signing order was wrong | re-run the pipeline; the script signs nested appex first, then `--deep` the outer .app |
| `codesign --verify` reports "resource fork… not allowed" | leftover `.DS_Store` or finder metadata | `xattr -cr` the app dir and re-run from step 1 |
| Embed step says `Could not locate agentmeter.app` | `pnpm tauri build` didn't produce a bundle (Tauri target unset?) | check `pnpm tauri build` output; verify `target/release/bundle/macos/` has the `.app` |
| Re-run errors with `existing identity already signed` | previous codesign metadata stuck | `rm -rf "$APP"` and re-run; codesign rejects re-signing under certain modes |
| `pnpm widget:build:mac` says "macOS-only" on Mac | shell is not `sh`-compatible (e.g. fish set as the npm shell) | run `bash src-tauri/macos-widget/build-appex.sh && pnpm tauri build && bash src-tauri/macos-widget/embed-widget.sh` directly |
| Linux `pnpm tauri build` fails after the widget commits | unexpected regression | check `git log` — only `package.json`, `.gitignore`, and `src-tauri/macos-widget/` should differ from before; nothing else should affect Linux |

## Pointers

- Widget README: [src-tauri/macos-widget/README.md](../../src-tauri/macos-widget/README.md)
- Snapshot schema: [shared/SCHEMA.md → WidgetSnapshot](../../shared/SCHEMA.md)
- Widget plan: [../260605-1900-macos-widgetkit-widget/plan.md](../260605-1900-macos-widgetkit-widget/plan.md)
