use restmin_lib::db::Database;
use rusqlite::Connection;

#[test]
fn infrastructure_survives_restart_without_reseeding() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("restaurant.sqlite");
    let db = Database::open(&path).unwrap();
    assert_eq!(db.schema_version().unwrap(), 1);
    drop(db);
    let conn = Connection::open(&path).unwrap();
    let before: String = conn.query_row("SELECT value FROM installation_metadata WHERE key='installation_id'", [], |row| row.get(0)).unwrap();
    drop(conn);
    drop(Database::open(&path).unwrap());
    let conn = Connection::open(&path).unwrap();
    let after: String = conn.query_row("SELECT value FROM installation_metadata WHERE key='installation_id'", [], |row| row.get(0)).unwrap();
    assert_eq!(before, after);
    assert_eq!(conn.query_row("SELECT COUNT(*) FROM schema_migrations", [], |row| row.get::<_, i64>(0)).unwrap(), 1);
}

#[test]
fn unknown_existing_database_is_not_initialized() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("restaurant.sqlite");
    let conn = Connection::open(&path).unwrap();
    conn.execute_batch("CREATE TABLE important_data(value TEXT); INSERT INTO important_data VALUES ('preserve');").unwrap();
    drop(conn);
    let error = Database::open(&path).err().unwrap();
    assert_eq!(error.code, "DB_UNRECOGNIZED");
    let conn = Connection::open(&path).unwrap();
    assert_eq!(conn.query_row("SELECT value FROM important_data", [], |row| row.get::<_, String>(0)).unwrap(), "preserve");
}

#[test]
fn newer_schema_is_rejected() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("restaurant.sqlite");
    let conn = Connection::open(&path).unwrap();
    conn.pragma_update(None, "user_version", 999).unwrap();
    drop(conn);
    assert_eq!(Database::open(&path).err().unwrap().code, "DB_NEWER_VERSION");
}

#[test]
fn corrupt_file_is_preserved() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("restaurant.sqlite");
    let bytes = b"not a sqlite database";
    std::fs::write(&path, bytes).unwrap();
    assert!(Database::open(&path).is_err());
    assert_eq!(std::fs::read(&path).unwrap(), bytes);
}
