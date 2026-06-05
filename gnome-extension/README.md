# GNOME extension (Phase 4 — not started)

> 🌐 Tiếng Việt: [README-vi.md](README-vi.md)

A GNOME Shell extension (GJS) that shows the cost "natively" in Ubuntu's
top-bar/panel. This is the closest equivalent to a system widget on GNOME (Linux
has no WidgetKit).

The extension reads a JSON snapshot pre-written by the Rust core (see
[`../shared/SCHEMA.md`](../shared/SCHEMA.md)) — it does NOT run ccusage itself.
GNOME only.
