# CLAUDE.md — agentmeter

Context for any Claude Code session working in this repo. Read this first.

## What this is

agentmeter is a lightweight **menubar/tray app** that shows the usage & cost of
coding-agent CLIs (Claude Code, Codex, Gemini…) — inspired by the macOS **Stats**
app. Cross-platform: **macOS + Ubuntu**. Data comes from
[`ccusage`](https://github.com/ryoppippi/ccusage); we do not parse agent logs
ourselves, we call `ccusage <cmd> --json` and present the result.

- Repo: https://github.com/felixn678/agentmeter (branch `master`)
- For the full pitch, architecture, and roadmap see **[README.md](README.md)**.

## Status

- **Phase 1 (MVP): done & verified.** Tray icon shows today's cost; window lists
  usage by day/week/month with per-model breakdown. Compiles and runs on Ubuntu.
- Next up: **Phase 2** — charts (line/bar/pie) + filter by model & agent.
- Roadmap (4 phases) lives in [README.md](README.md#roadmap).

## Stack

- **Core + tray:** Rust, Tauri v2 — `src-tauri/`
- **UI:** React + TypeScript + Vite — `src/`
- Native widgets (Phase 4) will be split per platform (`macos-widget/` WidgetKit,
  `gnome-extension/` GJS) and read the same core data.

## Architecture (the one rule that matters)

**Separate the data core from the UI.** Every UI consumes the same normalized
data, so growing from "simple → complex" is adding UI, never a rewrite.

| Path | Role |
|------|------|
| `src-tauri/src/ccusage.rs` | Data core: runs `ccusage --json`, parses into structs. **No UI here.** |
| `src-tauri/src/lib.rs` | Tauri `get_usage` command + tray icon (today's cost). |
| `src/App.tsx` | Dashboard UI: day/week/month toggle, totals, per-model rows. |
| `shared/SCHEMA.md` | The data contract every UI (incl. future native widgets) follows. |

The TS types in `App.tsx` mirror the Rust structs (serde **camelCase**). If you
change one side, update the other and `shared/SCHEMA.md`.

## Conventions (project rules)

- **Code and UI strings: English only.** No non-English text in `src/` or
  `src-tauri/src/`.
- **Human docs are bilingual:** each doc ships as `NAME.md` (English, default) and
  `NAME-vi.md` (Vietnamese), cross-linked at the top. Applies to README, SCHEMA,
  and the widget READMEs. (This file, `CLAUDE.md`, is AI-facing config — treat it
  like code: English only, no `-vi` variant.)
- **Commit/push only when the user explicitly asks.** Make changes, leave them in
  the working tree, and wait for an explicit "commit"/"push".
- Keep it small and lightweight — this is a tray app, not an IDE.

## Run / build

```bash
pnpm install           # first time
pnpm tauri dev         # run app (Vite + Tauri)
pnpm tauri build       # production build
```

System deps (already installed on this machine; needed on a fresh Ubuntu box):
`libwebkit2gtk-4.1-dev libayatana-appindicator3-dev librsvg2-dev` + the rest in
[README.md](README.md#system-requirements). On GNOME the tray icon needs the
**AppIndicator** shell extension to appear in the top bar (the window works
regardless). Running `ccusage` needs **Node** on PATH.

## Releases

Versioning + CI/CD release flow (release-please + matrix build + minisign
auto-update): **see [docs/release-runbook.md](docs/release-runbook.md)**.
Quick path after merging a Release PR: `pnpm release:build`.

## ClaudeKit (tooling)

This repo has the **ClaudeKit engineer kit** installed locally under `.claude/`
(skills, agents, hooks, rules). It is **gitignored** (reproducible — reinstall
with `ck init --kit engineer`), so it is not on GitHub. Its workflow rules
(`/ck:plan`, `/ck:cook`, `/ck:code-review`, …) are available when you run `claude`
from inside this directory.

@.claude/rules/CLAUDE.md
