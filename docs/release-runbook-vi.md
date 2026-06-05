# Release runbook

> 🌐 English: [release-runbook.md](release-runbook.md)

Quy trình end-to-end để ship một phiên bản agentmeter mới. Last verified: **v0.4.1**.

## Conventional commits cheatsheet

`release-please` dùng prefix commit trên `master` để quyết định bump version.

| Prefix | Tác dụng |
|--------|----------|
| `feat: …` | minor bump (0.X.0) |
| `fix: …` | patch bump (0.0.X) |
| `feat!: …` hoặc `fix!: …` | major bump (X.0.0) |
| `chore:`, `docs:`, `refactor:`, `style:`, `test:` | không bump |
| `chore(deps): …` | không bump (cập nhật deps) |

## Flow release bình thường

1. Land conventional commits lên `master` (PR hoặc push trực tiếp).
2. Workflow `release-please` chạy → mở hoặc cập nhật PR **"chore(master): release X.Y.Z"**.
3. Review diff + `CHANGELOG.md`.
4. **Squash merge** PR (subject: `chore(master): release X.Y.Z`).
5. release-please chạy lại sau merge → tạo tag `vX.Y.Z` + shell GitHub Release rỗng.
6. Trigger matrix build:
   ```bash
   pnpm release:build
   ```
   Đọc version từ `package.json` và dispatch workflow `release-build` với tag tương ứng.
7. Đợi ~7 phút. Verify trang GitHub Release có:
   - `agentmeter_X.Y.Z_aarch64.dmg` (macOS Apple Silicon)
   - `agentmeter_X.Y.Z_x64.dmg` (macOS Intel)
   - `agentmeter_X.Y.Z_amd64.deb` (Debian/Ubuntu)
   - `agentmeter_X.Y.Z_amd64.AppImage` (Linux portable) + `.sig`
   - `agentmeter_aarch64.app.tar.gz` + `.sig` (updater bundle macOS arm)
   - `agentmeter_x64.app.tar.gz` + `.sig` (updater bundle macOS Intel)
   - `latest.json` (manifest updater)
8. App đã cài tự detect update lần khởi động sau (hoặc qua tray menu "Check for updates…").

## Release thủ công

Dùng khi cần build lại 1 tag mà không đổi source (CI flaky, asset thiếu…):
```bash
gh workflow run release-build.yml -f tag=vX.Y.Z
```
Workflow checkout commit của tag và build + upload lại với `--clobber`.

## Setup GitHub Actions (làm 1 lần)

- **Settings → Actions → General → bật "Allow GitHub Actions to create and approve pull requests"**. Không bật → `release-please` silent fail không mở Release PR.
- 2 repo secrets bắt buộc:
  - `TAURI_SIGNING_PRIVATE_KEY` — nội dung file minisign private key
  - `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` — passphrase keypair
- Keypair minisign được generate local bằng `pnpm tauri signer generate`. Public key nhúng trong `src-tauri/tauri.conf.json` (`plugins.updater.pubkey`); rotate sẽ phá auto-update của mọi app đã cài.

## Tại sao phải trigger build thủ công?

Tag tạo bởi `release-please` dùng `GITHUB_TOKEN`, và GitHub Actions không trigger downstream workflows từ events tạo bởi token (chống infinite loop). Vì vậy `pnpm release:build` phải chạy tay sau khi merge Release PR. Muốn full auto: tạo Personal Access Token với scope `repo` rồi truyền vào `release-please-action` qua `token:` — out of scope hiện tại.

## Rollback

**Không bao giờ delete tag/release cũ.** User auto-update vào bản broken không có đường nào recover (crash-on-launch = updater không chạy nữa).

1. Mark release broken thành **Pre-release** ở GitHub Release page — ẩn khỏi `/releases/latest`.
2. Edit `latest.json` trên release good trước đó để auto-update trỏ về version known-good (hoặc re-upload assets của bản đó vào release broken).
3. Cut `vX.Y.Z+1` với fix. **Không bao giờ tái dùng version broken** — app đã cài cache version metadata.
4. Verify `.dmg` / `.AppImage` của release cũ vẫn download được để manual recovery.

## Test auto-update local

1. Cài `vX.Y.Z` từ release (`.dmg` trên mac, `.AppImage` trên Linux).
2. Cut release mới `vX.Y.Z+1` theo flow trên.
3. Mở lại app đã cài → click tray icon → **Check for updates…**
4. Dialog phải hiện: "agentmeter X.Y.Z+1 is available. Install and restart?"

Nếu không có dialog: check `https://github.com/felixn678/agentmeter/releases/latest/download/latest.json` trả về JSON parse được với platform key của OS bạn.

## Yêu cầu hệ thống tối thiểu

| Platform | Version | Note |
|----------|---------|------|
| macOS (Apple Silicon) | 11.0 (Big Sur) | Set qua `bundle.macOS.minimumSystemVersion` |
| macOS (Intel) | 11.0 (Big Sur) | Cùng minimum |
| Ubuntu/Debian | 22.04+ | Cần `libwebkit2gtk-4.1-0`. 20.04 chỉ có 4.0, install fail |
| Linux AppImage | glibc 2.31+ | Bundle media framework sẵn (`bundleMediaFramework: true`) |

## Lần đầu mở trên macOS (build unsigned)

agentmeter hiện chưa có Apple Developer signing. Lần đầu mở cần bypass 1 lần:

**Dễ nhất — right-click → Open:**
1. Finder → Applications → right-click `agentmeter` → **Open**
2. Dialog: "macOS cannot verify the developer…" → click **Open**
3. Xong. Lần sau double-click bình thường.

**Terminal — strip quarantine xattr:**
```bash
xattr -dr com.apple.quarantine /Applications/agentmeter.app
```

**Nếu right-click không mở được:** System Settings → Privacy & Security → kéo xuống "agentmeter was blocked…" → **Open Anyway**.

Sau khi được "Allow Anyway" (hoặc strip quarantine), bypass này persist qua auto-update vì Tauri thay bundle in-place.

Muốn không còn UX friction → enable Apple code signing — xem [release-signing-setup.md](release-signing-setup.md) khi sẵn sàng.

## Note về Linux installer

- `.deb` install **KHÔNG** auto-update. Code updater của app (`is_auto_update_supported()`) trả false khi env var `APPIMAGE` không có — xem `src-tauri/src/lib.rs`. dpkg sở hữu install path, Tauri updater sẽ phá. `.deb` user phải `sudo apt upgrade agentmeter` (hoặc re-download).
- `.AppImage` auto-update hoạt động in-place. App cần quyền ghi vào thư mục chứa AppImage.
- `.rpm` được build kèm theo nhưng không officially support — không signature, không auto-update.

## Troubleshooting

| Symptom | Nguyên nhân | Fix |
|---------|-------------|-----|
| `release-please` workflow xanh nhưng không có PR | Setting "Allow Actions to create PRs" tắt | Bật ở Settings → Actions → General |
| `pnpm release:build` error `Workflow does not have workflow_dispatch trigger` | YAML parse error (thường do flow-style `{ ${{…}} }`) | Chạy `npx @action-validator/cli .github/workflows/release-build.yml` |
| Cargo.lock không bump trong Release PR | Marker `# x-release-please-version` ở dòng `version = "X.Y.Z"` bị `cargo build` strip | Re-add marker trên block `[[package]] name = "agentmeter"` trong `src-tauri/Cargo.lock` |
| `latest.json` thiếu trên release | Job `publish-updater-json` fail | Re-run bằng `pnpm release:build`; idempotent qua `--clobber` |
| App báo "Could not check for updates" sau khi cài | Endpoint trả 404 (release thiếu `latest.json`) hoặc signature mismatch (pubkey không khớp) | Verify `latest.json` tồn tại trên `releases/latest`; verify pubkey trong `tauri.conf.json` khớp private key trong GH secrets |

## Pointers

- [Minisign signing](https://jedisct1.github.io/minisign/) — Tauri update signing scheme
- [Tauri updater plugin v2](https://v2.tauri.app/plugin/updater/)
- [release-please-action](https://github.com/googleapis/release-please-action)
- Apple Developer ID setup: [release-signing-setup.md](release-signing-setup.md) (deferred)

## macOS WidgetKit widget (chưa nằm trong CI)

Widget WidgetKit native (`src-tauri/macos-widget/`) **KHÔNG** thuộc CI release build — đó là feature local-build riêng cần Xcode + signing identity Apple ID free. CI-shipped `.dmg`/`.app` chỉ chứa host Tauri app; widget được add bằng cách chạy `pnpm widget:build:mac` trên Mac sau `pnpm tauri build`.

Ranh giới này sẽ dịch chuyển khi Apple Developer ID phase được làm: CI signed build sẽ embed widget mặc định + ship 1 bundle signed.
