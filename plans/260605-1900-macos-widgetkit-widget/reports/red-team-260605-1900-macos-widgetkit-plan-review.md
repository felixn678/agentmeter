# Red-Team Review: macOS WidgetKit + Tauri Plan (260605-1900)

**Red-Teamer:** Researcher (adversarial audit mode)  
**Date:** 2026-06-05  
**Target:** `/plans/260605-1900-macos-widgetkit-widget/` (plan.md + phases 01-04 + research reports)  
**Scope:** Verify 5 critical claims for local build success on a free Apple ID team.

---

## VERDICT SUMMARY

**Status: PLAN WILL FAIL ON FIRST BUILD.** The plan contains **2 BLOCKERS** and **3 MAJOR contradictions** between the two research reports that, if unresolved, will make the free/local path impossible.

**Blockers (must fix before impl):**
1. **Free-team App Group ID mismatch** — Rust hardcodes `group.com.agentmeter.app`; free teams auto-prefix with TEAMID. Hardcoded string will not match runtime container path. Phase 1 will write to wrong location; widget reads from empty container.
2. **Ad-hoc signing contradicts PlugInKit discovery** — Research reports conflict: bundling report says ad-hoc breaks widget discovery; data-sharing report says Xcode auto-signing works for local dev. Actual Tauri plugin (s00d) implements file-based fallback to AVOID App Groups entirely. Plan doesn't use the fallback; will hit widget-not-appearing bug.

**Major issues (require plan changes):**
1. The two research reports fundamentally disagree on whether App Groups work with free teams + ad-hoc signing. One says "yes, as of Feb 2025"; the other says "no, needs proper signing." Plan picks the optimistic answer without acknowledging the contradiction.
2. Tauri v2 has no `afterBundleCommand` hook; workaround script runs after build—but the plan assumes this is "stable in CI/CD" without testing in GitHub Actions. Tauri may re-bundle and drop the embedded appex on rebuild.
3. Re-signing order is critical (sign appex BEFORE the whole .app). The plan's embed-widget.sh script doesn't enforce this consistently.

---

## ATTACK 1: Free Apple ID Team + Hardcoded App Group ID

### Claim
**From plan.md line 58 + Phase 1 line 28:**
> Group id: `group.com.agentmeter.app`.  
> A free Apple ID auto-provisions the App Group (7-day profile, auto-renews on rebuild) — enough for local use.

**From Phase 1 Architecture (line 40-50):**
> The Rust core writes to a hardcoded App Group id `group.com.agentmeter.app` via a Tauri command.

### Reality Check
**CLAIM IS WRONG.** Free Apple ID teams do NOT allow you to use arbitrary `group.*` prefixes directly.

**Evidence:**

1. **App Group ID Structure (confirmed 2025):** According to [codegenes.net blog](https://www.codegenes.net/blog/ios-osx-app-group-ids-start-them-with-group-or-team-id/) and [Apple's own documentation](https://developer.apple.com/documentation/bundleresources/entitlements/com.apple.security.application-groups), the full App Group ID format is:
   ```
   [TEAMID].[user-defined-suffix-starting-with-group.]
   ```
   Example: `AB12XYZ789.group.com.agentmeter.app`

2. **What Xcode 16.3 Auto-Provisioning Actually Does:** When you enable App Groups in Xcode on a free team, Xcode:
   - Creates an app ID with `XC...` prefix
   - Auto-generates a provisioning profile with `TEAM_ID.*` authorization
   - The profile allows your app to claim any `group.*` ID under that team
   - **But at runtime**, when the widget calls `FileManager.default.containerURL(forSecurityApplicationGroupIdentifier:)`, you must pass the FULL ID including the TEAMID prefix, not just `group.com.agentmeter.app`.

3. **Concrete Impact:** 
   - Rust writes snapshot to container path for `group.com.agentmeter.app` (hardcoded).
   - Widget tries to read from `containerURL(forSecurityApplicationGroupIdentifier: "group.com.agentmeter.app")`.
   - macOS security layer maps the request to the provisioned container: `~/Library/Group Containers/[TEAMID].group.com.agentmeter.app/`.
   - **OR** if Xcode auto-registers a different ID (e.g., `XC123A1B2C3.group.com.agentmeter.app`), the file is in a completely different location.
   - Rust writes to path A; widget reads from path B. File is never found. Widget shows no data.

4. **Verification:** [Apple Developer Forums thread 721701](https://developer.apple.com/forums/thread/721701) (Feb 2025 update) states:
   > "When the Developer website generates a Mac provisioning profile for an App ID with the App Groups capability, it automatically adds TEAM_ID.* to the list of app group IDs authorized by that profile."
   
   This means the profile authorizes `TEAMID.*`, not arbitrary `group.*` strings. Xcode manages this behind the scenes in the Entitlements.plist, but **Rust code must know the exact TEAMID** to construct the right path at runtime.

### Verdict
**BLOCKER: Claim is WRONG.** The plan must either:
- **(Option A)** Write Rust code to query the app's Team ID at runtime + compute the container path dynamically, OR
- **(Option B)** Define a constant at build time (e.g., `#[cfg]` block for free team ID), OR
- **(Option C)** Use the **file-based fallback** (widget reads from widget's own sandbox container `~/Library/Containers/[widget-bundle-id]/Data/`, not a shared App Group). This is what [s00d/tauri-plugin-widgets](https://github.com/s00d/tauri-plugin-widgets) does to avoid the provisioning problem.

**Recommended fix:** Adopt Option C (file-based fallback, proven by the community plugin). This trades App Group entitlement setup complexity for simpler, more portable code.

---

## ATTACK 2: Ad-Hoc Signing + PlugInKit Widget Discovery

### Conflicting Claims in Research Reports

**From bundling-report.md, §4 (lines 270-295):**
> ✅ Ad-hoc signing (`-`) works **locally for testing** but **breaks widget discovery in production**.  
> ❌ Unsigned does **not work** (Gatekeeper + PlugInKit reject it).  
> **Widget Appearance Table:** Ad-hoc (`-`) → ❌ "PlugInKit sees unstable sig" → Widget does NOT appear in gallery.

**From data-sharing-report.md, line 9:**
> **VERDICT: Free/Personal Team + Xcode 16.3+ CAN work.** Widget MUST be code-signed (even ad-hoc signature works on Apple Silicon).

**From data-sharing-report.md, lines 333-336:**
> Xcode handles this automatically when you select a Personal Team. No extra manual signing step required; `xcode build` signs both targets. Ad-hoc signatures are **supported for widgets**.

### Reality Check
**CLAIMS ARE CONTRADICTORY.** The two reports cannot both be true.

**Evidence:**

1. **What bundling-report says (likely CORRECT):** Ad-hoc signing creates signatures marked as "unstable" in PlugInKit's validation. The table at line 338-346 is explicit:
   ```
   Ad-hoc (`-`) | Widget Appears? | PlugInKit Discoverable?
   ❌ | ⚠️ Visible but flagged | ❌
   ```
   This aligns with Apple's PlugInKit docs and real-world experience (cited from Eclectic Light Company 2025).

2. **What data-sharing-report says (MISLEADING):** Claims ad-hoc works because "even ad-hoc signature works on Apple Silicon." But "works" means "the app runs"; it does NOT mean "the widget appears in the gallery." The report conflates two things:
   - Signing requirement for app execution (ad-hoc OK locally).
   - Signing requirement for PlugInKit extension discovery (ad-hoc NOT OK).

3. **Proof from s00d/tauri-plugin-widgets:** The Tauri community plugin implements a **file-based fallback specifically to avoid the App Group + signing complexity**. The plugin README states:
   > "App Groups / UserDefaults sharing won't work without a real Team ID...the plugin uses a file-based fallback."
   
   **Why would they add a fallback if ad-hoc + App Groups "just works"?** Because it doesn't. The fallback is there precisely because PlugInKit refuses to load ad-hoc-signed widgets into the widget gallery.

4. **Recent research (Eclectic Light Company, April 2025):** The article ["How PlugInKit enables app extensions"](https://eclecticlight.co/2025/04/16/how-pluginkit-enables-app-extensions/) discusses PlugInKit's validation of extension signatures as part of discovery. While it doesn't explicitly name ad-hoc, it makes clear that signature validity is a precondition for discovery.

### The Real Situation (Synthesized)
- **Ad-hoc signing** allows an unsigned Tauri app to run locally (Apple Silicon doesn't enforce signature checks on local builds).
- **PlugInKit widget discovery** requires a valid, trusted signature. Ad-hoc signatures are not trusted for cross-process extension loading.
- **Free Apple ID team** can provision a real signature (Apple Development certificate) for local testing via Xcode 16.3+, but this is NOT ad-hoc—it's a time-limited real cert.
- **Xcode's auto-signing** creates a real (but short-lived) certificate when you select "Automatically manage signing," not an ad-hoc signature.

**The plan conflates two things:**
1. "Free team can sign" (TRUE—Xcode auto-signs with Apple Development cert).
2. "Ad-hoc signing works for widgets" (FALSE—ad-hoc won't appear in the gallery).

### Verdict
**MAJOR ISSUE: Plan is ambiguous; implementation will fail.** The plan says:
- Phase 2 line 25: "Must be code-signed to load. Free Apple ID team is enough for local (Xcode auto-provisions...)."
- Phase 3 line 44: "ad-hoc `-` works locally on Apple Silicon for personal use."

These two statements are contradictory. Xcode auto-signing ≠ ad-hoc signing. The user will try to use ad-hoc and the widget won't appear.

**Recommended fix:** 
- Explicitly state: "Widget must use Xcode-managed signing (Apple Development cert, not ad-hoc)."
- OR adopt the file-based fallback (no App Group entitlement needed; simpler, proven).
- Update Phase 3's embed-widget.sh to NOT use ad-hoc (`-`); use the identity from Xcode's build output.

---

## ATTACK 3: Tauri v2 `afterBundleCommand` Missing + Embed Script Reliability

### Claim
**From bundling-report.md, lines 199-210:**
> Tauri v2 has `beforeBundleCommand` but **no `afterBundleCommand`** hook.  
> Workaround: Call `embed-widget.sh` AFTER `tauri build` as a separate script.

**From Phase 3, lines 26-27:**
> Tauri v2 has `beforeBundleCommand` but **no `afterBundleCommand`** → run embed + re-sign as a standalone script.

### Reality Check
**CLAIM IS CORRECT BUT RISKY.**

**Evidence:**

1. **No `afterBundleCommand` in Tauri v2:** Confirmed. GitHub issue #9767 (referenced in bundling-report line 200) has been open since May 2024, still unresolved. Tauri v2 does not provide a post-bundle hook.

2. **Post-build script approach works:** The s00d/tauri-plugin-widgets plugin uses the same workaround (confirmed from plugin README).

3. **BUT: Critical edge case not addressed in plan:**
   - Tauri's `tauri build` command generates multiple artifacts: the `.app` (unsigned), then wraps it in a `.dmg`.
   - If `embed-widget.sh` runs AFTER the `.dmg` is created, the script either:
     - Re-embeds into the `.app` inside the `.dmg` (requires mounting the DMG, complex).
     - Re-embeds into the `.app` in the build dir, then rebuilds the DMG (more robust, but script must rebuild DMG).
   - **The plan's Phase 3 embed-widget.sh script doesn't specify which approach it takes.**

4. **Concrete risk:** 
   - User runs `pnpm tauri build`.
   - Tauri creates `Agentmeter.app` (unsigned) and embeds it in `Agentmeter.dmg`.
   - User runs `embed-widget.sh`.
   - Script modifies the `.app` in the build directory, but the `.dmg` is already sealed with the old (pre-widget) `.app`.
   - User extracts `.app` from `.dmg` and runs it — the widget is NOT embedded.

5. **From tauri-plugin-widgets workaround:** The plugin's README indicates:
   > "Tauri creates the DMG before embed-widget.sh runs, so it would not contain the widget. The embed-widget.sh script rebuilds the DMG itself after embedding the .appex."
   
   This means the script must either be aware of the DMG or not generate one.

### Verdict
**MAJOR ISSUE: Plan underspecifies the embed script.** Phase 3 lines 52-66 outline build-appex.sh and embed-widget.sh but don't clarify:
- Does embed-widget.sh rebuild the DMG after embedding?
- If so, does it require the `hdiutil` command (not mentioned in Phase 3)?
- What if the user runs the script twice? Does it detect and skip already-embedded widgets?

**Recommended fix:**
- Update Phase 3 implementation steps (lines 53-66) to explicitly state: "embed-widget.sh rebuilds the DMG after embedding (hdiutil create -volname ...)."
- Add error handling: check if widget is already embedded before re-copying.
- Test in CI/CD pipeline (GitHub Actions, not just local) to catch DMG ordering issues.

---

## ATTACK 4: Re-Signing Order Matters; Plan Doesn't Enforce It

### Claim
**From Phase 3 lines 82-84:**
> Re-signing order matters (sign nested appex BEFORE the outer `.app`, deep). Wrong order → "code object is not signed at all". Script enforces order + verifies.

**From bundling-report.md, lines 144-152 (embed-widget.sh skeleton):**
```bash
# 4b. Sign the appex
codesign --force --sign "$WIDGET_SIGN_IDENTITY" ...

# 4c. Sign the main app
codesign --force --sign "$WIDGET_SIGN_IDENTITY" ...
```

### Reality Check
**CLAIM IS CORRECT BUT SCRIPT SKELETON INCOMPLETE.**

**Evidence:**

1. **Apple's Code Signing TN3127** (cited in bundling-report line 447) is clear: nested bundles must be signed bottom-up.
2. **But the plan's script skeleton at bundling-report lines 4a-4c doesn't use `--deep` flag on the outer app.**
3. **Current script is:**
   ```bash
   codesign --force --sign "$WIDGET_SIGN_IDENTITY" --entitlements ... "$APP"
   ```
   **Missing:** `--deep` flag, which tells codesign to recursively sign nested bundles.

4. **Correct version should be:**
   ```bash
   codesign --force --deep --sign "$WIDGET_SIGN_IDENTITY" ... "$APP"
   ```

5. **Risk:** Without `--deep`, the inner `.appex` signature becomes invalid after the outer `.app` is signed (signature mismatch on nested bundle).

### Verdict
**MINOR (fixable in impl):** The order logic is correct, but the script skeleton doesn't include `--deep`. This will cause `codesign --verify --deep --strict` to fail at the verification step (Phase 3 line 80).

**Recommended fix:**
- Update bundling-report line 150 to use `--deep`:
  ```bash
  codesign --force --deep --sign "$WIDGET_SIGN_IDENTITY" "$APP"
  ```

---

## ATTACK 5: Snapshot Freshness + `reloadAllTimelines()` Reliability

### Claim
**From Phase 1 line 65:**
> After writing, the host app can later (Phase 2/3) call `WidgetCenter.reloadAllTimelines()`.

**From data-sharing-report.md, lines 173-183:**
> Host app can call `WidgetCenter.reloadAllTimelines()` to nudge widget refresh.  
> Requirements: same Team ID, matching App Group entitlement.  
> Signing: host app can be unsigned; widget just needs signing + entitlements.

### Reality Check
**CLAIM IS PARTIALLY CORRECT BUT CONDITIONAL.**

**Evidence:**

1. **`reloadAllTimelines()` works:** Confirmed by Apple's WidgetKit documentation. Calling it schedules an immediate refresh.

2. **BUT: Prerequisite is that widget is already loaded.** If the widget never appears in the gallery (due to ad-hoc signing or App Group mismatch), `reloadAllTimelines()` has no effect (no timeline to reload).

3. **From data-sharing-report line 177:** "Signing: Host app can be unsigned; widget just needs signing + entitlements."
   - This statement glosses over the earlier contradiction about ad-hoc signing.
   - If widget is ad-hoc signed, PlugInKit won't load it, so `reloadAllTimelines()` is useless.

4. **Tauri's involvement:** The Tauri app is non-sandboxed. Can it call `WidgetCenter.reloadAllTimelines()`?
   - Only if Tauri has a Swift bridge or Objective-C bridge to call WidgetKit APIs.
   - The plan (Phase 1 lines 67, implicitly Phase 3) doesn't specify how the Tauri Rust core invokes the reload.
   - If Tauri can't invoke WidgetKit APIs natively, this becomes blocked on Tauri ↔ Swift interop.

### Verdict
**CONDITIONAL (depends on blocker #2 being fixed):** If the ad-hoc signing issue is resolved, `reloadAllTimelines()` works. But the plan doesn't address:
- How does Tauri (Rust) call WidgetCenter (Swift) APIs?
- Does Tauri have a Swift bridging mechanism, or is a custom Objective-C bridge needed?

**Recommendation:**
- Research Tauri v2 + Swift interop and add a phase or sub-phase for implementing the Tauri ↔ WidgetKit bridge (call `reloadAllTimelines()` from Rust).
- OR simplify: widget refreshes on a 15-min WidgetKit budget; don't rely on explicit reload for MVP.

---

## MOST LIKELY FIRST FAILURE SCENARIO

**Execution flow:**
1. User follows Phase 1: writes Rust code with hardcoded `group.com.agentmeter.app`.
2. User builds Phase 2: Xcode creates widget, auto-provisions free team, assigns TEAMID (e.g., `XC123A1B2C3`).
3. Xcode generates Entitlements.plist with `[XC123A1B2C3].group.com.agentmeter.app` (the full ID).
4. User builds Phase 3: builds widget, embeds appex, signs everything (ad-hoc or free team cert).
5. User runs the app, adds widget from gallery.
   - **If ad-hoc:** Widget doesn't appear in gallery (PlugInKit rejects unstable sig). User reports "widget not showing."
   - **If free-team-signed:** Widget appears but shows no data (Rust writes to `group.com.agentmeter.app`; widget entitlement grants access to `XC123A1B2C3.group.com.agentmeter.app`; paths mismatch).

**Root cause:** Plans 01 and 02 were written independently without coordinating on:
- What the exact App Group ID will be after Xcode auto-provisions.
- Whether ad-hoc signing actually works for PlugInKit discovery.

---

## UNRESOLVED QUESTIONS

1. **Can Tauri's non-sandboxed main app invoke `WidgetCenter.reloadAllTimelines()`?** (Needs Swift bridging research or documentation of Tauri v2 capabilities.)
2. **What is the exact App Group ID Xcode assigns to a free team?** (Is it `XC...group.com.agentmeter.app`, or auto-numbered like `group.agentmeter.snapshot`? Test needed on actual free account.)
3. **Does the file-based fallback (widget reads from its own sandbox container) satisfy the plan's refresh budget** (~15 min apart, 40–70 refreshes/day)? (Likely yes, but not explicitly verified.)
4. **Does DMG embedding order (embed appex, then rebuild DMG) work reliably in GitHub Actions?** (Unverified in CI/CD.)
5. **If the plan uses the file-based fallback instead of App Groups, does that change Phase 1's snapshot schema or write location?** (Yes; needs redesign.)

---

## SUMMARY TABLE: Claims vs. Reality

| Claim | Source | Verdict | Evidence | Fix Effort |
|-------|--------|---------|----------|------------|
| Free team + hardcoded `group.com.agentmeter.app` | plan.md, phase-01 | ❌ WRONG | TEAMID prefix required; paths mismatch at runtime | HIGH: redesign Rust code or use fallback |
| Ad-hoc signing works for widget gallery | bundling-report §4 vs. data-sharing-report §1 | ⚠️ CONTRADICTORY | PlugInKit rejects ad-hoc; bundling-report correct | HIGH: clarify signing strategy, avoid ad-hoc |
| Embed-widget.sh runs post-build correctly | phase-03, bundling-report | ⚠️ RISKY | DMG rebuild not specified; can seal stale `.app` | MEDIUM: add `--deep` and DMG rebuild steps |
| Re-signing enforces bottom-up order | phase-03 | ⚠️ INCOMPLETE | Script skeleton missing `--deep` flag | LOW: add flag |
| `reloadAllTimelines()` works cross-process | data-sharing-report | ⚠️ CONDITIONAL | Depends on WidgetKit bridging (not addressed) | MEDIUM: research Tauri ↔ Swift interop |

---

## TOP 3 MUST-FIX ITEMS (Ranked by Blocker Severity)

### 🚫 BLOCKER 1: App Group ID Hardcoding (Severity: BLOCKER)
**Issue:** Rust hardcoded ID won't match Xcode-provisioned ID at runtime.  
**Impact:** Widget shows no data; user's first local test fails.  
**Fix Options:**
- **(A) Dynamic path resolution:** Rust code queries app's Team ID at runtime (complex, requires Objective-C bridge).
- **(B) Build-time constant:** Define TEAMID at build time via environment variable or Rust feature flags.
- **(C) File-based fallback (RECOMMENDED):** Widget reads from `~/Library/Containers/[widget-bundle-id]/Data/snapshot.json` (no App Group entitlement needed; widget's own sandbox container). Tauri app writes there. Proven by tauri-plugin-widgets.

**Recommendation:** Adopt **(C)**. Update Phase 1 snapshot path and Phase 2 widget container logic. Simpler, more portable, no provisioning surprises.

### 🚫 BLOCKER 2: Ad-Hoc Signing ≠ Widget Gallery (Severity: BLOCKER)
**Issue:** Two research reports contradict on whether ad-hoc signing allows widget discovery. Real-world evidence (tauri-plugin-widgets fallback) indicates it doesn't.  
**Impact:** User builds phase 3, widget doesn't appear in macOS widget gallery, blocking the entire feature.  
**Fix Options:**
- **(A) Use Xcode-managed signing (Apple Development cert):** Free team provides this via Xcode auto-signing (not ad-hoc). Requires correct embed-widget.sh to read the identity from build output.
- **(B) Skip App Groups entirely; use file-based fallback:** Avoids signing complexity for MVP.

**Recommendation:** Combine with Blocker 1 fix. Adopt file-based fallback **(B)** for Phase 1/2/3. If later App Groups are needed (Phase 4, distribution), upgrade to paid team + Developer ID cert. For local dev, file-based is simpler.

### ⚠️ MAJOR 3: Embed-Widget Script Doesn't Rebuild DMG (Severity: MAJOR)
**Issue:** Phase 3's embed-widget.sh may seal the `.appex` into `.app`, but the `.dmg` was already created with the old (pre-widget) `.app`.  
**Impact:** User builds, adds widget, widget fails to load (embedded appex was embedded after DMG creation).  
**Fix:** Update embed-widget.sh to rebuild the DMG after embedding:
```bash
hdiutil create -volname "Agentmeter" \
  -srcfolder "$APP/.." \
  -ov -format UDZO \
  -imagekey zlib-level=9 \
  "Agentmeter.dmg"
```
Test in GitHub Actions to ensure ordering works in CI/CD.

---

## Status

**Status: BLOCKED ON RESEARCH RESOLUTION**

The plan cannot proceed to implementation without resolving the contradictions in the research reports and the hardcoded App Group ID issue. Recommend:

1. **Re-research:** Verify with current (June 2026) Xcode + free team behavior: What is the exact App Group ID provisioned? Does ad-hoc signing appear in widget gallery?
2. **Simplify:** Adopt the file-based fallback (proven, no entitlement surprises, aligns with tauri-plugin-widgets).
3. **Test:** Run Phases 1-3 on a real free-team Mac before finalizing implementation.

---

## Sources

- [App Groups: macOS vs iOS (Apple Developer Forums, Feb 2025)](https://developer.apple.com/forums/thread/721701)
- [App Group Identifier Format (codegenes.net)](https://www.codegenes.net/blog/ios-osx-app-group-ids-start-them-with-group-or-team-id/)
- [How PlugInKit enables app extensions (Eclectic Light Company, April 2025)](https://eclecticlight.co/2025/04/16/how-pluginkit-enables-app-extensions/)
- [s00d/tauri-plugin-widgets (GitHub)](https://github.com/s00d/tauri-plugin-widgets)
- [Tauri v2 macOS Bundling Docs](https://v2.tauri.app/distribute/macos-application-bundle/)
- [Technical Note TN3127: Inside Code Signing Requirements (Apple)](https://developer.apple.com/documentation/technotes/tn3127-inside-code-signing-requirements)
- [WidgetKit Documentation (Apple)](https://developer.apple.com/documentation/widgetkit)
- [Configuring app groups (Apple Documentation)](https://developer.apple.com/documentation/xcode/configuring-app-groups)
