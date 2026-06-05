# agentmeter

> 🌐 Tiếng Việt: [README-vi.md](README-vi.md)

A lightweight app that shows the usage & cost of coding agent CLIs (Claude Code,
Codex, Gemini…) right in the **menubar/tray**, plus a full dashboard window.
Inspired by the **Stats** app on macOS. Runs on **macOS** and **Ubuntu**.

Data comes from [`ccusage`](https://github.com/ryoppippi/ccusage) — a tool that
reads the local logs of agent CLIs. agentmeter does not parse logs itself; it
calls `ccusage --json` and presents the result, so it automatically supports every
provider ccusage supports.

## Stack

- **Core + tray:** Rust (Tauri v2) — `src-tauri/`
- **UI:** React + TypeScript + Vite — `src/`
- Native widgets (later phase) are split per platform and read the same core data.

## Architecture

Rule #1: **separate the data core from the UI.** Every UI consumes the same
normalized data source, so going "simple → complex" is just adding UI, never a
rewrite.

```
agentmeter/
├─ src/              # React + TS: tray dropdown (Phase 1) + dashboard (Phase 2)
├─ src-tauri/        # Rust: core runs ccusage --json, parses, exposes via command + tray
│  └─ src/ccusage.rs # all the run & parse logic for ccusage (no UI here)
├─ shared/           # SCHEMA.md — the shared data contract for every UI
├─ macos-widget/     # (Phase 4) WidgetKit/Swift — macOS only
└─ gnome-extension/  # (Phase 4) GJS — native widget for GNOME/Ubuntu
```

Native widgets **do not run ccusage themselves** (extensions are resource-limited).
The core computes and writes the data to a file at the OS standard location; the
widget only reads that file.

## Roadmap

| Phase | Scope | Platforms | Status |
|-------|-------|-----------|--------|
| 1 — MVP | Tray icon + dropdown showing today's cost; window listing by day/week/month | Mac + Ubuntu | ✅ done |
| 2 — Dashboard | Line/bar/pie charts, filter by model & agent | Mac + Ubuntu | ⬜ |
| 3 — Cross-platform widget | Always-on-top Tauri widget window | Mac + Ubuntu | ⬜ |
| 4 — Native widget | WidgetKit (Swift) for Mac; GNOME extension (GJS) for Ubuntu | Per-OS | ⬜ |

## System requirements

- **Node.js** (to run `ccusage` via `npx`).
- **Rust** toolchain.
- **Ubuntu/Linux:** Tauri's system libraries:
  ```bash
  sudo apt update
  sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file \
    libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev
  ```
  `libayatana-appindicator3-dev` is needed for the tray. On GNOME (Ubuntu default)
  you may also need to install the **AppIndicator** extension for the icon to show
  in the top bar.
- **macOS:** Xcode Command Line Tools.

## Run (dev)

```bash
npm install
npm run tauri dev
```

## Build

```bash
npm run tauri build
```
