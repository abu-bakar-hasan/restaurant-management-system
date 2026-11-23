# 16 — AI Coding Agent Instructions

**Project:** Offline Restaurant Billing & Management Desktop Application  
**Status:** Implementation instructions, v1.0  
**Target:** Windows desktop, single-computer operation, fully offline

## 1. Mission
Build a reliable restaurant POS and management application that supports **both dine-in table orders and walk-in quick orders**. Preserve table-wise ordering and billing as first-class workflows. Prioritize billing correctness, recoverability, staff usability, and maintainable code over visual novelty.

## 2. Authoritative documents
Read the project documents in `docs/` before coding. Resolve conflicts in this order:
1. Explicit latest user instructions.
2. Approved business rules and functional specifications.
3. Product requirements and user flows.
4. Database schema and application architecture.
5. UI/UX guidelines and design system.
6. Development roadmap and this document.

Do **not** silently invent policy decisions. Record unresolved questions in `docs/decisions.md`, with the affected feature and safe provisional behavior. Do not treat sample tax rates or printer commands as legal or hardware guarantees.

## 3. Fixed technology choices
- **Desktop shell:** Tauri 2 (Windows installer).
- **Frontend:** React, TypeScript (strict), Vite.
- **UI:** Tailwind CSS v4, shadcn/ui, Lucide icons, Motion for restrained animation.
- **Client state:** Zustand for ephemeral UI state; do not use it as the authoritative store for orders or payments.
- **Backend:** Rust Tauri commands, services and repositories.
- **Persistence:** Local SQLite database with versioned migrations.
- **Reports:** Recharts where useful.
- **Networking:** No internet, remote API, cloud authentication, telemetry, or CDN dependency in normal operation.

## 4. Non-negotiable product behavior
- Dine-in: view tables, open a table session, add items, send KOT, bill, record payment, close and free the table.
- Walk-in: select items and bill directly without assigning a table.
- Show table status clearly: **available = green**; occupied, reserved and unavailable must be distinct and not color-only.
- Reservations must avoid conflicting bookings and clearly handle arrival, cancellation and no-show states.
- Support menu categories, items, price variants and availability.
- Support cash payments (including cash received and change), manually recorded UPI/card payments, split payments when specified, and authorized refunds.
- Generate invoices and KOTs; handle printer failures without losing financial records.
- Provide cash shifts, daily reports, staff roles, audit trails, local backups and restore.
- Do not add web hosting, accounts, subscriptions or online features unless requested.

## 5. Architecture and boundaries
### Frontend
- Organize features independently: `dashboard`, `tables`, `reservations`, `menu`, `orders`, `pos`, `kitchen`, `billing`, `payments`, `reports`, `settings`.
- Place shadcn/ui primitives in `src/components/ui/`; common composed controls in `src/components/common/`; feature-specific components within their feature.
- Keep components small, typed and accessible. Do not create a single giant `App.tsx` or a monolithic POS component.
- Access backend through typed command wrappers; never call SQLite directly from React.
- React form validation improves UX but **Rust validation is authoritative**.

### Rust
- Tauri commands are thin adapters: validate caller/session, parse request, invoke service, map structured results.
- Services implement business rules; repositories handle SQLite queries.
- Never trust client-submitted prices, totals, permissions, timestamps or invoice numbers without server-side checks.
- Keep printer integration behind an interface, with mock/test implementation and explicit printer status.

### Database
- SQLite is the single source of truth.
- Store money as integer **paise**; never use floating-point money arithmetic.
- Use foreign keys, constraints, indexes, migrations and transactions.
- Preserve historical line-item prices and tax snapshots.
- Treat paid invoices as immutable; corrections must be traceable through authorized adjustments/refunds.
- Use unique idempotency keys for operations that must not duplicate, especially payment completion and invoice creation.
- Use a safe SQLite online-backup method, not a raw copy of a live database file.

## 6. UI and interaction standards
- Desktop-first layout optimized for common Windows displays, keyboard and mouse.
- Clear left navigation, readable data density, high-contrast totals and action hierarchy.
- POS: menu search/categories, item selection, quantity adjustments, cart summary, checkout.
- Table overview: immediate visual distinction among available, occupied, reserved and blocked tables.
- Prefer shadcn/ui Dialog, Sheet, AlertDialog, Form, Table, Tabs, Select, Popover and Toast patterns where appropriate.
- Use semantic color tokens and consistent spacing. No unnecessary pills, badges, decorative clutter or intrusive animations.
- Every async action needs pending, success and error feedback. Disable repeat submissions where needed.
- All critical flows must work with keyboard; confirmations are required for destructive or financial actions.

## 7. Financial and operational safeguards
- Compute totals in Rust from persisted order lines and approved configuration.
- Tax, discount, service charge and rounding rules must be configurable and tested; do not hardcode a universal GST treatment.
- Use atomic transactions for payment recording, invoice finalization and table release.
- A printer failure must **not** roll back a committed payment. Record a print job with retry/reprint status.
- Kitchen tickets should reflect only new or changed order items, avoiding accidental duplicate production.
- Never delete paid financial history as part of ordinary UI actions.
- Record actor, timestamp, reason and before/after values for sensitive changes.

## 8. Authentication and security
- Store salted password/PIN hashes using a suitable password-hashing algorithm; never plaintext credentials.
- Enforce role-based permissions in Rust for every protected command.
- Restrict refunds, voids, price overrides, backups/restores and configuration changes appropriately.
- Minimize Tauri capabilities; do not expose arbitrary filesystem or shell access to the frontend.
- Keep database and backups in appropriate Windows application-data locations, not inside the installed executable directory.
- Explain limitations of local-only security: an administrator with full OS access may still access files unless additional protections are implemented.

## 9. Offline, backup and recovery
- First launch initializes the database and required settings locally.
- Normal operation must succeed with network adapters disabled.
- Backups must be consistent, verifiable and restorable through a guarded workflow.
- Before restore, create a recovery backup and require authorized confirmation.
- Handle low disk space, database errors, interrupted shutdowns, and migration failures with actionable messages.
- Never auto-delete customer records, payments or backups without an approved retention policy.

## 10. Printing
- Support configurable Windows-installed receipt and kitchen printers; target 58 mm and 80 mm layouts where supported.
- Separate printable document rendering from transport to hardware.
- Persist print jobs with status (`pending`, `printing`, `printed`, `failed`) and attempt history.
- Reprints must be clearly identified and auditable.
- Validate printer-specific behavior on real hardware; do not claim universal ESC/POS compatibility.

## 11. Development protocol for each task
1. Read the relevant docs and inspect existing code before changing anything.
2. Summarize the goal, dependencies, assumptions and affected modules.
3. Implement the smallest complete vertical slice, respecting existing structure.
4. Add or update migrations, types, backend commands, UI and tests as needed.
5. Run formatting, linting, type checks and tests; report the exact commands and results.
6. Manually verify critical UI states and offline behavior when applicable.
7. Summarize changed files, delivered behavior, known limitations and next task.

Do not overwrite unrelated work, delete existing modules, or refactor the architecture without a clear need. Do not claim tests passed if they were not run. Do not fabricate screenshots, database migrations or printer validation.

## 12. Recommended implementation sequence
1. Scaffold Tauri 2 + React/Vite/TypeScript + Tailwind + shadcn/ui.
2. Application shell, navigation, design tokens and reusable UI primitives.
3. SQLite initialization, migrations, repository pattern and typed command bridge.
4. Staff authentication and permission checks.
5. Menu management and table setup.
6. Table sessions and dine-in ordering; walk-in quick orders.
7. Kitchen ticket workflow and persistence.
8. Billing engine, payment recording, invoices and cash change.
9. Printer queue and receipt/KOT templates.
10. Reservations, cash shifts and reports.
11. Backups, restore, crash recovery, audit logging and security hardening.
12. End-to-end tests, real printer tests and Windows installer validation.

The frontend may be prototyped with dummy data initially, but label it clearly and do not confuse prototype behavior with persisted production functionality.

## 13. Required tests
- Dine-in order through paid invoice and table release.
- Walk-in cash order, cash received and exact change.
- Duplicate payment submission produces only one payment.
- Cancelled/voided items and KOT amendments are traceable.
- Reservation overlap is rejected.
- Printer unavailable after successful payment: invoice remains committed, reprint remains possible.
- App terminated mid-operation: database remains consistent on restart.
- Backup, restore and migration preserve financial data.
- Cashier cannot perform manager/admin-only actions through direct Tauri invocation.
- Packaged Windows app works with internet disabled.

## 14. Definition of done
A feature is complete only when its UI, Rust validation, SQLite persistence, error states, permissions, and relevant automated tests are implemented; related docs are updated; and any hardware-dependent verification is explicitly identified as passed or pending.

## 15. Pending decisions — do not assume
- Restaurant GST registration and invoice requirements.
- Tax-inclusive vs tax-exclusive menu prices and rounding policy.
- Discount authorization limits and service charges.
- Exact reservation duration, grace period and no-show policy.
- Split-bill scope and refunds/void policy.
- Printer models, drivers, cash drawer and paper sizes.
- Single-user vs multiple staff accounts on the same computer.
- Backup frequency, retention and optional backup encryption.
- Whether multi-computer support is ever needed (not part of current offline single-PC scope).

## 16. Suggested AI agent handoff prompt
> Read `docs/01-business-requirements.md` through `docs/16-ai-agent-instructions.md`, prioritizing the documents relevant to the requested feature. Build a fully offline Windows restaurant management desktop app using Tauri 2, React, TypeScript, shadcn/ui, Rust and SQLite. Preserve both table-wise dine-in and walk-in ordering. Before implementing a feature, inspect existing code and identify unresolved business decisions. Enforce billing, security and data integrity in Rust. Implement in small tested slices and report exactly what was changed, tested and remains pending.
