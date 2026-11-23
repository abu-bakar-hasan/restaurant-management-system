# 15 — Development Roadmap

**Product:** Offline Restaurant Billing & Management Desktop Application  
**Platform:** Windows desktop only  
**Stack:** Tauri 2, React, TypeScript, Vite, Tailwind CSS v4, shadcn/ui, Zustand, Rust, SQLite  
**Status:** Planning baseline — revise after requirements decisions and hardware validation

## 1. Purpose
This roadmap turns the business requirements, PRD, functional specifications, user flows, design system, architecture, database schema, business rules, offline storage, printing, security, and testing strategy into an executable implementation sequence. It is **not** a promise of delivery dates. Each phase has explicit exit criteria and dependencies.

## 2. Non-negotiable product scope
- Fully offline, single-Windows-computer desktop software; no cloud account or running web server.
- Dine-in table orders **and** separate walk-in/quick orders, using one order and billing engine.
- Table availability (available/green, occupied, reserved, unavailable), reservations, kitchen tickets, cash billing, recorded UPI/card payments, receipt printing, reporting, backups and recovery.
- SQLite is the durable source of truth. Rust enforces financial and authorization rules; React displays state and collects input.
- Store money as integer paise; preserve historic prices and finalized invoices; use transactions and idempotency for payments.
- Never treat a frontend demo or a successful development build as a production release.

## 3. Dependencies and decisions to close before production
| Decision | Why it matters | Owner |
|---|---|---|
| Restaurant GST registration, invoice format, applicable tax rates and tax-inclusive/exclusive pricing | Billing correctness and compliance; confirm with accountant | Restaurant owner |
| Service charge, discounts, rounding, refunds and bill void permissions | Business rules and acceptance tests | Restaurant owner |
| Supported thermal printers, paper widths, Windows drivers, KOT printer routing | Printer integration and physical testing | Restaurant owner + developer |
| Reservation duration, grace period, walk-in overlap, table transfer/merge and split bill policies | Table and order lifecycle | Restaurant owner |
| Staff roles, PIN/password policies, shift closing and cash variance approval | Security and cash operations | Restaurant owner |
| Backup destination, retention, encryption, restore authorization | Data protection | Restaurant owner |

Do not silently invent compliance settings. Keep configurable values in settings and document unresolved decisions.

## 4. Phases and deliverables

### Phase 0 — Requirements reconciliation and acceptance baseline
**Work:** Cross-check documents 01–14 for contradictions; decide MVP scope; enumerate all screens and workflows; create a traceability matrix (requirement ID → implementation → test); capture pending owner decisions.  
**Deliverables:** approved MVP checklist, decision log, screen inventory draft, acceptance matrix.  
**Exit:** no critical unresolved contradiction for MVP development.

### Phase 1 — Repository and desktop foundation
**Work:** Initialize Vite React TypeScript app and Tauri 2 shell; configure Tailwind v4, shadcn/ui, lint/format/type checks, tests, routing, error boundaries and feature-first folders; verify Windows packaging and offline launch early.  
**Deliverables:** working native desktop shell, basic navigation, CI/local checks, first test installer.  
**Exit:** clean install and launch on a target Windows machine with internet disconnected.

### Phase 2 — Design system and interactive frontend prototype
**Work:** Implement tokens, typography, layout, keyboard navigation, loading/empty/error states, dialogs and motion; build dashboard, tables, reservations, menu, POS, kitchen, billing, reports and settings with explicitly marked mock data. Maintain table-wise and walk-in paths separately in UI.  
**Deliverables:** navigable prototype and component catalogue.  
**Exit:** user can demonstrate both complete order flows visually without mistaking mock transactions for persisted sales.

### Phase 3 — SQLite persistence and Rust service foundation
**Work:** Implement migrations, foreign keys, transaction handling, repositories, validation, Tauri commands, local app-data paths, error mapping, audit logging and database integrity checks. Never store the live database inside the install directory.  
**Deliverables:** migration-tested SQLite database, typed frontend command adapters, seeded development fixtures.  
**Exit:** data survives restart; migrations upgrade a prior test database without losing records.

### Phase 4 — Menu, tables and reservations
**Work:** CRUD for categories, menu items and price variants; tables and seating sessions; reservation creation, conflict checks, arrival, no-show and cancellation rules; table status derivation.  
**Deliverables:** persistent menu and table/reservation management.  
**Exit:** overlapping bookings are rejected per configured policy; occupied/reserved/unavailable statuses remain consistent after restart.

### Phase 5 — Unified order engine and kitchen workflow
**Work:** Implement dine-in and walk-in orders, item snapshots, quantities, notes, order status transitions, KOT generation and amendments, kitchen queue, cancellation permissions and audit records.  
**Deliverables:** persisted orders and kitchen tickets.  
**Exit:** both order types use shared domain logic; no item silently disappears; KOT changes are traceable.

### Phase 6 — Billing, payments and cash shifts
**Work:** Build deterministic totals calculator in Rust; discounts, configurable tax, invoice issuance, cash tender/change, recorded UPI/card payments, split tender if approved, refunds/voids, shift open/close and cash variance. Use atomic transactions and idempotency keys for finalization.  
**Deliverables:** reliable invoice and payment lifecycle.  
**Exit:** duplicate clicks/retries do not double-charge in records; all monetary test vectors match expected paise; table released only under approved settlement rules.

### Phase 7 — Printing and reporting
**Work:** Add printer discovery/selection, receipt templates for supported widths, KOT routing, durable print jobs, retries and reprint audit; daily sales, item sales, payment-method and shift reports; CSV export.  
**Deliverables:** working printer integration and reports.  
**Exit:** test on real target printer(s); failed print does not reverse payment; reports reconcile with finalized invoices/refunds.

### Phase 8 — Security, backups and recovery
**Work:** Role-based authorization in Rust, password/PIN hashing, staff sessions, audit trails, safe SQLite online backups, integrity verification, restore preview and confirmation, retention, disk-full/error handling and crash recovery.  
**Deliverables:** offline operational resilience.  
**Exit:** backup restores on a separate Windows test installation; interrupted operations recover without duplicate financial records.

### Phase 9 — End-to-end QA and pilot
**Work:** Unit/integration/E2E tests; hardware testing; power-loss and app-crash simulation; Windows DPI and keyboard tests; realistic high-volume sample data; supervised restaurant pilot and issue triage.  
**Deliverables:** test report, defect log, operator feedback, updated documentation.  
**Exit:** all critical/high-severity defects closed, reconciliation and recovery tests pass, owner signs off workflows.

### Phase 10 — Release and handover
**Work:** Versioned Windows installer, first-run setup, backup/restore instructions, operator guide, printer setup guide, migration/release notes, local update procedure and rollback plan.  
**Deliverables:** signed installer if signing is available, release checklist, training materials, support procedure.  
**Exit:** clean offline install, real receipt test, successful backup and restore rehearsal, completed handover.

## 5. Recommended MVP vs later releases
**MVP:** Single site, one Windows PC, menu/categories, dine-in tables, walk-in POS, reservations, basic KOT, cash billing, recorded UPI/card, configured taxes, invoice/receipt, daily sales, basic staff roles, backup/restore, printer support for verified hardware.

**Later only if approved:** multi-terminal LAN sync, remote owner dashboard, inventory/recipes, loyalty/CRM, online ordering, QR payments with automatic confirmation, advanced promotions, complex split bills, accounting integrations, cloud sync. These features must not create hidden online dependencies in MVP.

## 6. Workstream dependencies
```text
Requirements → Desktop foundation → UI prototype
                            ↘ Database/Rust foundation
Database → Menu/Tables/Reservations → Orders/KOT → Billing/Payments
Billing + KOT → Printing/Reports
All persistent workflows → Security/Backup/Recovery → QA/Pilot → Release
```
Security, testing, and error handling begin in early phases; their later phases are final hardening, not first implementation.

## 7. Quality gates (apply to every feature)
1. Requirement and business-rule identifiers linked to code and tests.
2. TypeScript type-check, lint and formatting pass.
3. Rust unit/integration tests pass, including authorization and transaction boundaries.
4. Empty/loading/error/retry states implemented and keyboard-operable.
5. Offline behavior verified; no unexpected external network calls.
6. Persistence and restart behavior tested for every mutation.
7. Audit and permission checks for sensitive actions.
8. Relevant user workflow demonstrated on packaged Windows build.

## 8. Critical test scenarios
- Open Table 3 → add items → send KOT → add more items → settle cash → print receipt → table becomes available.
- Walk-in order → cash tender → correct change → print → no table occupancy.
- Reservation conflicts and arrival transitions; occupied table cannot be double-assigned.
- Double-click Pay or retry after timeout → one finalized invoice/payment.
- Crash before vs after transaction commit → consistent order and payment state.
- Printer offline → payment persists; job can be retried and reprint is marked.
- Refund/void requires approval and appears in audit and reconciliation.
- SQLite backup while app is running → valid restored database.
- Upgrade from previous version → migrations preserve historical records.
- No internet available from install through shift closing.

## 9. Suggested issue tracking format
For every ticket capture: **ID, module, requirement reference, business-rule reference, description, dependencies, priority, acceptance criteria, test IDs, owner, status, and evidence**. Suggested statuses: Backlog → Ready → In Progress → Review → QA → Done; Blocked is explicit.

## 10. Milestone review checklist
At each phase review: demonstrated feature, automated test results, offline behavior, database migration implications, security implications, known limitations, unresolved decisions and next-phase dependencies. No phase is complete on screenshots alone.

## 11. AI coding agent operating instructions
- Read this roadmap together with documents 01–14 before implementing a dependent feature.
- Implement small vertical slices; do not generate the whole application as one giant component or file.
- Reuse shared order/billing domain services for dine-in and walk-in workflows.
- Use SQLite migrations and Rust transactions for durable operations; do not use localStorage for authoritative financial data.
- Do not fabricate successful printer/payment confirmation. UPI/card in MVP records a staff-confirmed external payment, unless verified integration is later approved.
- Avoid hard-coded tax rates, invoice prefixes and printer models.
- Add tests and update the traceability matrix when behavior changes.
- Stop and record a decision needed rather than guessing on financial or legal behavior.

## 12. Related documents
- `01-business-requirements.md`
- `02-product-requirements.md`
- `03-functional-specifications.md`
- `04-user-flows.md`
- `05-ui-ux-guidelines.md`
- `06-design-system.md`
- `07-application-architecture.md`
- `08-folder-structure.md`
- `09-database-schema.md`
- `10-business-rules.md`
- `11-offline-data-management.md`
- `12-printing-and-billing.md`
- `13-security-and-permissions.md`
- `14-testing-strategy.md`

## 13. Next document
**16 — AI Agent Instructions:** coding standards, boundaries, definition of done, review rules, and task execution protocol.
