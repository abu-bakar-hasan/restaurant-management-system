# Implementation plan

Baseline reviewed: docs/AGENTS.md and all 19 numbered specifications, 2026-11-22.
Latest user decisions override draft specifications; see DECISIONS.md.

Each milestone requires implementation, relevant automated checks, fixes, and a PROGRESS.md update before advancing. Native build gates cannot be replaced by browser previews.

| Milestone | Scope | Verification / exit gate |
|---|---|---|
| M0 Requirements | Reconcile rules, dependencies, acceptance traceability | Decision log; unresolved high-risk behavior blocked |
| M1 Desktop foundation | React/TS/Vite, Tailwind 4, shadcn, Tauri 2, typed IPC, errors, navigation | Dependency install, TS/lint/tests, Rust checks, native launch and early installer |
| M2 Storage and admin | Versioned SQLite, app-data path, integrity checks, single-instance, first admin, Argon2id, sessions | Setup atomicity, authentication/rate limits, restart, denied direct commands |
| M3 Catalog and seating | Categories/variants, table metadata, reservations and conflicts | Persistent CRUD, archive safety, overlap/capacity/status tests |
| M4 Orders and kitchen | Separate dine-in/walk-in entry, persisted lines, snapshots, KOT deltas/amendments | Independent tables, restart, idempotent KOT, cancellation history |
| M5 Financial engine | Approved zero-tax calculation, continuous numbering, cash/UPI/card/split, shifts, authorized refunds | Integer boundary tests, atomic rollback, repeat checkout, cash reconciliation, immutable history |
| M6 Printing and reporting | Windows printer adapter, durable jobs, receipt/KOT snapshots, reports/CSV, Recharts | Print failure isolation, unknown delivery, reconciliation, export escaping |
| M7 Backup and recovery | Consistent backup/manifest, validation, reauthenticated restore, safety copy | Corrupt/newer backup rejection, interruptions, restart, disk failures |
| M8 Desktop QA | Full offline journeys, keyboard/DPI, crash injection, actual printer | All acceptance scenarios pass on packaged Windows installation |
| M9 Release | NSIS installer, offline WebView2, guides, hashes, upgrade testing | Clean offline installation, restore rehearsal, owner acceptance |

## Acceptance traceability

- PRD-SET / FS-AUTH / Security 13: M2, single admin per latest user decision.
- PRD-MENU / BR-040–044: M3, history snapshot checks in M4/M5.
- PRD-TBL / BR-020–024 and PRD-RES: M3/M4; green available tables and independent walk-in ordering.
- FS-ORD / BR-010–016 / BR-080–084: M4; transactional idempotency and kitchen snapshots.
- PRD-PAY / BR-050–074 / ER-01–03: M5; taxes/discounts/rounding disabled by approval.
- PRD-CASH / BR-090–095: M5/M6; payments and drawer movements remain distinct.
- PRD-PRN / ER-04–06 / ER-15: M6/M8, hardware tests mandatory.
- PRD-DATA / ODM-01–14 / ER-07–12: M2/M7/M8.
- Deployment document 19: M1 early build, M8/M9 release gates.

## Execution constraint

This workstation currently has Node 22.14.0/npm 11.2.0 but no detected Rust/Cargo or Visual Studio installer. npm registry lookup fails with ENOTFOUND. Prepare the foundation, retain failing checks honestly, and do not advance past its native verification gate by generating unverified feature modules.
