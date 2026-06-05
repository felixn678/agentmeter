mod blocks;
mod ccusage;
mod snapshot;

use blocks::ActiveBlock;
use ccusage::{Granularity, UsageReport};
use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    AppHandle, Emitter, Manager, WindowEvent,
};
use tauri_plugin_store::StoreExt;

/// Show or hide the floating widget window and persist the choice.
fn set_widget_visible(app: &AppHandle, visible: bool) {
    if let Some(w) = app.get_webview_window("widget") {
        if visible {
            let _ = w.show();
            // Keep it pinned to the desktop (below normal windows), not raised/focused.
            let _ = w.set_always_on_bottom(true);
        } else {
            let _ = w.hide();
        }
    }
    if let Ok(store) = app.store("agentmeter.json") {
        store.set("widgetVisible", serde_json::json!(visible));
        let _ = store.save();
    }
}

/// Command for the frontend: fetch a report at "daily" | "weekly" | "monthly".
#[tauri::command]
async fn get_usage(app: tauri::AppHandle, granularity: String) -> Result<UsageReport, String> {
    let g = match granularity.as_str() {
        "weekly" => Granularity::Weekly,
        "monthly" => Granularity::Monthly,
        _ => Granularity::Daily,
    };
    ccusage::fetch(&app, g).await
}

/// Command for the frontend: the current billing block's burn rate (or null).
#[tauri::command]
async fn get_blocks(app: tauri::AppHandle) -> Result<Option<ActiveBlock>, String> {
    blocks::fetch_active(&app).await
}

/// Command for the frontend: toggle the floating widget window's visibility.
#[tauri::command]
fn toggle_widget(app: AppHandle) {
    let visible = app
        .get_webview_window("widget")
        .map(|w| w.is_visible().unwrap_or(false))
        .unwrap_or(false);
    set_widget_visible(&app, !visible);
}

/// Whether auto-update is safe on this install.
///
/// Returns `false` for `.deb` / apt-managed installs on Linux because the Tauri
/// updater's Linux fallback runs `install_appimage` over whatever payload it
/// receives, clobbering the dpkg-managed binary. Returns `true` for AppImage
/// (the env var `APPIMAGE` is set by the AppImage runtime), macOS, and Windows.
#[tauri::command]
fn is_auto_update_supported() -> bool {
    #[cfg(target_os = "linux")]
    {
        return std::env::var("APPIMAGE").is_ok();
    }
    #[cfg(not(target_os = "linux"))]
    {
        true
    }
}

/// Command for the frontend: set the tray title directly. The frontend computes it
/// from data it has already loaded, so we avoid spawning ccusage a second time per
/// refresh. (Startup still computes the title in Rust so the tray shows a number
/// immediately, before the webview's first load.)
#[tauri::command]
fn set_tray_title(app: AppHandle, title: String) {
    if let Some(tray) = app.tray_by_id("main") {
        let _ = tray.set_title(Some(title));
    }
}

/// Persist the data the macOS WidgetKit widget reads. Frontend computes the
/// snapshot from data it already has (DRY: mirrors the set_tray_title pattern,
/// so we never spawn ccusage a second time per refresh). The write is
/// best-effort — a failure is swallowed so the UI thread never blocks.
#[tauri::command]
fn write_widget_snapshot(snapshot: snapshot::WidgetSnapshot) {
    if let Err(e) = snapshot::write(&snapshot) {
        eprintln!("widget snapshot write failed: {e}");
    }
}

/// Read the user's chosen tray metric from the store, defaulting to "today".
fn tray_metric(app: &AppHandle) -> String {
    if let Ok(store) = app.store("agentmeter.json") {
        if let Some(metric) = store
            .get("settings")
            .and_then(|s| s.get("trayMetric").and_then(|v| v.as_str()).map(String::from))
        {
            return metric;
        }
    }
    "today".to_string()
}

/// Latest-period cost formatted as a tray title, or a fallback on empty/error.
async fn period_title(app: &AppHandle, g: Granularity) -> String {
    match ccusage::fetch(app, g).await {
        Ok(report) => match ccusage::latest_entry(&report) {
            Some(entry) => format!("${:.2}", entry.total_cost),
            None => "$0.00".to_string(),
        },
        Err(_) => "⚠".to_string(),
    }
}

/// Compute the tray title for the currently configured metric.
async fn compute_tray_title(app: &AppHandle) -> String {
    match tray_metric(app).as_str() {
        "week" => period_title(app, Granularity::Weekly).await,
        "month" => period_title(app, Granularity::Monthly).await,
        "burnRate" => match blocks::fetch_active(app).await {
            Ok(Some(b)) => format!("${:.2}/hr", b.cost_per_hour),
            Ok(None) => "$0.00/hr".to_string(),
            Err(_) => "⚠".to_string(),
        },
        _ => period_title(app, Granularity::Daily).await,
    }
}

/// Recompute and apply the tray title from the configured metric.
async fn refresh_tray_title(app: &AppHandle) {
    let title = compute_tray_title(app).await;
    if let Some(tray) = app.tray_by_id("main") {
        let _ = tray.set_title(Some(title));
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            get_usage,
            get_blocks,
            toggle_widget,
            is_auto_update_supported,
            set_tray_title,
            write_widget_snapshot,
        ])
        // Closing the window hides it (the app stays in the tray and keeps running,
        // so budget/notification checks keep firing). Quit via the tray menu.
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                let _ = window.hide();
                api.prevent_close();
            }
        })
        .setup(|app| {
            // --- Tray menu ---
            let show = MenuItem::with_id(app, "show", "Open agentmeter", true, None::<&str>)?;
            let widget = MenuItem::with_id(app, "widget", "Show / hide widget", true, None::<&str>)?;
            let settings = MenuItem::with_id(app, "settings", "Settings", true, None::<&str>)?;
            let check_update =
                MenuItem::with_id(app, "check-update", "Check for updates…", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(
                app,
                &[&show, &widget, &settings, &check_update, &quit],
            )?;

            // --- Tray icon --- (looked up later by id "main" to update its title)
            let _tray = TrayIconBuilder::with_id("main")
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .title("…")
                .tooltip("agentmeter — today's cost")
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "quit" => app.exit(0),
                    "show" => {
                        if let Some(w) = app.get_webview_window("main") {
                            let _ = w.show();
                            let _ = w.set_focus();
                        }
                    }
                    "settings" => {
                        if let Some(w) = app.get_webview_window("main") {
                            let _ = w.show();
                            let _ = w.set_focus();
                            let _ = w.emit("open-settings", ());
                        }
                    }
                    "widget" => {
                        let visible = app
                            .get_webview_window("widget")
                            .map(|w| w.is_visible().unwrap_or(false))
                            .unwrap_or(false);
                        set_widget_visible(app, !visible);
                    }
                    "check-update" => {
                        // Frontend owns the update flow (semver guard, consent
                        // dialog, .deb skip). Bringing the window forward gives
                        // the dialog a parent so it can't end up off-screen.
                        if let Some(w) = app.get_webview_window("main") {
                            let _ = w.show();
                            let _ = w.set_focus();
                            let _ = w.emit("check-update", ());
                        }
                    }
                    _ => {}
                })
                .build(app)?;

            // Fetch the configured metric in the background, then set the tray title.
            let handle = app.handle().clone();
            std::thread::spawn(move || {
                tauri::async_runtime::block_on(refresh_tray_title(&handle));
            });

            // Restore the widget window if it was visible last session.
            if let Ok(store) = app.store("agentmeter.json") {
                if store
                    .get("widgetVisible")
                    .and_then(|v| v.as_bool())
                    .unwrap_or(false)
                {
                    if let Some(w) = app.get_webview_window("widget") {
                        let _ = w.show();
                    }
                }
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
