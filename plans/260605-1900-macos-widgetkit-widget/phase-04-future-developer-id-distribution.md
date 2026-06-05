---
phase: 4
title: "Future: Developer ID Distribution"
status: pending
priority: P3
effort: "2-3d (when triggered)"
dependencies: [3]
---

# Phase 4: Future — Developer ID Distribution (DEFERRED)

> **Not built now.** This phase is the roadmap for when the user buys an **Apple
> Developer Program membership ($99/yr)** and wants the widget — and signed, friction-
> free installs — for **all** users, not just the local Mac. Gated on user decision **D3**.

## Context Links
- CI: `.github/workflows/release-build.yml` (macOS bundles currently UNSIGNED by design)
- Runbook: `docs/release-runbook.md`
- Research: both reports in `../reports/` (signing/notarization sections)

## Overview
Today the macOS app ships **unsigned** — fine because only the author runs it (the app
comment notes "user does right-click → Open on first launch"). The widget cannot load
under that model for *other* users. This phase wires real **Developer ID signing +
notarization** so: (a) the widget loads for everyone, and (b) every macOS download
opens without the Gatekeeper "damaged/unidentified developer" friction.

## Why this is a sizable change (user-flagged)
Buying the cert is the cheap part; the work it unlocks/requires is broad:
1. **Widget distribution** — re-do Phase-3 signing with **Developer ID Application**
   identity instead of ad-hoc; the appex + app must be Developer-ID-signed AND notarized
   or the widget won't load on other Macs.
2. **CI/CD overhaul** (`release-build.yml`) — the currently-skipped Apple signing block
   must be wired:
   - Import the Developer ID cert into the macOS runner keychain (`APPLE_CERTIFICATE`,
     `APPLE_CERTIFICATE_PASSWORD`, `APPLE_SIGNING_IDENTITY` secrets — the workflow
     comment already reserves "APPLE_* env block once Developer ID cert is real").
   - Notarize via `notarytool` (`APPLE_ID`, `APPLE_PASSWORD`/app-specific, `APPLE_TEAM_ID`)
     and **staple** the ticket to the `.dmg`/`.app`.
   - Embed the widget appex in CI (automate Phase-3's manual embed step) BEFORE signing
     the outer app, then notarize the whole thing.
   - Stable App Group id under the paid team (no more 7-day free-team profile expiry).
3. **Install UX** — drop the "right-click → Open" workaround from README/runbook; macOS
   downloads become double-click-to-open. Update `docs/release-runbook.md` +
   `README`/`README-vi`.
4. **Updater interplay** — confirm the minisign auto-update flow still validates a
   signed+notarized bundle (it should; the two signatures are independent).

## Bonus ideas unlocked by having the cert (future backlog)
- **Interactive widget** (macOS 14+): `Button`/`Toggle` in the widget via `AppIntents`
  — e.g. tap to switch the widget metric (today/week/month) or open the dashboard.
- **Notarized auto-update without friction** — signed bundles mean the updater can
  replace the app silently without Gatekeeper re-prompts.
- **Login item / launch-at-login** via `SMAppService` (doesn't strictly need the cert,
  but pairs well with a "real install" story).
- **Homebrew cask** — a cask is far more credible (and some users expect notarization)
  once builds are signed; enables `brew install --cask agentmeter`.
- **(Stretch) Mac App Store** — would additionally require full sandboxing of the main
  app + App Store provisioning; large scope, listed only for completeness (likely YAGNI
  for an OSS menubar tool).

## Related Code Files (when triggered)
- Modify: `.github/workflows/release-build.yml` (Apple signing + notarytool + staple +
  CI appex embed), `docs/release-runbook.md` + `-vi`, `README.md` + `-vi`,
  `src-tauri/macos-widget/embed-widget.sh` (swap ad-hoc → Developer ID identity),
  the widget `.entitlements` / App Group registration under the paid team.

## Implementation Steps (when triggered)
1. Enroll in Apple Developer Program; create a **Developer ID Application** cert +
   (if needed) registered App Group id under the team.
2. Add the Apple secrets to the repo; wire the signing + notarization + staple steps
   into `release-build.yml` for both macOS arch matrix legs.
3. Automate the appex embed in CI (port Phase-3 scripts), sign appex → app (deep) →
   notarize → staple.
4. Update install docs to remove the unsigned workaround.
5. Verify on a clean Mac (not the dev machine): download from the GitHub release, open
   without Gatekeeper friction, add the widget, confirm it loads + shows live data.

## Success Criteria (when triggered)
- [ ] A downloaded release `.app`/`.dmg` opens on a fresh Mac with no Gatekeeper warning.
- [ ] The widget loads + renders for a non-author user.
- [ ] `release-build.yml` produces signed + notarized + stapled macOS bundles across
      both arch legs; updater still validates.

## Risk Assessment
- Notarization is async + occasionally flaky in CI → add retry/wait on `notarytool`.
- Cert/secret management in CI is sensitive → least-privilege secrets, never logged.
- Recurring $99/yr + cert renewal is an ongoing commitment → only trigger when
  distribution is actually wanted.

## Security Considerations
- Apple secrets live only in GitHub Actions secrets; never echoed. Notarization sends
  the bundle to Apple (expected for signed distribution) — no user data involved.
