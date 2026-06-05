# macOS WidgetKit Widget

> 🌐 Tiếng Việt: [README-vi.md](README-vi.md)

A native macOS WidgetKit extension (Notification Center + Desktop, small +
medium families) that renders today's cost, week/month totals, the 7-day-avg
trend, and the live burn rate from the Phase-1 snapshot file.

**Mac-only.** Cannot be built or run on Linux/Windows. The host Tauri app
itself still cross-builds; only this widget extension is macOS-bound.

## Prerequisites (one-time on your Mac)

1. **Xcode 15+** (free from the App Store).
2. **Sign in to Xcode → Settings → Accounts** with your Apple ID. A free Apple
   ID gives you an *Apple Development* managed signing cert — which is what we
   need. Ad-hoc (`-`) signing does **not** work: PlugInKit rejects it and the
   widget never appears in the gallery.
3. **XcodeGen:**
   ```sh
   brew install xcodegen
   ```
   We track `project.yml` (human-readable) instead of the generated
   `.xcodeproj`, which is regenerated on demand.

## One-shot build (recommended)

From the repo root:

```sh
pnpm widget:build:mac
```

This does, in order:
1. `xcodegen generate` (if the `.xcodeproj` is missing)
2. `xcodebuild` the widget → `AgentmeterWidget.appex`
3. `pnpm tauri build` the host app
4. Embed `.appex` into `agentmeter.app/Contents/PlugIns/` and re-sign the
   whole bundle deep
5. `codesign --verify --deep --strict` to confirm

Output: `src-tauri/target/release/bundle/macos/agentmeter.app` with the widget
embedded.

## Install + test on your Mac

```sh
# 1. Copy to /Applications so PlugInKit can discover the nested widget.
#    (Running from build dir can fail extension discovery.)
cp -R src-tauri/target/release/bundle/macos/agentmeter.app /Applications/

# 2. Launch the host app once so it starts writing the snapshot file.
open -a /Applications/agentmeter.app

# 3. Open Notification Center (two-finger swipe from the right edge) →
#    Edit Widgets → search "agentmeter" → drag systemSmall or systemMedium in.
#    Or right-click your Desktop → Edit Widgets (macOS 14+).

# 4. Inspect the snapshot file (read directly):
cat ~/Library/Containers/com.agentmeter.app.widget/Data/Library/Application\ Support/agentmeter/snapshot.json
```

## Manual step-by-step (if `pnpm widget:build:mac` fails partway)

```sh
cd src-tauri/macos-widget
xcodegen generate                 # writes AgentmeterWidget.xcodeproj
./build-appex.sh                  # writes build/.../AgentmeterWidget.appex
cd ../..
pnpm tauri build                  # writes target/release/bundle/macos/agentmeter.app
src-tauri/macos-widget/embed-widget.sh   # embeds + re-signs + verifies
```

Override the signing identity by exporting `CODESIGN_ID` before either script:

```sh
export CODESIGN_ID="Apple Development: you@example.com (TEAMID)"
```

Look up identities with `security find-identity -v -p codesigning`.

## Known caveats (free-team only)

- **macOS 15 (Sequoia) + free Apple ID = PlugInKit silently refuses to register
  the widget extension.** Verified empirically: the widget builds and signs
  cleanly, `codesign --verify --deep --strict` passes, the embedded `.app`
  copies into `/Applications/` correctly, but the widget never appears in the
  Notification Center gallery and `pluginkit -m -p com.apple.widgetkit-extension`
  doesn't list it. Sequoia tightened extension validation: PlugInKit now
  requires the widget host bundle to clear `spctl` assessment, and a free-team
  `Apple Development` cert is `rejected` by Gatekeeper because it isn't
  notarized. `sudo spctl --master-disable` is gated behind a System Settings
  confirmation on Sequoia, and even if granted is not guaranteed to satisfy
  PlugInKit's extension-specific checks. The only path that fully removes this
  block is **paid Apple Developer ID + notarization** — deferred to the
  unbuilt Phase 4 of the widget plan. The Swift + signing pipeline shipped
  here is the right code for that paid path; the gating is purely Apple's
  platform policy, not a bug in this repo.
- **Widget requires macOS 14 (Sonoma) or newer.** The host Tauri app still
  runs on macOS 11+; only the widget extension itself needs macOS 14 because
  it uses SwiftUI's `containerBackground` modifier. On macOS 11–13 the host
  app runs fine but the widget extension won't load (PlugInKit silently
  rejects).
- **Don't install from the `.dmg`.** `pnpm tauri build` runs *before* the
  embed step, so Tauri seals the `.dmg` containing the un-embedded `.app`.
  Always install the embedded `.app` from
  `src-tauri/target/release/bundle/macos/agentmeter.app` directly (copy to
  `/Applications/`).
- **7-day cert window.** Free Apple ID provisioning expires after 7 days. The
  widget stops loading after that until you rebuild. (Paid Apple Developer ID
  in Phase 4 removes this.)
- **Gatekeeper first-launch warning.** The host app is still unsigned for
  distribution; first launch needs the right-click → Open bypass (see the
  project README → "First launch on macOS").
- **No auto-refresh push from the app yet.** The widget refreshes on its own
  ~15-minute `.after()` timeline policy. WidgetKit budgets ~40-70 reloads/day
  per widget on macOS anyway, so coarse refresh is the norm.

## Layout

```
src-tauri/macos-widget/
├── project.yml                  # XcodeGen config (tracked)
├── Info.plist                   # NSExtension → com.apple.widgetkit-extension
├── AgentmeterWidget.entitlements # sandbox-only (no App Group for MVP)
├── Sources/
│   ├── Snapshot.swift           # Codable mirror of WidgetSnapshot
│   ├── Provider.swift           # TimelineProvider, reads own container
│   ├── Views.swift              # SwiftUI small + medium views
│   └── AgentmeterWidget.swift   # @main entry
├── build-appex.sh               # xcodebuild → .appex
└── embed-widget.sh              # embed into agentmeter.app + re-sign deep
```

Generated (gitignored): `AgentmeterWidget.xcodeproj/`, `build/`.

The bundle id **`com.agentmeter.app.widget`** is the single source of truth
that determines the sandbox container path the Phase-1 Rust writer targets
(see `shared/SCHEMA.md` → WidgetSnapshot).
