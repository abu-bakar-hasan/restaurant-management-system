CREATE TABLE schema_migrations (
    version INTEGER PRIMARY KEY CHECK (version > 0),
    applied_at TEXT NOT NULL
);

-- Infrastructure only. Operational schema is added in tested feature migrations.
CREATE TABLE installation_metadata (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
) STRICT;
