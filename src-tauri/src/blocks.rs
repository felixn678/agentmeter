//! Live "burn rate" from ccusage's 5-hour billing blocks (`ccusage blocks --json`).
//! We only surface the currently active block as a small summary for the UI.

use serde::{Deserialize, Serialize};
use tauri::AppHandle;

#[derive(Deserialize)]
struct BurnRate {
    #[serde(rename = "costPerHour", default)]
    cost_per_hour: f64,
}

#[derive(Deserialize)]
struct Projection {
    #[serde(rename = "remainingMinutes", default)]
    remaining_minutes: i64,
    #[serde(rename = "totalCost", default)]
    total_cost: f64,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct RawBlock {
    #[serde(default)]
    is_active: bool,
    // ccusage spells this "costUSD" (capital USD), which camelCase wouldn't match.
    #[serde(rename = "costUSD", default)]
    cost_usd: f64,
    burn_rate: Option<BurnRate>,
    projection: Option<Projection>,
}

#[derive(Deserialize)]
struct RawBlocks {
    blocks: Vec<RawBlock>,
}

/// Slim summary of the active billing block, sent to the frontend.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ActiveBlock {
    /// Spend so far in the current block.
    pub cost_usd: f64,
    /// Current burn rate in USD/hour.
    pub cost_per_hour: f64,
    /// Projected total cost by the end of the block.
    pub projected_cost: f64,
    /// Minutes remaining in the block.
    pub remaining_minutes: i64,
}

/// Fetch the active block summary, or `None` if no block is active right now.
pub async fn fetch_active(app: &AppHandle) -> Result<Option<ActiveBlock>, String> {
    let bytes = crate::ccusage::run_ccusage(app, &["blocks", "--json"]).await?;
    let parsed: RawBlocks =
        serde_json::from_slice(&bytes).map_err(|e| format!("Failed to parse blocks JSON: {e}"))?;

    let active = parsed.blocks.into_iter().find(|b| b.is_active);
    Ok(active.map(|b| ActiveBlock {
        cost_usd: b.cost_usd,
        cost_per_hour: b.burn_rate.map(|r| r.cost_per_hour).unwrap_or(0.0),
        projected_cost: b.projection.as_ref().map(|p| p.total_cost).unwrap_or(0.0),
        remaining_minutes: b.projection.map(|p| p.remaining_minutes).unwrap_or(0),
    }))
}
