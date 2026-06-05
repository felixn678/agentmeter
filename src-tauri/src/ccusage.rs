//! Data core of agentmeter.
//!
//! Its only responsibility: run `ccusage <cmd> --json`, parse the output, and
//! normalize it into shared structs. This layer knows nothing about the UI/tray —
//! every interface (tray dropdown, dashboard, and later the native widgets)
//! consumes this same data.

use serde::{Deserialize, Serialize};
use std::process::Command;

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

/// Run ccusage and return the parsed report.
///
/// Currently invoked through `npx ccusage@latest`, so the user needs Node.
/// (A later phase may allow pointing at a pre-installed ccusage binary to drop
/// the npx dependency.)
pub fn fetch(granularity: Granularity) -> Result<UsageReport, String> {
    let output = Command::new("npx")
        .args(["-y", "ccusage@latest", granularity.subcommand(), "--json"])
        .output()
        .map_err(|e| format!("Failed to run ccusage via npx: {e}. Is Node/npm installed?"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("ccusage returned an error: {}", stderr.trim()));
    }

    serde_json::from_slice(&output.stdout)
        .map_err(|e| format!("Failed to parse JSON from ccusage: {e}"))
}

/// Get the most recent entry (the bucket closest to now). ccusage returns
/// entries in ascending chronological order, so the last element is newest.
pub fn latest_entry(report: &UsageReport) -> Option<&UsageEntry> {
    report.entries.last()
}
