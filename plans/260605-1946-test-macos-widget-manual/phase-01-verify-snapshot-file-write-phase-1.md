---
phase: 1
title: Verify snapshot file write (Phase-1)
status: completed
priority: P1
effort: 5min
dependencies: []
---

# Phase 1: Verify snapshot file write

## Overview
Confirm the host Tauri app writes a valid `snapshot.json` into the widget's
sandbox container path. **No Swift/Xcode work needed for this phase.**

## Implementation Steps

### Step 1 — Run the host app

```sh
pnpm tauri dev
```

Wait for the dashboard window to open. Leave it on the default view for
~15s so `useUsageReports` finishes its initial load and one revalidation
tick fires.

### Step 2 — Confirm the file exists

```sh
SNAP="$HOME/Library/Containers/com.agentmeter.app.widget/Data/Library/Application Support/agentmeter/snapshot.json"
ls -la "$SNAP"
```

**Expected:** the file exists. Size is small (<1 KB).

If `ls` says "No such file": the host app hasn't written yet. Focus the
dashboard window, wait 30s, retry.

### Step 3 — Confirm the schema is valid

```sh
cat "$SNAP" | jq .
```

**Expected output:**

```jsonc
{
  "schemaVersion": 1,
  "generatedAt": "2026-…Z",
  "today":   { "cost": …, "tokens": … },
  "week":    { "cost": …, "tokens": … },
  "month":   { "cost": …, "tokens": … },
  "trend":   { "pct": …, "dir": "up" | "down" | "flat" } | null,
  "burnRate": { "costPerHour": …, "active": true | false }
}
```

Check the keys match the schema in `shared/SCHEMA.md` → WidgetSnapshot.
`trend` may be `null` if you have less than 2 days of usage history.

### Step 4 — Confirm revalidation rewrites the file

```sh
# baseline hash
md5 "$SNAP"
# wait ~60s (or whatever your Settings → revalidation interval is)
sleep 60
md5 "$SNAP"
```

**Expected:** the two MD5s differ (`generatedAt` advances every revalidation
even when cost values haven't changed).

If the hash stays identical: the dashboard window may be hidden — the
revalidation effect pauses when `document.hidden` is true. Show the window
and retry.

### Step 5 — Confirm atomic write semantics

```sh
DIR="$HOME/Library/Containers/com.agentmeter.app.widget/Data/Library/Application Support/agentmeter"
ls "$DIR"
```

**Expected:** only `snapshot.json`. If you see `snapshot.json.tmp`, a write
crashed mid-rename — restart the host app and retry step 2.

## Success Criteria

- [ ] `snapshot.json` exists at the documented path within 30s of dashboard
      open.
- [ ] `jq .` parses without error.
- [ ] All required keys are present (`schemaVersion`, `generatedAt`, `today`,
      `week`, `month`, `burnRate`); `trend` may be `null`.
- [ ] `md5` changes between two reads 60s apart.
- [ ] No leftover `.tmp` file in the directory.

## Common Failures + Fixes

| Symptom | Cause | Fix |
|---|---|---|
| Path does not exist at all (parent dir missing) | Host app never ran, OR ran on a non-macOS target | Run `pnpm tauri dev` on macOS; check the dashboard window opened |
| `Permission denied` reading the dir | Some old install left a sandboxed copy that owns the container | `xattr -dr com.apple.quarantine` the host app, or `rm -rf` the container dir and let the app recreate it |
| Empty file (0 bytes) | An atomic rename was interrupted | Restart the host app; the next revalidation tick rewrites cleanly |
| `today.cost` is `0` despite real usage | `ccusage` failed; tray title also shows `⚠` | Check ccusage works manually: `npx ccusage daily --json` |
| `burnRate.active` always `false` | No live ccusage block in the last 5 hours | Expected — start a coding-agent session to populate the active block |
