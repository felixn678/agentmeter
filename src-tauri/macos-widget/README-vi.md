# macOS WidgetKit Widget

> 🌐 English: [README.md](README.md)

WidgetKit extension native cho macOS (Notification Center + Desktop, family
small + medium) render cost hôm nay, tổng week/month, trend so với avg 7 ngày,
và burn rate hiện tại từ snapshot file Phase-1.

**Mac-only.** Không build/chạy được trên Linux/Windows. Host app Tauri vẫn
cross-platform; chỉ widget extension này gắn với macOS.

## Prerequisites (làm 1 lần trên Mac)

1. **Xcode 15+** (free từ App Store).
2. **Sign in Xcode → Settings → Accounts** bằng Apple ID. Apple ID free cho
   bạn cert *Apple Development* — đúng cái cần. Ad-hoc (`-`) **không hoạt
   động**: PlugInKit reject + widget không hiện trong gallery.
3. **XcodeGen:**
   ```sh
   brew install xcodegen
   ```
   Track `project.yml` (human-readable) thay cho `.xcodeproj` generated.

## One-shot build (khuyến nghị)

Từ repo root:

```sh
pnpm widget:build:mac
```

Làm tuần tự:
1. `xcodegen generate` (nếu `.xcodeproj` thiếu)
2. `xcodebuild` widget → `AgentmeterWidget.appex`
3. `pnpm tauri build` host app
4. Embed `.appex` vào `agentmeter.app/Contents/PlugIns/` + re-sign deep
5. `codesign --verify --deep --strict` để confirm

Output: `src-tauri/target/release/bundle/macos/agentmeter.app` với widget
embedded.

## Cài + test trên Mac

```sh
# 1. Copy vào /Applications để PlugInKit discover widget bên trong.
#    (Chạy từ build dir có thể fail extension discovery.)
cp -R src-tauri/target/release/bundle/macos/agentmeter.app /Applications/

# 2. Mở host app 1 lần để bắt đầu ghi snapshot file.
open -a /Applications/agentmeter.app

# 3. Mở Notification Center (vuốt 2 ngón tay từ phải sang) →
#    Edit Widgets → search "agentmeter" → kéo systemSmall hoặc systemMedium vào.
#    Hoặc right-click Desktop → Edit Widgets (macOS 14+).

# 4. Xem snapshot file:
cat ~/Library/Containers/com.agentmeter.app.widget/Data/Library/Application\ Support/agentmeter/snapshot.json
```

## Step-by-step thủ công (nếu `pnpm widget:build:mac` fail giữa chừng)

```sh
cd src-tauri/macos-widget
xcodegen generate                 # tạo AgentmeterWidget.xcodeproj
./build-appex.sh                  # tạo build/.../AgentmeterWidget.appex
cd ../..
pnpm tauri build                  # tạo target/release/bundle/macos/agentmeter.app
src-tauri/macos-widget/embed-widget.sh   # embed + re-sign + verify
```

Override signing identity bằng `CODESIGN_ID` trước khi chạy script:

```sh
export CODESIGN_ID="Apple Development: you@example.com (TEAMID)"
```

List identities có: `security find-identity -v -p codesigning`.

## Caveat (free-team only)

- **macOS 15 (Sequoia) + free Apple ID = PlugInKit silently refuse register
  widget extension.** Đã verify thực tế: widget build + sign sạch,
  `codesign --verify --deep --strict` PASS, embed `.app` copy vào
  `/Applications/` đúng — nhưng widget không xuất hiện trong Notification
  Center gallery và `pluginkit -m -p com.apple.widgetkit-extension` không
  list nó. Sequoia siết chặt extension validation: PlugInKit yêu cầu widget
  host bundle phải pass `spctl` assessment, và free-team `Apple Development`
  cert bị Gatekeeper `rejected` vì chưa notarized. `sudo spctl --master-disable`
  trên Sequoia yêu cầu confirm trong System Settings, và kể cả khi confirm
  cũng không đảm bảo PlugInKit accept (Apple có thêm extension-specific
  checks). Cách duy nhất gỡ block triệt để là **paid Apple Developer ID
  + notarization** — defer sang Phase 4 chưa làm của widget plan. Code Swift
  + signing pipeline ở đây ĐÚNG cho paid path; block hiện tại thuần Apple
  platform policy, không phải bug repo.
- **Widget cần macOS 14 (Sonoma) trở lên.** Host Tauri app vẫn chạy được
  macOS 11+; chỉ widget extension cần macOS 14 vì dùng SwiftUI
  `containerBackground` modifier. Trên macOS 11–13 host app vẫn OK nhưng
  widget extension không load (PlugInKit silently reject).
- **Đừng cài từ `.dmg`.** `pnpm tauri build` chạy *trước* bước embed, nên
  Tauri seal `.dmg` chứa `.app` chưa embed widget. Luôn cài `.app` đã embed
  từ `src-tauri/target/release/bundle/macos/agentmeter.app` (copy vào
  `/Applications/`).
- **Cert hết hạn sau 7 ngày.** Free Apple ID provisioning expire sau 7 ngày →
  widget stop load → phải rebuild. (Phase 4 paid Developer ID sẽ fix.)
- **Gatekeeper warning lần đầu.** Host app vẫn unsigned cho distribution;
  lần đầu mở cần bypass right-click → Open (xem README chính → "First launch
  on macOS").
- **Chưa auto-refresh push từ app.** Widget refresh theo timeline policy
  `.after(~15min)` của chính nó. WidgetKit budget ~40-70 reload/day per widget
  trên macOS, coarse refresh là default.

## Layout

```
src-tauri/macos-widget/
├── project.yml                  # XcodeGen config (tracked)
├── Info.plist                   # NSExtension → com.apple.widgetkit-extension
├── AgentmeterWidget.entitlements # sandbox-only (không App Group cho MVP)
├── Sources/
│   ├── Snapshot.swift           # Codable mirror của WidgetSnapshot
│   ├── Provider.swift           # TimelineProvider, đọc container của chính nó
│   ├── Views.swift              # SwiftUI small + medium views
│   └── AgentmeterWidget.swift   # @main entry
├── build-appex.sh               # xcodebuild → .appex
└── embed-widget.sh              # embed vào agentmeter.app + re-sign deep
```

Generated (gitignored): `AgentmeterWidget.xcodeproj/`, `build/`.

Bundle id **`com.agentmeter.app.widget`** là single source of truth quyết
định sandbox container path Phase-1 Rust writer target (xem
`shared/SCHEMA.md` → WidgetSnapshot).
