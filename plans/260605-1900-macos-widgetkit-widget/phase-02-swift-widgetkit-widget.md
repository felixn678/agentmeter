---
phase: 2
title: Swift WidgetKit Widget
status: completed
priority: P2
effort: 1-2d
dependencies:
  - 1
---

# Phase 2: Swift WidgetKit Widget

## Context Links
- Research: `../reports/researcher-260605-1904-appgroup-widgetkit-datasharing-report.md` (§4 SwiftUI skeleton)
- Depends on: Phase 1 snapshot schema + App Group path

## Overview
The Swift/SwiftUI WidgetKit extension: a `TimelineProvider` that reads the Phase-1
snapshot from the App Group container and renders `systemSmall` + `systemMedium`
widgets. **Mac-only — cannot be built or run on this Linux machine.** All steps below
are Mac/Xcode commands the user runs.

## Key Insights
- Widget runs sandboxed; for the MVP it reads from **its OWN container** (no App Group):
  `FileManager.default.url(for: .applicationSupportDirectory, in: .userDomainMask)` →
  resolves to `~/Library/Containers/com.agentmeter.app.widget/Data/Library/Application Support/`.
  The Phase-1 Rust writer targets that exact path. (Avoids the free-team App Group
  team-id-prefix bug — red-team blocker.)
- Must be code-signed with a **real signature to load**: the free-team **"Apple
  Development" managed cert** (Xcode automatic signing), **NOT ad-hoc `-`** (PlugInKit
  rejects ad-hoc → widget never appears). Unsigned = no widget.
- Keep it a pure renderer — decode the snapshot, show numbers; never compute.
- No App Group entitlement needed for the MVP — only `com.apple.security.app-sandbox`.

## Requirements
- Functional: small widget = today's cost + trend arrow; medium = today + week +
  month + burn rate `$/hr`. Light/dark via `@Environment(\.colorScheme)`. Orange accent
  matching the app (`#ff7a00` / `#ff9f0a`).
- Non-functional: macOS 11+ deployment target; no third-party Swift deps; English
  strings; matches the app's visual identity (rounded card, tabular numbers).

## Architecture
**Directory** `src-tauri/macos-widget/` (per the original phase-04 split):
- `AgentmeterWidget.xcodeproj` — minimal Xcode project, ONE Widget Extension target.
- `Sources/Snapshot.swift` — `Codable` mirror of the Phase-1 `WidgetSnapshot` schema.
- `Sources/Provider.swift` — `TimelineProvider`: read App Group file → decode → build
  `Timeline(entries:[entry], policy: .after(now + 15min))`.
- `Sources/AgentmeterWidget.swift` — `@main` widget, `WidgetConfiguration`,
  `.supportedFamilies([.systemSmall, .systemMedium])`.
- `Sources/Views.swift` — SwiftUI views per family.
- `Info.plist` — `NSExtension` → `com.apple.widgetkit-extension`.
- `AgentmeterWidget.entitlements` — `com.apple.security.app-sandbox = true` only (no
  App Group for the MVP).
- `README.md` + `README-vi.md` — build/install steps.

**TimelineProvider skeleton** (reads the widget's OWN container — no App Group):
```swift
struct Provider: TimelineProvider {
  func placeholder(in: Context) -> Entry { .preview }
  func getSnapshot(in: Context, completion: @escaping (Entry) -> Void) { completion(load()) }
  func getTimeline(in: Context, completion: @escaping (Timeline<Entry>) -> Void) {
    let next = Calendar.current.date(byAdding: .minute, value: 15, to: Date())!
    completion(Timeline(entries: [load()], policy: .after(next)))
  }
  private func load() -> Entry {
    guard let support = try? FileManager.default.url(
            for: .applicationSupportDirectory, in: .userDomainMask,
            appropriateFor: nil, create: false),
          case let url = support.appendingPathComponent("agentmeter/snapshot.json"),
          let data = try? Data(contentsOf: url),
          let snap = try? JSONDecoder().decode(WidgetSnapshot.self, from: data)
    else { return .empty }
    return Entry(date: Date(), snap: snap)
  }
}
```

## Related Code Files
- Create: everything under `src-tauri/macos-widget/` (Xcode project + Swift sources +
  Info.plist + entitlements + README/README-vi).
- Read: Phase-1 `WidgetSnapshot` schema (`shared/SCHEMA.md`), app accent colors
  (`src/index.css`).

## Implementation Steps (Mac)
1. In Xcode: new project → add a **Widget Extension** target; set deployment target
   macOS 11; bundle id `com.agentmeter.app.widget`; set automatic signing with your
   **free Apple ID team** (gives an "Apple Development" cert — do NOT use ad-hoc). No
   App Group capability for the MVP (sandbox only).
2. Add `Snapshot.swift` (Codable matching Phase-1 fields incl. `schemaVersion`; tolerate
   missing fields with optionals/defaults).
3. Implement `Provider` (read the widget-container snapshot, `.after(15min)` policy) +
   `Entry` with a `.preview`/`.empty` fallback for the gallery.
4. Build the two SwiftUI views (small, medium) with light/dark + orange accent + tabular
   numbers; up/down/flat trend arrow.
5. Run the widget in the Xcode preview + add it from the macOS widget gallery; manually
   drop a sample `snapshot.json` into the widget's container
   (`~/Library/Containers/com.agentmeter.app.widget/Data/Library/Application Support/agentmeter/`)
   to verify rendering before Phase 1 is wired end-to-end.
6. Write `README.md` + `README-vi.md` (prerequisites: Xcode, free Apple ID; how to set
   the team/signing).

## Todo List
- [ ] Xcode widget extension target (macOS 11, free-team Apple Development signing, sandbox-only)
- [ ] `Snapshot.swift` Codable mirror
- [ ] `Provider` reads the widget-container snapshot with fallback
- [ ] small + medium SwiftUI views (light/dark, accent, trend arrow)
- [ ] Renders from a hand-placed sample snapshot
- [ ] `macos-widget/README.md` + `README-vi.md`

## Success Criteria
- [ ] Widget appears in the macOS widget gallery and can be added.
- [ ] With a sample snapshot present, small shows today $ + trend; medium shows
      today/week/month + `$/hr`.
- [ ] Light + dark both legible; numbers tabular; accent matches the app.

## Risk Assessment
- Free-team provisioning/signing expires after 7 days → widget stops loading until a
  rebuild. Acceptable for local dev; documented in README. (Paid team in Phase 4 removes
  this.)
- The widget **bundle id** (`com.agentmeter.app.widget`) must be byte-identical to the
  path the Phase-1 Rust writer targets (the container path is derived from it). Single
  source of truth: document the id + path in `shared/SCHEMA.md`.
- `.preview`/`.empty` entries must render cleanly so the gallery + first-add (before any
  snapshot exists) don't show broken/blank tiles.

## Security Considerations
- Sandboxed widget; reads only its own container snapshot. No network, no secrets.
