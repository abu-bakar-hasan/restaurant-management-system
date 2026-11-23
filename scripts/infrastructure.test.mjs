import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

// Executes the actual SQL migration using Node's bundled SQLite. These checks
// supplement, and never replace, the Rust integration/native release tests.
const migration = readFileSync(new URL('../src-tauri/migrations/0001_infrastructure.sql', import.meta.url), 'utf8');

test('infrastructure migration persists metadata across connection restart', () => {
  const directory = mkdtempSync(join(tmpdir(), 'restmin-test-'));
  const path = join(directory, 'test.sqlite');
  let db;
  try {
    db = new DatabaseSync(path);
    db.exec('BEGIN IMMEDIATE');
    db.exec(migration);
    db.prepare('INSERT INTO schema_migrations VALUES (?, ?)').run(1, '2026-11-22T00:00:00Z');
    db.prepare('INSERT INTO installation_metadata VALUES (?, ?)').run('installation_id', 'test-installation');
    db.exec('COMMIT');
    db.close();
    db = new DatabaseSync(path);
    assert.equal(db.prepare('SELECT value FROM installation_metadata').get().value, 'test-installation');
    assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check, 'ok');
  } finally {
    db?.close();
    rmSync(directory, { recursive: true });
  }
});

test('failed migration transaction leaves no partial schema', () => {
  const db = new DatabaseSync(':memory:');
  try {
    db.exec('BEGIN IMMEDIATE');
    db.exec(migration);
    assert.throws(() => db.exec('INSERT INTO schema_migrations VALUES (0, \'invalid\')'));
    db.exec('ROLLBACK');
    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM sqlite_master WHERE type='table'").get().count, 0);
  } finally { db.close(); }
});

test('migration ledger and installation keys reject duplicates', () => {
  const db = new DatabaseSync(':memory:');
  try {
    db.exec(migration);
    db.exec("INSERT INTO schema_migrations VALUES (1, '2026-11-22'); INSERT INTO installation_metadata VALUES ('installation_id', 'first');");
    assert.throws(() => db.exec("INSERT INTO schema_migrations VALUES (1, '2026-11-23')"));
    assert.throws(() => db.exec("INSERT INTO installation_metadata VALUES ('installation_id', 'second')"));
    assert.equal(db.prepare('SELECT value FROM installation_metadata').get().value, 'first');
  } finally { db.close(); }
});
