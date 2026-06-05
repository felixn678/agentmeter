// Codable mirror of the Phase-1 WidgetSnapshot schema (shared/SCHEMA.md).
// JSON is camelCase; Swift's Codable handles that automatically since the
// property names already match the wire format. All non-essential fields are
// optional / defaulted so a future schemaVersion that adds keys decodes
// cleanly, and a missing snapshot.json maps to a graceful "empty" entry.

import Foundation

struct BucketCost: Codable {
  let cost: Double
  let tokens: UInt64?

  static let zero = BucketCost(cost: 0, tokens: 0)
}

struct SnapshotTrend: Codable {
  let pct: Double
  let dir: String  // "up" | "down" | "flat"
}

struct BurnRate: Codable {
  let costPerHour: Double
  let active: Bool

  static let inactive = BurnRate(costPerHour: 0, active: false)
}

struct WidgetSnapshot: Codable {
  let schemaVersion: Int
  let generatedAt: String   // ISO-8601 UTC
  let today: BucketCost
  let week: BucketCost
  let month: BucketCost
  let trend: SnapshotTrend?
  let burnRate: BurnRate

  static let placeholder = WidgetSnapshot(
    schemaVersion: 1,
    generatedAt: "2026-01-01T00:00:00Z",
    today: BucketCost(cost: 7.50, tokens: 604_308),
    week: BucketCost(cost: 22.0, tokens: 4_231_590),
    month: BucketCost(cost: 120.0, tokens: 19_284_731),
    trend: SnapshotTrend(pct: 38.0, dir: "up"),
    burnRate: BurnRate(costPerHour: 4.25, active: true)
  )

  static let empty = WidgetSnapshot(
    schemaVersion: 1,
    generatedAt: "—",
    today: .zero,
    week: .zero,
    month: .zero,
    trend: nil,
    burnRate: .inactive
  )
}
