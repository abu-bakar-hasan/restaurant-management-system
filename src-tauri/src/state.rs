use crate::{db::Database, errors::AppError};
use std::sync::Mutex;

pub struct AppState {
    pub database: Mutex<Result<Database, AppError>>,
}
