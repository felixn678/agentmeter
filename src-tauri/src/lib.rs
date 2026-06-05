mod blocks;
mod ccusage;

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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_notification::init())
        .invoke_handler(tauri::generate_handler![get_usage, get_blocks, toggle_widget])
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
            let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show, &widget, &settings, &quit])?;

            // --- Tray icon ---
            let tray = TrayIconBuilder::new()
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
                    _ => {}
                })
                .build(app)?;

            // Fetch today's cost in the background, then update the tray title.
            let handle = app.handle().clone();
            let tray_handle = tray.clone();
            std::thread::spawn(move || {
                let result =
                    tauri::async_runtime::block_on(ccusage::fetch(&handle, Granularity::Daily));
                match result {
                    Ok(report) => {
                        if let Some(entry) = ccusage::latest_entry(&report) {
                            let _ = tray_handle.set_title(Some(format!("${:.2}", entry.total_cost)));
                        } else {
                            let _ = tray_handle.set_title(Some("$0.00"));
                        }
                    }
                    Err(_) => {
                        let _ = tray_handle.set_title(Some("⚠"));
                    }
                }
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
