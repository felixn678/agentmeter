# Hợp đồng dữ liệu (data contract)

> 🌐 English: [SCHEMA.md](SCHEMA.md)

Tất cả UI của agentmeter — tray, dashboard, và (phase sau) widget native trên
macOS/GNOME — đều tiêu thụ **cùng một** cấu trúc dữ liệu này. Nguồn sự thật là
struct Rust trong [`../src-tauri/src/ccusage.rs`](../src-tauri/src/ccusage.rs);
file này chỉ mô tả lại để các thành phần không-Rust (Swift, GJS) bám theo.

Serde serialize sang JSON **camelCase**.

## UsageReport

```jsonc
{
  "entries": [ UsageEntry, ... ],  // theo thứ tự thời gian tăng dần
  "totals":  Totals
}
```

## UsageEntry

```jsonc
{
  "period": "2026-06-05",          // nhãn khoảng thời gian (ngày | tuần | tháng)
  "agent": "all",                  // "all" hoặc tên agent
  "totalCost": 1.0424905,          // USD
  "totalTokens": 604308,
  "inputTokens": 7898,
  "outputTokens": 21839,
  "cacheCreationTokens": 29520,
  "cacheReadTokens": 545051,
  "modelsUsed": ["claude-opus-4-8"],
  "modelBreakdowns": [ ModelBreakdown, ... ]
}
```

## ModelBreakdown

```jsonc
{
  "modelName": "claude-opus-4-8",
  "cost": 1.0424905,
  "inputTokens": 7898,
  "outputTokens": 21839,
  "cacheCreationTokens": 29520,
  "cacheReadTokens": 545051
}
```

## Totals

```jsonc
{
  "totalCost": 16.214109,
  "totalTokens": 16058796,
  "inputTokens": 15849,
  "outputTokens": 206032,
  "cacheCreationTokens": 533149,
  "cacheReadTokens": 15303766
}
```

## WidgetSnapshot (cầu nối WidgetKit macOS)

Widget native KHÔNG gọi ccusage trực tiếp — nó chạy ở process sandbox riêng.
App Tauri ghi sẵn một snapshot file cho widget đọc. Schema:

```jsonc
{
  "schemaVersion": 1,
  "generatedAt": "2026-06-05T12:00:00Z",   // ISO-8601 UTC
  "today":   { "cost": 7.50, "tokens": 604308 },
  "week":    { "cost": 22.0, "tokens": 4231590 },
  "month":   { "cost": 120.0, "tokens": 19284731 },
  "trend":   { "pct": 38.0, "dir": "up" }, // today vs avg 7 ngày; dir = up|down|flat; null khi n<2 ngày
  "burnRate": { "costPerHour": 4.25, "active": true }
}
```

**Source of truth:** struct Rust trong
[`../src-tauri/src/snapshot.rs`](../src-tauri/src/snapshot.rs); helper frontend
ở `src/lib/widget-snapshot.ts` mirror lại. Write atomic (`snapshot.json.tmp` →
rename).

### Đường dẫn bridge (macOS, MVP)

```
~/Library/Containers/com.agentmeter.app.widget/Data/Library/Application Support/agentmeter/snapshot.json
```

- Widget bundle id: **`com.agentmeter.app.widget`** — single source of truth
  cho path; target Xcode ở Phase-2 phải dùng đúng id này.
- App Tauri (không sandbox) tự `mkdir -p` container path. Khi widget extension
  chưa được install, write của app vẫn land — timeline reload đầu tiên của
  widget sẽ thấy file.
- Widget sandbox đọc container của chính nó tự do — không cần entitlement,
  không cần App Group, không bị Apple team id prefix mismatch.

App Groups (container `group.com.agentmeter.shared` portable với entitlement
rõ ràng) defer sang phase paid-Developer-ID; free Apple team auto-prefix App
Group id bằng team id, Rust writer dùng id cố định không match được.

### Linux / Windows

Command Rust compile cross-platform nhưng write là no-op ngoài macOS
(`#[cfg(target_os = "macos")]`). Floating widget window cross-platform của
Tauri đã cover Linux; GNOME extension bị bỏ.
