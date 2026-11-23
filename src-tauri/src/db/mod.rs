use crate::errors::AppError;
use rusqlite::{Connection, OpenFlags, TransactionBehavior};
use std::{path::Path, time::Duration};

pub const SCHEMA_VERSION: i64 = 1;

pub struct Database {
    connection: Connection,
}

impl Database {
    pub fn open(path: &Path) -> Result<Self, AppError> {
        let existed = path.try_exists().map_err(|_| AppError::storage("DB_PATH_UNAVAILABLE", "The local data path cannot be accessed."))?;
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent).map_err(|_| AppError::storage("DB_DIRECTORY_UNAVAILABLE", "The local data directory cannot be created."))?;
        }
        let mut flags = OpenFlags::SQLITE_OPEN_READ_WRITE;
        if !existed { flags |= OpenFlags::SQLITE_OPEN_CREATE; }
        let mut connection = Connection::open_with_flags(path, flags)?;
        connection.busy_timeout(Duration::from_secs(5))?;
        connection.pragma_update(None, "foreign_keys", "ON")?;

        let quick_check: String = connection.query_row("PRAGMA quick_check", [], |row| row.get(0))?;
        if quick_check != "ok" {
            return Err(AppError::storage("DB_INTEGRITY_FAILED", "Storage integrity failed. No restaurant operations are available."));
        }
        let version: i64 = connection.pragma_query_value(None, "user_version", |row| row.get(0))?;
        if version > SCHEMA_VERSION {
            return Err(AppError::storage("DB_NEWER_VERSION", "This database requires a newer application version."));
        }
        if version == 0 {
            // Never mistake a pre-existing empty, foreign, or damaged database
            // for a new restaurant installation.
            if existed {
                return Err(AppError::storage("DB_UNRECOGNIZED", "Existing storage has no recognized schema. It has been preserved."));
            }
            let transaction = connection.transaction_with_behavior(TransactionBehavior::Immediate)?;
            transaction.execute_batch(include_str!("../../migrations/0001_infrastructure.sql"))?;
            transaction.execute("INSERT INTO schema_migrations(version, applied_at) VALUES (1, strftime('%Y-%m-%dT%H:%M:%fZ','now'))", [])?;
            transaction.execute("INSERT INTO installation_metadata(key, value) VALUES ('installation_id', ?1)", [uuid::Uuid::new_v4().to_string()])?;
            transaction.pragma_update(None, "user_version", SCHEMA_VERSION)?;
            transaction.commit()?;
        }
        let ledger_version: i64 = connection.query_row("SELECT COALESCE(MAX(version),0) FROM schema_migrations", [], |row| row.get(0))?;
        if ledger_version != SCHEMA_VERSION {
            return Err(AppError::storage("DB_MIGRATION_MISMATCH", "The database migration history requires review."));
        }
        let journal: String = connection.query_row("PRAGMA journal_mode=WAL", [], |row| row.get(0))?;
        if journal.to_lowercase() != "wal" {
            return Err(AppError::storage("DB_JOURNAL_UNAVAILABLE", "Durable local journaling could not be enabled."));
        }
        connection.pragma_update(None, "synchronous", "FULL")?;
        Ok(Self { connection })
    }

    pub fn schema_version(&self) -> Result<i64, AppError> {
        Ok(self.connection.pragma_query_value(None, "user_version", |row| row.get(0))?)
    }
}
