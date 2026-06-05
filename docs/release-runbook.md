# Release runbook

> 🌐 Tiếng Việt: [release-runbook-vi.md](release-runbook-vi.md)

End-to-end recipe for shipping a new agentmeter version. Last verified: **v0.4.1**.

## Conventional commits cheatsheet

release-please drives version bumps from commit prefixes on `master`.

| Prefix | Effect |
|--------|--------|
| `feat: …` | minor bump (0.X.0) |
| `fix: …` | patch bump (0.0.X) |
| `feat!: …` or `fix!: …` | major bump (X.0.0) |
| `chore:`, `docs:`, `refactor:`, `style:`, `test:` | no bump |
| `chore(deps): …` | no bump (dependency updates) |

## Normal release flow

1. Land conventional commits on `master` (PR or direct push).
2. `release-please` workflow auto-runs → opens or updates a **"chore(master): release X.Y.Z"** PR.
3. Review the PR diff + `CHANGELOG.md`.
4. **Squash merge** the PR (subject: `chore(master): release X.Y.Z`).
5. release-please re-runs post-merge → creates tag `vX.Y.Z` + an empty GitHub Release shell.
6. Trigger the matrix build:
   ```bash
   pnpm release:build
   ```
   Reads version from `package.json` and dispatches `release-build` workflow with the matching tag.
7. Wait ~7 min. Verify the GitHub Release page has:
   - `agentmeter_X.Y.Z_aarch64.dmg` (macOS Apple Silicon)
   - `agentmeter_X.Y.Z_x64.dmg` (macOS Intel)
   - `agentmeter_X.Y.Z_amd64.deb` (Debian/Ubuntu)
   - `agentmeter_X.Y.Z_amd64.AppImage` (Linux portable) + `.sig`
   - `agentmeter_aarch64.app.tar.gz` + `.sig` (macOS arm updater bundle)
   - `agentmeter_x64.app.tar.gz` + `.sig` (macOS Intel updater bundle)
   - `latest.json` (updater manifest)
8. Installed apps detect the update at next launch (or via tray menu "Check for updates…").

## Manual release

Use when you need to rebuild a tag without changing the source (e.g. flaky CI run, missing asset):
```bash
gh workflow run release-build.yml -f tag=vX.Y.Z
```
Workflow checks out the tag's commit and rebuilds + reuploads with `--clobber`.

## GitHub Actions one-time setup

- **Settings → Actions → General → "Allow GitHub Actions to create and approve pull requests"** must be enabled. Without this, `release-please` silently fails to open the Release PR.
- Two repository secrets are required:
  - `TAURI_SIGNING_PRIVATE_KEY` — content of the minisign private key file
  - `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` — keypair passphrase
- The minisign keypair was generated locally with `pnpm tauri signer generate`. The public key is embedded in `src-tauri/tauri.conf.json` (`plugins.updater.pubkey`) and rotating it would break auto-update for all installed apps.

## Why the manual trigger?

Tags created by `release-please` use `GITHUB_TOKEN`, and GitHub Actions does not trigger downstream workflows from token-created events (prevents infinite loops). Hence `pnpm release:build` is run manually after merging the Release PR. To eliminate the manual step, generate a Personal Access Token with `repo` scope and pass it to `release-please-action` via `token:` — out of scope for now.

## Rollback

**Never delete prior tags or releases.** Users whose auto-update pulled a broken version cannot recover otherwise (crash-on-launch means the updater never runs).

1. Mark the broken release as **Pre-release** on the GitHub Release page — hides it from `/releases/latest`.
2. Edit `latest.json` on the previous good release to point auto-update back at the last known-good version (or simply re-upload its assets to the broken release).
3. Cut `vX.Y.Z+1` with the fix. **Never reuse the broken version** — installed apps cache version metadata.
4. Verify the previous release's `.dmg` / `.AppImage` are still downloadable for manual recovery.

## Test auto-update locally

1. Install `vX.Y.Z` from a release (`.dmg` on mac, `.AppImage` on Linux).
2. Cut a new release `vX.Y.Z+1` following the flow above.
3. Reopen the installed app → click tray icon → **Check for updates…**
4. Dialog should appear: "agentmeter X.Y.Z+1 is available. Install and restart?"

If no dialog: check `https://github.com/felixn678/agentmeter/releases/latest/download/latest.json` returns a parseable JSON with the platform key for your OS.

## Minimum system requirements

| Platform | Version | Notes |
|----------|---------|-------|
| macOS (Apple Silicon) | 11.0 (Big Sur) | Set via `bundle.macOS.minimumSystemVersion` |
| macOS (Intel) | 11.0 (Big Sur) | Same minimum |
| Ubuntu/Debian | 22.04+ | Needs `libwebkit2gtk-4.1-0`. 20.04 ships only 4.0, install will fail |
| Linux AppImage | any glibc 2.31+ | Bundles its own media framework (`bundleMediaFramework: true`) |

## First launch on macOS (unsigned builds)

agentmeter is currently unsigned (no Apple Developer ID). First launch needs a one-time bypass:

**Easiest — right-click → Open:**
1. Finder → Applications → right-click `agentmeter` → **Open**
2. Dialog: "macOS cannot verify the developer…" → click **Open**
3. Done. Future launches work via double-click.

**Terminal alternative — strip quarantine xattr:**
```bash
xattr -dr com.apple.quarantine /Applications/agentmeter.app
```

**If the right-click dialog won't open the app:** System Settings → Privacy & Security → scroll to "agentmeter was blocked…" → **Open Anyway**.

Once `Allow Anyway` is granted (or quarantine xattr is stripped), the bypass holds across auto-updates because Tauri replaces the app bundle in-place.

To remove this UX friction permanently, enable Apple code signing — see [release-signing-setup.md](release-signing-setup.md) when ready.

## Linux installer notes

- `.deb` installs do **not** auto-update. The app's updater code (`is_auto_update_supported()`) returns false when `APPIMAGE` env var is absent — see `src-tauri/src/lib.rs`. dpkg owns the install path and the Tauri updater would clobber it. `.deb` users must `sudo apt upgrade agentmeter` (or re-download).
- `.AppImage` auto-updates work in-place. The app needs write permission on the AppImage file's directory.
- `.rpm` is built as a side effect but not officially supported — no signature, no auto-update.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| `release-please` workflow green but no PR opens | Repo setting "Allow Actions to create PRs" disabled | Enable in Settings → Actions → General |
| `pnpm release:build` errors `Workflow does not have workflow_dispatch trigger` | YAML parse error (often flow-style `{ ${{…}} }`) | Run `npx @action-validator/cli .github/workflows/release-build.yml` |
| Cargo.lock not bumped on Release PR | `# x-release-please-version` marker on `version = "X.Y.Z"` line got stripped by `cargo build` | Re-add the marker on the `[[package]] name = "agentmeter"` block in `src-tauri/Cargo.lock` |
| `latest.json` missing from release | `publish-updater-json` job failed | Re-run via `pnpm release:build`; idempotent via `--clobber` |
| App says "Could not check for updates" after install | Endpoint returned 404 (release lacks `latest.json`) or signature mismatch (pubkey mismatch) | Verify `latest.json` exists on `releases/latest`; verify pubkey in `tauri.conf.json` matches the private key in GH secrets |

## Pointers

- [Minisign signing](https://jedisct1.github.io/minisign/) — Tauri's update signing scheme
- [Tauri updater plugin v2](https://v2.tauri.app/plugin/updater/)
- [release-please-action](https://github.com/googleapis/release-please-action)
- Apple Developer ID setup: [release-signing-setup.md](release-signing-setup.md) (deferred)
