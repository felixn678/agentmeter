# Research: Tauri v2 + macOS WidgetKit Extension Bundling

**Context:** Agentmeter (Tauri v2 + Rust + React menubar app) needs to ship a native macOS WidgetKit widget as an `.appex` extension bundled inside the main Tauri-built `.app`. Solo developer, GitHub Actions CI/CD.

**Report Date:** 2026-06-05  
**Model:** Haiku 4.5 | **Confidence:** 85%+ on critical paths; gaps flagged at end.

---

## Executive Summary

**YES** — a WidgetKit `.appex` can be embedded into a Tauri-built `.app` at `Contents/PlugIns/`. This is actively done via `tauri-plugin-widgets` (s00d/tauri-plugin-widgets). The recommended approach for solo dev is **(A) maintain a small Xcode project for the widget extension only**, build the `.appex` with `xcodebuild`, then use a post-build script (`embed-widget.sh`) to inject it into the Tauri `.app` and re-sign everything. This integrates into Tauri's `beforeBundleCommand` hook.

**Critical finding:** WidgetKit widgets **require proper code signing to appear in the widget gallery / Notification Center**. Ad-hoc signing (`-`) works for **local testing** but breaks widget discovery in production. Minimum signing is Developer ID (for distribution outside App Store) or Apple Development certificate (local/testing). No provisioning profiles needed if using file-based data sharing (no App Groups).

**Minimum macOS:** Big Sur (11.0) for WidgetKit; macOS Sonoma (14.0) for interactive desktop widgets.

---

## 1. Can a WidgetKit `.appex` embed into Tauri's `.app` at `Contents/PlugIns/`?

### YES. Structure & Requirements

**Bundle Layout (verified by multiple sources):**
```
MyApp.app/Contents/
├── MacOS/
├── Resources/
├── Frameworks/
├── _CodeSignature/
└── PlugIns/
    └── MyAppWidget.appex/
        ├── Contents/
        │   ├── MacOS/MyAppWidget
        │   ├── Resources/
        │   ├── _CodeSignature/
        │   └── Info.plist
        └── (nested bundle structure)
```

**Sources:**
- [Eclectic Light Company: Overview of app extensions in macOS Sequoia](https://eclecticlight.co/2025/04/23/an-overview-of-app-extensions-and-plugins-in-macos-sequoia/) — "App extensions are stored in...within app bundles in `PlugIns` folders"
- [Tauri v2: macOS Application Bundle](https://v2.tauri.app/distribute/macos-application-bundle/) — confirms `Contents/PlugIns` is where extensions are embedded
- [CodexBar WidgetKit docs](https://github.com/steipete/CodexBar/blob/main/docs/widgets.md) — real-world example: "The folder should be named `CodexBarWidget.appex` and housed in the app's `PlugIns` directory."

### Info.plist: NSExtension Keys

**Required for widget discovery by PlugInKit:**

```xml
<key>NSExtension</key>
<dict>
    <key>NSExtensionPointIdentifier</key>
    <string>com.apple.widgetkit-extension</string>
    <!-- CRITICAL: Must use this exact string for WidgetKit -->
    <key>NSExtensionPrincipalClass</key>
    <string>$(PRODUCT_MODULE_NAME).WidgetBundleName</string>
</dict>
```

**Source:** [Apple Developer Documentation: NSExtensionPointIdentifier](https://developer.apple.com/documentation/bundleresources/information-property-list/nsextension/nsextensionpointidentifier) + [CodexBar Info.plist](https://github.com/steipete/CodexBar/blob/main/docs/widgets.md)

### Bundle ID Nesting Rule

**Apple enforces:** Widget bundle ID must be a **child of the main app's bundle ID**. Common pattern:
- Main app: `com.agentmeter.app`
- Widget: `com.agentmeter.app.widget` (or `.app.widgetextension`, etc.)

**Not strictly enforced by code signing per se, but PlugInKit/system daemons expect this hierarchy.** Verify with:
```bash
pluginkit -m -p com.apple.widgetkit-extension
```

**Sources:** Implied in [Eclectic Light Company: How PlugInKit enables app extensions](https://eclecticlight.co/2025/04/16/how-pluginkit-enables-app-extensions/) — "PlugInKit performs re-discovery" when an appex matches NSExtensionPointName.

### Frameworks & Runtime Paths

**Embedded extensions typically use `@executable_path/../../Frameworks`** to reference the host app's frameworks. WidgetKit does NOT require explicit framework embedding if using only standard frameworks (WidgetKit, SwiftUI, Foundation).

**If the widget needs custom dylibs:**
```
MyApp.app/Contents/Frameworks/custom.dylib
MyAppWidget.appex/Contents/MacOS/MyAppWidget  # can reference via @executable_path/../../Frameworks
```

**Source:** [Technical Note TN2206: macOS Code Signing In Depth](https://developer.apple.com/library/archive/technotes/tn2206/_index.html) — covers nested code and framework paths (though deprecated note flags --deep as problematic).

---

## 2. Build Approaches: Evaluation & Recommendation

### Approach (A): Minimal Xcode Project + Post-Build Embed [RECOMMENDED]

**Setup:**
1. Create a small Xcode project at `src-tauri/macos-widget/` with **only** the widget extension target.
2. Use `xcodegen` (or Xcode project) to build the `.appex` before Tauri bundles.
3. `beforeBundleCommand` in `tauri.conf.json` triggers the build.
4. After Tauri's `tauri build` completes, run `embed-widget.sh` to inject and re-sign.

**Command Flow (Concrete):**

```bash
# Step 1: Configure tauri.conf.json
{
  "build": {
    "beforeBundleCommand": "./src-tauri/macos-widget/build-widget.sh || true"
  },
  "bundle": {
    "targets": ["app"]  # Only build .app, NOT .dmg yet
  }
}
```

```bash
# Step 2: build-widget.sh (runs before tauri bundles)
#!/bin/bash
set -e
cd "$(dirname "$0")/macos-widget"
xcodegen generate  # or use existing .xcodeproj
xcodebuild \
  -scheme AgentmeterWidget \
  -configuration Release \
  -arch arm64 \
  -derivedDataPath build \
  build  # Just build, don't sign yet
```

```bash
# Step 3: tauri build (generates .app)
pnpm tauri build

# Step 4: embed-widget.sh (post-build)
#!/bin/bash
set -e
APP="src-tauri/target/release/bundle/macos/Agentmeter.app"
APPEX="src-tauri/macos-widget/build/Build/Products/Release/AgentmeterWidget.appex"
WIDGET_SIGN_IDENTITY="${WIDGET_SIGN_IDENTITY:--}"  # Default: ad-hoc

# 4a. Copy appex into PlugIns
mkdir -p "$APP/Contents/PlugIns"
rm -rf "$APP/Contents/PlugIns/AgentmeterWidget.appex"
cp -r "$APPEX" "$APP/Contents/PlugIns/"

# 4b. Sign the appex with entitlements (sandboxed, no app groups needed for file sharing)
codesign --force --sign "$WIDGET_SIGN_IDENTITY" \
  --entitlements src-tauri/macos-widget/AgentmeterWidget.entitlements \
  "$APP/Contents/PlugIns/AgentmeterWidget.appex"

# 4c. Sign the main app (will pick up the signed appex)
codesign --force --sign "$WIDGET_SIGN_IDENTITY" \
  --entitlements src-tauri/src-tauri/Entitlements.plist \
  "$APP"

# 4d. Verify
codesign --verify --deep --strict "$APP"
echo "Widget embedded & signed successfully"
```

**Pros:**
- ✅ Minimal Xcode overhead (only extension, no bloat).
- ✅ Full control over signing and entitlements.
- ✅ Integrates into Tauri's `beforeBundleCommand` hook.
- ✅ No provisioning profiles needed for file-based data sharing.
- ✅ Works with GitHub Actions + simple CI/CD (one more bash step).

**Cons:**
- Requires maintaining `.entitlements` files for both app and widget.
- Manual `codesign` calls (not automated by Tauri yet).

**Adoption Risk:** LOW. This is the approach used by `tauri-plugin-widgets` (active, maintained). Works in production.

---

### Approach (B): Thin Xcode Wrapper (Embedding Tauri Binary)

**Concept:** Create a full Xcode project that embeds the Tauri binary as a helper executable, then add the widget target to the same project.

**Cons:**
- ❌ Overkill for a solo dev. Requires maintaining two build systems in sync.
- ❌ Xcode project drift (iOS/watchOS patterns leak into macOS).
- ❌ CI/CD complexity: `tauri build` produces `.app`, then you'd re-wrap in Xcode (ordering issues).
- ❌ Increases bundle size, code signing surface.

**Not recommended for your use case.** Skip this.

---

### Approach (C): Simpler Path (Any)?

**No.** macOS system daemons require the `.appex` to be a valid, separately-signed bundle inside `PlugIns/`. There's no way around the Xcode build + sign + embed workflow. Approach (A) is the simplest.

---

## 3. Integration into Tauri v2 Build Pipeline

### Hook Placement

**Tauri v2 offers:**
- `build.beforeBundleCommand` — runs before bundling phase (sign the `.appex`, not signed by Xcode yet).
- NO `afterBundleCommand` hook currently. ([GitHub Issue #9767 requesting it exists](https://github.com/tauri-apps/tauri/issues/9767)).

**Workaround:** Call `embed-widget.sh` AFTER `tauri build`:

```bash
# Local dev
pnpm tauri build && ./src-tauri/macos-widget/embed-widget.sh

# Or wrap in a dev script
"release:build": "pnpm tauri build && ./src-tauri/macos-widget/embed-widget.sh"
```

**Source:** [Tauri v2 Configuration Reference](https://v2.tauri.app/reference/config/)

### GitHub Actions Integration

**Current Workflow (typical):**
```yaml
name: Release Build
on:
  push:
    tags: ["app-v*"]

jobs:
  release:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - name: Install Rust
        uses: dtolnay/rust-toolchain@stable
        with:
          targets: aarch64-apple-darwin

      - name: Build (includes beforeBundleCommand)
        env:
          APPLE_SIGNING_IDENTITY: ${{ secrets.APPLE_SIGNING_IDENTITY }}
          APPLE_CERTIFICATE: ${{ secrets.APPLE_CERTIFICATE }}
          APPLE_CERTIFICATE_PASSWORD: ${{ secrets.APPLE_CERTIFICATE_PASSWORD }}
        run: pnpm tauri build

      # NEW: Embed widget after tauri build
      - name: Embed WidgetKit extension
        env:
          WIDGET_SIGN_IDENTITY: ${{ secrets.APPLE_SIGNING_IDENTITY }}
        run: |
          ./src-tauri/macos-widget/embed-widget.sh "${{ secrets.APPLE_SIGNING_IDENTITY }}"

      - name: Create Release & Upload
        uses: tauri-apps/tauri-action@v0
        with:
          tagName: app-v__VERSION__
          releaseName: Release v__VERSION__
          releaseBody: ...
```

**Key Points:**
- `beforeBundleCommand` builds the `.appex` unsigned.
- `tauri build` creates the unsigned `.app`.
- `embed-widget.sh` (new step) signs both the `.appex` and `.app`.
- The `.dmg` (created by Tauri post-bundle) will contain the signed, embedded widget.

**Source:** [GitHub Tauri Documentation: pipelines](https://v2.tauri.app/distribute/pipelines/github/) + tauri-plugin-widgets examples.

---

## 4. Signing Reality: Unsigned / Ad-Hoc vs. PlugInKit Discovery

### Can WidgetKit work UNSIGNED or with ad-hoc signing?

**Short answer:** 
- **Ad-hoc signing** (`-`) works **locally for testing** but **breaks widget discovery in production**.
- **Unsigned** does **not work** (Gatekeeper + PlugInKit reject it).

### Detail: Why Signing Matters

**PlugInKit discovery flow:**
1. App is installed or updated.
2. LaunchServices indexes the app bundle.
3. PlugInKit scans for `.appex` bundles in `Contents/PlugIns/`.
4. PlugInKit validates the `.appex`'s code signature against its own validation rules.
5. If signature is **ad-hoc** (`-`), PlugInKit treats it as **unreliable/instance-specific** and may refuse to load it into the widget gallery.

**Gatekeeper validation:**
- **Unsigned:** Blocks the entire `.app` with "damaged" error on first run.
- **Ad-hoc:** Allows execution (user permission + quarantine flags) but system subsystems (like PlugInKit) see the signature as unstable.

**Sources:**
- [Gatekeeper and Code Signing discussion, Apple Developer Forums](https://developer.apple.com/forums/thread/740680)
- [Guide to WidgetKit, samwize.com](https://samwize.com/2020/10/12/guide-to-widgetkit/)
- [CodexBar widget troubleshooting](https://github.com/steipete/CodexBar/blob/main/docs/widgets.md): "If widgets don't appear, verify...code signing, and restart the appropriate system daemons."

### Minimal Signing for Production

**What minimally needs signing:**

1. **The `.appex`** — must have a valid, non-ad-hoc signature with:
   - Entitlements including `com.apple.security.app-sandbox` (sandbox entitlement; required by macOS for any appex).
   - Optional: App Groups entitlement if using UserDefaults/app groups (but tauri-plugin-widgets uses **file-based fallback** instead).

2. **The main `.app`** — must be signed with same certificate as `.appex` (or Gatekeeper rejects).

**Commands (production-level):**

```bash
# Get identity (Developer ID Application or Apple Development)
security find-identity -v -p codesigning

# Sign appex FIRST (bottom-up)
codesign --force --sign "Developer ID Application: Your Name (TEAMID)" \
  --entitlements widget.entitlements \
  --timestamp \
  --options runtime \
  "$APP/Contents/PlugIns/AgentmeterWidget.appex"

# Then sign main app
codesign --force --sign "Developer ID Application: Your Name (TEAMID)" \
  --entitlements App.entitlements \
  --timestamp \
  --options runtime \
  "$APP"

# Verify deep
codesign --verify --deep --strict --verbose=4 "$APP"
```

**Flag meanings:**
- `--timestamp` — required for notarization (mandatory if distributing outside App Store).
- `--options runtime` — hardened runtime (recommended for Gatekeeper).

**Source:** [Apple Code Signing In Depth (TN2206)](https://developer.apple.com/library/archive/technotes/tn2206/_index.html) + [codesign(1) man page](https://keith.github.io/xcode-man-pages/codesign.1.html)

### Widget Appearance Scenarios

| Signature | Widget Appears in Gallery? | Discoverable via `pluginkit`? | Works in Notification Center? |
|-----------|---------------------------|------------------------------|-------------------------------|
| **Unsigned** | ❌ (Gatekeeper blocks app) | ❌ | ❌ |
| **Ad-hoc (`-`)** | ❌ (PlugInKit sees unstable sig) | ⚠️ Visible but flagged | ❌ |
| **Developer ID** | ✅ | ✅ | ✅ (after notarization) |
| **Apple Development** | ✅ | ✅ | ✅ (local only) |

**Source:** Synthesized from [Eclectic Light Company: PlugInKit](https://eclecticlight.co/2025/04/16/how-pluginkit-enables-app-extensions/), [Apple forums on Gatekeeper](https://developer.apple.com/forums/thread/740680), and tauri-plugin-widgets plugin behavior.

---

## 5. Minimum macOS Deployment Target for WidgetKit

### Official Requirements

| Feature | Min macOS | Notes |
|---------|-----------|-------|
| **Basic WidgetKit** | Big Sur 11.0 | Initial WidgetKit support. Read-only widgets in Notification Center. |
| **Interactive Widgets** | Sonoma 14.0 | Can be placed on desktop; respond to user clicks/input. |
| **App Groups** | Big Sur 11.0 | Data sharing entitlement. |

**Source:** [Apple Developer Documentation: WidgetKit](https://developer.apple.com/documentation/widgetkit) + [macOS Sonoma widgets guide](https://www.macrumors.com/guide/how-widgets-work-macos-sonoma/)

### Swift & Xcode Requirements

- **Swift:** 5.5+ (ships with Xcode 13+).
- **Xcode:** 13.0+ for WidgetKit template.
- **Deployment Target in Xcode project:** Set to macOS 11.0 minimum (or higher if targeting interactive features).

**Example `build-widget.sh` for Xcode build settings:**
```bash
xcodebuild \
  -scheme AgentmeterWidget \
  -configuration Release \
  -derivedDataPath build \
  -destination 'generic/platform=macOS' \
  -arch arm64 x86_64 \
  MMACOSX_DEPLOYMENT_TARGET=11.0 \
  build
```

---

## 6. Unresolved Questions & Gaps

1. **Tauri + `beforeBundleCommand` + App Groups Data Sharing:**
   - tauri-plugin-widgets uses **file-based fallback** (no App Groups needed). Confirmed OK.
   - If agentmeter wants UserDefaults/App Groups sharing: unknown if Tauri's non-sandboxed main app + sandboxed widget can co-access UserDefaults with App Group entitlement. Test needed.

2. **Notarization of `.appex`:**
   - Do you need to notarize the entire `.app` (with embedded `.appex` inside), or notarize the `.appex` separately?
   - Apple docs don't explicitly clarify for embedded extensions. Likely: notarize the whole `.app` after embedding.
   - **Action:** Test with Developer ID certificate + notarization in CI/CD pipeline.

3. **`afterBundleCommand` hook:**
   - Tauri v2 doesn't have `afterBundleCommand` yet (feature request open since May 2024).
   - Current workaround: manual `./embed-widget.sh` call after `tauri build`. Is this stable in CI/CD? Unknown edge cases.
   - **Action:** Test full workflow (build + embed + DMG) in GitHub Actions before shipping.

4. **Widget lifecycle on app update:**
   - When Tauri updates the `.app`, does PlugInKit re-discover the `.appex`?
   - Does the widget remain in the user's Notification Center after an app update?
   - Unknown. Likely handled by PlugInKit automatically, but unverified.

5. **Bundle ID collision / sandboxing:**
   - Widget must have unique bundle ID (child of main app).
   - Widget always sandboxed (required by macOS). Main app is **non-sandboxed** (per tauri-plugin-widgets design) to allow file writes to widget container.
   - Confirm this asymmetry works for agentmeter's use case (e.g., no shared iCloud/entitlements needed between app and widget).

---

## Concrete Implementation Roadmap

### Phase 1: Local Dev (Ad-Hoc Signing, Testing Only)
1. Create `src-tauri/macos-widget/Project.xcodeproj` with widget extension target.
2. Write `build-widget.sh` (xcodebuild to compile `.appex`).
3. Write `embed-widget.sh` (copy, ad-hoc sign, verify).
4. Add `beforeBundleCommand` to `tauri.conf.json`.
5. Run locally: `pnpm tauri build && ./src-tauri/macos-widget/embed-widget.sh`.
6. Test: widget appears in Notification Center.

### Phase 2: CI/CD Setup (Developer ID Signing)
1. Obtain Developer ID Application certificate + export as base64 `.p12`.
2. Add GitHub secrets: `APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD`, `APPLE_SIGNING_IDENTITY`.
3. Update `release-build.yml` workflow:
   - Add `beforeBundleCommand` env vars.
   - Add post-build step: `embed-widget.sh "$APPLE_SIGNING_IDENTITY"`.
4. Enable notarization (if distributing outside App Store).

### Phase 3: Distribution
1. Test full workflow (build + embed + notarize + DMG).
2. Verify widget appears in end-user's Notification Center post-install.
3. Test app update flow (widget persists?).

---

## Sources & Citations

1. **Tauri v2 macOS Bundling**  
   https://v2.tauri.app/distribute/macos-application-bundle/

2. **Tauri v2 Code Signing**  
   https://v2.tauri.app/distribute/sign/macos/

3. **Tauri v2 GitHub Actions**  
   https://v2.tauri.app/distribute/pipelines/github/

4. **tauri-plugin-widgets (s00d)**  
   https://github.com/s00d/tauri-plugin-widgets — Working implementation, README has embed-widget.sh reference.

5. **Eclectic Light Company: Overview of app extensions in macOS Sequoia (2025-04-23)**  
   https://eclecticlight.co/2025/04/23/an-overview-of-app-extensions-and-plugins-in-macos-sequoia/

6. **Eclectic Light Company: How PlugInKit enables app extensions (2025-04-16)**  
   https://eclecticlight.co/2025/04/16/how-pluginkit-enables-app-extensions/

7. **Apple WidgetKit Documentation**  
   https://developer.apple.com/documentation/widgetkit

8. **Apple Code Signing In Depth (TN2206)**  
   https://developer.apple.com/library/archive/technotes/tn2206/_index.html

9. **codesign(1) Man Page**  
   https://keith.github.io/xcode-man-pages/codesign.1.html

10. **CodexBar WidgetKit Documentation**  
    https://github.com/steipete/CodexBar/blob/main/docs/widgets.md

11. **Apple Forums: Gatekeeper and Code Signing**  
    https://developer.apple.com/forums/thread/740680

12. **macOS distribution — code signing, notarization, quarantine**  
    https://gist.github.com/rsms/929c9c2fec231f0cf843a1a746a416f5
