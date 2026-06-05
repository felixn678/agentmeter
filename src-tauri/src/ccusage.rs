//! Data core of agentmeter.
//!
//! Its only responsibility: run `ccusage <cmd> --json`, parse the output, and
//! normalize it into shared structs. This layer knows nothing about the UI/tray —
//! every interface (tray dropdown, dashboard, and later the native widgets)
//! consumes this same data.

use serde::{Deserialize, Serialize};
#[cfg(debug_assertions)]
use std::process::Command;
use tauri::AppHandle;
use tauri_plugin_shell::ShellExt;

/// One usage row for a time bucket (a day, week, or month) from ccusage.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UsageEntry {
    /// Period label, e.g. "2026-06-05".
    pub period: String,
    /// "all" or a specific agent name.
    #[serde(default)]
    pub agent: String,
    pub total_cost: f64,
    pub total_tokens: u64,
    #[serde(default)]
    pub input_tokens: u64,
    #[serde(default)]
    pub output_tokens: u64,
    #[serde(default)]
    pub cache_creation_tokens: u64,
    #[serde(default)]
    pub cache_read_tokens: u64,
    #[serde(default)]
    pub models_used: Vec<String>,
    #[serde(default)]
    pub model_breakdowns: Vec<ModelBreakdown>,
}

/// Per-model usage detail within a time bucket.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelBreakdown {
    pub model_name: String,
    pub cost: f64,
    #[serde(default)]
    pub input_tokens: u64,
    #[serde(default)]
    pub output_tokens: u64,
    #[serde(default)]
    pub cache_creation_tokens: u64,
    #[serde(default)]
    pub cache_read_tokens: u64,
}

/// Grand totals across all time buckets.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Totals {
    pub total_cost: f64,
    pub total_tokens: u64,
    #[serde(default)]
    pub input_tokens: u64,
    #[serde(default)]
    pub output_tokens: u64,
    #[serde(default)]
    pub cache_creation_tokens: u64,
    #[serde(default)]
    pub cache_read_tokens: u64,
}

/// The full output of one `ccusage <cmd> --json` invocation.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UsageReport {
    #[serde(alias = "daily", alias = "weekly", alias = "monthly")]
    pub entries: Vec<UsageEntry>,
    #[serde(default)]
    pub totals: Totals,
}

/// Aggregation granularity supported by ccusage.
#[derive(Debug, Clone, Copy)]
pub enum Granularity {
    Daily,
    Weekly,
    Monthly,
}

impl Granularity {
    fn subcommand(self) -> &'static str {
        match self {
            Granularity::Daily => "daily",
            Granularity::Weekly => "weekly",
            Granularity::Monthly => "monthly",
        }
    }
}

fn parse(stdout: &[u8]) -> Result<UsageReport, String> {
    serde_json::from_slice(stdout).map_err(|e| format!("Failed to parse JSON from ccusage: {e}"))
}

/// Run a ccusage subcommand and return raw stdout bytes.
///
/// Prefers the bundled standalone sidecar. In debug builds, falls back to
/// `npx ccusage@latest` for local dev convenience. Release builds DO NOT
/// include the npx fallback — auto-update would otherwise launder an
/// unverified npm package into a code path signed by our minisign key.
pub async fn run_ccusage(app: &AppHandle, args: &[&str]) -> Result<Vec<u8>, String> {
    if let Ok(cmd) = app.shell().sidecar("ccusage") {
        if let Ok(out) = cmd.args(args.iter().copied()).output().await {
            if out.status.success() {
                return Ok(out.stdout);
            }
        }
    }

    #[cfg(debug_assertions)]
    {
        run_via_npx(args)
    }

    #[cfg(not(debug_assertions))]
    {
        let _ = args;
        Err("ccusage sidecar unavailable. Reinstall agentmeter or report this issue.".to_string())
    }
}

#[cfg(debug_assertions)]
fn run_via_npx(args: &[&str]) -> Result<Vec<u8>, String> {
    let mut npx_args = vec!["-y", "ccusage@latest"];
    npx_args.extend_from_slice(args);
    let output = Command::new("npx").args(npx_args).output().map_err(|e| {
        format!("ccusage sidecar unavailable and npx failed: {e}. Install Node, or run a bundled build.")
    })?;
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("ccusage returned an error: {}", stderr.trim()));
    }
    Ok(output.stdout)
}

/// Run ccusage at the given granularity and return the parsed report.
pub async fn fetch(app: &AppHandle, granularity: Granularity) -> Result<UsageReport, String> {
    let bytes = run_ccusage(app, &[granularity.subcommand(), "--json"]).await?;
    parse(&bytes)
}

/// Get the most recent entry (the bucket closest to now). ccusage returns
/// entries in ascending chronological order, so the last element is newest.
pub fn latest_entry(report: &UsageReport) -> Option<&UsageEntry> {
    report.entries.last()
}
