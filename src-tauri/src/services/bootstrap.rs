use crate::{db::Database, errors::AppError};
use serde::Serialize;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BootstrapStatus {
    pub app_version: &'static str,
    pub schema_version: i64,
    pub database_ready: bool,
    pub operational_ready: bool,
}

pub fn status(database: &Database) -> Result<BootstrapStatus, AppError> {
    Ok(BootstrapStatus {
        app_version: env!("CARGO_PKG_VERSION"),
        schema_version: database.schema_version()?,
        database_ready: true,
        operational_ready: false,
    })
}
