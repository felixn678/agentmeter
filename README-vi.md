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
đọc dữ liệu **không cần Node hay ccusage trên máy**. Nếu sidecar thiếu (vd lúc dev chưa
fetch) thì fallback về `npx ccusage@latest`.

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
npm install
npm run tauri dev
```

## Build

```bash
bash scripts/fetch-ccusage-sidecars.sh   # một lần, nếu src-tauri/binaries/ trống
npm run tauri build
```
