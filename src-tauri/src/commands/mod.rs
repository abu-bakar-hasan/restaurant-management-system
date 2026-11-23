use crate::{errors::AppError, services::bootstrap, state::AppState};

// Only non-sensitive installation diagnostics are public before authentication.
// Operational commands must be introduced with backend session authorization.
#[tauri::command]
pub fn bootstrap_status(state: tauri::State<'_, AppState>) -> Result<bootstrap::BootstrapStatus, AppError> {
    let guard = state.database.lock().map_err(|_| AppError::storage("DB_STATE_UNAVAILABLE", "Restart the application to reconnect to local storage."))?;
    match guard.as_ref() {
        Ok(database) => bootstrap::status(database),
        Err(error) => Err(error.clone()),
    }
}
