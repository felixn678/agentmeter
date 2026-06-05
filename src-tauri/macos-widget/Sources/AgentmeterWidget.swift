// Entry point for the agentmeter Widget Extension.
//
// Bundle id must be `com.agentmeter.app.widget` — that id is the single source
// of truth that determines the sandbox container path the Phase-1 Rust writer
// targets (see shared/SCHEMA.md and src-tauri/src/snapshot.rs).

import SwiftUI
import WidgetKit

@main
struct AgentmeterWidget: Widget {
  let kind: String = "AgentmeterWidget"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: Provider()) { entry in
      AgentmeterWidgetEntryView(entry: entry)
    }
    .configurationDisplayName("agentmeter")
    .description("Today's coding-agent spend, week/month totals, and burn rate.")
    .supportedFamilies([.systemSmall, .systemMedium])
  }
}

struct AgentmeterWidgetEntryView: View {
  let entry: Entry
  @Environment(\.widgetFamily) private var family

  var body: some View {
    switch family {
    case .systemSmall:  SmallView(snap: entry.snap)
    case .systemMedium: MediumView(snap: entry.snap)
    default:            SmallView(snap: entry.snap)
    }
  }
}

#if DEBUG
#Preview(as: .systemSmall)  { AgentmeterWidget() } timeline: { Entry.preview }
#Preview(as: .systemMedium) { AgentmeterWidget() } timeline: { Entry.preview }
#endif
