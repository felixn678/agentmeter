//! Widget data bridge.
//!
//! The macOS WidgetKit widget runs in its own sandboxed process and cannot call
//! Tauri commands, so the (non-sandboxed) app writes a small JSON snapshot into
//! the widget's own sandbox container. The widget reads its own container with
//! no entitlement and no App Group involved — App Groups are deferred to the
//! paid-Developer-ID phase because their identifiers get an auto-prefixed
//! team-id under a free Apple team.
//!
//! Bundle id of the widget extension is the single source of truth for the
//! container path; it MUST match the Phase-2 target id exactly.

use serde::{Deserialize, Serialize};

/// Bundle id of the widget extension. The widget's sandbox container is keyed
/// on this id, so the snapshot path is derived from it.
pub const WIDGET_BUNDLE_ID: &str = "com.agentmeter.app.widget";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BucketCost {
    pub cost: f64,
    #[serde(default)]
    pub tokens: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Trend {
    /// Absolute percentage change vs the prior-window average.
    pub pct: f64,
    /// "up" | "down" | "flat".
    pub dir: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BurnRate {
    /// USD/hour from the current ccusage billing block, 0 when inactive.
    pub cost_per_hour: f64,
    pub active: bool,
}

/// What the widget renders. Kept tiny and pre-computed; the widget never
/// re-derives anything from this payload.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WidgetSnapshot {
    pub schema_version: u32,
    /// ISO-8601 UTC ("Z"-suffixed), already formatted by the caller.
    pub generated_at: String,
    pub today: BucketCost,
    pub week: BucketCost,
    pub month: BucketCost,
    pub trend: Option<Trend>,
    pub burn_rate: BurnRate,
}

/// Write the snapshot to the widget's sandbox container. Best-effort: a write
/// failure is logged via the returned `Err` and never escalated — the caller
/// (`write_widget_snapshot` command) swallows it so the UI thread is unaffected.
///
/// Non-macOS callers see this as a no-op success (the widget only exists on
/// macOS; the rest of the app stays cross-platform).
#[cfg(target_os = "macos")]
pub fn write(snapshot: &WidgetSnapshot) -> Result<(), String> {
    use std::fs;
    use std::io::Write;

    let home = std::env::var("HOME").map_err(|e| format!("HOME unset: {e}"))?;
    let dir = std::path::PathBuf::from(home)
        .join("Library")
        .join("Containers")
        .join(WIDGET_BUNDLE_ID)
        .join("Data")
        .join("Library")
        .join("Application Support")
        .join("agentmeter");

    // The widget's container is created by macOS when the widget extension is
    // first registered. Until then the path does not exist; mkdir -p is safe
    // either way because the (non-sandboxed) app can write into Containers.
    fs::create_dir_all(&dir).map_err(|e| format!("mkdir {}: {e}", dir.display()))?;

    let final_path = dir.join("snapshot.json");
    let tmp_path = dir.join("snapshot.json.tmp");

    let bytes = serde_json::to_vec_pretty(snapshot)
        .map_err(|e| format!("serialize snapshot: {e}"))?;

    {
        let mut f = fs::File::create(&tmp_path)
            .map_err(|e| format!("create {}: {e}", tmp_path.display()))?;
        f.write_all(&bytes)
            .map_err(|e| format!("write {}: {e}", tmp_path.display()))?;
        f.sync_all().ok();
    }

    fs::rename(&tmp_path, &final_path).map_err(|e| {
        format!(
            "rename {} -> {}: {e}",
            tmp_path.display(),
            final_path.display()
        )
    })
}

#[cfg(not(target_os = "macos"))]
pub fn write(_snapshot: &WidgetSnapshot) -> Result<(), String> {
    // Widget only exists on macOS — no-op on other targets to keep the
    // cross-platform command surface uniform.
    Ok(())
}
