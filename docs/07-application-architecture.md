# 07 — Application Architecture

**Product:** Offline Restaurant Billing & Management Desktop Application  
**Platform:** Windows desktop only  
**Status:** Proposed architecture (implementation blueprint)  
**Stack:** Tauri 2, React, TypeScript, Vite, Tailwind CSS v4, shadcn/ui, Zustand, Rust, SQLite

## 1. Architectural goals

- Operate fully offline without a local HTTP server, cloud service, or internet connection.
- Keep dine-in table orders and walk-in orders as distinct workflows on a shared order and billing engine.
- Protect financial records from duplicate clicks, crashes, partial writes, and concurrent operations.
- Support cash, UPI, card and split-tender recording; recording a non-cash payment does **not** imply bank/UPI verification.
- Support local receipt and KOT printing, manual backup/restore, and audit trails.
- Deliver a native Windows installer with straightforward updates and data portability.

## 2. System boundaries

```text
Windows Desktop App (Tauri 2)
  ├── React UI (shadcn/ui, Tailwind, Motion)
  │    ├── Dashboard / Tables / Reservations
  │    ├── POS: Dine-in / Walk-in
  │    ├── Kitchen / Billing / Reports / Settings
  │    └── Zustand: transient UI state + cached views
  └── Tauri invoke/events bridge
       └── Rust application layer
            ├── Authentication & authorization
            ├── Table/reservation/order services
            ├── Pricing, tax, payment, invoice services
            ├── KOT and print queue
            ├── Reports and audit services
            └── SQLite repository + transactions
                 └── Local SQLite DB (app data directory)
```

The React layer never opens the SQLite file directly and never becomes the authority for prices, payment state, permissions, or invoice numbers. Rust owns validated commands and durable writes.

## 3. Frontend architecture

- **React + TypeScript + Vite:** typed screens and reusable components.
- **shadcn/ui + Tailwind v4:** consistent accessible controls and design tokens per Document 06.
- **Zustand:** sidebar state, selected table, temporary cart drafts, filters, dialog state; never the sole store for committed orders.
- **React Hook Form + Zod:** user-friendly client validation; repeat all important validation in Rust.
- **Motion:** restrained transitions; respect reduced-motion preferences.
- **Recharts:** dashboard charts using locally aggregated report data.
- **Feature modules:** dashboard, tables, reservations, pos, orders, kitchen, billing, reports, menu, staff, settings.
- **Data access:** typed `invoke()` wrappers with request/response contracts and standardized errors. No direct SQL in UI.

## 4. Rust application layers

1. **Tauri command adapters:** deserialize inputs, identify the authenticated operator, invoke services, return typed DTOs.
2. **Domain services:** enforce permissions, order state machines, pricing, inventory-independent menu rules, table state and settlement rules.
3. **Repositories:** parameterized SQL queries and transaction management.
4. **Infrastructure adapters:** SQLite, printer/Windows spooler, filesystem backups, clock, logging.

Keep business calculations in Rust and unit-test them without launching Tauri. Treat frontend price previews as estimates until the backend confirms totals.

## 5. SQLite storage

- Store the live DB in the Tauri app-data directory, **not** inside the installation directory or frontend assets.
- Use migrations with an explicit schema version; migrations run on startup with a pre-migration backup where appropriate.
- Enable foreign keys; use WAL mode when appropriate; configure busy timeout and transactional writes.
- Use integer minor units (paise) for money; avoid floating-point arithmetic for invoices.
- Persist timestamps in UTC and render local business time; store restaurant timezone/settings explicitly.
- Add unique constraints for invoice numbers, payment request keys and other identifiers where needed.
- Store receipt snapshots (line descriptions, quantities, taxes, prices) so historical invoices remain accurate after menu edits.

### Core entities

`staff`, `roles`, `sessions`, `tables`, `reservations`, `menu_categories`, `menu_items`, `item_variants`, `orders`, `order_lines`, `kitchen_tickets`, `kitchen_ticket_lines`, `invoices`, `invoice_lines`, `payments`, `refunds`, `cash_shifts`, `cash_movements`, `print_jobs`, `settings`, `audit_events`, `schema_migrations`.

Exact columns, relationships and indexes belong in Document 09 — Database Schema.

## 6. Order lifecycle

### Dine-in

`available table → seated/occupied → open order → add items → KOT → billed → paid/closed → available table`

### Walk-in

`new walk-in order → add items → optional KOT → billed → paid/closed`

Rules:
- An occupied table may have an open order; a walk-in order has no table assignment.
- A reservation does not automatically imply an active order.
- Changes to sent kitchen items require a new KOT delta or cancellation record; do not silently rewrite already printed tickets.
- Finalized invoices cannot be edited in place; use authorized adjustments/refunds with audit history.
- Table transfer, merge and split-bill actions must be atomic and authorized.

## 7. Billing and payment integrity

A single backend pricing function computes subtotal, item discounts, bill discounts, configured taxes/charges, rounding, total due, payments applied and balance. Exact tax inclusivity, service charge policy, rounding and GST invoice requirements are configurable business decisions and must be confirmed before production.

**Checkout transaction:**
1. Validate operator permissions and order status.
2. Recompute totals from persisted line items and current applicable policy/snapshots.
3. Allocate a unique invoice number in a transaction.
4. Persist immutable invoice snapshot and payment records.
5. Mark order settled only when sufficient valid tenders are recorded.
6. Commit the transaction, then enqueue receipt printing.

Use a per-operation idempotency key to prevent double settlement on repeated clicks. Printer failure must never reverse a successfully committed sale. Cash change is calculated and displayed but is not additional revenue.

## 8. Tauri command contracts

Suggested command groups:

| Domain | Example commands |
|---|---|
| Session | `login`, `logout`, `current_session` |
| Tables | `list_tables`, `set_table_status`, `transfer_table` |
| Reservations | `create_reservation`, `list_reservations`, `check_reservation_conflicts` |
| Menu | `list_menu`, `save_menu_item`, `set_item_availability` |
| Orders | `create_order`, `add_order_line`, `update_order_line`, `submit_kot` |
| Billing | `preview_bill`, `finalize_invoice`, `record_payment`, `refund_payment` |
| Kitchen | `list_kitchen_tickets`, `update_kitchen_ticket_status` |
| Reports | `get_daily_sales`, `get_shift_summary` |
| Data | `create_backup`, `validate_backup`, `restore_backup` |
| Printing | `list_printers`, `print_receipt`, `retry_print_job` |

Commands are illustrative; finalize DTO names and contracts during implementation. Commands return stable error codes (`VALIDATION_ERROR`, `PERMISSION_DENIED`, `CONFLICT`, `NOT_FOUND`, `DB_UNAVAILABLE`, `PRINT_FAILED`) plus safe user-facing messages. Never return raw SQL errors or secrets.

## 9. UI refresh and events

After a successful backend mutation, update affected queries/views from the confirmed response and emit local events such as `order:changed`, `table:changed`, `kot:changed`, `payment:recorded`. Events are UI refresh signals, **not** a replacement for committed SQLite state. On restart, rebuild the interface from SQLite.

## 10. Printing architecture

- Generate 58 mm/80 mm receipt layouts and KOT layouts independently of React screen rendering.
- Print via a Windows-compatible adapter; validate actual printer models/drivers during deployment.
- Persist print jobs and outcomes (`pending`, `sent`, `failed`, `reprinted`) with retry capability.
- Mark duplicates/reprints clearly where needed; never issue a new invoice number merely to reprint.
- Where kitchen and receipt printers differ, configure routing per printer/department.
- Printing must be non-blocking and should not block saving an order or payment.

## 11. Offline data, backup and restore

- No runtime network dependency, remote authentication or hosted database.
- Backups should use SQLite's supported backup mechanism or a consistent checkpoint/snapshot; **do not** copy a live WAL-mode database file naively.
- Include metadata: schema version, application version, backup creation time, restaurant identity, integrity/checksum where appropriate.
- Restore requires elevated permission, explicit confirmation, validation, a safety backup of current data, and a controlled database reopen/restart.
- A backup on the same disk is not sufficient protection against drive failure; support external-drive copies.
- Protect against shutdown mid-operation with SQLite transactions and startup integrity/recovery checks.

## 12. Security model

- Local staff accounts with role-based permissions; store password/PIN verifiers using an appropriate salted password hashing algorithm, never plaintext.
- Enforce permissions in Rust commands, not just by hiding UI buttons.
- Limit Tauri capabilities/plugins and filesystem permissions to required operations.
- Restrict access to sensitive local files and avoid logging credentials or full payment details.
- Record audit events for refunds, voids, manual discounts, cash adjustments, backup restores, and permission changes.
- Optional idle lock; re-authentication for high-risk operations.

## 13. Performance and reliability

Target quick POS interaction on typical Windows office hardware. Use indexed queries, pagination for long history, and background work for reports/printing. Avoid large synchronous UI operations. Provide clear handling for database busy errors, printer disconnection, power loss and invalid backup files. Measure startup time, order save latency and invoice commit latency on the actual target machine.

## 14. Deployment

- Package using Tauri's supported Windows installer target(s), test on a clean Windows machine.
- On first run, create the app-data directory, initialize schema, and guide restaurant/admin setup.
- Keep app binaries and mutable restaurant data separate so reinstalling does not overwrite data.
- For offline upgrades, distribute a signed installer when possible; perform versioned migrations with recovery planning.
- Verify installer prerequisites, printer drivers, backup permissions and uninstall behavior.

## 15. Testing boundaries

- **Unit:** money calculations, taxes, discounts, state transitions, reservation overlap, permissions.
- **Integration:** SQLite transactions, migrations, unique invoice numbers, idempotency, backup/restore.
- **UI:** POS keyboard flows, table colors, dialogs, validation, reduced motion.
- **End-to-end:** dine-in order → KOT → invoice → payment → print → table released; walk-in cash sale; split payment; crash/restart recovery.
- **Hardware:** receipt/KOT printers, USB disconnect, paper out, print retry and reprint.

## 16. Architecture decisions to confirm

1. One Windows PC only for v1, or multiple terminals later? SQLite on a shared network drive is **not** a recommended multi-terminal architecture; future multi-terminal operation needs a deliberate service/synchronization design.
2. Restaurant tax registration/GST requirements, item tax rates, inclusive/exclusive tax policy and invoice format.
3. Whether UPI/card are recorded manually or integrated with a payment terminal later.
4. Supported thermal printer models and 58 mm vs 80 mm paper.
5. Reservation duration, no-show handling, table merging/splitting and refunds approval policy.
6. Staff authentication method and role definitions.
7. Backup cadence, retention, encryption needs and restoration ownership.

Until confirmed, keep these as configurable policies or explicit assumptions, not hardcoded legal or operational facts.

## 17. Implementation sequence

1. Tauri shell, typed IPC, design system and navigation.
2. SQLite migrations, settings, staff authentication and permissions.
3. Menu, tables and reservations.
4. Unified order engine with separate dine-in and walk-in POS screens.
5. KOT, invoice calculations, payments and cash shifts.
6. Printer integration, reports, backups and audit trail.
7. Fault-injection tests, Windows packaging and pilot rollout.

## 18. Instructions for AI coding agents

- Read Documents 01–06 before changing user-facing workflows; consult Document 09 for schema details.
- Do not introduce cloud services, browser-only persistence, an Express API or a required internet connection.
- Keep all financial mutations in Rust + SQLite transactions.
- Avoid monolithic React files; separate feature screens, components, hooks and typed IPC clients.
- Do not treat Zustand or localStorage as the durable source of truth.
- Write migrations and tests for each persistent feature.
- Do not silently change finalized financial documents; implement audited reversal/refund flows.
- Keep printer failure independent of order/payment persistence.
- If a business policy is unresolved, surface it explicitly rather than inventing a production rule.

## 19. Related documents

- `01-business-requirements.md` — business scope
- `02-product-requirements.md` — product acceptance criteria
- `03-functional-specifications.md` — detailed behavior
- `04-user-flows.md` — operator journeys
- `05-ui-ux-guidelines.md` — interaction guidelines
- `06-design-system.md` — visual tokens and components
- `08-folder-structure.md` — next document
- `09-database-schema.md` — persistent data contract

---

**Architecture principle:** The interface may be modern and fast, but the authoritative record of every restaurant order, invoice, payment and audit action must remain in the local transactional backend.
