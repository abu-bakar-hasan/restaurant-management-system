# 10 — Business Rules

**Product:** Offline Restaurant Billing & Management (Windows Desktop)  
**Status:** Draft for approval  
**Stack context:** Tauri 2, React/TypeScript, shadcn/ui, Rust, SQLite  
**Purpose:** Define enforceable operational rules independently of screens and implementation details.

> **Decision convention:** **Required** rules are baseline product requirements. **Configurable** rules must have documented defaults and restricted settings access. **Pending decision** items must not be silently assumed for production.

## 1. System-wide invariants

- **BR-001 (Required):** SQLite is the authoritative store for orders, tables, reservations, invoices, payments, shifts, and audit records. React state is a projection only.
- **BR-002 (Required):** Every state-changing operation is validated in Rust and executed atomically where multiple records are affected.
- **BR-003 (Required):** Money is stored as integer paise (`INTEGER`), never binary floating-point. Quantity uses a documented integer or decimal representation; define rounding at each calculation boundary.
- **BR-004 (Required):** Server-style timestamps are not available offline. Store UTC timestamps plus relevant local business date; record clock changes and never rely on wall-clock time alone for uniqueness.
- **BR-005 (Required):** Financially consequential actions are attributable to a staff member and logged with before/after details where appropriate.
- **BR-006 (Required):** Finalized financial records are immutable. Corrections use documented void/refund/adjustment records rather than destructive edits.
- **BR-007 (Required):** All sensitive actions enforce role permissions in Rust, not merely by hiding buttons.

## 2. Orders and order lifecycle

- **BR-010 (Required):** An order has one service mode: `DINE_IN` or `WALK_IN`. Both share menu, tax, payment, and invoice calculation services.
- **BR-011 (Required):** A dine-in order belongs to an active table session; a walk-in order does not require a table.
- **BR-012 (Required):** Order states follow `DRAFT → OPEN → READY_FOR_BILL → CLOSED`; `CANCELLED` is allowed only before settlement, subject to permissions and KOT state. Status labels may differ in UI, but transitions must be explicit.
- **BR-013 (Required):** A draft can be discarded without generating an invoice or payment. Persist drafts when needed for crash recovery.
- **BR-014 (Required):** Item lines snapshot name, unit price, tax classification, variant, and selected modifiers at order time. Menu edits never retroactively change existing lines.
- **BR-015 (Required):** Editing quantities after a KOT has been sent must produce an auditable kitchen amendment/cancellation; never silently rewrite the original KOT.
- **BR-016 (Required):** A closed order cannot accept new items. Reopening requires an authorized, audited workflow; never alter a finalized invoice in place.
- **BR-017 (Configurable):** Optional item notes, complimentary items, and custom prices require role-based permission and a reason when used.

## 3. Tables and occupancy

- **BR-020 (Required):** Table statuses are **Available (green)**, **Occupied**, **Reserved**, and **Out of Service**. Text labels must accompany color.
- **BR-021 (Required):** A table cannot have two overlapping active dine-in sessions. Enforce this at the database/service layer.
- **BR-022 (Required):** Seating a party opens a table session and changes the visible table state to Occupied.
- **BR-023 (Required):** A table returns to Available only after its session is closed and no reservation or maintenance restriction currently applies.
- **BR-024 (Required):** Transferring an order moves its table-session association atomically; source/destination availability must be checked immediately before commit.
- **BR-025 (Pending decision):** Merging tables and splitting orders across tables are advanced features; define whether included in MVP and how kitchen history and bills are attributed.

## 4. Reservations

- **BR-030 (Required):** A reservation records contact/name (when provided), party size, table assignment if known, start time, expected duration, status, and creator.
- **BR-031 (Required):** Prevent conflicting confirmed reservations for the same table and overlapping time interval, including configurable buffer time.
- **BR-032 (Required):** Reservation states: `PENDING`, `CONFIRMED`, `SEATED`, `COMPLETED`, `CANCELLED`, `NO_SHOW`.
- **BR-033 (Required):** A reservation does not itself create a paid order; seating creates or links an active table session.
- **BR-034 (Configurable):** Grace period and no-show handling default to **15 minutes**, subject to manager configuration.
- **BR-035 (Required):** Manual override of a booking conflict requires manager authorization and an audit reason; no silent double-booking.

## 5. Menu and pricing

- **BR-040 (Required):** Each sellable menu variant has a current price, availability flag, and category. Price must be nonnegative.
- **BR-041 (Required):** Unavailable items cannot be added to new orders, but remain visible in historical transactions.
- **BR-042 (Required):** Price changes affect only subsequently created order lines.
- **BR-043 (Configurable):** Manager-authorized item discounts and bill discounts may be percentage or fixed amount, with configurable maximum limits.
- **BR-044 (Required):** Discounts cannot make a taxable base or payable total negative. Define the discount application order in settings and keep it stable per invoice.

## 6. Tax, charges, totals, and rounding

- **BR-050 (Required):** Tax settings support tax-inclusive and tax-exclusive pricing, with tax treatment snapshotted onto invoices.
- **BR-051 (Required):** Calculate each line using a documented sequence: gross line amount → eligible item discount → allocated bill discount → taxable value → applicable taxes → charges → invoice rounding. Persist the component amounts.
- **BR-052 (Required):** Rounding uses an explicitly configured rule; do not round intermediary calculations unpredictably. Any final rounding adjustment appears as its own invoice line/field.
- **BR-053 (Configurable):** Service charges are optional and must be separately shown; their applicability and tax treatment are configurable only after compliance review.
- **BR-054 (Required):** Tax rates and invoice requirements are configuration-dependent. **Do not hardcode GST percentages or assume every restaurant must charge GST.** Verify applicable Indian tax rules and invoice obligations with the business's accountant before production.
- **BR-055 (Required):** Invoices have unique, sequential identifiers under a defined financial-year or business series policy. Allocate identifiers transactionally and document treatment of voided numbers.
- **BR-056 (Pending decision):** Confirm whether rounding is applied per line or at invoice level, how bill discounts are allocated, and how inclusive taxes are extracted.

## 7. Payments and checkout

- **BR-060 (Required):** Record payment method (`CASH`, `UPI`, `CARD`, or configured other), amount, timestamp, staff member, and reference where relevant.
- **BR-061 (Required):** Multiple payment records may settle one invoice; the sum of accepted payments cannot exceed the amount due except cash tendered, which is recorded separately from applied payment and change.
- **BR-062 (Required):** For cash: `change = max(0, cash_tendered - outstanding_due)`. Reject insufficient tender unless an explicitly supported partial-payment workflow is used.
- **BR-063 (Required):** Offline UPI/card entries are **manual records of externally confirmed payments**. The application cannot independently verify settlement without a payment provider connection. Show this limitation in the UI.
- **BR-064 (Required):** Checkout is idempotent: repeated clicks or retries with the same operation key cannot create duplicate invoices or payments.
- **BR-065 (Required):** Invoice finalization, payment allocation, order closure, and table-session closure occur in one consistent transactional workflow, with explicit support for partial payments if enabled.
- **BR-066 (Required):** Print failure never rolls back a committed payment. Reprinting uses the original invoice number and is audit logged.
- **BR-067 (Pending decision):** Deposits, credit sales, tips, partial payments, and payment-on-account are excluded from MVP unless explicitly approved.

## 8. Cancellations, voids, refunds

- **BR-070 (Required):** Before KOT, authorized staff may remove an item; after KOT, a cancellation request is recorded and communicated to kitchen.
- **BR-071 (Required):** Cancelling an order with an accepted payment is prohibited; use a refund/void workflow with audit trail.
- **BR-072 (Required):** Refunds reference the original invoice/payment, require permission and reason, and never exceed net collected amounts less previous refunds.
- **BR-073 (Required):** Do not delete paid invoices or refund records. Report refunds separately from gross sales.
- **BR-074 (Pending decision):** Define cash versus UPI/card refund procedures and whether partial line-item refunds are supported in MVP.

## 9. Kitchen tickets (KOT)

- **BR-080 (Required):** Sending to kitchen creates a uniquely identifiable KOT with order/table context, item quantities, notes, and timestamp.
- **BR-081 (Required):** KOT states: `NEW`, `PREPARING`, `READY`, `SERVED`, with `CANCELLED`/amendment events where permitted.
- **BR-082 (Required):** Repeated Send actions cannot duplicate the same unsent items. Track sent quantities or revisions per line.
- **BR-083 (Required):** Kitchen printing failures retain queued KOT data and support retry without creating a duplicate KOT.
- **BR-084 (Configurable):** Whether kitchen completion is mandatory before billing is configurable; default **not mandatory** to support fast checkout.

## 10. Shifts, cash, and reports

- **BR-090 (Required):** A cash shift records opening float, operator, opening/closing timestamps, cash in/out, expected cash, counted cash, and variance.
- **BR-091 (Required):** Expected cash = opening float + recorded cash receipts − cash refunds + cash-ins − cash-outs, adjusted for documented exceptions.
- **BR-092 (Required):** Shift closure requires cash count and records variance; only authorized users may reopen or correct with an audit entry.
- **BR-093 (Required):** Reports distinguish order totals, finalized sales, received payments, refunds, taxes, discounts, and cash movements; these figures must not be treated as interchangeable.
- **BR-094 (Required):** Define business-day cutoff in restaurant settings; default local calendar midnight until confirmed. Reports use business date consistently.
- **BR-095 (Required):** Reports must be reproducible from committed database records; never use only in-memory counters.

## 11. Offline reliability, backups, and audit

- **BR-100 (Required):** All core workflows function without internet, including staff login, POS, table operations, printing, and reporting.
- **BR-101 (Required):** Use SQLite transactions, foreign keys, migrations, and safe connection management. Prefer WAL where compatible with backup and deployment policy.
- **BR-102 (Required):** Backup uses SQLite's online backup mechanism or another consistency-safe approach; never simply copy a live database file while writes may be active.
- **BR-103 (Required):** Restore requires explicit confirmation, backup validation, and a safety copy of current data. Restart/reopen connections before resuming operations.
- **BR-104 (Required):** Failed database writes display an actionable error and never show false success. Retried financial operations reuse the same idempotency key.
- **BR-105 (Required):** Audit logs cover login attempts, permissions, price overrides, discounts, cancellations, refunds, reprints, backups, restores, and shift corrections.
- **BR-106 (Required):** Offline software does not automatically synchronize between multiple computers. Multi-device use requires a separate future architecture and must not be implied.

## 12. Roles and permissions baseline

| Action | Cashier | Manager | Admin | Kitchen |
|---|---|---|---|---|
| Create/edit open orders | Yes | Yes | Yes | No |
| Send KOT | Yes | Yes | Yes | View/update |
| Take payments and print receipts | Yes | Yes | Yes | No |
| Edit menu prices/taxes | No | Configurable | Yes | No |
| Override discounts/voids/refunds | No | Yes | Yes | No |
| Close cash shift | Own shift | Yes | Yes | No |
| Manage users/backups/restore | No | No | Yes | No |

All permissions are checked in Rust. Actual role definitions may be refined in Document 13.

## 13. Worked examples (illustrative, not tax advice)

### A. Walk-in cash order

- Items: 2 × ₹120 = ₹240; 1 × ₹80 = ₹80; subtotal ₹320.
- Illustrative bill discount: ₹20 → ₹300 before any applicable tax or charges.
- If configured taxes and charges total ₹0, amount due ₹300.
- Customer tenders ₹500; applied cash payment ₹300; change ₹200.
- Persist invoice, payment, cash tender/change, and closed order once; allow receipt reprint without duplicate sale.

### B. Dine-in table order

- Seat Table 04 → Occupied; add items → OPEN; send KOT; append a later item → new KOT revision.
- On checkout, calculate and display full itemized bill; record payment; finalize invoice and close session atomically.
- Table becomes Available unless a current reservation/maintenance rule prevents it.

### C. Printer failure after payment

- Invoice/payment commit succeeds; printer returns error.
- UI shows **Payment saved — receipt not printed** and offers Retry Print.
- Retry prints the same invoice and logs a reprint; it must not create a new payment.

## 14. Acceptance criteria

1. Two simultaneous attempts to occupy the same table cannot both succeed.
2. Double-clicking Pay produces exactly one payment and one invoice for the same checkout operation.
3. A price change does not alter an existing order line or finalized invoice.
4. A second KOT contains only newly added/changed items, not duplicates.
5. An offline crash/restart preserves committed orders and payments.
6. A failed printer job can be retried without a duplicate sale.
7. Cash change, discounts, refunds, and shift expected cash reconcile to stored records.
8. Unauthorized staff cannot bypass refund/price controls through direct Tauri commands.
9. Overlapping reservations for one table are rejected unless an audited manager override is explicitly supported.
10. Backup/restore tests preserve referential integrity and invoice history.

## 15. Decisions to confirm before production

| Decision | Suggested MVP default | Owner |
|---|---|---|
| GST registration, rates, invoice fields | Configurable; accountant-reviewed | Restaurant owner/accountant |
| Service charge | Disabled | Owner |
| Discount approval threshold | Manager approval for overrides | Owner |
| Partial payments and credit | Disabled | Owner |
| Split/merge bills and tables | Defer advanced workflows | Owner |
| Refund method and limits | Manager-only, original payment reference | Owner |
| Reservation buffer and no-show | 15-minute grace; configurable buffer | Manager |
| Business-day cutoff | Midnight local time | Owner |
| KOT required before checkout | No | Manager |
| Thermal printer width | Configurable 58/80 mm | Deployment technician |

## 16. Implementation guidance for AI coding agent

- Reference rule IDs (`BR-###`) in relevant service tests and pull requests.
- Enforce invariants in Rust service methods and SQLite constraints/transactions, not only frontend validation.
- Use pure, independently tested calculation functions for totals, discounts, tax allocation, change, and refunds.
- Model state transitions explicitly and reject invalid transitions with typed errors.
- Treat all pending decisions as configuration or blocked requirements, not guessed business policy.
- Keep dine-in and walk-in UX separate but share the order/billing domain.

## 17. Related documents

- `01-business-requirements.md`
- `02-product-requirements.md`
- `03-functional-specifications.md`
- `04-user-flows.md`
- `07-application-architecture.md`
- `09-database-schema.md`
- Next: `11-offline-data-management.md`
