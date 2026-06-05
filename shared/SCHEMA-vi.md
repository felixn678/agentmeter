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

## Ghi chú cho widget native (Phase 4)

Widget native KHÔNG gọi ccusage trực tiếp. Lõi (Rust) sẽ định kỳ tính sẵn và ghi
một snapshot JSON theo schema trên ra vị trí chuẩn của OS (ví dụ
`~/.local/state/agentmeter/latest.json` trên Linux, App Group container trên macOS);
widget chỉ đọc file đó. Vị trí cụ thể sẽ chốt khi bắt đầu Phase 4.
