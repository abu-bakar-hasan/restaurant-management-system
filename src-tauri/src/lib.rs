pub mod db;
pub mod errors;
pub mod services;

#[cfg(feature = "desktop")]
mod commands;
#[cfg(feature = "desktop")]
mod state;

#[cfg(feature = "desktop")]
pub fn run() {
    use tauri::Manager;

    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _, _| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_focus();
            }
        }))
        .setup(|app| {
            // Preserve a failed initialization as a recoverable diagnostic state;
            // never erase or recreate an existing file on an error.
            let database = app.path().app_data_dir()
                .map_err(|_| errors::AppError::storage("APP_DATA_UNAVAILABLE", "The application data directory is unavailable."))
                .and_then(|directory| db::Database::open(&directory.join("data").join("restaurant.sqlite")));
            app.manage(state::AppState { database: std::sync::Mutex::new(database) });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![commands::bootstrap_status])
        .run(tauri::generate_context!())
        .expect("The desktop runtime could not start. Restaurant data was not reset.");
}
