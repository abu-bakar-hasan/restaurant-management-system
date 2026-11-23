# 04 — User Flows

**Product:** Offline Restaurant Billing & Management Desktop Application  
**Platform:** Windows desktop, Tauri 2 + React + TypeScript + shadcn/ui + SQLite  
**Status:** Product workflow specification (v1.0)  
**Related:** `01-business-requirements.md`, `02-product-requirements.md`, `03-functional-specifications.md`

## 1. Purpose and conventions
This document defines end-to-end staff journeys and state transitions for a **single-location, offline-first restaurant**. It is written for designers, developers, testers, and AI coding agents. It is not a substitute for the detailed business rules, database schema, or tax configuration.

**Actors:** Admin, Manager, Cashier, Waiter/Order Taker, Kitchen Staff. Roles are configurable; a small restaurant may have one person handling several roles.

**Entry points:** Sidebar navigation (Dashboard, POS, Tables, Reservations, Kitchen, Menu, Reports, Settings), keyboard shortcuts, and contextual actions. Every mutation must persist to local SQLite through Tauri commands before the UI reports success.

**Order types:** `DINE_IN` (linked to a table) and `WALK_IN` (no table). Both use the same order, pricing, payment, and receipt engine.

**General UX rules:** Clearly display the active table/order, show totals before payment, require confirmation for destructive actions, disable duplicate submission while saving, and provide actionable error messages. A failed printer job must never roll back a successfully committed payment.

## 2. First-run restaurant setup
**Actor:** Admin. **Entry:** First launch when no restaurant profile exists.

1. Open the installed Windows application; it detects an uninitialized local database.
2. Create the initial administrator credentials/PIN and restaurant profile (name, address, contact, currency INR).
3. Set business day cutoff, receipt header/footer, tax mode/rates, optional service charges, and invoice numbering policy.
4. Add dining areas and tables (e.g., Table 1–8), categories and menu items; optionally import initial menu data.
5. Configure receipt/KOT printers, or choose to configure later.
6. Confirm the setup summary and enter the Dashboard.

**Alternate paths:** Missing required information blocks completion; printer unavailability does not block setup; unexpected shutdown resumes setup safely. Initial configuration changes must be auditable.

## 3. Login, switch user, and lock
**Actors:** All staff. **Entry:** Locked application.

1. Select staff account and enter PIN/password.
2. Verify credentials locally; load role-appropriate navigation and permissions.
3. Open the default permitted screen.
4. Lock the app manually or after configurable inactivity; unsaved edits prompt the user.
5. To switch users, authenticate the next account without restarting the app.

**Failures:** Incorrect credentials show a generic error; repeated failures apply a local rate limit. Permission denial must be enforced by backend commands, not only hidden buttons.

## 4. Dashboard to operational action
**Actors:** Admin, Manager, Cashier.

1. Open Dashboard to view today’s gross/net sales, open orders, unpaid bills, occupied tables, and cash totals (as permitted).
2. Select a metric or recent order to navigate to its source screen with relevant filters.
3. Refresh metrics automatically after a successful local transaction or on screen focus.

**Empty state:** Show zero values and useful actions, not fabricated chart data. Financial figures must be calculated from persisted records.

## 5. Start a dine-in table order
**Actors:** Waiter, Cashier. **Entry:** Tables screen.

1. Display tables by area with clear states: **Available (green)**, Occupied, Reserved, Out of Service.
2. Select an available table; optionally enter guest count and customer note.
3. Create an open `DINE_IN` order and atomically assign the table.
4. Open POS with the table name prominent in the header.
5. Add menu items, quantities, variants, and kitchen notes.
6. Save the order and optionally submit selected items as a KOT.
7. Return to Tables; the table is now Occupied and retains its open order.

**Guardrails:** A table cannot acquire a second active seating accidentally; show a clear choice to resume an existing order. Out-of-service tables cannot be seated. A reservation that overlaps the intended seating triggers a warning/manager policy rather than silent overwrite.

## 6. Add items to an existing table order
1. Select an occupied table and choose **Resume Order**.
2. View existing items grouped by KOT status, plus a running total.
3. Add new items or edit quantities and notes on items not yet sent to kitchen.
4. Save; newly added items remain pending until submitted as a new KOT.
5. Submit only new/changed kitchen-relevant items to avoid duplicate preparation.

**Exception:** Removing or changing a sent item follows the cancellation/void flow and may require manager approval.

## 7. Quick walk-in order and cash billing
**Actors:** Cashier. **Entry:** POS → **New Walk-in Order** (prominent quick action).

1. Start an order of type `WALK_IN`, without selecting a table.
2. Search/browse categories and add items; adjust quantities and notes.
3. Choose whether kitchen preparation is required and submit a KOT if applicable.
4. Review subtotal, permitted discount, applicable taxes/charges, and final total.
5. Select **Checkout** → **Cash**; enter cash received.
6. Validate cash received is at least the remaining amount; calculate change due.
7. Confirm payment exactly once; persist payment, invoice, and order completion in a database transaction.
8. Show success and receipt preview; print or reprint as needed.
9. Start the next walk-in order with a clean cart.

**Alternate paths:** Hold an unpaid order and resume it later; accept UPI/card as recorded offline payment methods; never claim an external UPI/card transaction was verified merely because it was entered in the app.

## 8. Table checkout and release
1. Open an occupied table’s active order.
2. Confirm all required items and adjustments; optionally view pending kitchen items.
3. Review final bill; apply authorized discount/charges and generate invoice.
4. Record one or more payments until the payable balance is zero.
5. Mark the order settled and close the seating.
6. Release the table to **Available**, unless an active reservation or out-of-service state dictates otherwise.
7. Print the customer receipt; a printer failure leaves the settled order intact.

**Guardrails:** Do not release a table with an unpaid balance without an explicit authorized exception. A table cannot be assigned to two open seatings concurrently.

## 9. Advance table reservation
**Actors:** Cashier, Manager. **Entry:** Reservations → New.

1. Select date, start time, estimated duration, party size, and customer name/contact (optional fields per policy).
2. Show suitable tables and existing reservations for the requested interval.
3. Select a table and confirm the reservation.
4. Store status `CONFIRMED`; display it in the calendar/list and on the table timeline.
5. At arrival, select **Check In** and open a dine-in seating/order.
6. On completion, close the order and mark the reservation `COMPLETED`.

**Alternates:** Reschedule only after rechecking conflicts; cancel with reason; mark no-show under configured policy; late arrivals may require manager override. **Important:** A future reservation must not automatically make a currently empty table unusable all day; table state and time-slot availability are distinct.

## 10. Kitchen Order Ticket (KOT) workflow
**Actors:** Cashier/Waiter → Kitchen Staff.

1. In an order, select **Send to Kitchen**.
2. Generate a uniquely numbered KOT snapshot containing only newly submitted items, table/walk-in identifier, notes, and timestamp.
3. Commit the KOT and its item statuses to SQLite before requesting printing.
4. Display it on Kitchen screen as `NEW`.
5. Kitchen marks ticket `PREPARING` → `READY` → `SERVED` (or configured equivalent).
6. Subsequent additions produce a new KOT linked to the same order.

**Exceptions:** If KOT printing fails, show **Retry Print** for the same ticket number; do not create a duplicate KOT. Cancellation of submitted items requires a cancellation record and, where appropriate, a cancellation KOT.

## 11. Table transfer, merge, and split
**Actors:** Manager or authorized Cashier.

**Transfer:** Open active seating → **Transfer Table** → select an available compatible table → preview → confirm atomic reassignment; release old table and occupy new one. Preserve KOT and payment history.

**Merge:** Select two eligible open table orders → preview items, discounts, taxes, payments, and kitchen states → require authorized confirmation → consolidate without deleting audit history. If either order has payments/invoices, follow a restricted policy and do not silently rewrite financial records.

**Split bill:** From an open order, select **Split Bill** → assign item quantities/amounts to bills → verify sum equals original payable amount (subject to rounding rules) → settle each bill separately → release table only after all balances are settled. Define exact invoice behavior in business rules before implementation.

## 12. Discounts, voids, refunds, and corrections
**Discount:** At checkout, enter an allowed fixed/percentage discount → preview recalculated total → require approval above role limit → save approval identity/reason.

**Void before payment:** Choose item/order → enter reason → confirm and record an immutable audit event. Sent kitchen items may require cancellation KOT.

**Refund after payment:** Find original invoice → choose eligible amount/items and refund method → require manager approval → create a linked refund/credit record; preserve original invoice and payment history. Print refund acknowledgment if configured.

**Correction:** Do not edit settled financial records in place. Use an explicit adjustment/refund/rebill flow per tax and accounting policy.

## 13. Cash shift opening and closing
**Actors:** Cashier, Manager.

1. Open a shift with starting cash float and staff identity.
2. Record cash payments and authorized cash in/out adjustments against the shift.
3. At closing, display expected cash = opening float + cash receipts − cash refunds + cash-in − cash-out.
4. Count actual cash and enter denomination totals or a single count.
5. Show over/short variance and require reason/approval when outside threshold.
6. Confirm close; freeze the shift summary and make it printable/exportable.
7. Start a new shift as needed without deleting historical data.

**Edge cases:** Open unpaid orders can carry over under explicit policy. Closing a shift must not retroactively change payment timestamps or invoice numbers.

## 14. Menu and pricing administration
1. Authorized user opens Menu → Categories / Items.
2. Create/edit item name, category, base price, variant/modifier, tax classification, kitchen routing, and availability.
3. Validate nonnegative price, required names, and unique identifiers.
4. Save; POS updates from local data.
5. Archive unavailable/discontinued items rather than deleting items referenced by historical orders.

**Rule:** Historical order lines store price/tax snapshots, so later menu price changes do not alter old bills.

## 15. Reports and exports
1. Authorized user opens Reports and chooses business-day range, cashier, order type, and payment method.
2. View sales totals, discounts, taxes, refunds, payment breakdown, item sales, and shift variances.
3. Drill down to underlying orders/invoices.
4. Export CSV or printable report to a user-selected local folder.

**Rule:** Reports distinguish gross sales, net sales, collected payments, and refunds; they are not interchangeable.

## 16. Receipt and KOT printing
1. From an eligible order/invoice, select **Print**.
2. Choose configured printer or use a default printer; preview where supported.
3. Submit the print job and show status/feedback.
4. On failure, keep the source document unchanged and offer retry or another printer.
5. Reprints use the same invoice/KOT identifier and may display **DUPLICATE** according to policy.

**Hardware note:** Windows thermal printers vary; printer model, paper width (58/80 mm), driver and cash-drawer behavior require device testing. Offline printing must not depend on a cloud service.

## 17. Backup, restore, and unexpected shutdown
**Backup:** Settings → Backup → choose local/USB destination → verify sufficient space → create a consistent SQLite backup → validate backup artifact → display success and timestamp. Do not copy a live SQLite database file without a safe backup mechanism.

**Restore:** Admin chooses backup → application validates version, integrity, and target → warns that current data will be replaced → creates safety backup → restores while database connections are closed → reopens and verifies data. Never silently overwrite current records.

**Crash recovery:** On restart, recover committed orders and payments from SQLite. Unsaved UI-only edits may be lost and should be identified clearly. Idempotency keys prevent repeated payment/invoice creation when the user retries after an uncertain result.

## 18. Cross-module state and navigation rules

| Event | Order state | Table state | Kitchen | Financial state |
|---|---|---|---|---|
| Seat dine-in guests | OPEN | OCCUPIED | None | Unpaid |
| Start walk-in order | OPEN | Not applicable | None | Unpaid |
| Send KOT | OPEN | Unchanged | NEW | Unpaid |
| Mark KOT ready | OPEN | Unchanged | READY | Unpaid |
| Record partial payment | OPEN / PARTIALLY_PAID | OCCUPIED for dine-in | Unchanged | Balance remains |
| Record final payment | SETTLED | AVAILABLE after close, subject to reservations | Historical | Paid |
| Cancel unpaid order | CANCELLED | AVAILABLE after close | Cancellation if needed | No payment due |
| Refund settled order | SETTLED with refund record | Unchanged | Historical | Refund recorded |

**Status design:** Persist table occupancy/seating and reservation time slots separately. Avoid treating a table’s visual color as the authoritative data model.

## 19. Acceptance scenarios for QA

- **UF-01:** Create Table 1 dine-in order, send KOT, add more items, send second KOT; no duplicated kitchen lines.
- **UF-02:** Complete a walk-in cash bill and verify change, receipt, and report totals.
- **UF-03:** Open Table 2 order, pay partially, restart app, verify remaining balance and occupied table.
- **UF-04:** Reserve Table 3 for tomorrow; it remains available today and cannot be double-booked for an overlapping slot.
- **UF-05:** Attempt to seat two parties at the same table; second operation is rejected safely.
- **UF-06:** Disconnect printer, settle bill, retry printing; only one payment and invoice exist.
- **UF-07:** Change menu price; old invoices retain original item price.
- **UF-08:** Close cash shift with a variance and verify audit trail.
- **UF-09:** Back up to USB, restore in a test installation, and verify order/invoice totals.
- **UF-10:** Unauthorized staff cannot issue refunds or alter tax configuration.
- **UF-11:** Transfer an unpaid table order; all items and KOT history follow the order.
- **UF-12:** Split a bill; sum of splits equals original total and table remains occupied until all are paid.

## 20. Decisions to confirm before implementation

1. **Restaurant service model:** table service only, or counter pickup/takeaway/delivery as well?
2. **Invoice/GST policy:** GST registration, tax-inclusive vs. tax-exclusive prices, service charges, rounding, and legally required receipt fields.
3. **Payment policy:** Are UPI/card entries manually confirmed by staff, and are split/partial payments needed in MVP?
4. **Reservation policy:** Default seating duration, grace period, overlap rules, and whether customer phone is mandatory.
5. **Kitchen setup:** One kitchen printer or multiple stations; KOT required for all menu items?
6. **Billing edge cases:** MVP support for split/merge/transfer, post-payment refunds, and manager approvals.
7. **Operating model:** Single Windows computer only initially, or multiple terminals sharing one local network database later? (This document assumes one device.)
8. **Printing hardware:** Printer brand/model, 58/80 mm paper, Windows driver, and cash drawer.
9. **Staff access:** PIN-only vs. password, role matrix, shift policies, and auto-lock timeout.
10. **Business-day boundary:** Midnight or configurable late-night cutoff.

## 21. Implementation handoff for AI coding agent

- Build UI flows as separate route-level features with reusable primitives; avoid a monolithic POS component.
- Use typed domain models and explicit order/payment/KOT state machines.
- Implement critical validations in Rust/backend and SQLite constraints, not solely in React.
- Use transactional writes and idempotency keys for financial operations and KOT submission.
- Keep order item price/tax snapshots; never derive historical invoices from current menu prices.
- Separate view state from persisted state; use optimistic UI only where rollback is safe.
- Do not mark simulated UI behavior as completed production functionality.
- Add automated tests for every scenario in §19 and test with actual Windows printer hardware before release.

---
**Next document:** `05-ui-ux-guidelines.md` — desktop layout, navigation, POS density, shadcn/ui patterns, interaction and accessibility guidelines.
