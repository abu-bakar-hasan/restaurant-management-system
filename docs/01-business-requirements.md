# Restaurant Billing & Management — Business Requirements & Product Blueprint

**Product type:** Windows desktop restaurant POS and management software  
**Deployment:** Single-computer, fully offline (initial release)  
**Document purpose:** Source of truth for product design, frontend implementation, database design, and business workflows.  
**Status:** Proposed specification; business-specific defaults should remain configurable.

---

## 1. Business overview

The software helps a restaurant manage its daily operations from one Windows computer: dine-in tables, advance table reservations, walk-in/takeaway orders, kitchen tickets, menu and prices, cash billing, payment reconciliation, and sales reporting. It must work without internet access or a browser.

### Primary business goals

- Create and settle bills quickly during busy service hours.
- Keep table availability and ongoing table orders accurate.
- Support **both table-wise dining and counter/walk-in billing** as first-class workflows.
- Prevent lost orders, duplicate payments, and untracked discounts or cancellations.
- Produce printable customer receipts and kitchen order tickets (KOTs).
- Maintain auditable local records and easy offline backup/restore.
- Keep the UI easy for cashiers and staff who are not technically trained.

### Operating assumptions

- Initial deployment is **one Windows computer**, with a local SQLite database.
- Restaurant staff may share the machine; role-based login is recommended.
- Internet is never required for core operations.
- No customer mobile app, online reservations, cloud sync, or payment gateway is required for v1.
- Cash, UPI, and card may be **recorded as payment methods**; offline recording does **not** itself process or verify electronic payments.
- Restaurant name, currency, taxes, table count, menu, and printer configuration are configurable.

## 2. Users and permissions

| Role | Typical responsibilities | Suggested permissions |
|---|---|---|
| Owner / Admin | Configuration, oversight, reports, backups | Full access; can manage roles, taxes, refunds, and restore |
| Manager | Shift supervision and exceptions | Orders, tables, reservations, reports, approved discounts/voids |
| Cashier | Take orders, collect payment, print receipts | POS, table orders, checkout, permitted discounts, cash closing |
| Kitchen staff (optional) | Read and update KOTs on same device | Kitchen queue and item preparation statuses |

**Rules:** Use a PIN/password per employee; do not store passwords in plaintext. Log sensitive actions with employee, timestamp, and reason. Permission limits should be configurable.

## 3. Core business entities

- **Restaurant:** Business identity, address, contact, logo, tax identifiers, receipt footer, currency.
- **Employee / Role:** Login credentials, status, permission assignments.
- **Dining area:** Optional zone or floor (Main Hall, Outdoor, etc.).
- **Table:** Number/name, capacity, area, active status, current occupancy.
- **Reservation:** Guest name/contact (optional), date/time, party size, table assignment, status, notes.
- **Menu category:** Starters, Main Course, Drinks, etc.; display order and active status.
- **Menu item:** Name, description, price, category, tax classification, availability, optional image.
- **Item variant/add-on:** Size, extras, modifiers, additional charge.
- **Order:** Dine-in or walk-in/takeaway, linked table if applicable, status, creator, timestamps.
- **Order line:** Menu item snapshot, quantity, unit price, modifiers, note, status.
- **KOT:** Kitchen ticket number, ordered items, timestamps, status, print/reprint history.
- **Invoice:** Immutable bill number, totals, taxes, discounts, issue time, linked order.
- **Payment:** Invoice, amount, method, time, reference (optional), employee.
- **Refund / Void:** Reason, amount or affected items, approver, audit trail.
- **Cash shift:** Opening cash, cash received, refunds/payouts, expected and counted closing cash.
- **Audit event:** Action, actor, affected record, timestamp, previous/new values where appropriate.
- **Backup record:** Date, destination, result, app/schema version.

## 4. Order types

### 4.1 Dine-in / table order

1. Cashier opens **Tables** and selects an available or occupied table.
2. For a new party, enters guest count (optional) and starts a table session.
3. Adds food items, quantities, variants, modifiers, and kitchen notes.
4. Sends new items to kitchen by generating a KOT.
5. Can add more items later without resending earlier KOT lines.
6. Opens bill preview; applies authorized discounts/taxes as configured.
7. Records one or more payments and prints receipt.
8. Once fully settled, closes the table session and returns table to **Available**.

**Important:** An occupied table must retain its open order when switching screens or restarting the application. A table may have multiple KOTs under one active session. Prevent two simultaneous active sessions for the same table unless the business explicitly enables them.

### 4.2 Walk-in / counter order

1. Cashier clicks **Quick Order / Walk-in** in the main navigation or header.
2. Adds items without selecting any table.
3. Optionally sends preparation items to kitchen.
4. Takes payment and prints a receipt.
5. Completes the order; no table state is changed.

**Important:** Walk-in orders are not a fallback mode of table orders. They have a dedicated, fast POS entry point and appear separately in filters and reports.

### 4.3 Takeaway (optional but recommended)

A counter order may be marked **Takeaway**, with optional customer name and pickup note. It uses the same order/payment engine, but its own label and reporting filter.

## 5. Table management

### Table states

| State | Meaning | Visual treatment |
|---|---|---|
| Available | No active session; ready for seating | **Green** |
| Occupied | Active dine-in session | Red / warm accent |
| Reserved | Held for an upcoming booking | Amber |
| Cleaning / Unavailable | Temporarily not usable | Neutral gray |

Table cards should display table number, capacity, status, and—when occupied—elapsed time and running bill. Allow filtering by area and status. Use both color and text so status is accessible.

### Table actions

- Add, rename, reorder, activate/deactivate tables.
- Start/open an order, add items, view running bill.
- Mark a table unavailable or available.
- Move an active session to another free table with confirmation and audit log.
- Merge or split bills **only if explicitly enabled**; this is an advanced feature and requires careful payment logic.
- Never delete a table with active orders or relevant historical records; archive it instead.

## 6. Table reservations / booking

**Reservation fields:** Guest name, contact number (optional), date, start time, party size, requested table/area, notes, status, creator.

**Statuses:** Pending, Confirmed, Seated, Completed, Cancelled, No-show.

**Business rules:**

- Show reservations in a date list and table-oriented view.
- Detect overlapping reservations for the same table, based on configurable booking duration and buffer.
- Prevent seating an unrelated party into a currently held table without manager override.
- Allow walk-in seating when no reservation conflicts exist.
- When a guest arrives, convert reservation to an active table session without creating a duplicate reservation.
- A reservation is not automatically a paid order; deposits are out of scope for v1 unless requested.
- Since the system is offline, bookings are entered locally by staff; there is no public online booking page.

## 7. Menu and pricing

- CRUD for categories, menu items, and optional modifiers/add-ons.
- Item availability toggle: Available / Sold Out / Hidden.
- Optional item image; app must work well without images.
- Configurable tax treatment per item/category, with restaurant-wide defaults.
- Optional dine-in vs takeaway prices, if the restaurant needs them.
- Quantity and special instructions on each order line.
- Save price, item name, and tax snapshots on each order line so historical bills remain accurate after menu edits.
- Prices cannot be negative; discounts cannot exceed permitted amounts.

**Example categories (seed data only):** Starters, Main Course, Breads, Rice, Beverages, Desserts. Menu content and prices must not be hard-coded as business rules.

## 8. POS and billing

### POS layout

- **Left:** Category navigation and searchable menu item grid/list.
- **Center/right:** Current order lines, quantity controls, notes, totals, checkout.
- **Top:** Order type switch (Table / Walk-in / Takeaway), selected table or order number, quick search.
- Fast keyboard operation, clear touch/click targets, confirmation for destructive actions.

### Bill calculation

1. Sum `(unit price + modifier charges) × quantity` for each active billable line.
2. Apply eligible item-level and/or bill-level discounts according to a documented order of operations.
3. Calculate tax based on the configured tax-inclusive or tax-exclusive model and applicable rules.
4. Apply any configured service charge only when applicable and legally appropriate.
5. Calculate final payable total and rounding adjustment if configured.
6. Record payments and compute remaining due or change due.

**Never assume a fixed GST rate.** Indian tax invoices, tax rates, registration thresholds, and receipt fields must be configured according to the restaurant's actual tax situation and verified with a qualified accountant. Avoid labeling a receipt “GST Tax Invoice” unless applicable.

### Payment methods

- **Cash:** Amount tendered, change due, cash drawer impact.
- **UPI:** Record amount and optional transaction/reference number; staff confirms receipt externally.
- **Card:** Record amount and optional reference; card processing is external.
- **Split:** Multiple payment records against one invoice, with exact reconciliation.

**Rules:** Never mark an invoice fully paid until the recorded payment sum meets the payable amount. Prevent overpayment except cash tender with correctly calculated change. Avoid double-submit by making finalization idempotent.

### Invoice and receipt

Receipt includes restaurant details, invoice number/date, order type/table, item lines, quantities, discounts, applicable taxes, total, payment methods, and footer. Customer contact is optional. Provide preview, print, and reprint. Reprints must retain the original invoice number and can be marked **Duplicate**.

## 9. Kitchen order ticket (KOT)

- KOT is generated for newly submitted items, not every time an existing order is opened.
- Show order number, table or walk-in identifier, item quantities, modifiers, notes, and submission time.
- KOT status: New → Preparing → Ready → Served/Completed (adapt for takeaway).
- Permit item cancellation after KOT only through a controlled workflow with reason and optional manager approval.
- Support KOT print and reprint; distinguish reprints from new tickets.
- Kitchen queue can be a screen on the same computer. A second kitchen terminal/network printer is a future enhancement, not assumed for v1.

## 10. Dashboard

Suggested KPI cards:

- Today's gross sales, discounts, refunds, and net sales.
- Orders completed today; open orders; average order value.
- Occupied, available, and reserved tables.
- Cash collected, UPI recorded, card recorded.
- Pending kitchen tickets.

Charts and widgets: hourly sales, sales by order type, top-selling menu items, recent transactions. All figures derive from the local database, not dummy counters after backend integration.

**Reporting conventions:** Define business-day cutoff (e.g., midnight or after late-night closing), timezone, cancelled-order treatment, refund handling, and whether charts show gross or net revenue.

## 11. Reports and cash management

### Reports

- Daily, weekly, monthly, and custom date-range sales.
- Order type breakdown: dine-in vs walk-in vs takeaway.
- Payment method breakdown: cash, UPI, card, split.
- Menu item quantity and revenue.
- Discounts, cancelled items/orders, refunds, and taxes.
- Employee/cashier activity.
- Table occupancy and reservation summaries.
- Export to CSV; printable report where useful.

### Cash shift / day closing

1. Open shift with starting cash amount.
2. Record cash receipts, approved cash refunds, and cash-in/out adjustments.
3. Calculate expected drawer cash.
4. Cashier enters actual counted cash at closing.
5. Display over/short difference and require reason when nonzero.
6. Close and lock shift summary; corrections require audit-tracked adjustment.

Electronic payment records must not increase physical cash drawer totals.

## 12. Navigation and screen inventory

**Primary navigation:**

1. Dashboard
2. POS / Quick Order
3. Tables
4. Reservations
5. Kitchen / KOT
6. Orders & Invoices
7. Menu Management
8. Reports
9. Cash Shifts
10. Settings

**Global header:** Restaurant name, current shift, signed-in employee, current date/time, quick access to new order, and backup status where relevant.

**Dialogs/drawers:** Add item, edit quantity/notes, reservation form, payment checkout, bill preview, move table, cancel/void confirmation, shift closing, backup/restore confirmation.

## 13. UI / UX requirements

- Clean, modern, professional **shadcn/ui** design; avoid unnecessary visual clutter.
- Desktop-first layout targeting common Windows laptop and monitor sizes (minimum recommended design width: 1280 px; smaller screens should remain usable).
- Sidebar navigation with clear active state; compact header; consistent spacing and typography.
- High-density but readable POS; table grid with unmistakable availability states.
- Smooth, subtle Motion transitions for dialogs and drawers; no animation that delays checkout.
- Keyboard shortcuts for search, quantity, checkout, and new walk-in order where safe.
- Loading, empty, error, confirmation, and success states for every data-driven module.
- Strong validation, clear error messages, accessible focus management, and sufficient contrast.
- No reliance on online fonts, CDN assets, remote images, or internet APIs.
- Use realistic dummy restaurant data for frontend prototyping; isolate seed data from production records.

## 14. Technical architecture

| Layer | Choice | Responsibility |
|---|---|---|
| Desktop shell | Tauri 2 | Native Windows window, installer, OS integration |
| Frontend | React + TypeScript + Vite | Views, workflows, form interaction |
| UI | Tailwind CSS + shadcn/ui + Lucide | Components and styling |
| Animation | Motion | Lightweight transitions |
| Client state | Zustand | Ephemeral UI state and current selection |
| Validation | Zod + React Hook Form | Input validation and forms |
| Backend | Rust / Tauri commands | Transactions, business rules, permissions, printing, backups |
| Database | Local SQLite | Persistent records and reports |
| Charts | Recharts | Dashboard/report visualizations |

**Data flow:** React UI → typed application services → Tauri commands → Rust domain services → SQLite. Business-critical calculations and mutations must be validated in the backend, not trusted to frontend state.

### Reliability requirements

- Enable SQLite foreign keys and appropriate journaling (typically WAL) and use database transactions.
- Store application data in the OS-appropriate per-user or app data directory, not alongside executable binaries.
- Persist every confirmed order change; do not rely on browser localStorage as the source of truth.
- Use unique invoice/KOT numbering strategies that remain consistent after restarts.
- Never delete finalized invoices as an ordinary edit; use void/refund/adjustment workflows.
- Protect against duplicate checkout and interrupted writes.
- Use migrations for database schema changes.
- Keep local secrets/credentials appropriately protected; apply least-privilege access.

## 15. Offline printing

- Support standard Windows print dialog first; prioritize common 58 mm and 80 mm thermal receipt widths.
- Provide configurable paper width, printer name, copies, logo visibility, and receipt footer.
- Receipt printing and KOT printing are separate workflows.
- Failed printing must not roll back a successfully committed payment or create duplicate invoices; allow safe reprint.
- Direct ESC/POS printer control and automatic cash drawer opening are optional hardware-specific enhancements requiring testing.

## 16. Backup, restore, and data ownership

- Offer manual **Backup Now** to a selected folder or USB drive.
- Use SQLite's safe backup mechanism rather than copying a live database file naively.
- Record backup date, size, application/schema version, and success/failure.
- Support restore from a compatible backup with a prominent warning and pre-restore safety backup.
- Validate backup integrity before replacing the active database.
- Recommend routine backups to an external drive; a backup stored only on the same computer is not disaster recovery.
- Restaurant owns its data and can export reports without an internet account.

## 17. Suggested data model

```text
restaurants
employees
roles
permissions
employee_roles
dining_areas
tables
reservations
table_sessions
menu_categories
menu_items
menu_item_variants
modifiers
orders
order_items
order_item_modifiers
kots
kot_items
invoices
invoice_lines
payments
refunds
cash_shifts
cash_movements
audit_logs
app_settings
backup_history
```

**Key relationships:**

- One table may have many historical sessions, but normally only one active session.
- One table session may contain one or more orders or one accumulating order (choose one model consistently).
- One order has many order lines and may generate multiple KOTs.
- One finalized invoice belongs to an order/billing settlement and may have multiple payments.
- Walk-in orders have **no required table foreign key**.
- Reservation-to-table-session link is optional until guest seating.

**Important database constraints:** Unique invoice numbers, foreign keys, nonnegative quantities and monetary amounts, constrained status values, and transactionally enforced payment/order transitions. Store money in integer minor units (e.g., paise) or another exact-decimal representation, not binary floating point.

## 18. Acceptance criteria / essential test scenarios

1. App starts and works with Wi-Fi disabled.
2. **Available table displays green**; selecting it can open a new dine-in order.
3. Occupied table retains items and bill after switching pages and restarting the app.
4. Two different tables maintain independent orders and totals.
5. A walk-in customer can be billed without selecting a table.
6. New KOT contains only newly submitted items, even after subsequent additions.
7. Reservation overlap is blocked or explicitly overridden by authorized staff.
8. Cash checkout correctly calculates change and records drawer cash.
9. UPI/card are recorded without falsely claiming payment processing.
10. Split payments settle an invoice exactly once.
11. Discount/tax changes update bill preview correctly; finalized invoice stays unchanged.
12. Failed printer output allows reprint without duplicating the transaction.
13. Table becomes available only when its active session is properly closed.
14. Cancel/refund actions require reason and appear in audit and reports.
15. Daily report totals reconcile with invoices, payments, and refunds.
16. Backup can be restored successfully on a test installation.
17. Restaurant data survives application updates and normal system restart.
18. Unauthorized staff cannot access protected settings or approve their own restricted actions.

## 19. MVP scope and delivery phases

### Phase 1 — Complete interactive frontend

- Desktop app shell, sidebar, header, navigation.
- Dashboard with clearly marked sample data.
- Tables grid, table detail, table order flow.
- Dedicated walk-in POS.
- Reservations screen, menu management, kitchen queue.
- Checkout dialog, invoice preview, reports, settings.
- Reusable, individually separated components and mock service interfaces.

### Phase 2 — Real offline data and core transactions

- SQLite migrations and seed setup.
- Restaurant configuration, menu CRUD, tables, reservations.
- Order persistence, KOT generation, invoice calculation, payment records.
- Staff authentication, authorization, and audit logs.

### Phase 3 — Operational readiness

- Thermal printing, receipt/KOT templates, cash shifts.
- Reports and CSV export.
- Backup/restore and error recovery.
- End-to-end tests for interrupted checkout and offline operation.

### Phase 4 — Distribution

- Build and test Windows installer.
- First-run setup wizard: restaurant details, tax preferences, tables, admin PIN, printer.
- Data migration/versioning and documented backup procedures.
- Installer and real-world cashier usability testing.

## 20. Explicitly out of scope for initial release

- Cloud database, online login, SaaS subscriptions, and browser-based access.
- Multi-PC live synchronization and remote owner dashboard.
- Online table reservations and customer ordering website.
- Integrated UPI/card transaction processing or automatic bank reconciliation.
- Inventory purchasing, recipe-level ingredient depletion, payroll, and accounting ledger.
- Delivery aggregator integrations and loyalty/CRM automation.
- Hardware-specific direct printer protocols until device requirements are known.

These can be considered later without complicating the offline single-PC MVP.

## 21. Business decisions to confirm before production

- Restaurant type: dine-in, quick-service, takeaway, or mixed.
- Number of tables, dining areas, and expected menu size.
- Whether bookings have fixed duration, buffers, or table-combination rules.
- Whether tax-inclusive pricing, GST registration, service charges, and invoice format apply.
- Required payment methods and whether partial payments are permitted.
- Discount/void/refund approval thresholds.
- Whether cashiers use individual logins or a shared terminal account.
- Receipt/KOT printer make, model, connection type, and paper width.
- Whether kitchen status updates happen on the same computer.
- Whether split bills, table transfers, and merge orders are needed in v1.
- Business-day closing time and cash shift procedure.
- Backup frequency, preferred external storage, and retention period.

---

## 22. Instructions for the AI development agent

Build the product described above as an **offline-first Windows desktop application**, not a hosted web app. Use **Tauri 2, React, TypeScript, Vite, Tailwind CSS, shadcn/ui, Rust, and SQLite**. Preserve **table-wise management and dedicated walk-in quick ordering** throughout the implementation.

Implement features as separate modules and reusable components, with clear boundaries between UI, domain services, persistence, and platform integration. Start with a polished, functional frontend using mock data behind replaceable service interfaces; do not confuse mock interactions with completed persistent business functionality. Later connect the same screens to transaction-safe Rust/SQLite services.

Prioritize correctness of totals, table states, reservations, KOTs, payments, invoices, permissions, and backup/restore over decorative features. All critical operations must work without internet. Do not silently add cloud dependencies. Treat this document as a business blueprint; clarify unresolved business decisions rather than inventing tax/legal requirements or hardware capabilities.
