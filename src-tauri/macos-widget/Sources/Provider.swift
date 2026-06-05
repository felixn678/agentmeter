// TimelineProvider for the agentmeter widget.
//
// The widget runs sandboxed; for the free-team MVP it reads the snapshot from
// its OWN container, NOT an App Group (App Group ids get a TEAMID. prefix under
// a free Apple team, which the Rust writer can't match). The non-sandboxed
// Tauri app (Phase 1) writes the same path the sandbox resolves below.

import WidgetKit

struct Entry: TimelineEntry {
  let date: Date
  let snap: WidgetSnapshot

  static let preview = Entry(date: Date(), snap: .placeholder)
  static let empty = Entry(date: Date(), snap: .empty)
}

struct Provider: TimelineProvider {
  func placeholder(in context: Context) -> Entry {
    .preview
  }

  func getSnapshot(in context: Context, completion: @escaping (Entry) -> Void) {
    completion(load())
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<Entry>) -> Void) {
    // WidgetKit budget is ~40-70 reloads/day on macOS; .after(15min) is a sane
    // coarse rate. The host app writes more frequently — the widget just picks
    // up whatever is on disk at the next reload tick.
    let next = Calendar.current.date(byAdding: .minute, value: 15, to: Date()) ?? Date()
    completion(Timeline(entries: [load()], policy: .after(next)))
  }

  /// Read the snapshot from the widget's own sandbox container.
  /// Returns a sentinel `.empty` entry on any error (file absent, decode failure)
  /// so the gallery and first-add render cleanly.
  private func load() -> Entry {
    guard
      let support = try? FileManager.default.url(
        for: .applicationSupportDirectory,
        in: .userDomainMask,
        appropriateFor: nil,
        create: false
      )
    else { return .empty }

    let url = support.appendingPathComponent("agentmeter/snapshot.json")

    guard
      let data = try? Data(contentsOf: url),
      let snap = try? JSONDecoder().decode(WidgetSnapshot.self, from: data)
    else { return .empty }

    return Entry(date: Date(), snap: snap)
  }
}
