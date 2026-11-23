# 12 — Printing & Billing Specification

**Product:** Offline Restaurant Billing & Management (Windows desktop)  
**Stack:** Tauri 2, React, TypeScript, shadcn/ui, Rust, SQLite  
**Status:** Implementation specification; tax and hardware policies require restaurant-specific confirmation.

## 1. Scope and goals

Provide dependable dine-in/table billing and walk-in quick billing, kitchen order ticket (KOT) output, cash settlement, UPI/card payment recording, invoice printing and reprinting. All workflows operate without internet. The app records payments made externally; it does not claim to process online payments offline.

## 2. Operating modes

- **Dine-in:** Start or resume an active table session, add items, send KOTs, optionally split a bill, settle and release the table only after all balances are resolved.
- **Walk-in:** Start a counter order without a table, add items, settle and print.
- **Reservation:** A booking is not a chargeable order until a table session/order is opened; deposits, if introduced later, need explicit accounting rules.
- **Takeaway (optional):** Uses the same order engine, with separate order type and receipt label.

## 3. Billing workflow

1. Select existing order or create new table/walk-in order.
2. Add menu items with variants, quantities and optional kitchen notes.
3. Persist item snapshots (name, unit price, tax classification, discount treatment) so historical bills remain stable.
4. Send new/changed kitchen items to KOT; do not silently alter an already-issued KOT.
5. Review itemized subtotal, discounts, applicable charges, taxes and final payable amount.
6. Confirm checkout; create immutable invoice snapshot and unique invoice number in a database transaction.
7. Record one or more payment allocations. Mark invoice paid only when allocations cover amount due, allowing for documented rounding.
8. Queue receipt print independently. If printing fails, invoice/payment remain saved and user can retry.
9. Close order and release table after settlement according to business rules.

## 4. Amounts and calculation precision

- Store monetary amounts as **integer paise**, not floating-point rupees. Use explicit decimal arithmetic for percentage calculations, with deterministic rounding.
- Display amounts in INR with two decimals; the user interface must show exact line totals and adjustments.
- Suggested calculation pipeline: item base amounts → line/item discounts → order-level discount allocation → applicable charges → tax computation → invoice rounding adjustment → payable total.
- For tax-inclusive prices, reverse-calculate taxable base according to configured tax rules; for tax-exclusive prices, add calculated tax. Do not mix methods silently.
- Discounts must not produce negative line values; invoice totals must not become negative.
- Example (illustrative, no tax): 2 × ₹120.00 + 1 × ₹80.00 = ₹320.00; ₹20.00 discount → ₹300.00 due; cash tendered ₹500.00 → change ₹200.00.
- GST applicability, rate, supply type, rounding and invoice presentation must be configured and reviewed by a qualified local tax professional; **do not hardcode one restaurant GST rate**.

## 5. Cash, UPI, card and split payments

- **Cash:** Enter tendered amount; show amount due and change. Cash recorded as collected must equal invoice cash allocation, not tendered amount including change.
- **UPI/card:** Record an externally confirmed payment, amount, optional reference, and operator; do not mark payment successful merely because a QR code was displayed.
- **Split tender:** Multiple payment rows may settle one invoice; total applied must not exceed payable except cash tendered/change handling.
- **Partial payment:** If permitted by restaurant policy, keep invoice open with outstanding balance and prevent accidental table release.
- **Payment corrections/refunds:** Use reversal/refund records with reason, authorizer and audit trail. Never delete settled payment history.
- **Duplicate prevention:** Checkout and payment operations accept idempotency keys; retries return existing results.

## 6. Invoice numbering and records

- Invoice identifiers must be unique and allocated atomically in SQLite, using a configured fiscal-year/series policy if required.
- Keep internal UUID/ID distinct from customer-facing invoice number.
- Finalized invoice snapshots include restaurant identity, optional GSTIN, order type/table, line details, taxes/charges, discounts, totals, tender summary, timestamps and cashier.
- A finalized invoice must not be silently edited. Corrections require authorized void/credit/refund workflow consistent with applicable law and configured business policy.
- Invoice date/time should use stored UTC timestamps with local-time display; handle clock changes explicitly.

## 7. Thermal receipt formats

Support configurable **58 mm and 80 mm** paper widths, tested against actual printer printable widths and fonts. Template sections:

```text
        RESTAURANT NAME
       Address / Phone
       GSTIN (if applicable)
--------------------------------
Invoice: INV-000123
Date: 22-11-2026  18:15
Order: Dine-in | Table 04
Cashier: Staff 01
--------------------------------
Item              Qty    Amount
Paneer Tikka        2    240.00
Veg Biryani         1     80.00
--------------------------------
Subtotal                  320.00
Discount                  -20.00
Tax (if applicable)         0.00
Rounding                    0.00
TOTAL                     300.00
--------------------------------
Cash received             500.00
Change                    200.00
--------------------------------
         Thank you!
```

- Align columns with printer capabilities; long names wrap rather than truncate amounts.
- Include tax breakdown and required statutory fields when applicable.
- Reprints must display **DUPLICATE / REPRINT** and retain original invoice number; log operator, time and reason when policy requires.
- Offer preview before print and printer test page from Settings.

## 8. Kitchen Order Tickets (KOT)

- KOTs contain order/table or walk-in identifier, sequential ticket number, timestamp, item quantities, variants, special instructions and originating operator.
- Exclude prices and payment information by default.
- Print only newly submitted or amended kitchen items; maintain versioned KOT events for additions, cancellations and quantity reductions.
- If an item is cancelled after KOT issue, print a clearly labeled cancellation/amendment ticket and record the authorization.
- Kitchen tickets may target a different printer from customer receipts.
- A KOT print failure must leave its ticket pending and retriable, never lose the order.

## 9. Printer support and hardware boundaries

- Support Windows-installed printers first, with selectable receipt printer and KOT printer; test 58 mm and 80 mm configurations.
- Treat ESC/POS raw printing as an optional adapter requiring model/driver testing; not all Windows printer drivers accept raw ESC/POS.
- Define a printer abstraction: `listPrinters`, `testPrint`, `printReceipt`, `printKot`, `getJobStatus` (status where available).
- All OS-level printer access belongs to Rust/Tauri with narrowly scoped capabilities, not arbitrary frontend shell execution.
- Persist printer preferences per installation; provide safe fallback to Windows print dialog or PDF preview when supported.
- A successful OS spool submission is **not proof that paper printed**. Show honest states: queued, sent to spooler, confirmed if supported, failed/unknown.

## 10. Print queue and retry safety

- Persist print jobs in SQLite: ID, document type/id, target printer, template version, payload snapshot, state, attempt count, error and timestamps.
- Create invoice/KOT and pending print job transactionally where appropriate.
- On restart, reload pending/uncertain jobs and allow operator-controlled retry; warn about possible duplicate physical prints after uncertain outcomes.
- Printing must not occur inside a database transaction held open during slow device I/O.
- Never regenerate a finalized invoice from mutable menu data during reprint; use immutable invoice snapshot.

## 11. Shift reconciliation and reporting

- Opening cash float, cash sales, cash refunds, paid-outs, cash drops and closing counted cash must be separate fields.
- Expected cash = opening float + cash sales − cash refunds − cash paid-outs − cash drops (adjust only with audited entries).
- Report cash variance and require reason/authorization for adjustments.
- Reports distinguish payment method, gross sales, discounts, taxes, voids/refunds and net sales to avoid double counting.

## 12. Security and auditability

- Role permissions govern discounts, manual price overrides, refunds, invoice voids, reprints, cash adjustments and printer settings.
- Record actor, action, target, old/new values where applicable, reason and timestamp in append-only audit events.
- Do not store card numbers, CVV, UPI PINs or other payment secrets.
- Backups must include invoices, payment records, print jobs, configuration and audit history.

## 13. Failure scenarios

| Scenario | Required behavior |
|---|---|
| Printer offline | Save invoice and payment; mark print job pending/failed; retry later. |
| Power loss after payment commit | Recover paid invoice and queued receipt; never charge again automatically. |
| Double-click Pay | Same idempotency key produces one payment/invoice transition. |
| Cash tendered below due | Show outstanding amount; disallow fully-paid status. |
| UPI transfer unconfirmed | Keep payment pending/not recorded as settled. |
| KOT printer paper out | Keep kitchen ticket pending; warn operator. |
| App restart with occupied tables | Restore table sessions and open orders from SQLite. |
| Duplicate reprint attempt | Clearly label duplicate and audit it. |
| Printer driver incompatibility | Show actionable error; allow alternative configured printer. |
| Invalid tax configuration | Block finalization with explanation; do not guess tax. |

## 14. Suggested domain contracts

```ts
type MoneyPaise = number; // validated safe integer

type TenderMethod = 'cash' | 'upi' | 'card';
type PrintJobState = 'pending' | 'spooled' | 'failed' | 'unknown';

interface PaymentAllocation {
  method: TenderMethod;
  amountPaise: MoneyPaise;
  externalReference?: string;
}

interface CheckoutRequest {
  orderId: string;
  idempotencyKey: string;
  payments: PaymentAllocation[];
  cashTenderedPaise?: MoneyPaise;
}
```

Rust backend validates all totals and permissions independently of the frontend. Exact interfaces must be reconciled with `09-database-schema.md` and `10-business-rules.md` before coding.

## 15. Acceptance tests

1. Table and walk-in orders both produce correct, independent invoices.
2. Cash tender/change calculation is correct to the paise.
3. Mixed cash + UPI payments settle exactly one invoice.
4. Repeated checkout request does not duplicate invoice or payment.
5. Printer failure leaves successful financial records intact.
6. Restart restores pending KOT and receipt jobs.
7. 58 mm and 80 mm samples print legibly without clipped totals.
8. KOT amendment/cancellation produces separate traceable ticket.
9. Reprint retains original invoice number and is labeled duplicate.
10. Changing menu price does not change old receipts.
11. Unauthorized cashier cannot issue refund or void.
12. Shift cash report reconciles sales, refunds and cash movements.
13. All workflows complete with networking disabled.
14. Restore from backup preserves invoice numbering and audit trail.

## 16. Decisions to confirm before production

- Restaurant legal name, address, contact details and GST registration status.
- Applicable GST rates, inclusive/exclusive pricing, tax invoice format, rounding and fiscal-year numbering policy.
- Whether service charge, packing charge, discounts and tips are supported and how taxed.
- Whether partial settlement, split bills, invoice voids and refunds are permitted and by whom.
- Target printer models, Windows drivers, paper widths and kitchen routing.
- Whether printed KOT acknowledgment is required before kitchen preparation.
- Cash shift policy and receipt/reprint authorization requirements.

## 17. AI agent implementation instructions

1. Treat this document as requirements, not a substitute for real hardware and tax validation.
2. Use one Rust billing service for dine-in and walk-in, with order-type-specific UI.
3. Keep calculation functions pure and extensively unit tested.
4. Store integer paise, immutable invoice snapshots and transaction-safe payment records.
5. Keep printing asynchronous and recoverable; never roll back committed payments due to printer failures.
6. Reuse shadcn/ui components for payment dialogs, confirmation, receipt preview and error feedback.
7. Match IDs, table names and constraints to the approved SQLite schema; create migrations rather than ad-hoc table changes.
8. Document unresolved business policy rather than silently inventing defaults.

## 18. Related documents

- `02-product-requirements.md`
- `03-functional-specifications.md`
- `04-user-flows.md`
- `07-application-architecture.md`
- `09-database-schema.md`
- `10-business-rules.md`
- `11-offline-data-management.md`

**Next document:** `13-security-and-permissions.md`.
