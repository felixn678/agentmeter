// SwiftUI views for the agentmeter widget.
//
// Two families: systemSmall (today + trend) and systemMedium (today / week /
// month / burn rate). Orange accent matches the app brand (#ff7a00 / #ff9f0a).
// Pure renderer — never recomputes anything from the snapshot.

import SwiftUI
import WidgetKit

private let accentLight = Color(red: 1.00, green: 0.478, blue: 0.000)   // #ff7a00
private let accentDark = Color(red: 1.00, green: 0.624, blue: 0.039)    // #ff9f0a

private extension Color {
  static func brand(_ scheme: ColorScheme) -> Color {
    scheme == .dark ? accentDark : accentLight
  }
}

private func fmtUSD(_ v: Double) -> String {
  let f = NumberFormatter()
  f.numberStyle = .currency
  f.currencyCode = "USD"
  f.minimumFractionDigits = 2
  f.maximumFractionDigits = 2
  return f.string(from: NSNumber(value: v)) ?? "$\(v)"
}

private func arrow(for dir: String) -> String {
  switch dir {
  case "up": return "↑"
  case "down": return "↓"
  default: return "→"
  }
}

// MARK: - Small

struct SmallView: View {
  let snap: WidgetSnapshot
  @Environment(\.colorScheme) private var scheme

  var body: some View {
    VStack(alignment: .leading, spacing: 6) {
      HStack(spacing: 6) {
        Circle()
          .fill(Color.brand(scheme))
          .frame(width: 8, height: 8)
        Text("agentmeter")
          .font(.system(size: 11, weight: .semibold))
          .foregroundStyle(.secondary)
      }
      Spacer(minLength: 0)
      Text("Today")
        .font(.system(size: 11, weight: .medium))
        .foregroundStyle(.secondary)
      Text(fmtUSD(snap.today.cost))
        .font(.system(size: 28, weight: .bold, design: .rounded))
        .monospacedDigit()
        .minimumScaleFactor(0.7)
        .lineLimit(1)
      if let t = snap.trend {
        HStack(spacing: 3) {
          Text(arrow(for: t.dir))
          Text("\(Int(t.pct.rounded()))%")
            .monospacedDigit()
        }
        .font(.system(size: 11, weight: .semibold))
        .foregroundStyle(Color.brand(scheme))
      }
    }
    .padding(14)
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    .containerBackground(.background, for: .widget)
  }
}

// MARK: - Medium

struct MediumView: View {
  let snap: WidgetSnapshot
  @Environment(\.colorScheme) private var scheme

  var body: some View {
    HStack(alignment: .top, spacing: 16) {
      // Left column: today + trend
      VStack(alignment: .leading, spacing: 4) {
        HStack(spacing: 6) {
          Circle()
            .fill(Color.brand(scheme))
            .frame(width: 8, height: 8)
          Text("agentmeter")
            .font(.system(size: 11, weight: .semibold))
            .foregroundStyle(.secondary)
        }
        Spacer(minLength: 0)
        Text("Today")
          .font(.system(size: 11, weight: .medium))
          .foregroundStyle(.secondary)
        Text(fmtUSD(snap.today.cost))
          .font(.system(size: 26, weight: .bold, design: .rounded))
          .monospacedDigit()
          .minimumScaleFactor(0.7)
          .lineLimit(1)
        if let t = snap.trend {
          HStack(spacing: 3) {
            Text(arrow(for: t.dir))
            Text("\(Int(t.pct.rounded()))% vs 7d avg")
              .monospacedDigit()
          }
          .font(.system(size: 10, weight: .semibold))
          .foregroundStyle(Color.brand(scheme))
        }
      }

      // Right column: week / month / burn rate
      VStack(alignment: .trailing, spacing: 8) {
        statRow(label: "Week",  value: fmtUSD(snap.week.cost))
        statRow(label: "Month", value: fmtUSD(snap.month.cost))
        statRow(
          label: snap.burnRate.active ? "Burn" : "Burn (idle)",
          value: snap.burnRate.active
            ? "\(fmtUSD(snap.burnRate.costPerHour))/hr"
            : "—"
        )
      }
    }
    .padding(14)
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    .containerBackground(.background, for: .widget)
  }

  @ViewBuilder
  private func statRow(label: String, value: String) -> some View {
    VStack(alignment: .trailing, spacing: 1) {
      Text(label)
        .font(.system(size: 10, weight: .medium))
        .foregroundStyle(.secondary)
      Text(value)
        .font(.system(size: 14, weight: .semibold, design: .rounded))
        .monospacedDigit()
        .lineLimit(1)
    }
  }
}
