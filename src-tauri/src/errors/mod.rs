use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppError {
    pub code: String,
    pub category: String,
    pub message: String,
    pub retryable: bool,
    pub correlation_id: String,
}

impl AppError {
    pub fn storage(code: &str, message: &str) -> Self {
        Self {
            code: code.into(),
            category: "storage".into(),
            message: message.into(),
            retryable: false,
            correlation_id: uuid::Uuid::new_v4().to_string(),
        }
    }
}

impl std::fmt::Display for AppError {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(formatter, "{}: {} ({})", self.code, self.message, self.correlation_id)
    }
}
impl std::error::Error for AppError {}

impl From<rusqlite::Error> for AppError {
    fn from(error: rusqlite::Error) -> Self {
        match error.sqlite_error_code() {
            Some(rusqlite::ErrorCode::DatabaseBusy | rusqlite::ErrorCode::DatabaseLocked) => {
                let mut result = Self::storage("DB_BUSY", "Local storage is busy. Close any other application instance and retry.");
                result.retryable = true;
                result
            }
            _ => Self::storage("DB_UNAVAILABLE", "Local storage could not be verified. Preserve the data and review recovery options."),
        }
    }
}
