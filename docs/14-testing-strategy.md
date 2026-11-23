# 14 — Testing Strategy & Quality Assurance

**Product:** Offline Restaurant Billing & Management Desktop Application  
**Platform:** Windows desktop (Tauri 2)  
**Stack:** React, TypeScript, Vite, Tailwind CSS, shadcn/ui, Zustand, Rust, SQLite  
**Status:** Proposed testing baseline; validate against product requirements and implementation.

## 1. Purpose
Establish a repeatable test plan proving that dine-in/table orders, walk-in POS, reservations, kitchen tickets, invoicing, cash reconciliation, printing, and offline persistence work safely in real restaurant conditions. Passing a visual demo is not sufficient for release.

## 2. Quality goals
- **Correctness:** Bills, taxes, discounts, change, and shift totals reconcile to the paise.
- **Durability:** Confirmed orders, invoices, and payments survive restarts and power interruption.
- **Consistency:** Table, order, KOT, invoice, and payment states never contradict one another.
- **Usability:** Cashiers can complete common actions quickly with keyboard or mouse.
- **Offline operation:** No network access is required for any core workflow.
- **Security:** Unauthorized staff cannot execute restricted actions through the UI or direct Tauri commands.
- **Recoverability:** Backups are restorable, verified, and documented.

## 3. Test levels and suggested tools
| Level | Focus | Suggested approach |
|---|---|---|
| Type/static checks | Contracts, types, lint | `tsc`, ESLint, `cargo fmt --check`, Clippy |
| React unit tests | Formatting, UI state, forms | Vitest + React Testing Library |
| Rust unit tests | Billing engine, permissions, state transitions | `cargo test` |
| Database integration | SQL constraints, migrations, transaction rollback | Rust integration tests with temporary SQLite files |
| Tauri integration | Command validation, filesystem permissions, service boundaries | Tauri/Rust command integration harness |
| Desktop end-to-end | Actual cashier workflows | Windows UI automation/manual scripted tests; select compatible automation tooling after prototype |
| Hardware tests | Thermal printers, cash drawer if supported | Physical Windows test station |
| Recovery tests | Crashes, backups, disk full | Disposable test machines and controlled failure injection |

Do not assume browser-only E2E tests validate the packaged Windows app or printer behavior.

## 4. Test environments
1. **Developer environment:** Windows, local test SQLite database, mocked printer adapter.
2. **Clean install environment:** Fresh Windows user profile with no preexisting database.
3. **Upgrade environment:** Installed prior app version and populated database.
4. **Hardware environment:** Actual 58 mm and/or 80 mm thermal printers used by target restaurants.
5. **Failure environment:** Disposable database copies for crash, corruption, and disk-space tests.

Test standard and restricted Windows user accounts, display scaling (100%, 125%, 150%), and at least one lower-end target PC. Record OS, Tauri/WebView2 version, printer model, and app build in test reports.

## 5. Test data strategy
Use deterministic fixtures: restaurant settings, 8–20 tables, staff with all roles, menu categories, variants, unavailable items, reservations, open/closed orders, payments, and shifts. Include boundary cases: ₹0 amounts where permitted, large quantities, fractional tax rates, discount limits, duplicate IDs, midnight shifts, overlapping reservations, and missing printer. Use integer paise for all financial assertions. Never use production customer records in automated tests.

## 6. Module test matrix
| Module | Minimum scenarios |
|---|---|
| Login & permissions | Correct/incorrect PIN; locked session; disabled account; manager approval; direct unauthorized command |
| Dashboard | Empty day; active shift; totals match authoritative records; cross-midnight business day |
| Tables | Green available table; occupy; release only after valid settlement; transfer; merge; simultaneous clicks |
| Reservations | Create/edit/cancel; overlap detection; no-show; reserved vs occupied; timezone/local clock boundary |
| Menu | Add/edit/archive; unavailable item; variant pricing; historical order price unaffected |
| Walk-in POS | Add/remove items; quantity; modifiers; hold/resume; checkout without table |
| Dine-in POS | Assign table; add rounds; persist draft; transfer; checkout; return table to available |
| Kitchen/KOT | Generate only new unsent items; amendment; cancel with authorization; print retry without duplicated KOT |
| Billing | Discount/tax/service charge ordering; rounding; invoice numbering; immutable issued invoice |
| Payments | Exact cash; overpayment/change; insufficient tender; UPI/card recorded; split payment; duplicate submission |
| Refunds | Authorized partial/full refund; limits; reason; audit trail; no deletion of original payment |
| Cash shifts | Open/close; opening float; cash in/out; expected vs counted; discrepancy |
| Printing | 58/80 mm wrapping; special characters; no printer; paper out; reprint marked copy |
| Reports | Sales by day/item/method; refunds; voids; CSV export; totals reconcile |
| Backup/restore | Backup during use; verify; restore; incompatible version; missing/corrupt file |

## 7. Billing calculation test vectors
These are **illustrative tests**, not a decision on restaurant-specific GST or service-charge policy. Tax and discount ordering must be finalized in `10-business-rules.md` before expected values are locked.

- **Basic subtotal:** 2 × ₹125.50 + 1 × ₹49.00 = ₹300.00 (30,000 paise).
- **Fixed discount:** ₹300.00 − ₹20.00 = ₹280.00 before any applicable tax/charges.
- **Percentage discount:** 10% of ₹300.00 = ₹30.00; discounted amount ₹270.00.
- **Cash change:** Payable ₹287.50, tendered ₹300.00 → change ₹12.50.
- **Split tender:** ₹150.00 cash + ₹137.50 UPI → ₹287.50 paid; remaining ₹0.00.
- **Underpayment:** Payable ₹287.50, tendered ₹280.00 → cannot finalize as fully paid.
- **Idempotency:** Repeating the same payment command with the same idempotency key creates only one payment record.
- **Rounding:** Assert integer-paise calculations with documented per-line vs invoice-level rounding rules; test 1-paise boundaries.

## 8. State-transition tests
Document and test permitted and forbidden transitions for orders, table sessions, reservations, KOTs, invoices, payments, and shifts. Examples:
- Available table → occupied after a valid dine-in session begins.
- Occupied table must not become available while an unsettled active session remains, unless an explicitly authorized transfer or cancellation workflow resolves it.
- Paid invoice must not be silently edited; corrections use a documented void/refund/adjustment process.
- Closed shift must reject new payments assigned to it.
- Retrying a failed print must not create another invoice or payment.

## 9. SQLite and transaction tests
- Verify foreign keys are enabled on **every** connection.
- Verify uniqueness, CHECK constraints, and indexes with negative tests.
- Force a failure between invoice creation and payment insertion; verify complete rollback or an explicitly designed recoverable state.
- Verify write contention/busy timeout behavior and no partial checkout.
- Run `PRAGMA integrity_check` on controlled test copies.
- Test migrations from each supported released schema version, including rollback/restore plan for migration failure.
- Validate that database backups use SQLite's safe backup mechanism rather than copying a live WAL database file alone.

## 10. Offline, crash, and recovery tests
1. Disable Wi-Fi/Ethernet; start the app and complete an order, payment, receipt, report, and backup.
2. Terminate the process while editing an order; restart and verify persisted state.
3. Simulate termination during checkout at controlled commit boundaries; ensure no duplicate payment and recoverable transaction status.
4. Simulate printer failure after payment commit; verify invoice/payment retained and print job retryable.
5. Remove USB backup destination mid-operation; original database remains intact.
6. Test low disk space, inaccessible data directory, and database lock; show actionable errors and prevent unsafe writes.
7. Restore a verified backup on a clean Windows profile; confirm record counts, invoice continuity, and settings.
8. Test system clock change and daylight-saving assumptions even if deployment normally uses IST.

Use disposable test data for destructive tests; do not deliberately power-cycle a live restaurant PC.

## 11. Printing acceptance tests
Print representative 58 mm and 80 mm receipts with long item names, modifiers, discounts, taxes, payment method, and change. Validate alignment, legibility, paper width, Unicode/Indian currency rendering, invoice number, restaurant identity, and any legally required tax fields configured by the business. Print KOTs separately from customer receipts. Test disconnected printer, paper-out, Windows spooler delay, duplicate retry, and marked reprint. The app should distinguish **recorded/paid** from **printed**.

## 12. Security and privacy tests
Test every privileged Rust command with unauthorized roles; UI hiding alone is insufficient. Verify PIN/password hashing, session timeout, logout, local secret handling, audit trail for void/refund/discount/restore, and safe file selection for import/backup. Verify that logs and error messages do not leak PINs, credentials, or unnecessary customer information. Assess Windows file access limitations and document that OS-level access to unencrypted SQLite files is a separate threat.

## 13. UI/UX and accessibility tests
Check sidebar navigation, keyboard focus order, escape/enter behavior in dialogs, disabled/loading states, validation errors, empty states, visible table status (color plus text), large touch/click targets, scroll behavior, and dense POS usage. Test common resolutions such as 1366×768 and 1920×1080, including Windows scaling. Verify that animations do not block cashier input and respect reduced-motion preferences.

## 14. Performance benchmarks (provisional targets)
Targets should be measured on agreed minimum hardware and adjusted after profiling:
- Main POS screen usable within **3 seconds** of app launch after normal startup.
- Typical menu search response **<150 ms** for 1,000 items.
- Adding an item gives visible feedback **<100 ms**.
- Standard checkout database commit **<500 ms** absent printer latency.
- Reports over one year of normal sample data remain responsive; long operations show progress.

These are project goals, not claims about achieved performance. Track median and 95th-percentile latency.

## 15. Automated test structure
```text
src/
  features/<feature>/__tests__/
  lib/__tests__/
src-tauri/
  src/domain/... (unit tests near implementation)
  tests/ (integration tests)
tests/
  fixtures/
  e2e/
  manual/
  hardware/
```
Use stable fixture factories and isolated temporary databases. Mock time and printer interfaces in deterministic unit tests; validate actual devices separately.

## 16. CI and release gates
Before merging: format/lint, TypeScript typecheck, frontend unit tests, Rust tests, and database integration tests. Before release: Windows packaged-app smoke tests, migration and backup/restore tests, offline workflow tests, financial reconciliation, role-permission tests, and physical printer tests for supported hardware. Do not ship with critical or high-severity unresolved defects affecting payments, data integrity, security, or recovery.

## 17. Traceability and defect reporting
Each test should reference a requirement ID from the PRD/functional specs and applicable `BR-*` rule. Track test ID, setup, steps, expected outcome, actual outcome, build, database schema version, severity, and evidence. Example:

| Test ID | Requirement | Scenario | Expected |
|---|---|---|---|
| PAY-001 | Payment / business rules | Retry identical checkout | One payment and one invoice |
| TBL-001 | Table management | Settle table and close session | Table becomes available |
| OFF-001 | Offline requirements | Disconnect network | Core POS still works |
| PRT-001 | Printing | Printer offline after payment | Payment saved; retry available |
| BAK-001 | Backup | Restore verified backup | Data and integrity checks pass |

## 18. UAT: restaurant staff sign-off
Run supervised acceptance sessions with an owner/manager, cashier, and kitchen operator. Have them complete opening shift, dine-in table service, walk-in billing, reservations, KOT handling, cash change, split payment, printer failure/reprint, shift close, and backup. Record confusing steps and trainability issues. Obtain explicit sign-off on tax/receipt policy and printer models before deployment.

## 19. Definition of done
A feature is complete only when its acceptance criteria are documented, relevant unit/integration tests pass, authorization is enforced in Rust, SQLite transactions are verified where needed, error states are handled, keyboard workflows work, and documentation is updated. The application is release-ready only when all critical end-to-end, offline, backup/restore, and printer checks pass on a packaged Windows build.

## 20. Open decisions
- Supported Windows versions and minimum CPU/RAM/storage.
- Exact printer models, connection types, and 58/80 mm support.
- GST applicability, tax-inclusive/exclusive pricing, service-charge and rounding policy (confirm with a qualified local tax professional).
- Invoice numbering reset rules and business-day cutoff.
- Split-bill, refund, and manager-override policies for v1.
- Backup cadence, retention, and whether encrypted backups are required.
- Required cashier throughput and menu/order scale.

## 21. Instructions for AI coding agents
1. Read `01-business-requirements.md` through `13-security-and-permissions.md` as applicable; do not invent unresolved business policies.
2. Implement Rust domain tests for every financial formula and state transition before connecting UI actions.
3. Use integer paise; do not use floating-point money calculations.
4. Keep SQLite as the durable source of truth; use transactions and idempotency for financial commands.
5. Never equate printer success with payment success.
6. Keep table-wise and walk-in ordering distinct in UI but shared in billing logic.
7. Report test results truthfully; distinguish mocked tests from real Windows/printer verification.
8. Do not mark a feature complete merely because the screen renders.

## 22. Related documents
- `02-product-requirements.md`
- `03-functional-specifications.md`
- `04-user-flows.md`
- `07-application-architecture.md`
- `09-database-schema.md`
- `10-business-rules.md`
- `11-offline-data-management.md`
- `12-printing-and-billing.md`
- `13-security-and-permissions.md`

**Next document:** `15-development-roadmap.md`.
