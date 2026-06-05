# macOS widget (Phase 4 — not started)

> 🌐 Tiếng Việt: [README-vi.md](README-vi.md)

A WidgetKit + SwiftUI extension that shows the cost on the desktop / Notification
Center, like Apple's Calendar/Weather widgets.

The widget reads a JSON snapshot pre-written by the Rust core (see
[`../shared/SCHEMA.md`](../shared/SCHEMA.md)) — it does NOT run ccusage itself.
macOS only.
