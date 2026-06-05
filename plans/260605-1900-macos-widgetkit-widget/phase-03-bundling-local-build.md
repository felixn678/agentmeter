---
phase: 3
title: Bundling & Local Build
status: completed
priority: P2
effort: 1-1.5d
dependencies:
  - 2
---

# Phase 3: Bundling & Local Build

## Context Links
- Research: `../reports/researcher-260605-1904-tauri-widgetkit-bundling-report.md`
- Depends on: Phase 2 widget target

## Overview
Embed the Phase-2 `.appex` into the Tauri-produced macOS `.app` and get a **working
widget on the user's own Mac** using **free/local signing** (ad-hoc / free Apple ID).
No CI, no paid cert — that's Phase 4. **Mac-only.**

## Key Insights
- Tauri builds the `.app` via cargo, not Xcode → the widget `.appex` must be embedded
  into `Contents/PlugIns/` and the whole `.app` re-signed *after* `tauri build`.
- Tauri v2 has `beforeBundleCommand` but **no `afterBundleCommand`** → run the embed +
  re-sign as a standalone script the user invokes after the build (wrapped in a pnpm
  script for convenience).
- The widget must be signed with the **free-team "Apple Development" cert (NOT ad-hoc
  `-`)** — PlugInKit rejects ad-hoc, so an ad-hoc widget never appears (red-team
  blocker). The whole `.app` is re-signed deep so the nested appex signature stays valid.
- **Local milestone runs the embedded `.app` DIRECTLY** (copy to `/Applications` or run
  in place) — **no `.dmg` involved**. Tauri seals the `.dmg` before our post-build embed
  runs, so a `.dmg` would contain the pre-embed app; re-sealing the dmg is a **Phase-4
  CI** concern, not needed for local use (red-team MAJOR-3).

## Requirements
- Functional: one command produces a local `.app` with the widget embedded and
  loadable; the widget shows live data from the running app.
- Non-functional: must not break the Linux/`tauri build` path (the embed script is
  macOS-only and opt-in); keep the existing unsigned distribution flow untouched.

## Architecture
- `src-tauri/macos-widget/build-appex.sh` — `xcodebuild` the widget scheme →
  `AgentmeterWidget.appex` (Release, the chosen signing identity).
- `src-tauri/macos-widget/embed-widget.sh` — copy the `.appex` into
  `<app>/Contents/PlugIns/`, then `codesign` the appex and re-`codesign --deep` the
  whole `.app` with the local identity; `codesign --verify --deep --strict` to confirm.
- `package.json` script `widget:build:mac` = build appex → `tauri build` → embed/re-sign
  the `.app` (guarded to macOS).
- Signing identity is a variable (`CODESIGN_ID`, **default = the free-team "Apple
  Development" cert**, e.g. `"Apple Development: you@email (TEAMID)"`) so Phase 4 can
  swap in `Developer ID Application` without rewriting. **Ad-hoc `-` is explicitly not
  the default** (widget would not load).

## Related Code Files
- Create: `src-tauri/macos-widget/build-appex.sh`, `src-tauri/macos-widget/embed-widget.sh`.
- Modify: `package.json` (`widget:build:mac` script), `README.md` + `README-vi.md`
  (macOS widget build prerequisites + steps), `docs/release-runbook.md` (note the manual
  embed step until Phase 4 automates it).

## Implementation Steps (Mac)
1. `build-appex.sh`: `xcodebuild -project src-tauri/macos-widget/AgentmeterWidget.xcodeproj
   -scheme AgentmeterWidget -configuration Release -derivedDataPath build CODE_SIGN_IDENTITY="$CODESIGN_ID"`
   → locate the produced `.appex`.
2. `embed-widget.sh`: copy `.appex` → `APP/Contents/PlugIns/`; `codesign --force
   --options runtime --sign "$CODESIGN_ID" <appex>`; then `codesign --force --deep --sign
   "$CODESIGN_ID" <APP>`; finally `codesign --verify --deep --strict <APP>`.
3. `package.json`: add `widget:build:mac` chaining build-appex → `pnpm tauri build` →
   embed-widget, all guarded behind a macOS check.
4. Run end-to-end: build, copy the embedded `.app` to `/Applications` (so PlugInKit
   discovers the nested widget — running from a build dir can fail discovery), launch
   the app, add the widget from the gallery, confirm it shows live
   today/week/month/burn data from Phase 1's snapshot. (Run the `.app` directly — ignore
   any `.dmg` Tauri produced; it predates the embed.)
5. Confirm the Linux/`pnpm tauri build` path is untouched (scripts are macOS-only, not
   wired into the default build).
6. Document the full local build in `macos-widget/README.md` (+ `-vi`).

## Todo List
- [ ] `build-appex.sh` (xcodebuild the widget)
- [ ] `embed-widget.sh` (embed into PlugIns + re-sign + verify)
- [ ] `widget:build:mac` pnpm script (macOS-guarded)
- [ ] End-to-end: widget loads + shows live data on the user's Mac
- [ ] Linux build path unaffected
- [ ] README/README-vi build docs

## Success Criteria
- [ ] One command on macOS produces a `.app` whose widget loads and displays live
      today/week/month/burn-rate from the running app.
- [ ] `codesign --verify --deep --strict` passes.
- [ ] `pnpm tauri build` on Linux unchanged; no regression.

## Risk Assessment
- Re-signing order matters (sign nested appex BEFORE the outer `.app`, deep). Wrong
  order → "code object is not signed at all". Script enforces order + verifies.
- Tauri may re-bundle and drop the embedded appex on a rebuild → embed is a *post*-build
  step, always run last; documented.
- **PlugInKit discovery:** the widget may not appear unless the host `.app` lives in a
  discovered location (e.g. `/Applications`); running from `target/.../bundle/` can fail.
  Mitigation: copy to `/Applications` (or `pluginkit -a` the appex) and document it.
- Free-team "Apple Development" signing (no notarization) means Gatekeeper still prompts
  on first open — acceptable for personal use; notarization is the Phase-4 boundary.

## Security Considerations
- Local-only signing; nothing distributed. No secrets in scripts (identity is a var).
