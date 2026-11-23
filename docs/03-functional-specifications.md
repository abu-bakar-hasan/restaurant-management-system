# Restaurant Billing & Management — Functional Specifications

**Document ID:** 03  
**Version:** 1.0 — Draft for review  
**Product:** Single-location, fully offline Windows desktop POS  
**Stack:** Tauri 2, React, TypeScript, Vite, Tailwind CSS, shadcn/ui, Rust, SQLite  
**Companion documents:** `01-business-requirements.md`, `02-product-requirements.md`  
**Status:** Implementation-oriented behavioral contract; items marked **Decision required** are not finalized.

## 1. Purpose and conventions

This specification describes *how* the application behaves: user actions, state changes, validations, calculations, permissions, persistence, failures, and acceptance checks. The UI uses shadcn/ui components, but the Rust/Tauri backend is authoritative for financial calculations, state transitions, permissions, and SQLite writes. UI state is not the source of truth.

- **MUST**: mandatory for initial release; **SHOULD**: recommended; **LATER**: future release.
- Each transaction has a stable UUID. Human-readable invoice numbers are separate, assigned atomically when an invoice is finalized.
- Money is stored as integer minor units (paise), never floating-point. Quantities may be decimal where configured; use exact decimal math.
- Dates are persisted as unambiguous timestamps; business-day boundaries are calculated using the restaurant's configured local timezone.
- All changes to persisted financial data occur within SQLite transactions.
- Every screen supports loading, empty, error, and success states. Failed writes do not silently appear successful.

## 2. Users, login, sessions and permissions

**FS-AUTH-01 — First launch.** If no restaurant profile exists, show setup wizard: restaurant name, address, phone (optional), currency INR, local timezone, invoice prefix, initial admin credentials/PIN, default tax mode, and printer preferences. Validate required fields and prevent completion until an admin account exists.

**FS-AUTH-02 — Local sign-in.** Staff choose an account and authenticate using a PIN/password. Store only strong salted password hashes; never plaintext PINs. Apply local rate limiting and temporary lockout for repeated failures. A locked user requires an authorized recovery process; no universal backdoor.

**FS-AUTH-03 — Session.** Show active staff name and role. Lock or sign out manually; optional idle auto-lock configurable by admin. On restart, require reauthentication for sensitive functions. Reopening the application must not discard saved orders.

**FS-AUTH-04 — Authorization.** Admin: full access; manager: daily operations and permitted corrections; cashier: orders and payment collection; kitchen: KOT visibility and status changes only. Refunds, voids, historical adjustments, restore, and staff administration require explicit elevated permission. Validate permissions in backend commands, not only by hiding buttons.

**FS-AUTH-05 — Audit.** Log who performed sensitive actions, when, target record, previous/new values where applicable, and reason for refunds, voids, price overrides, or reprints. Audit events are append-only for ordinary users.

## 3. Navigation and dashboard

**FS-NAV-01.** Sidebar sections: Dashboard, POS / Quick Order, Tables, Reservations, Kitchen, Menu, Bills / Transactions, Reports, Staff / Shifts, Settings. Hide or disable unauthorized destinations with a clear reason. Maintain screen context when switching modules without losing persisted work.

**FS-DASH-01.** Dashboard shows current business-day paid sales, order counts by state, open/unpaid tables, pending KOTs, payment breakdown, and recent transactions. Calculations come from stored orders/payments; do not count unpaid draft orders as realized revenue.

**FS-DASH-02.** Dashboard refreshes after local mutations and on re-entry; reports display their time range and last calculated timestamp. An empty database shows zero metrics and helpful empty states.

## 4. Table setup and status

**FS-TBL-01 — CRUD.** Authorized users can add/edit tables with unique display code, optional area/section, seat capacity (>0), display order, and active/inactive flag. Cannot delete a table with active orders or unresolved reservations; archive instead.

**FS-TBL-02 — Status.** Display: **Available (green)**, **Occupied**, **Reserved**, **Unavailable**. Table status is derived from active orders, applicable reservations, and manual unavailability; do not persist an independent mutable status that can contradict those records. Occupied takes precedence over Reserved for physical occupancy; show upcoming reservation warning separately.

**FS-TBL-03 — Open table.** Selecting an available table opens a new dine-in order or the table detail panel. Selecting an occupied table opens its active order. Attempting to open a second active order on the same table requires a deliberate, supported multi-check policy (**Decision required**); MVP defaults to one active check per table.

**FS-TBL-04 — Move table.** Authorized staff can move an unpaid order to a free compatible table. Validate destination and perform update atomically; preserve order identity and KOT history. Do not move settled orders.

**FS-TBL-05 — Merge/split.** **Decision required:** merging table checks and splitting one check into multiple invoices. Until specified, do not implement destructive or ambiguous merging; provide a clear unsupported-action message.

**Acceptance:** A table becomes occupied immediately after its first active dine-in order is saved; after full settlement/closure it returns to available unless reserved or unavailable.

## 5. Reservations

**FS-RES-01 — Create.** Record guest name, optional phone, party size (>0), start time, estimated duration/end, assigned table, notes, creator, and status. Prevent reservations in the past unless manager override with reason. Phone is optional; no internet/SMS dependency.

**FS-RES-02 — Conflict detection.** Before saving, check overlapping active reservations for the same table and existing occupancy. A reservation is conflicting if `startA < endB AND startB < endA`. Show conflicts before confirmation. Check and insert in one SQLite write transaction to prevent race conditions.

**FS-RES-03 — Lifecycle.** `Booked → Seated → Completed`; `Booked → Cancelled / No-show`. Seating attaches or creates a dine-in order, and links it to the reservation. Cancellation/no-show requires reason if configured.

**FS-RES-04 — Display.** Tables page shows current reservations and upcoming bookings; reservation list filters by date, status, guest, and table. Do not permanently block a table for a future booking outside its configured hold window.

**Decision required:** default reservation duration, hold window, grace period, and whether deposits are supported. Deposits are out of MVP unless separately specified.

## 6. Menu and pricing

**FS-MENU-01.** Admin/manager manage categories, item name, description, optional image, SKU/code, price, tax category, availability, display order, and optional variants/add-ons. Item names required; price >= 0; duplicate SKU disallowed when SKU provided.

**FS-MENU-02.** Unavailable/archived items cannot be newly ordered, but remain visible in historical orders. Editing an item does not retroactively change historical line-item names, prices, taxes, or totals.

**FS-MENU-03.** POS search filters by name/code/category, keyboard-friendly; add item with one action. For variants or add-ons, require selection and show incremental price before adding.

**FS-MENU-04.** Authorized price override requires permission, reason, and audit event. Snapshot the item name, selected options, unit price, tax rules, and any override onto each order line.

## 7. Orders: dine-in and walk-in

**FS-ORD-01 — Order types.** Support `DINE_IN` linked to a table and `WALK_IN` without a table. Both share the same line-item, calculation, payment, and receipt services. Optional takeaway label is a UI subtype of walk-in until additional fulfillment rules are defined.

**FS-ORD-02 — Create.** Create an order on the first committed item or explicit Save. Draft orders may be empty only until saved; a saved order requires at least one valid line. Assign UUID, creator, timestamps, order type, and `OPEN` state.

**FS-ORD-03 — Edit.** Add items, change quantities, remove unsubmitted lines, add notes, and apply permitted discounts. Quantity must be >0; prohibit negative prices and invalid option combinations. Show unsaved changes and protect against accidental navigation.

**FS-ORD-04 — Kitchen-submitted lines.** Once a line has been submitted on a KOT, changes must create a traceable adjustment/cancellation ticket; never silently rewrite an issued KOT. Require authorization/reason for removing prepared items. Keep all previous tickets.

**FS-ORD-05 — State model.** Order: `OPEN → READY_FOR_PAYMENT → PAID → CLOSED`; `OPEN → VOIDED` with authorization. Kitchen status is separate from financial state. Allow payment from `OPEN` if restaurant workflow permits; checkout must verify current totals and any required kitchen constraints.

**FS-ORD-06 — Reopen.** Paid/closed orders cannot be edited directly. Corrections use a documented refund/void/adjustment flow with audit trail and linked documents.

**FS-ORD-07 — Idempotency.** Double-clicking Save, Send to Kitchen, or Charge must not create duplicate orders, KOTs, or payments. Each command includes a unique idempotency key, enforced in backend/database.

**Acceptance:** Walk-in order never occupies a table. Two orders cannot accidentally claim the same table under the MVP single-active-check rule.

## 8. Kitchen order tickets (KOT)

**FS-KOT-01.** Clicking **Send to Kitchen** snapshots newly added or changed kitchen-relevant lines, quantities, notes, table/walk-in reference, order number, timestamp, and staff into a new sequential KOT. Do not resend already submitted unchanged lines.

**FS-KOT-02.** KOT lifecycle: `NEW → PREPARING → READY → SERVED`, plus `CANCELLED` with permission and reason. Kitchen staff may advance status but not alter financial totals.

**FS-KOT-03.** If printer unavailable, persist ticket as pending print and visibly indicate failure; do not lose the KOT. Reprint is marked **REPRINT** with original ticket identity. Printing success is not required to commit the order/KOT record.

**FS-KOT-04.** New items on an existing table produce an additional KOT; cancelled items generate a cancellation KOT, not deletion of the original.

## 9. Billing, tax, discounts and rounding

**FS-BILL-01 — Price snapshot.** Backend calculates each line from saved unit price, quantity, modifiers, item-level discounts, and tax settings captured for that order. Frontend totals are previews only.

**FS-BILL-02 — Calculation sequence (default proposal).** `gross line amount = unit price × quantity + priced modifiers`; subtract authorized line discount; sum discounted lines; apply order-level discount (allocated proportionally across eligible lines for tax calculations); compute applicable tax/charges per configured tax mode; apply explicitly configured final rounding; compute payable total. All arithmetic uses exact decimals, then rounds to paise at defined stages. The implementation must document the rounding method and show a reproducible breakdown.

**FS-BILL-03 — Tax.** Support tax-disabled and configurable tax-inclusive/tax-exclusive pricing. GST rate and split (CGST/SGST vs IGST) depend on applicable business facts and invoice type; do not hard-code one tax rate for all items. Admin configures tax registration details and invoice format. **Decision required:** tax regime, item tax classification, service charges, and jurisdiction-specific compliance. Obtain accountant review before production GST use.

**FS-BILL-04 — Discounts.** Support fixed-amount and percentage discounts with bounds: percentage 0–100; fixed discount not exceeding eligible base. Capture reason and authorizing user when required. Discounts cannot make an order negative.

**FS-BILL-05 — Finalize.** Show itemized preview and ask confirmation. Allocate invoice number in a transaction at finalization; ensure uniqueness. Persist immutable invoice snapshot with totals and references to payments. If write fails, do not print or show a completed invoice.

**FS-BILL-06 — Historical integrity.** Changing restaurant name, tax rate, menu price, or printer settings later must not alter existing invoice data.

**Worked example (tax disabled):** 2 × ₹120 + 1 × ₹80 = ₹320; order discount ₹20; total ₹300. Payment ₹300 → balance ₹0. If taxes enabled, calculate from saved configured rules instead.

## 10. Payments, cash handling and refunds

**FS-PAY-01.** Accept recorded tender types: Cash, UPI, Card, and Split. For UPI/card, the offline app records the operator's declaration/reference only; it cannot verify bank settlement. Clearly label this limitation.

**FS-PAY-02.** On checkout, show amount due and existing payments. Reject zero/negative tender entries and overpayment for noncash methods. Cash tender may exceed due; compute change = cash received − remaining due, never negative.

**FS-PAY-03.** Split tender accepts multiple payment entries whose net applied amounts exactly cover invoice due before marking `PAID`. Partial payments may be stored as `PARTIALLY_PAID` only if explicitly enabled (**Decision required**); otherwise do not finalize until fully settled.

**FS-PAY-04.** Payment commit is atomic and idempotent. A printer error after commit must never cause a second charge or invoice. Retry printing separately.

**FS-PAY-05.** Cash shifts: cashier opens shift with opening float, records cash in/out with reason, and closes shift with counted cash. Expected cash = opening float + cash receipts − cash refunds + cash-in − cash-out. Display variance and require manager acknowledgement when nonzero.

**FS-PAY-06.** Refunds and voids require authorization, reason, linked original invoice/payment, refund amount <= remaining refundable amount, and audit log. Do not delete original invoice or payment. For cash refund, update shift ledger. Noncash refund records an offline refund declaration, not a real processor reversal.

**FS-PAY-07.** Protect against duplicate invoice settlement by enforcing invoice balance and payment uniqueness in one transaction.

## 11. Receipts and printing

**FS-PRINT-01.** Support configurable receipt printer and paper width (e.g. 58 mm/80 mm), with printable preview. Receipt includes restaurant details, invoice number/date, cashier, items, discounts, tax breakdown when enabled, total, tender(s), cash change, and optional footer.

**FS-PRINT-02.** Save invoice before attempting print. On printing failure, show actionable retry option; keep the invoice settled. Reprints visibly identify duplicate copies and log operator/time.

**FS-PRINT-03.** KOT format is separate from customer receipt; kitchen ticket should not show financial amounts unless explicitly configured. Test printer-specific behavior on actual Windows hardware; no guarantee of universal ESC/POS support.

**FS-PRINT-04.** Support saving/exporting a PDF or print preview only if implemented as a local offline feature. Do not silently rely on browser cloud print services.

## 12. Transactions and reports

**FS-REP-01.** Transactions list filters by business date, invoice number, order type, cashier, payment type, and status. Selecting a record opens a read-only detail with print/reprint and authorized refund actions.

**FS-REP-02.** Reports: gross sales, discounts, taxes, net paid sales, refunds, cash vs UPI vs card, order count, average bill, top-selling items, table vs walk-in split, and shift variance. Show clear definitions for every metric.

**FS-REP-03.** Report date ranges use the configured business day, which may cross midnight (**Decision required:** day cutoff). Never count cancelled/voided orders as completed sales; represent refunds separately and derive net values consistently.

**FS-REP-04.** Export reports to CSV locally; Excel/PDF exports optional. Escape CSV cells to avoid spreadsheet formula injection when exporting user-entered names/notes.

## 13. Settings, backup, restore and data integrity

**FS-SET-01.** Admin can edit restaurant identity, currency display, timezone, receipt header/footer, tax settings, table configuration, staff roles, printer selection, and backup location. Warn if a setting affects future documents only.

**FS-DATA-01.** Store SQLite database in the OS-approved per-user/app data directory, not beside the executable. Enable foreign keys, appropriate journal mode, and transaction durability settings. Schema migrations must be versioned and tested.

**FS-DATA-02.** Manual backup uses SQLite's supported consistent backup method, not an unsafe live file copy. Validate destination write success, include backup metadata/schema version, and report completion only after verification.

**FS-DATA-03.** Restore requires admin authentication, warning, explicit confirmation, and a safety backup of the current database. Validate integrity, schema compatibility, and target before replacement; on failure, retain the current working database.

**FS-DATA-04.** On unexpected shutdown, SQLite transaction recovery must leave committed records intact and incomplete operations uncommitted. On startup, detect pending prints, open shifts, and incomplete orders for staff review.

**FS-DATA-05.** Data retention and deletion rules require owner confirmation. Financial records should not be hard-deleted from ordinary UI flows.

## 14. Error handling and UI behavior

| Scenario | Required behavior |
|---|---|
| Item unavailable while POS open | Reject add at save, refresh item availability, preserve rest of order |
| Table already occupied | Block conflicting order, show current table order |
| Reservation time conflict | Explain conflicting interval and offer alternate table/time |
| Payment Save clicked twice | One payment only; return prior successful result for duplicate request |
| Database write fails | No fake success; show retry guidance and preserve unsaved input where safe |
| Receipt printer disconnected | Invoice remains saved; show Print Pending and Retry |
| Kitchen printer disconnected | KOT remains saved; mark pending print |
| App closes during checkout | Reopen and show persisted invoice/payment status; never assume failure implies no charge |
| Invalid PIN | Generic failure, rate-limit; do not expose stored credentials |
| Backup destination unavailable | Fail visibly; original database unaffected |
| Restore invalid backup | Reject without replacing live database |

**FS-UI-01.** Use shadcn/ui for dialogs, sheets, tables, menus, inputs, and toast notifications; accessible focus behavior and keyboard shortcuts. Avoid excessive animations in fast billing workflows. Keep high-contrast status labels in addition to colors.

**FS-UI-02.** POS should keep category navigation, searchable menu, active cart, and payment action visible at typical Windows desktop resolutions. Show confirmation for irreversible operations; do not require confirmations for routine item additions.

**FS-UI-03.** For operations lasting more than a brief moment, display a progress state and disable duplicate submission while the backend command is pending.

## 15. Backend command boundaries and persistence

Suggested command families (names illustrative; exact signatures belong in architecture/API documentation):

- `auth.*`, `staff.*`, `settings.*`
- `tables.*`, `reservations.*`
- `menu.*`, `orders.*`, `kot.*`
- `billing.preview`, `billing.finalize`, `payments.record`, `refunds.create`
- `shifts.*`, `reports.*`, `printing.*`, `backup.*`

Every mutation command MUST: validate caller authorization; validate inputs and current persisted state; execute atomic writes where needed; return structured success/error with stable error codes; record audit events for sensitive actions. Never trust UI-supplied totals or permissions.

Recommended key entities: `restaurant_settings`, `staff`, `roles`, `tables`, `reservations`, `menu_categories`, `menu_items`, `menu_variants`, `orders`, `order_lines`, `order_line_adjustments`, `kots`, `kot_lines`, `invoices`, `invoice_lines`, `payments`, `refunds`, `cash_shifts`, `cash_movements`, `print_jobs`, `audit_events`, `idempotency_keys`, `schema_migrations`.

## 16. End-to-end acceptance scenarios

1. **Walk-in cash:** Add 2 menu items → save → preview total → tender cash → receive change → invoice saved → print receipt → no table occupied.
2. **Dine-in:** Open Table 3 → add items → send KOT → kitchen marks ready → add dessert → second KOT → settle bill → Table 3 available again.
3. **Reservation:** Book Table 5 for a future interval → conflicting reservation rejected → guest seated → linked order created → settle → reservation completed.
4. **Split payment:** ₹500 due → record ₹200 cash and ₹300 UPI declaration → mark paid exactly once → report shows both tender types.
5. **Printer failure:** Finalize invoice → printer disconnected → invoice still saved and paid → retry print → duplicate/reprint tracked.
6. **Crash recovery:** Save active table order → force-close app → restart → order and line items remain intact; no duplicate invoice.
7. **Refund:** Manager approves partial refund → original invoice remains unchanged → linked refund stored → report net sales and cash shift updated.
8. **Access control:** Kitchen staff cannot view cash reports or call backend refund command, even if UI is bypassed.
9. **Backup/restore:** Make verified backup → add test data → restore backup with admin approval → original backed-up state returns, with pre-restore safety copy retained.
10. **Menu change:** Finalize order → change menu price → old invoice retains original unit price and tax calculation.

## 17. Decisions required before implementation

| ID | Decision | Safe MVP assumption until confirmed |
|---|---|---|
| D-01 | GST registration and item-specific tax rules | Tax disabled by default; configurable and reviewed before production |
| D-02 | Business-day closing time | Calendar midnight in configured timezone |
| D-03 | One or multiple active checks per table | One active check per table |
| D-04 | Split bills / merge tables | Deferred; transfer a whole unpaid order only |
| D-05 | Reservation hold window / grace period | Configurable; avoid blocking table too early |
| D-06 | Partial payment / pay-later | No unpaid invoice finalization by default |
| D-07 | Service charge, packaging fee, rounding | Disabled unless explicitly configured |
| D-08 | Cashier shift mandatory? | Required for cash collection |
| D-09 | Receipt/KOT printer models | Verify with actual Windows printer hardware |
| D-10 | Staff password/PIN recovery | Admin-mediated local reset; no master password |
| D-11 | Refund/void policy and limits | Manager/admin approval and reason required |
| D-12 | Restaurant language and receipt localization | English UI, INR currency; Hindi optional later |

## 18. Definition of done for each feature

A feature is complete only when: UI and backend behavior match this spec; authorization is enforced in Rust; SQLite persistence survives restart; failure/empty states are implemented; calculations are deterministic; idempotency and audit rules are satisfied where relevant; automated tests cover core behavior; and a manual Windows offline test passes.

## 19. Relationship to forthcoming documents

- **04 User Flows:** detailed screen-to-screen paths and edge-case journeys.
- **05 UI/UX Guidelines / 06 Design System:** layout, accessibility, component usage, interaction patterns.
- **07 Architecture / 08 Folder Structure:** module boundaries and Tauri commands.
- **09 Database Schema:** normalized tables, keys, indexes, migrations and constraints.
- **10 Business Rules:** exact financial formulas, status transitions and policy matrices.
- **11–14:** backup, printing, security, and testing specifics.

**End of Document 03.**
