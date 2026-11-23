# Restaurant Billing & Management — Product Requirements Document (PRD)

**Document ID:** 02  
**Version:** 1.0 (draft for review)  
**Platform:** Windows desktop, fully offline  
**Product stack:** Tauri 2, React, TypeScript, Vite, Tailwind CSS, shadcn/ui, Rust, SQLite  
**Status:** Product baseline; unresolved decisions are explicitly marked.

## 1. Product summary

Build a dependable, fast, offline-first restaurant point-of-sale (POS) and management application for a single restaurant location. It supports dine-in tables and direct walk-in/takeaway orders, reservations, kitchen order tickets, billing, payment collection, reporting, staff access, receipt printing, and local backups. The final product is an installed Windows application, not a browser-based application.

### 1.1 Product goals
- Complete common billing actions quickly, with keyboard and mouse.
- Keep table orders distinct from walk-in orders while sharing a single order and payment engine.
- Prevent loss, duplication, or silent alteration of completed transactions.
- Work without internet access, including after restart.
- Make cash closing, receipt reprints, and data backup straightforward.
- Use a polished, accessible, consistent shadcn/ui interface.

### 1.2 Non-goals for initial release
- Cloud accounts, remote dashboards, mobile apps, online ordering, delivery integrations.
- Multi-location inventory synchronization or simultaneous multi-PC editing.
- Loyalty programs, payroll, and advanced stock accounting.
- Internet-dependent payment verification. Recording a UPI/card payment locally does **not** prove bank settlement.

## 2. Users and permissions

| Role | Primary capabilities |
|---|---|
| Owner/Admin | Full setup, staff management, reports, refunds/void approvals, backups and restore |
| Manager | Tables, reservations, orders, menu maintenance, authorized corrections, reports |
| Cashier | Create orders, take payments, print/reprint bills, manage assigned cash shift |
| Kitchen staff | View KOTs, update preparation status; no payment or financial report access |

Permissions must be enforced in backend commands, not only hidden in the UI. Exact role-permission matrix belongs in `13-security-and-permissions.md`.

## 3. Operational assumptions
- Initial deployment: one Windows computer with a local SQLite database.
- Tables are configurable; initial demo can show Tables 1–8, not a hard-coded limit.
- Restaurant may serve dine-in, takeaway, and counter/walk-in customers.
- Tax treatment and invoice wording are configurable and must be validated for the business's actual registration and local rules before production use.
- Thermal printer model and connection type are not yet chosen; printing must be adapter-based.
- Currency defaults to INR (₹), with money stored as integer minor units (paise) to avoid floating-point errors.

## 4. Scope and release priorities

**P0 — required for first usable release:** local setup, login, menu, tables, dine-in orders, walk-in orders, checkout, cash payments, receipt generation, basic KOT, daily sales, local persistence, backup/restore.

**P1 — target for production hardening:** reservations, UPI/card payment recording, split tender, discounts, configurable taxes, cash shifts, refunds/voids with approvals, detailed reporting, audit log, printer troubleshooting.

**P2 — future:** floor-plan editor, recipes/inventory, customer history, multiple kitchen printers, sophisticated analytics, multi-terminal synchronization.

## 5. Functional requirements

### 5.1 First-run setup and authentication
- **PRD-SET-01 [P0]** On first launch, collect restaurant name, address, phone, currency, basic receipt settings, and initial admin credential.
- **PRD-SET-02 [P0]** Subsequent launches require local staff authentication; support logout and role-aware navigation.
- **PRD-SET-03 [P1]** Allow authorized admin to change restaurant profile, tax defaults, printers, and receipt footer.

**Acceptance:** Relaunching without network retains configuration; unauthorized staff cannot modify restricted settings.

### 5.2 Dashboard
- **PRD-DASH-01 [P0]** Display today's gross sales, net sales, order count, open tables, and outstanding/unpaid orders.
- **PRD-DASH-02 [P0]** Provide quick actions to create walk-in order, view tables, and resume pending bills.
- **PRD-DASH-03 [P1]** Show tender breakdown, refunds, top-selling items, and time-based sales chart.

**Acceptance:** Metrics reconcile with saved orders, payment records, and refund adjustments for the selected business day.

### 5.3 Tables and reservations
- **PRD-TBL-01 [P0]** Create/edit/disable tables with unique display name, capacity, and optional area.
- **PRD-TBL-02 [P0]** Display clear table states: available (green), occupied, reserved, unavailable; status is computed from bookings/active orders where applicable.
- **PRD-TBL-03 [P0]** Open or resume a dine-in order from a table; block accidental creation of conflicting active orders.
- **PRD-TBL-04 [P1]** Transfer an active order between tables with confirmation and audit trail.
- **PRD-TBL-05 [P1]** Book a table for date/time, party size, name, and optional phone/notes; prevent conflicting reservations according to configurable slot duration/buffer.
- **PRD-TBL-06 [P1]** Support reservation states: booked, seated, completed, cancelled, no-show.

**Acceptance:** Table 1 can be green when vacant, switches to occupied when an active dine-in order opens, and returns to available when the order is settled and closed, unless blocked by a reservation/unavailable state.

### 5.4 Menu and pricing
- **PRD-MENU-01 [P0]** Manage categories and menu items: name, category, price, availability, optional image, description, and tax category.
- **PRD-MENU-02 [P0]** Search/filter menu quickly from POS; mark unavailable items to prevent new additions.
- **PRD-MENU-03 [P1]** Support variants, add-ons, preparation notes, and configurable item discounts.
- **PRD-MENU-04 [P0]** Snapshot item name, unit price, taxes, and modifiers onto order lines so later menu edits do not rewrite old bills.

**Acceptance:** A historical invoice stays unchanged after an item price is edited.

### 5.5 Orders and POS
- **PRD-ORD-01 [P0]** Create two order types: `DINE_IN` linked to a table, and `WALK_IN` without a table.
- **PRD-ORD-02 [P0]** Add/remove items, adjust quantities, and attach line/order notes before settlement.
- **PRD-ORD-03 [P0]** Persist drafts and open orders immediately, including across app restarts.
- **PRD-ORD-04 [P0]** Calculate subtotal, discounts, charges, tax, rounding adjustment (if enabled), and payable total deterministically.
- **PRD-ORD-05 [P0]** Track lifecycle: draft/open → sent to kitchen (optional) → ready/served → paid/closed; cancellation and voiding are separate auditable outcomes.
- **PRD-ORD-06 [P1]** Support item cancellation after KOT with explicit reason and permission, plus order transfer/merge only if rules allow.
- **PRD-ORD-07 [P0]** Prevent double submission through unique operation IDs or equivalent idempotency protections.

**Acceptance:** A walk-in order can be billed without selecting a table; an open table order survives an unexpected app restart.

### 5.6 Kitchen order tickets (KOT)
- **PRD-KOT-01 [P0]** Generate numbered KOTs containing order reference, table/walk-in indicator, items, quantities, notes, and time.
- **PRD-KOT-02 [P0]** Show pending, preparing, ready, and served statuses.
- **PRD-KOT-03 [P1]** Subsequent additions create delta KOTs; cancelled items are clearly communicated and recorded.
- **PRD-KOT-04 [P1]** Reprint a KOT without creating duplicate kitchen work.

**Acceptance:** Sending an order twice by retry does not create duplicate KOT lines.

### 5.7 Checkout, payments, and invoices
- **PRD-PAY-01 [P0]** Accept cash payment, capture amount received, and show change due.
- **PRD-PAY-02 [P1]** Record UPI and card tenders locally with optional reference number; show that verification is external/manual.
- **PRD-PAY-03 [P1]** Support split tenders; prevent overpayment unless explicit cash-change rules apply.
- **PRD-PAY-04 [P0]** Generate unique invoice/receipt numbers and preserve immutable settled amounts.
- **PRD-PAY-05 [P0]** Allow receipt preview, print, and clearly marked reprint.
- **PRD-PAY-06 [P1]** Refund/void completed transactions only with authorized action, reason, and compensating financial records; never silently delete them.
- **PRD-PAY-07 [P1]** Allow configurable taxes and service charges with visible breakdown, including tax-inclusive or tax-exclusive pricing as configured.

**Acceptance:** The sum of accepted tender amounts matches the amount due, subject to cash-change handling; clicking Pay twice cannot produce two invoices or duplicate payment records.

### 5.8 Cash shifts and reports
- **PRD-CASH-01 [P1]** Cashier opens shift with opening float and closes with counted cash.
- **PRD-CASH-02 [P1]** Record cash in/out adjustments with reason; show expected vs counted cash and variance.
- **PRD-RPT-01 [P0]** Daily report includes settled orders, sales, discounts, tax, refunds, and payment-method totals.
- **PRD-RPT-02 [P1]** Filter by business date, cashier, order type, and tender; export CSV and printable summary.
- **PRD-RPT-03 [P1]** Define business-day cutoff independently of midnight when needed.

**Acceptance:** Reports reconcile to stored transactions and include refund adjustments without double counting.

### 5.9 Offline persistence and backup
- **PRD-DATA-01 [P0]** Store operational records locally in SQLite, with foreign keys, migrations, and transaction boundaries.
- **PRD-DATA-02 [P0]** No internet connection or hosted service is required for launch, ordering, billing, reports, or printing.
- **PRD-DATA-03 [P0]** Provide manual backup to a user-selected folder or removable drive using a consistent SQLite backup procedure.
- **PRD-DATA-04 [P0]** Restore only after validation, explicit warning, and safety copy of existing data.
- **PRD-DATA-05 [P1]** Offer scheduled local backup reminders or automatic backups with retention policy.

**Acceptance:** Orders and settings remain intact after offline restart; a validated backup can be restored on a test installation.

### 5.10 Printing and hardware
- **PRD-PRN-01 [P0]** Generate receipts in a printable layout for common 58 mm / 80 mm thermal paper widths.
- **PRD-PRN-02 [P0]** Print failure does not roll back an already committed payment; user can retry safely.
- **PRD-PRN-03 [P1]** Configure printer destination for receipts and KOTs; show clear error/status messages.
- **PRD-PRN-04 [P1]** Provide test-print and reprint operations with an audit record.

**Acceptance:** Reprinting produces the same financial values and invoice number, with a reprint indicator where appropriate.

## 6. UX and design requirements
- Desktop-first layout optimized for 1366×768 and larger, with usable behavior at 1280×720.
- Persistent primary navigation: Dashboard, POS, Tables, Reservations, Kitchen, Menu, Reports, Settings (visibility by role).
- Large, easily clickable POS item tiles, efficient search, visible cart and totals.
- Green for available tables; occupied, reserved, and unavailable use distinct colors **and text**, never color alone.
- Consistent shadcn/ui primitives, accessible keyboard focus, confirmations for destructive actions, non-blocking toasts for successful actions.
- Motion should be subtle and respect reduced-motion preferences; no animation may delay urgent billing actions.
- Empty, loading, error, printer-disconnected, and offline states must be designed.

## 7. Nonfunctional requirements

| ID | Requirement | Target / verification |
|---|---|---|
| NFR-01 | Offline operation | Full P0 workflow with network disabled |
| NFR-02 | Startup | Target < 5 seconds on a representative Windows PC; measure during testing |
| NFR-03 | POS responsiveness | Typical item addition and cart update feel immediate; target < 200 ms UI feedback |
| NFR-04 | Data integrity | SQLite transactions, constraints, crash-recovery testing, no duplicate settlement |
| NFR-05 | Security | Password/PIN protection, least privilege, secure local storage for secrets |
| NFR-06 | Accessibility | Keyboard navigation, visible focus, readable contrast, non-color-only statuses |
| NFR-07 | Maintainability | Feature-based modular code, migrations, automated tests, typed boundaries |
| NFR-08 | Installation | Signed installer preferred for distribution; installer/upgrade path tested on Windows |
| NFR-09 | Privacy | No automatic transmission of customer or sales data |
| NFR-10 | Auditability | Record critical changes with actor, timestamp, reason, and affected record |

Performance targets are provisional and should be validated on the intended hardware.

## 8. Key workflows and acceptance scenarios

### Scenario A — Dine-in cash sale
1. Cashier selects available Table 3.
2. Adds two menu items and saves order.
3. Sends KOT; table shows occupied.
4. Adds another item, creating a supplemental KOT.
5. Opens checkout, reviews taxes/discounts, receives cash, and confirms payment.
6. Receipt is printed or queued for retry; order closes and table becomes available unless another reservation blocks it.

**Pass criteria:** Exactly one settled invoice and corresponding payment; order survives restart at any pre-payment step.

### Scenario B — Walk-in quick sale
1. Cashier clicks **New Walk-in Order**.
2. Adds items without selecting any table.
3. Collects cash, confirms payment, prints receipt.

**Pass criteria:** Order is stored with `WALK_IN` type and no table assignment; table statuses remain unchanged.

### Scenario C — Reservation conflict
1. Manager reserves Table 5 for a specified time interval.
2. Another user attempts an overlapping booking for Table 5.

**Pass criteria:** Conflict is shown and the overlapping reservation is rejected unless an authorized override rule is explicitly configured.

### Scenario D — Printer disconnected
1. Cashier settles a valid bill while receipt printer is unavailable.
2. Application shows printing failure and offers retry.

**Pass criteria:** Payment/invoice remain committed exactly once; retry does not charge or settle again.

### Scenario E — Backup and recovery
1. Admin creates a local backup.
2. Test installation validates and restores backup.
3. Compare orders, invoices, and report totals.

**Pass criteria:** Data and relationships match; failed validation never overwrites live data.

## 9. Data entities (high-level)
- RestaurantSettings, StaffUser, Role/Permission, AuditEvent
- DiningArea, RestaurantTable, Reservation
- MenuCategory, MenuItem, ItemVariant/Modifier
- Order, OrderLine, OrderAdjustment, KitchenTicket, KitchenTicketLine
- Invoice, Payment, Refund, CashShift, CashMovement
- PrinterConfiguration, BackupRecord

Exact columns, indexes, foreign keys, and migration strategy belong in `09-database-schema.md`.

## 10. Business rules to define separately
- When an order can be edited after KOT or after settlement.
- Tax inclusion/exclusion, discount application order, rounding, service charges.
- Table reservation duration, grace period, no-show, and seating rules.
- Payment split/change and refunds.
- Invoice numbering and business-day cutoff.
- Cash shift reconciliation and void permissions.

These rules must be finalized in `10-business-rules.md` before implementing settlement logic.

## 11. Dependencies and delivery stages

| Stage | Outcome | Exit criterion |
|---|---|---|
| 1. UI prototype | App shell, dashboard, POS, tables, menu with dummy data | All P0 screens navigable |
| 2. Local persistence | Tauri commands, SQLite schema, migrations | CRUD survives restart |
| 3. Transaction engine | Orders, KOT, cash settlement, invoice records | Automated calculation/idempotency tests pass |
| 4. Operational workflows | Reservations, reports, receipt printing, backup | Offline end-to-end scenarios pass |
| 5. Hardening and packaging | Roles, audit, failure recovery, installer | Windows acceptance tests pass |

A UI prototype is **not** considered production-ready merely because its screens work with mock data.

## 12. Open decisions requiring product-owner confirmation
1. Single-PC only for first release, or future LAN multi-terminal support?
2. Is the restaurant GST-registered? Which tax/service-charge behaviors are needed?
3. Receipt printer: brand/model, USB/Bluetooth/LAN, 58 mm or 80 mm?
4. Are kitchen tickets printed, shown on-screen, or both?
5. Is takeaway distinct from walk-in, or are they the same order type?
6. Do you need customer names/phone numbers on bills and reservations?
7. Is there a fixed opening/closing business-day cutoff?
8. Should item variants, modifiers, split bills, and refunds be in the first release?
9. What minimum Windows version and target computer specifications should be supported?
10. Will there be one shared cashier account or separate staff logins?

## 13. Related documentation
- `01-business-requirements.md` — business context and operational goals.
- `03-functional-specifications.md` — detailed screen and action behavior.
- `04-user-flows.md` — end-to-end workflow diagrams and edge cases.
- `05-ui-ux-guidelines.md` and `06-design-system.md` — interaction and visual standards.
- `07-application-architecture.md` and `08-folder-structure.md` — code organization.
- `09-database-schema.md` and `10-business-rules.md` — data integrity and calculation rules.
- `11-offline-data-management.md`, `12-printing-and-billing.md`, `13-security-and-permissions.md` — operational correctness.
- `14-testing-strategy.md`, `15-development-roadmap.md`, `16-ai-agent-instructions.md` — delivery and implementation.

## 14. Definition of done for initial release
- All P0 requirements implemented with real local persistence.
- Dine-in and walk-in cash billing pass end-to-end tests.
- Table status and KOT behavior are consistent.
- Invoices and payments are idempotent and auditable.
- App functions with network disabled and recovers from restart.
- Backup/restore validated; printer failure does not lose sales.
- Windows installation, launch, and upgrade tested.
- No unresolved critical data-loss, calculation, or authorization bugs.

---

**Document status:** Draft v1.0. Open decisions are not assumptions to silently hard-code. Update this PRD as decisions are confirmed, then propagate them into functional specifications, database schema, and business rules.
