# 11 — Offline Data Management & Recovery

**Product:** Restaurant Billing & Management Desktop Application  
**Platform:** Windows desktop, Tauri 2 + React + Rust + SQLite  
**Status:** Implementation specification (decisions requiring confirmation marked **TBD**)  
**Primary principle:** All essential restaurant operations must work without internet access.

## 1. Scope and objectives

This specification covers local database lifecycle, transaction durability, backups, restores, migration, corruption handling, retention, export, and device replacement. It applies to dine-in table orders, reservations, walk-in POS, KOT, invoices, cash/UPI/card payment *records*, shifts, users, settings, and audit trails. No cloud dependency or remote authentication is permitted for normal operation.

**Non-goals for initial release:** multi-computer live synchronization, cloud backup, remote access, online payment gateway processing. Recording a UPI/card payment does not imply that the application itself verifies settlement with an external provider.

## 2. Storage ownership and paths

- The **Rust backend owns all SQLite reads/writes**. React never opens the database or writes financial records to localStorage.
- Store mutable application data under Tauri's Windows app-data location, using the resolved app-specific path; never in the installation directory, source tree, or current working directory.
- Suggested subdirectories: `data/restaurant.sqlite`, `backups/`, `exports/`, `logs/`, `attachments/` (if enabled). Paths are examples, not hard-coded Windows paths.
- Keep installation assets separate from restaurant-specific data. On uninstall, explain whether app data is retained and offer an explicit data removal choice.
- For images/attachments, use controlled app-data storage with database references; prevent path traversal.

## 3. SQLite connection and initialization

1. Resolve/create app-data directories with restricted filesystem permissions where feasible.
2. Acquire a **single-app-instance guard** or otherwise prevent two app processes from independently modifying the same database.
3. Open the SQLite database through a controlled Rust connection manager; enable `PRAGMA foreign_keys=ON` on **every connection**.
4. Prefer WAL mode for responsive concurrent reads; configure a suitable busy timeout. Choose `synchronous=FULL` for stronger power-loss durability, with measured performance impact.
5. Apply versioned, transactional migrations before allowing business operations.
6. Run `PRAGMA quick_check` at startup or a periodic safe interval; use full `integrity_check` for troubleshooting/maintenance.
7. Seed only essential configuration and first-run setup; never overwrite existing restaurant data.
8. If initialization fails, show a recovery screen with read-only diagnostics and restore options; do not silently create an empty replacement database over an existing file.

## 4. Data consistency and transaction boundaries

- SQLite is the **source of truth**. UI caches are disposable and must reload from the database after restart.
- Each financial action uses a single database transaction for all related changes: order updates, totals, invoice issuance, payment record, audit entry, and table release when appropriate.
- Store money as **integer paise**, with explicit rounding rules from `10-business-rules.md`.
- Use unique constraints and idempotency keys for payment submissions and invoice issuance. Repeated clicks or process retries must not create duplicate charges.
- Treat completed invoices/payments as immutable accounting events; corrections use authorized reversals/adjustments with audit history.
- Printing is an **independent side effect**. Persist the bill first, then enqueue printing; a failed printer cannot roll back a valid payment.
- KOT dispatch is likewise recorded durably before external printing.

## 5. Crash and power-loss recovery

On startup after an unclean exit:

1. Open the existing database without deleting WAL or shared-memory files manually.
2. Allow SQLite to perform its normal WAL recovery.
3. Verify schema version and check basic integrity.
4. Reconstruct active tables, open orders, unpaid invoices, pending KOTs, and open cash shifts from persisted state.
5. Resume pending print jobs with an explicit review/reprint action to avoid duplicate paper tickets.
6. If integrity checks fail, stop writes, preserve the affected files, and offer backup restoration; never automatically discard financial data.

**Acceptance scenario:** A power failure immediately after payment commit must result in exactly one durable payment record and no duplicate invoice on restart.

## 6. Backup strategy

### 6.1 Backup types

- **Manual backup:** user initiates at any time, including export to a USB drive.
- **Automatic backup:** scheduled locally at startup/daily close or configurable intervals; no network needed.
- **Pre-migration backup:** mandatory before schema upgrades.

### 6.2 Safe backup implementation

- Use SQLite's **online backup API** (`sqlite3_backup`) or a correctly managed `VACUUM INTO` strategy, not a naïve copy of an open WAL-mode `.sqlite` file.
- Write the backup to a temporary file, verify the result, then atomically rename it into the backup destination where supported.
- Bundle a manifest with app version, schema version, creation timestamp, restaurant identifier, database checksum, and backup format version.
- Verify integrity of the copied database and hash of the completed archive. Optionally encrypt backups using a user-controlled recovery secret (**TBD**); clearly explain that losing the secret prevents recovery.
- Default naming: `restaurant-backup-YYYYMMDD-HHMMSS.rmbak` (format to be specified and versioned).
- Do not include payment credentials or plaintext staff PINs. Staff secrets must be salted password/PIN hashes.
- Inform the operator that backups stored only on the same disk do not protect against disk failure; encourage periodic USB backups.

### 6.3 Retention (proposed defaults; configurable)

- Automatic local backups: keep last **7 daily + 4 weekly** successful backups, subject to storage capacity.
- Manual/USB backups: never automatically delete files outside the application's managed backup directory.
- Never delete the last verified good backup.
- Alert on backup failures and low disk space without blocking routine billing unless data safety is immediately at risk.

## 7. Restore procedure

Restoring **replaces the current restaurant dataset** and requires admin authorization.

1. Display source file, timestamp, restaurant identity, schema version, and potential data-loss warning.
2. Verify archive structure, checksum, database integrity, and compatibility **before** modifying current data.
3. Require explicit confirmation; block new orders/payments during restore.
4. Create a verified safety backup of the current database.
5. Close database connections and stop background jobs.
6. Extract to a staging directory on the same filesystem; verify again.
7. Atomically swap staged data into place where supported; retain rollback copy until restart succeeds.
8. Reopen database, run migrations if supported, validate integrity, refresh UI state, and record restore metadata outside the replaced dataset when appropriate.
9. If any step fails, restore the pre-restore dataset and show a clear error.

**Never** merge two restaurant datasets by simply copying SQLite files together. Merging requires a separately designed import workflow.

## 8. Schema migrations and application updates

- Use monotonically versioned SQL/Rust migrations, tracked in a migration ledger.
- On launch, compare database schema version with supported application versions.
- Back up before upgrading; run migration steps in transactions where supported; validate constraints afterward.
- Refuse to open a newer unsupported schema for writes, and explain that an older app version cannot safely use the upgraded data.
- Test migration chains from every supported released version with representative orders, invoices, and refunds.
- App installers must not overwrite or erase the user database.
- Offline updates may be delivered through a trusted installer or signed local update package; verify publisher/signature as applicable.

## 9. Data export and portability

- Provide admin-controlled CSV export for reports and operational records; export does **not** replace a full backup.
- Use UTF-8 CSV with safe escaping to mitigate spreadsheet formula injection when exported files are opened in spreadsheet software.
- Exports should clearly label currency, timezone, date range, tax breakdowns, and report generation timestamp.
- For moving to a new PC: install the compatible application, transfer the verified backup via USB, restore, configure the local printer, and validate a sample invoice and historical report.
- Keep the original PC's data until the new installation has been verified.

## 10. Security and access control

- Restrict backup/restore/export operations to authorized roles; log actor, time, destination category, and result without exposing secrets.
- Use Argon2id or another established password-hashing scheme for local credentials; never store plaintext passwords or PINs.
- Protect the database with Windows account permissions. Consider optional database-at-rest encryption as a separately scoped feature; standard SQLite is **not encrypted by default**.
- Warn that a local administrator or anyone with unrestricted disk access may access an unencrypted database.
- Avoid logging customer phone numbers, PINs, or full payment reference details.
- Treat USB backup files as sensitive and advise secure physical storage.

## 11. Time, identifiers, and auditability

- Store timestamps consistently in UTC; render them in the restaurant's configured local timezone (default India Standard Time if appropriate).
- Persist a business-date definition for shifts that cross midnight; do not infer accounting day solely from calendar date.
- Use stable unique IDs for records; invoice numbers follow configurable local sequential numbering rules and must never be silently reused.
- Log critical actions: refunds, discounts requiring approval, cancellations, restore attempts, user changes, and shift reconciliation.
- Local device clocks can be changed; record clock anomalies where detectable, but do not require internet time sync.

## 12. Disk space and maintenance

- Check free space before backups, imports, large exports, and migrations.
- Provide a Storage & Backup screen showing DB size, backup size, last successful backup, backup health, and restore controls.
- Run WAL checkpoints through SQLite APIs during suitable idle windows; never delete `-wal` or `-shm` files manually.
- Avoid routine `VACUUM` during peak billing. Offer planned maintenance with sufficient free space.
- Do not purge invoice/payment history as a generic cleanup operation. Any retention/deletion policy must respect applicable legal/accounting requirements.

## 13. UI states and user feedback

- Backup progress: preparing → copying → verifying → completed/failed.
- Restore progress: validating → safety backup → restoring → verifying → restart/reload.
- Show meaningful errors: permission denied, insufficient space, corrupt archive, incompatible version, missing drive, or interrupted copy.
- Disable duplicate submissions while operations are running; provide accessible progress and keyboard navigation.
- Clearly distinguish **backup created** from **backup verified**.

## 14. Testing matrix

| ID | Scenario | Expected outcome |
|---|---|---|
| ODM-01 | Disconnect internet for entire shift | All core operations function normally |
| ODM-02 | Kill app during unpaid order | Committed order data survives restart |
| ODM-03 | Power loss after payment commit | One invoice/payment; no duplication |
| ODM-04 | Backup while POS is active | Consistent, verified restorable backup |
| ODM-05 | Remove USB during backup | Error shown; original database intact |
| ODM-06 | Restore corrupt archive | Rejected before changing current data |
| ODM-07 | Restore valid older schema | Migrated safely or rejected with explanation |
| ODM-08 | Restore interrupted | Original database recoverable |
| ODM-09 | Low disk space | Clear warning; no silent data loss |
| ODM-10 | Upgrade app with existing bills | All historical totals remain unchanged |
| ODM-11 | Open two app instances | Second instance blocked or safely redirected |
| ODM-12 | Reinstall app | Existing user data retained per uninstall policy |
| ODM-13 | Transfer to another Windows PC | Data restored, printer reconfigured, totals match |
| ODM-14 | Backup checksum mismatch | Backup marked invalid and not offered as verified |

## 15. Decisions to confirm before implementation

1. Automatic backup cadence and retention limits.
2. Whether backups require encryption and how recovery keys are managed.
3. Whether multiple restaurant locations will ever share a dataset (out of scope initially).
4. Whether customer contact information is collected at all.
5. Whether offline app updates are installer-only or use signed local packages.
6. Exact legal retention requirements and invoice numbering configuration.
7. Whether database file encryption is required for the initial release.

## 16. AI coding agent implementation constraints

- Implement database access and file operations in Rust/Tauri commands with narrowly scoped permissions.
- Keep all critical business logic in backend services; React only displays and submits user intent.
- Use safe SQLite backup APIs; never implement backup as `fs.copy` of a live database.
- Add tests for every failure path above before declaring backup/restore production-ready.
- Avoid destructive auto-repair and never silently reset an existing database.
- Reference `07-application-architecture.md`, `09-database-schema.md`, and `10-business-rules.md` for canonical architecture and domain rules.

## 17. Definition of done

This module is complete only when a restaurant can operate through an internet outage, survive abrupt app termination without losing committed financial records, generate a verified backup during use, restore to a replacement Windows PC, and upgrade database schemas without altering historical invoice values. All critical recovery tests must pass on an actual Windows installation.

---
**Next document:** `12-printing-and-billing.md`.
