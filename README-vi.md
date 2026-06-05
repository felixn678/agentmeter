# agentmeter

> 🌐 English: [README.md](README.md)

App nhỏ gọn hiển thị lượng sử dụng & chi phí của các coding agent CLI (Claude
Code, Codex, Gemini…) ngay trên **menubar/tray**, kèm một cửa sổ dashboard đầy đủ.
Lấy cảm hứng từ app **Stats** trên macOS. Chạy trên **macOS** và **Ubuntu**.

Dữ liệu lấy từ [`ccusage`](https://github.com/ryoppippi/ccusage) — công cụ đọc log
local của các agent CLI. agentmeter không tự parse log mà gọi `ccusage --json` rồi
trình bày lại, nhờ vậy tự động hỗ trợ mọi provider mà ccusage hỗ trợ.

## Stack

- **Lõi + tray:** Rust (Tauri v2) — `src-tauri/`
- **Giao diện:** React + TypeScript + Vite — `src/`
- Widget native (phase sau) tách theo nền tảng, đọc cùng dữ liệu lõi.

## Kiến trúc

Nguyên tắc số 1: **tách lõi dữ liệu khỏi giao diện.** Mọi UI đều tiêu thụ cùng
một nguồn dữ liệu chuẩn hoá, nên việc "đơn giản → phức tạp" chỉ là thêm UI, không
phải viết lại.

```
agentmeter/
├─ src/              # React + TS: tray dropdown (Phase 1) + dashboard (Phase 2)
├─ src-tauri/        # Rust: lõi gọi ccusage --json, parse, expose qua command + tray
│  └─ src/ccusage.rs # toàn bộ logic chạy & parse ccusage (không dính UI)
├─ shared/           # SCHEMA.md — hợp đồng dữ liệu dùng chung cho mọi UI
├─ macos-widget/     # (Phase 4) WidgetKit/Swift — chỉ build trên macOS
└─ gnome-extension/  # (Phase 4) GJS — widget native cho GNOME/Ubuntu
```

Widget native **không tự chạy ccusage** (extension bị giới hạn tài nguyên). Lõi sẽ
tính sẵn và ghi dữ liệu ra một file ở vị trí chuẩn của OS; widget chỉ đọc file đó.

## Lộ trình

| Phase | Nội dung | Nền tảng | Trạng thái |
|-------|----------|----------|------------|
| 1 — MVP | Tray icon + dropdown hiện chi phí hôm nay; cửa sổ liệt kê theo ngày/tuần/tháng | Mac + Ubuntu | ✅ xong |
| 2 — Dashboard | Chart line/bar/pie, filter theo model & agent | Mac + Ubuntu | ⬜ |
| 3 — Widget cross-platform | Cửa sổ Tauri luôn-nổi kiểu widget | Mac + Ubuntu | ⬜ |
| 4 — Widget native | WidgetKit (Swift) cho Mac; GNOME extension (GJS) cho Ubuntu | Riêng từng OS | ⬜ |

## Cách đọc dữ liệu usage

App **nhúng sẵn binary standalone của ccusage** dưới dạng Tauri sidecar, nên bản đã cài
đọc dữ liệu **không cần Node hay ccusage trên máy**. Nếu sidecar fail lúc runtime, lõi
Rust sẽ fallback về `npx ccusage@latest`.

Các binary sidecar **không commit** (~13MB) — fetch trước khi build:

```bash
bash scripts/fetch-ccusage-sidecars.sh   # ghi ra src-tauri/binaries/ccusage-<target-triple>
```

## Yêu cầu hệ thống

- **Node.js + npm** — để build frontend và fetch sidecar (chỉ lúc build; bản đã cài
  **không cần Node** lúc chạy).
- **Rust** toolchain.
- **Ubuntu/Linux:** cần thư viện hệ thống của Tauri:
  ```bash
  sudo apt update
  sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file \
    libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev
  ```
  `libayatana-appindicator3-dev` cần cho tray. Trên GNOME (Ubuntu mặc định) có thể
  phải cài thêm extension **AppIndicator** để icon hiện trên top-bar.
- **macOS:** Xcode Command Line Tools.

## Chạy thử (dev)

```bash
pnpm install
bash scripts/fetch-ccusage-sidecars.sh   # một lần, nếu src-tauri/binaries/ trống
pnpm tauri dev
```

> Bước fetch sidecar **bắt buộc cho cả `tauri dev`**, không chỉ `tauri build` — Tauri
> validate `externalBin` (khai báo trong `src-tauri/tauri.conf.json`) ở compile time, nên
> binary cho target triple hiện tại phải tồn tại trên đĩa. Bỏ qua sẽ lỗi
> `resource path 'binaries/ccusage-<triple>' doesn't exist`.

## Build (local)

```bash
bash scripts/fetch-ccusage-sidecars.sh   # một lần, nếu src-tauri/binaries/ trống
pnpm tauri build
```

## Cài đặt (end user)

Tải installer phù hợp từ [release mới nhất trên GitHub](https://github.com/felixn678/agentmeter/releases/latest):

- **macOS Apple Silicon:** `agentmeter_X.Y.Z_aarch64.dmg`
- **macOS Intel:** `agentmeter_X.Y.Z_x64.dmg`
- **Ubuntu/Debian:** `agentmeter_X.Y.Z_amd64.deb` (update bằng `sudo apt upgrade agentmeter` — auto-update tắt sẵn cho dpkg install)
- **Linux portable:** `agentmeter_X.Y.Z_amd64.AppImage` (auto-update in-place)

Tối thiểu: macOS 11 (Big Sur), Ubuntu 22.04+ (cần `libwebkit2gtk-4.1-0`).

### Lần đầu mở trên macOS (build unsigned)

agentmeter hiện chưa có Apple Developer signing. Lần đầu mở cần bypass 1 lần:

1. Finder → Applications → **right-click** `agentmeter` → **Open**
2. Dialog "macOS cannot verify the developer…" → bấm **Open**
3. Xong. Lần sau double-click bình thường; auto-update giữ nguyên bypass.

Terminal — strip quarantine xattr:
```bash
xattr -dr com.apple.quarantine /Applications/agentmeter.app
```

Nếu right-click không mở được: System Settings → Privacy & Security → kéo xuống "agentmeter was blocked…" → **Open Anyway**.

## Release

Flow release theo tag (release-please + matrix build + auto-update ký minisign). Xem **[docs/release-runbook-vi.md](docs/release-runbook-vi.md)** cho quy trình đầy đủ.

Quick reference sau khi merge Release PR:
```bash
pnpm release:build   # build + upload installers + latest.json vào tag mới
```

## macOS WidgetKit widget (optional, local build)

Widget native Notification Center / Desktop hiện today / week / month / burn rate. Mac-only, build local với Apple ID free. Xem **[src-tauri/macos-widget/README-vi.md](src-tauri/macos-widget/README-vi.md)** cho one-shot:

```bash
pnpm widget:build:mac   # build widget + tauri app, embed .appex, re-sign deep
```

Release qua macOS CI (`pnpm release:build`) **KHÔNG** ship widget — đây là feature local-build đến khi có paid Apple Developer ID.

## Giấy phép

[MIT](LICENSE) © 2026 Felix Nguyen.

agentmeter đóng gói [`ccusage`](https://github.com/ryoppippi/ccusage) (MIT) dưới dạng
sidecar binary độc lập; giấy phép và bản quyền của ccusage được giữ kèm theo binary đó.
Các dependency khác (Tauri, React) là MIT/Apache-2.0.
