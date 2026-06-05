mod ccusage;

use ccusage::{Granularity, UsageReport};
use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    Manager,
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![get_usage])
        .setup(|app| {
            // --- Tray menu ---
            let show = MenuItem::with_id(app, "show", "Open agentmeter", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show, &quit])?;

            // --- Tray icon ---
            // `title` shows text directly in the menubar (well supported on macOS;
            // may be hidden on GNOME).
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
                    _ => {}
                })
                .build(app)?;

            // Fetch today's cost in the background, then update the tray title.
            let handle = app.handle().clone();
            let tray_handle = tray.clone();
            std::thread::spawn(move || {
                let result = tauri::async_runtime::block_on(ccusage::fetch(&handle, Granularity::Daily));
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
