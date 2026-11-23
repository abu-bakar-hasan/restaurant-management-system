# 09 — SQLite Database Schema

**Product:** Offline Restaurant Billing & Management (Windows desktop)  
**Stack:** Tauri 2 · Rust · SQLite · React/TypeScript · shadcn/ui  
**Status:** Proposed implementation baseline — validate tax, refund, and operational policies before production.

## 1. Goals and invariants

- One local SQLite database is the source of truth; no cloud dependency.
- Dine-in table orders and walk-in orders share the same order, invoice, and payment model.
- Persist monetary values as **integer paise**, never floating point.
- Persist timestamps as UTC ISO-8601 strings; display them in restaurant-local time (typically Asia/Kolkata).
- Never delete posted invoices or settled payments. Use explicit void/refund/reversal records and audit events.
- Enforce foreign keys, transactional writes, unique invoice numbers, and idempotency keys.
- Treat table availability as a projection of current seating, maintenance, and reservations; do not assume a manually stored color is authoritative.

## 2. Relationship overview

```text
staff_users ──< shifts ──< payments >── invoices >── orders ──< order_items
                         │                    │          │
                         │                    │          ├──< kitchen_tickets ──< kitchen_ticket_items
                         │                    │          └── dining_sessions >── restaurant_tables
                         └──< payment_refunds  │
reservations >── restaurant_tables             └──< invoice_lines
menu_categories ──< menu_items ──< menu_variants
orders ──< order_items >── menu_variants
```

The relationship diagram is simplified: a dining session may include multiple orders; a reservation can optionally link to a session; split bills require explicit invoice-line allocations.

## 3. Database configuration

On every connection run `PRAGMA foreign_keys = ON;` and configure `busy_timeout`. Use WAL journaling for routine concurrency, and checkpoint/SQLite backup APIs for safe backup. Keep the DB under Tauri's application data directory, not alongside the executable. Use a migration runner with a `schema_migrations` table; never silently recreate a production database.

## 4. Core SQL schema (initial migration)

The following is a concrete starting schema, not a complete set of operational queries. Application services must enforce cross-row invariants within `BEGIN IMMEDIATE` transactions.

```sql
PRAGMA foreign_keys = ON;

CREATE TABLE schema_migrations (
  version INTEGER PRIMARY KEY,
  applied_at TEXT NOT NULL
);

CREATE TABLE staff_users (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  pin_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner','manager','cashier','server','kitchen')),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  created_at TEXT NOT NULL
);

CREATE TABLE restaurant_tables (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL UNIQUE,
  capacity INTEGER NOT NULL CHECK (capacity > 0),
  zone TEXT,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  maintenance INTEGER NOT NULL DEFAULT 0 CHECK (maintenance IN (0,1))
);

CREATE TABLE reservations (
  id TEXT PRIMARY KEY,
  table_id TEXT NOT NULL REFERENCES restaurant_tables(id),
  guest_name TEXT NOT NULL,
  guest_phone TEXT,
  party_size INTEGER NOT NULL CHECK (party_size > 0),
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('booked','seated','completed','cancelled','no_show')),
  notes TEXT,
  created_by TEXT REFERENCES staff_users(id),
  created_at TEXT NOT NULL,
  CHECK (ends_at > starts_at)
);

CREATE TABLE dining_sessions (
  id TEXT PRIMARY KEY,
  table_id TEXT NOT NULL REFERENCES restaurant_tables(id),
  reservation_id TEXT UNIQUE REFERENCES reservations(id),
  guest_count INTEGER NOT NULL CHECK (guest_count > 0),
  opened_at TEXT NOT NULL,
  closed_at TEXT,
  opened_by TEXT REFERENCES staff_users(id),
  CHECK (closed_at IS NULL OR closed_at >= opened_at)
);
CREATE UNIQUE INDEX ux_active_session_per_table
  ON dining_sessions(table_id) WHERE closed_at IS NULL;

CREATE TABLE menu_categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1))
);

CREATE TABLE menu_items (
  id TEXT PRIMARY KEY,
  category_id TEXT NOT NULL REFERENCES menu_categories(id),
  name TEXT NOT NULL,
  description TEXT,
  image_path TEXT,
  available INTEGER NOT NULL DEFAULT 1 CHECK (available IN (0,1)),
  archived INTEGER NOT NULL DEFAULT 0 CHECK (archived IN (0,1))
);

CREATE TABLE menu_variants (
  id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL REFERENCES menu_items(id),
  name TEXT NOT NULL DEFAULT 'Regular',
  price_paise INTEGER NOT NULL CHECK (price_paise >= 0),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  UNIQUE(item_id, name)
);

CREATE TABLE orders (
  id TEXT PRIMARY KEY,
  order_number TEXT NOT NULL UNIQUE,
  order_type TEXT NOT NULL CHECK (order_type IN ('dine_in','walk_in')),
  session_id TEXT REFERENCES dining_sessions(id),
  status TEXT NOT NULL CHECK (status IN ('open','sent_to_kitchen','ready','served','closed','cancelled')),
  created_by TEXT NOT NULL REFERENCES staff_users(id),
  created_at TEXT NOT NULL,
  closed_at TEXT,
  notes TEXT,
  CHECK ((order_type = 'dine_in' AND session_id IS NOT NULL)
      OR (order_type = 'walk_in' AND session_id IS NULL))
);

CREATE TABLE order_items (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id),
  variant_id TEXT REFERENCES menu_variants(id),
  item_name_snapshot TEXT NOT NULL,
  variant_name_snapshot TEXT NOT NULL,
  unit_price_paise INTEGER NOT NULL CHECK (unit_price_paise >= 0),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  status TEXT NOT NULL CHECK (status IN ('active','cancelled')),
  notes TEXT,
  added_at TEXT NOT NULL,
  cancelled_at TEXT,
  cancelled_by TEXT REFERENCES staff_users(id),
  cancellation_reason TEXT
);

CREATE TABLE kitchen_tickets (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id),
  ticket_number TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('queued','preparing','ready','completed','cancelled')),
  created_at TEXT NOT NULL,
  printed_at TEXT
);
CREATE TABLE kitchen_ticket_items (
  id TEXT PRIMARY KEY,
  ticket_id TEXT NOT NULL REFERENCES kitchen_tickets(id),
  order_item_id TEXT NOT NULL REFERENCES order_items(id),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  UNIQUE(ticket_id, order_item_id)
);

CREATE TABLE invoices (
  id TEXT PRIMARY KEY,
  invoice_number TEXT NOT NULL UNIQUE,
  order_id TEXT NOT NULL REFERENCES orders(id),
  status TEXT NOT NULL CHECK (status IN ('issued','part_paid','paid','void')),
  subtotal_paise INTEGER NOT NULL CHECK (subtotal_paise >= 0),
  discount_paise INTEGER NOT NULL DEFAULT 0 CHECK (discount_paise >= 0),
  tax_paise INTEGER NOT NULL DEFAULT 0 CHECK (tax_paise >= 0),
  service_charge_paise INTEGER NOT NULL DEFAULT 0 CHECK (service_charge_paise >= 0),
  total_paise INTEGER NOT NULL CHECK (total_paise >= 0),
  issued_at TEXT NOT NULL,
  issued_by TEXT REFERENCES staff_users(id),
  void_reason TEXT,
  CHECK (discount_paise <= subtotal_paise),
  CHECK (total_paise = subtotal_paise - discount_paise + tax_paise + service_charge_paise)
);

CREATE TABLE invoice_lines (
  id TEXT PRIMARY KEY,
  invoice_id TEXT NOT NULL REFERENCES invoices(id),
  order_item_id TEXT NOT NULL REFERENCES order_items(id),
  description_snapshot TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price_paise INTEGER NOT NULL CHECK (unit_price_paise >= 0),
  line_total_paise INTEGER NOT NULL CHECK (line_total_paise >= 0),
  CHECK (line_total_paise = quantity * unit_price_paise)
);

CREATE TABLE shifts (
  id TEXT PRIMARY KEY,
  opened_by TEXT NOT NULL REFERENCES staff_users(id),
  opened_at TEXT NOT NULL,
  opening_cash_paise INTEGER NOT NULL DEFAULT 0 CHECK (opening_cash_paise >= 0),
  closed_by TEXT REFERENCES staff_users(id),
  closed_at TEXT,
  counted_cash_paise INTEGER CHECK (counted_cash_paise >= 0),
  CHECK (closed_at IS NULL OR closed_at >= opened_at)
);

CREATE TABLE payments (
  id TEXT PRIMARY KEY,
  invoice_id TEXT NOT NULL REFERENCES invoices(id),
  shift_id TEXT REFERENCES shifts(id),
  method TEXT NOT NULL CHECK (method IN ('cash','upi','card','other')),
  amount_paise INTEGER NOT NULL CHECK (amount_paise > 0),
  received_paise INTEGER CHECK (received_paise >= 0),
  change_paise INTEGER NOT NULL DEFAULT 0 CHECK (change_paise >= 0),
  external_reference TEXT,
  idempotency_key TEXT NOT NULL UNIQUE,
  recorded_by TEXT NOT NULL REFERENCES staff_users(id),
  recorded_at TEXT NOT NULL,
  CHECK (method = 'cash' OR (received_paise IS NULL AND change_paise = 0)),
  CHECK (method <> 'cash' OR (received_paise IS NOT NULL AND received_paise = amount_paise + change_paise))
);

CREATE TABLE payment_refunds (
  id TEXT PRIMARY KEY,
  payment_id TEXT NOT NULL REFERENCES payments(id),
  amount_paise INTEGER NOT NULL CHECK (amount_paise > 0),
  reason TEXT NOT NULL,
  authorized_by TEXT NOT NULL REFERENCES staff_users(id),
  created_at TEXT NOT NULL
);

CREATE TABLE app_settings (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE print_jobs (
  id TEXT PRIMARY KEY,
  document_type TEXT NOT NULL CHECK (document_type IN ('receipt','kot')),
  document_id TEXT NOT NULL,
  printer_name TEXT,
  status TEXT NOT NULL CHECK (status IN ('queued','printed','failed')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  last_error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE audit_events (
  id TEXT PRIMARY KEY,
  actor_id TEXT REFERENCES staff_users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  detail_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX ix_reservations_table_time ON reservations(table_id, starts_at, ends_at);
CREATE INDEX ix_orders_session ON orders(session_id);
CREATE INDEX ix_order_items_order ON order_items(order_id);
CREATE INDEX ix_kitchen_tickets_order ON kitchen_tickets(order_id);
CREATE INDEX ix_invoices_order ON invoices(order_id);
CREATE INDEX ix_payments_invoice ON payments(invoice_id);
CREATE INDEX ix_payments_shift ON payments(shift_id);
CREATE INDEX ix_audit_entity ON audit_events(entity_type, entity_id, created_at);
```

## 5. Critical transaction workflows

### Place or edit an order
1. Begin transaction; verify user permissions and session/order status.
2. Snapshot current item name, variant, and price into each new order item.
3. Save order changes; insert audit event; commit.
4. If sending to kitchen, create a ticket containing only newly sent quantities (avoid duplicate KOT items).

### Issue invoice
1. Begin transaction and lock the writer with `BEGIN IMMEDIATE`.
2. Verify invoiceable quantities and prevent double-allocation of items to multiple invoices.
3. Compute totals in integer paise, using an explicitly documented tax/rounding policy.
4. Allocate an invoice number from a transactionally maintained sequence; insert immutable invoice and line snapshots.
5. Commit before attempting printing.

### Record payment
1. Begin transaction; verify the invoice is payable and user is authorized.
2. Check `idempotency_key`; if already processed, return the original result.
3. Compute outstanding balance from recorded payments minus refunds; reject overpayment unless an explicitly defined advance/credit workflow applies.
4. Insert payment, audit event, and update invoice status atomically.
5. Commit; enqueue receipt printing independently. Cash tender/change are distinct from credited payment amount.

### Close table
Only close a dining session when its orders have been resolved according to restaurant policy and all payable invoices are settled or validly voided. A table becomes available when no active session, maintenance block, or imminent reservation policy prevents seating.

## 6. Rules not enforceable by simple CHECK constraints

Implement and test in Rust transaction services:

- No overlapping active reservations on the same table (`booked`/`seated`) using half-open intervals: `existing.starts_at < new.ends_at AND existing.ends_at > new.starts_at`.
- Guest count must not exceed table capacity unless an authorized override is recorded.
- Do not allow payment refunds to exceed the refundable net amount of the source payment.
- Do not allow aggregate payments to exceed invoice balance.
- Do not allocate more order-item quantity across invoice lines than was ordered and not cancelled.
- Do not generate duplicate kitchen tickets for the same dispatched quantity.
- Do not modify posted invoice totals or line snapshots; correction must use a controlled void/reissue or adjustment workflow.
- Restrict who may void, discount, refund, override capacity, or close shifts.

## 7. Split bills, transfers, and multi-table reservations

The baseline schema supports multiple invoices per order and multiple payments per invoice, but split billing requires service-level quantity allocation checks. For production-grade split billing, consider adding a unique allocation ledger (`invoice_line_allocations`) and invoice lifecycle states for drafts.

A transfer of a dining session from one table to another must be audited and performed transactionally. If table-join and multi-table reservations are required, replace single `table_id` relationships with join tables (`session_tables`, `reservation_tables`) rather than stuffing IDs into JSON.

## 8. Taxes and statutory invoice fields

The restaurant's GST registration, tax mode, rates, invoice particulars, and rounding policy must be configured and validated against applicable requirements before launch. Snapshot relevant tax components and registration details on issued invoices so historical invoices remain accurate after settings change. The initial schema stores an aggregate `tax_paise`; extend it with `invoice_tax_lines` for CGST/SGST/IGST breakdowns as applicable. Do not assume GST is always charged.

## 9. Data retention, security, and backup

- Hash staff PINs with a suitable password hashing algorithm (e.g. Argon2id), with salts and rate limiting; never store plaintext PINs.
- Store only operationally necessary customer data; avoid collecting sensitive payment credentials.
- Use OS app-data permissions and consider encryption-at-rest if the threat model requires it.
- Perform backups using SQLite's online backup mechanism or a validated `VACUUM INTO` workflow; never copy a live WAL database file alone.
- Verify backups with `PRAGMA integrity_check`, version metadata, and a test restore; require confirmation and safety backup before restore.
- Preserve immutable financial and audit records; document retention and export policies.

## 10. Migration and test plan

1. Create a baseline migration, followed by additive versioned migrations.
2. Seed development-only restaurant tables, categories, menu items, and staff accounts; never ship default credentials.
3. Test FK violations, uniqueness, amount CHECK constraints, and invalid status values.
4. Test concurrent billing attempts, duplicate idempotency keys, printer failure after commit, and restart during transactions.
5. Test overlapping reservations, table transfers, split bills, partial payments, refunds, and shift reconciliation.
6. Test migration upgrades against a copy of an existing populated database and restore from a verified backup.

## 11. Open decisions to confirm before implementation

- Single cashier or multiple concurrent staff on one Windows computer?
- Are dine-in orders allowed to produce multiple separate invoices (split bills) in the first release?
- Is GST registration applicable, and how should service charges and rounding work?
- Can tables be joined, or can one reservation hold multiple tables?
- Should UPI/card be recorded manually only, or will payment terminal integration be added later?
- Is inventory/ingredient tracking out of scope for MVP?
- What receipt printer model and paper width (58 mm or 80 mm) will be supported?

## 12. AI agent implementation rules

- Treat this schema as a baseline proposal, not permission to bypass unresolved business decisions.
- Use parameterized SQL only; keep SQL access in Rust repositories/services, never in React components.
- Keep schema migrations in version control and execute them safely at startup.
- Maintain clear separation between menu catalog values and historical order/invoice snapshots.
- Never perform monetary arithmetic with JavaScript floating point.
- Use explicit transactions for order, invoice, payment, refund, table, and reservation state changes.
- Every important financial mutation must create an audit event.
- Keep printer I/O outside the payment transaction; printing is retryable.
