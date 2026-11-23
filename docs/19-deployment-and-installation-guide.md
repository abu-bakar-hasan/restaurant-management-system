# 19 — Deployment & Installation Guide

**Product:** Offline Restaurant Billing & Management Desktop Application  
**Target:** Windows 10/11, single-computer installation  
**Stack:** Tauri 2, React, TypeScript, Vite, Rust, SQLite, shadcn/ui  
**Status:** Implementation guide; validate commands against the project's actual Tauri configuration.

## 1. Purpose and scope
This guide defines how to package, install, configure, update, recover, and hand over the restaurant application. All core operations—table orders, walk-in orders, reservations, KOT, cash billing, reports, and backups—must work without internet access. The deployment target is one Windows PC with a local SQLite database. Multi-terminal networking and cloud synchronization are out of scope.

## 2. Supported environments
- Target Windows 10/11 x64 (confirm the exact supported Windows versions and CPU architecture during QA).
- Verify availability of the Microsoft Edge WebView2 runtime on each target PC; prepare an offline runtime installer or configure the appropriate Tauri WebView2 installation strategy for offline deployment.
- Verify adequate free disk space for application files, SQLite data, WAL files, logs, receipts, and backups.
- Confirm USB or Windows-installed receipt/KOT printers and their drivers on the actual restaurant computer.
- Use a dedicated Windows user account with appropriate application-data permissions; do not require administrator rights for everyday billing.

## 3. Release prerequisites
Before release, confirm that:
1. Business rules, invoice format, and restaurant tax configuration are approved.
2. The packaged app completes core workflows with the network disabled.
3. SQLite migrations are tested against both empty and existing databases.
4. Cash, UPI, card, split-payment recording, refunds, and invoice numbering pass tests.
5. Printing and printer-failure recovery work with the actual hardware.
6. Backup and restore have been tested with a removable drive.
7. The installer has been tested on a clean Windows PC.
8. Version number, release notes, build hash, and rollback plan are recorded.

## 4. Build workstation setup
Install compatible versions of Node.js, a package manager, Rust via rustup, and the Windows C++ build tools required by Tauri. Keep the toolchain versions pinned in project configuration/CI. For an existing project:

```powershell
npm ci
npm run build
npm run tauri build
```

The final command assumes `tauri` is exposed as a package script (or via the installed CLI). If not, use `npx tauri build`. Do not run `npm ci` until a lockfile is committed. Tauri can generate Windows installer bundles such as NSIS `.exe` or WiX `.msi`, depending on the bundle configuration and build environment.

## 5. Tauri release configuration
- Set a stable application identifier, product name, version, icons, and Windows bundle targets.
- Configure a narrow Tauri capability/permission set. Never enable arbitrary shell execution or unrestricted filesystem access for UI code.
- Set up production CSP and disable development-only debugging or endpoints.
- Bundle only required assets and dependencies; ensure fonts, icons, and UI assets work offline.
- Select NSIS `.exe` as the default installer if a conventional Windows installer is desired; `.msi` may be offered for managed environments.
- Prefer code signing for distributed Windows builds; document signing certificate ownership and renewal.

Example *illustrative* bundle configuration (merge into the actual `src-tauri/tauri.conf.json` rather than replacing it):

```json
{
  "bundle": {
    "active": true,
    "targets": ["nsis"],
    "icon": ["icons/icon.ico"]
  }
}
```

## 6. Application data locations
Store the SQLite database and application-owned files in a persistent Windows application-data directory resolved through Tauri/Rust path APIs—not inside the executable folder, source tree, or temporary directory. Separate directories for `database/`, `backups/`, `logs/`, and `exports/` as appropriate. Do not assume a hard-coded Windows username or drive letter. Keep database and backup paths documented in the application's Settings screen.

Use SQLite foreign keys, transaction boundaries, and a deliberate journal/synchronous policy. If using WAL mode, account for `-wal` and `-shm` files; never copy a live SQLite database file directly as a backup. Use SQLite's online backup API or an equivalent consistent backup mechanism.

## 7. Installation workflow
1. Copy the tested installer and any required offline WebView2/printer prerequisites to a USB drive.
2. Verify installer integrity using the recorded SHA-256 checksum.
3. Install the application on the restaurant PC.
4. Launch it while offline to verify no sign-in, licensing, CDN, or cloud dependency blocks startup.
5. Initialize the local database through versioned migrations.
6. Complete first-run configuration (Section 8).
7. Print a test receipt and a test KOT.
8. Create a test order, settle a cash bill, close the test shift, and verify reports.
9. Create and verify an initial backup.
10. Record the installed app version, data directory, printer models, and handover contact.

## 8. First-run restaurant setup
Provide a guided wizard to configure:
- Restaurant display name, address, phone, optional tax identifiers, currency (INR), timezone, and receipt footer.
- Owner/admin credentials and recovery process.
- Tables, capacities, and operational areas.
- Menu categories, items, variants, prices, and availability.
- Tax/service-charge settings according to approved business requirements; do not assume all restaurants use the same GST rules.
- Invoice series and numbering policy, including financial-year rollover if applicable.
- Receipt printer and KOT printer, paper width (58 mm or 80 mm), character encoding, and test output.
- Backup destination, schedule, and retention policy.

Do not silently create production invoices or payments as part of setup. Keep sample/demo data clearly isolated and removable.

## 9. Printer setup and validation
Use installed Windows printer drivers or a deliberately selected supported printing transport. Verify each device's exact model, connection type, paper width, and supported commands. Test:
- Receipt formatting, long item names, totals, taxes, and multilingual text if needed.
- Cash tendered/change and split payment display.
- KOT item modifiers, quantities, and cancellations.
- Disconnected printer, out-of-paper, duplicate-click, and retry behavior.

Persist a print job record before attempting output. Mark a job as printed only when supported evidence of success is available; some printers cannot reliably acknowledge physical paper output. Reprints must be clearly marked and audited. Printing failures must never roll back a successfully committed payment.

## 10. Offline update process
Updates must be distributable via USB without an internet connection:
1. Announce the target version and migration requirements.
2. Complete open orders and settle or explicitly preserve active shifts according to approved policy.
3. Create and verify a pre-update backup; retain the previous installer.
4. Exit the application and confirm no process is using the database.
5. Run the new installer; never remove the persistent data directory during an ordinary update.
6. On launch, validate the database and run forward-only versioned migrations in controlled transactions where supported.
7. Verify login, existing invoices, current orders, printer settings, and new transactions.
8. Record migration outcome and release version.

**Rollback warning:** Installing an older executable over a migrated database may be unsafe. If rollback is necessary, restore a verified pre-update backup together with the matching previous application version, following an explicit recovery procedure. Preserve a copy of the newer database for investigation.

## 11. Backup and restore
- Support manual backup to local storage or removable USB and configurable automatic backups.
- Generate backups using a consistent SQLite backup operation; include any required non-database assets/settings in a versioned manifest.
- Verify backup integrity and record creation time, schema version, app version, checksum, and size.
- Write backups to a temporary destination and finalize atomically where possible; never replace the last known-good backup with an incomplete file.
- Warn when USB storage is missing, full, or disconnected.
- Restore only after administrator authentication, compatibility checks, and a protective backup of current data.
- Restore into a staging location, validate integrity, then switch to the restored database with a documented rollback path.
- Test restore regularly on a separate installation, not only on the production computer.

## 12. Moving to another Windows PC
1. Create and verify a complete backup on the old PC.
2. Install the same or a compatible application version on the new PC.
3. Install and test receipt/KOT printer drivers on the new PC.
4. Restore the backup through the app's restore wizard.
5. Verify restaurant identity, menu, tables, invoices, reports, staff accounts, and shift history.
6. Reconfigure machine-specific printer names and backup destinations.
7. Prevent simultaneous use of both PCs as independent production copies unless an approved migration/cutover procedure explicitly supports it.

## 13. Uninstallation and reinstallation
Uninstalling the application must not silently erase business records. Explain the difference between removing program files and deleting application data. Provide an explicit, separately confirmed data-deletion operation with clear warnings and a recommended verified backup. Test reinstalling over an existing data directory.

## 14. Security and operations
- Store password/PIN verifiers using an appropriate salted password-hashing algorithm; never store plaintext secrets.
- Enforce staff permissions in Rust commands, including refunds, voids, discounts, backup restore, and settings.
- Use least-privilege filesystem access and avoid exposing arbitrary database paths to the renderer.
- Protect sensitive logs: no plaintext credentials, full payment details, or unnecessary personal information.
- Provide a local diagnostic export with redaction and administrator authorization.
- Document physical security, Windows account access, antivirus exclusions only if truly necessary, and USB backup custody.

## 15. Acceptance checklist for a release
- [ ] Installer works on a clean supported Windows PC.
- [ ] Application launches and operates with Wi-Fi and Ethernet disabled.
- [ ] No external CDN, API, authentication, or telemetry is required for core functions.
- [ ] First-run wizard completes successfully.
- [ ] Available tables show green; reservations and occupancy behave correctly.
- [ ] Table-wise and walk-in orders both work.
- [ ] KOT and receipts print correctly on actual restaurant printers.
- [ ] Cash/change, UPI/card recording, split payments, taxes, and refunds are accurate.
- [ ] Invoice numbering remains unique across restarts.
- [ ] Printer errors do not lose committed financial transactions.
- [ ] Unexpected shutdown does not corrupt the database or duplicate payments.
- [ ] Backups can be created and restored from USB.
- [ ] Offline upgrade preserves data and passes migration checks.
- [ ] Reinstallation preserves existing data.
- [ ] User roles and audit logging pass security checks.
- [ ] Release version, checksum, notes, and recovery instructions are delivered.

## 16. Handover package
Deliver:
- Signed installer if available, otherwise documented unsigned build and hash.
- Offline prerequisites (as applicable), installation steps, and supported OS information.
- Quick-start guide for cashier, manager, and owner.
- Printer configuration guide and test receipt.
- Backup/restore guide and recommended backup routine.
- Admin credential handover procedure (never put passwords in the guide).
- Versioned release notes, known issues, and support/maintenance instructions.

## 17. AI coding agent instructions
- Read documents 01–18 before making changes that affect business rules or architecture; consult the relevant document for each feature.
- Keep Windows desktop and offline-first requirements non-negotiable.
- Do not substitute browser localStorage for SQLite or move billing logic into React.
- Treat payments, invoices, migrations, and backups as high-risk operations requiring automated and packaged-app tests.
- Implement installer, first-run wizard, data directories, backup, and printer configuration as independently testable features.
- Never claim an installer is production-ready without testing the packaged application on a clean offline Windows machine and actual target printer hardware.

## 18. Open decisions before production
- Exact supported Windows editions/architectures and minimum hardware.
- Installer format (`.exe` NSIS only or additional `.msi`).
- Target printer brands/models and connection types.
- Required receipt language(s) and GST/invoice format as reviewed by the restaurant's accountant.
- Backup schedule, retention, and USB custody policy.
- Whether automatic updates are intentionally disabled (recommended for fully offline deployments).
- License/support arrangement, if commercial distribution is planned.

---
**Related documents:** 01 Business Requirements; 02 PRD; 07 Architecture; 09 Database Schema; 10 Business Rules; 11 Offline Data Management; 12 Printing & Billing; 13 Security; 14 Testing; 15 Roadmap; 18 Error Handling & Recovery.
