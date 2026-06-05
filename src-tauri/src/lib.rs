mod blocks;
mod ccusage;

use blocks::ActiveBlock;
use ccusage::{Granularity, UsageReport};
use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    Emitter, Manager, WindowEvent,
};

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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_notification::init())
        .invoke_handler(tauri::generate_handler![get_usage, get_blocks])
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
            let settings = MenuItem::with_id(app, "settings", "Settings", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show, &settings, &quit])?;

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

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
