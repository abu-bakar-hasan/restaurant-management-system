# 17 — Screen Inventory & Navigation Map

**Product:** Offline Restaurant Billing & Management (Windows Desktop)  
**Status:** Implementation specification / decisions subject to product-owner approval  
**Stack:** Tauri 2 · React · TypeScript · shadcn/ui · Tailwind CSS · Rust · SQLite  
**Version:** 1.0

## 1. Purpose and boundaries

This document inventories the application's screens, dialogs, drawers, and navigation behavior. It is intended to guide frontend implementation without changing the business requirements. The app runs on a single Windows desktop, entirely offline. Dine-in table orders and walk-in quick orders are **both mandatory** and remain distinct workflows, backed by a shared billing engine.

Route paths below are **suggested internal React routes**, not internet URLs. All screens use local data via Tauri commands; no browser or cloud server is required.

## 2. Application shell

- **Sidebar:** Dashboard, POS / Quick Order, Tables, Reservations, Kitchen, Menu, Orders, Billing / Invoices, Reports, Cash Shifts, Staff (permission-gated), Settings.
- **Header:** current screen title, active staff member, shift indicator, local date/time, printer status, and lock/logout action.
- **Global actions:** New Walk-in Order, Open Tables, Search Order/Invoice (permission-gated), and Help / Shortcuts.
- **Persistent notices:** unsent KOTs, pending print jobs, database/backup errors, and active shift issues.
- **Desktop behavior:** responsive within common Windows window sizes; sidebar collapses at narrow widths; keyboard navigation works throughout.
- **Navigation safety:** warn before abandoning an unsaved draft; do not warn for changes already persisted successfully.

## 3. Navigation hierarchy

```text
Authentication
  ├─ First-time setup (initial installation only)
  ├─ Login / staff PIN
  └─ Locked session

Application
  ├─ Dashboard
  ├─ POS / Quick Order
  │   ├─ Walk-in order editor
  │   └─ Checkout / payment / receipt
  ├─ Tables
  │   ├─ Table overview
  │   ├─ Table order editor
  │   └─ Transfer / merge / split (if enabled)
  ├─ Reservations
  │   ├─ Reservation list / calendar
  │   └─ Create / edit reservation
  ├─ Kitchen
  │   ├─ Active tickets
  │   └─ Ticket details
  ├─ Orders
  │   ├─ Active / history
  │   └─ Order details
  ├─ Billing / Invoices
  │   ├─ Invoice list
  │   ├─ Invoice details
  │   └─ Refund / reprint (authorized only)
  ├─ Menu
  │   ├─ Categories
  │   └─ Items / variants
  ├─ Cash Shifts
  │   ├─ Open / current shift
  │   └─ Close / reconciliation / history
  ├─ Reports
  │   ├─ Sales
  │   ├─ Payments
  │   └─ Item performance
  ├─ Staff (admin/manager)
  └─ Settings
      ├─ Restaurant / taxes / charges
      ├─ Tables and service areas
      ├─ Printer setup
      ├─ Backup / restore
      └─ Application / data diagnostics
```

## 4. Screen inventory

| ID | Screen | Suggested route | Primary user | Primary actions |
|---|---|---|---|---|
| S01 | Initial setup wizard | `/setup` | Owner/Admin | Configure restaurant, first admin, initial tables, printers |
| S02 | Login | `/login` | All staff | Authenticate locally |
| S03 | Lock screen | `/lock` | All staff | Unlock or switch staff |
| S04 | Dashboard | `/` | Admin/Manager/Cashier | Review KPIs, jump to orders and tables |
| S05 | Walk-in POS | `/pos` | Cashier | Add items, edit quantities, checkout |
| S06 | Table overview | `/tables` | Cashier/Manager | Select table, see availability and reservations |
| S07 | Table order | `/tables/:tableId/order` | Cashier | Add items, KOT, bill, checkout |
| S08 | Reservation overview | `/reservations` | Cashier/Manager | Search, filter, create, check-in, cancel |
| S09 | Kitchen board | `/kitchen` | Kitchen/Manager | Track preparation, mark ready |
| S10 | Order list | `/orders` | Cashier/Manager | Search and filter active/past orders |
| S11 | Order detail | `/orders/:orderId` | Authorized staff | Review timeline, amendments, status |
| S12 | Invoice list | `/invoices` | Cashier/Manager | Search, filter, view receipts |
| S13 | Invoice detail | `/invoices/:invoiceId` | Authorized staff | Reprint, review payments, refund with approval |
| S14 | Menu items | `/menu/items` | Manager/Admin | Add/edit/archive items and variants |
| S15 | Menu categories | `/menu/categories` | Manager/Admin | Reorder/manage categories |
| S16 | Current cash shift | `/shifts/current` | Cashier/Manager | Open shift, cash in/out, reconcile |
| S17 | Shift history | `/shifts` | Manager/Admin | Review past reconciliations |
| S18 | Sales report | `/reports/sales` | Manager/Admin | Date range, summaries, export |
| S19 | Payment report | `/reports/payments` | Manager/Admin | Tender breakdown, refunds, export |
| S20 | Item performance | `/reports/items` | Manager/Admin | Item quantities, revenue, export |
| S21 | Staff & permissions | `/staff` | Admin | Create/deactivate staff, role assignment |
| S22 | Restaurant settings | `/settings/restaurant` | Admin | Profile, tax/charge settings |
| S23 | Table settings | `/settings/tables` | Admin/Manager | Add/edit/disable tables |
| S24 | Printer settings | `/settings/printers` | Admin/Manager | Choose printers, test print |
| S25 | Backup & restore | `/settings/data` | Admin | Backup, verify, restore with safeguards |
| S26 | App diagnostics | `/settings/about` | Admin | Version, database status, logs |
| S27 | Not found / access denied | `*` | All staff | Return to authorized home |

**Important:** Table booking is a **reservation**, while a table order represents an active dining session. The UI must not confuse these concepts.

## 5. Dialogs, drawers, and overlays

| ID | Surface | Trigger | Key requirements |
|---|---|---|---|
| D01 | Add/edit menu item | Menu action | Validate prices and required fields |
| D02 | Add/edit table | Table settings | Unique label, capacity, availability rules |
| D03 | Reservation form | Reservations / table | Date/time, party size, conflicts, optional contact |
| D04 | Assign/check-in reservation | Reservation action | Confirm table occupancy |
| D05 | Item customization | POS item selection | Variant, notes, quantity, modifier price |
| D06 | Send KOT confirmation | Order editor | Only new/changed items; prevent duplicate sends |
| D07 | Checkout drawer | POS/table order | Itemized totals, taxes, discounts, payment method |
| D08 | Cash tender dialog | Checkout | Amount received, change due, confirmation |
| D09 | Split payment dialog | Checkout | Multiple tenders; exact total settlement |
| D10 | Discount authorization | Checkout | Reason, permission check, audit |
| D11 | Cancel/void item | Order detail | Reason and approval where required |
| D12 | Transfer table | Table order | Validate destination availability |
| D13 | Merge/split order | Table order | Explicit review before committing; optional later release |
| D14 | Refund dialog | Invoice detail | Permission, amount, reason, immutable audit trail |
| D15 | Receipt preview | Post-payment/invoice | 58mm/80mm preview, print/reprint |
| D16 | Print failure notice | Print job | Retry, choose printer, continue without losing payment |
| D17 | Shift open/close | Cash shifts | Opening cash, counted cash, variance, approval |
| D18 | Backup/restore wizard | Settings | Validate backup, warn about replacement, recovery copy |
| D19 | Confirm destructive action | Contextual | Clear consequence and safe default |
| D20 | Session lock / switch user | Header | Prevent unauthorized access |

Use shadcn/ui `Dialog`, `AlertDialog`, `Sheet`, `Popover`, `Command`, and `Toast` as appropriate. Never use a transient toast as the sole indication of a failed payment or unsafe data state.

## 6. Core flows and screen transitions

### 6.1 Walk-in quick order

`Dashboard or sidebar → POS → select items → checkout drawer → record payment → invoice detail / receipt preview → new POS order`.

- Walk-in checkout does **not** require a table assignment.
- A saved but unpaid order remains recoverable.
- Payment and invoice persistence happen before printing.

### 6.2 Dine-in table order

`Tables → available table → open dining session → table order → add items → send KOT → add more items as needed → checkout → payment → receipt → table returns available`.

- Available tables appear **green**, with both color and text status.
- Occupied tables display an active order summary.
- Table is released only when settlement and closing rules are satisfied.

### 6.3 Reservation

`Reservations → create → validate conflicts → save → check in → assign table → table order`.

- Reservation status and actual occupancy are separate.
- Handle cancellation, no-show, and late arrival according to business rules.

### 6.4 Kitchen

`KOT submitted → Kitchen board → preparing → ready → served/closed`.

- Kitchen staff cannot modify payments.
- Failed KOT printing must be visible and retryable.

### 6.5 Shift closing

`Cash shifts → current shift → counted cash → variance review → close shift → shift summary`.

- Require authorization for overrides.
- Prevent ambiguous treatment of open orders and unsettled payments.

## 7. Screen-level interaction contracts

### POS (S05) and Table Order (S07)

**Zones:** searchable menu/categories, product list, order lines, totals, prominent checkout, current order/table context.  
**States:** empty cart, item loading, unsent KOT changes, saved order, payment in progress, paid, error.  
**Actions:** add item, increment/decrement, remove/void, notes/modifiers, hold/resume, KOT, checkout.  
**Rules:** keyboard-friendly; never duplicate an order on repeated clicks; preserve state on app restart once saved.

### Tables (S06)

**Zones:** table filters, status legend, table cards, reservation indicators.  
**States:** available (green), occupied, reserved, unavailable; mixed status needs explicit priority rules.  
**Actions:** open table, view current order, create reservation, transfer (authorized).

### Checkout (D07–D09)

**Zones:** immutable itemized preview for current transaction, taxes/discounts, payable amount, tender controls.  
**States:** ready, processing, paid, partially paid where supported, failed, unknown result requiring reconciliation.  
**Rules:** integer paise, server-side (Rust) recalculation, idempotent submission, never mark paid on frontend optimism.

## 8. Permissions and navigation

- **Admin:** all authorized operational and configuration screens.
- **Manager:** operations, reports, menu, approved adjustments; restricted system settings as configured.
- **Cashier:** POS, tables, reservations, orders, billing, own shift; limited refunds/discounts.
- **Kitchen:** kitchen board and permitted order details; no financial settings.

Sidebar hiding is a convenience only. **Every Tauri command must enforce authorization in Rust.** Unauthorized deep links show an access-denied state without exposing restricted data.

## 9. Global UX states

Each screen must account for: loading, no records, no search results, validation failure, access denied, database error, pending print, recoverable interruption, and success. Use clear actionable text. Keep active order and payment errors visible until resolved.

Keyboard focus must return predictably after dialogs. Disable repeated submissions while a command is pending, but do not rely on disabled buttons alone for idempotency.

## 10. Suggested route and component ownership

```text
src/
  app/
    router.tsx
    layouts/AppLayout.tsx
    guards/RequirePermission.tsx
  features/
    auth/pages/
    dashboard/pages/
    pos/pages/
    tables/pages/
    reservations/pages/
    kitchen/pages/
    orders/pages/
    billing/pages/
    menu/pages/
    shifts/pages/
    reports/pages/
    staff/pages/
    settings/pages/
  components/
    ui/                 # shadcn/ui primitives
    shared/             # reusable app-level controls
```

Use feature-specific components inside each feature. Do not place all dialogs, business logic, or screens in a single component. The React router is navigation only; the Rust/SQLite layer remains authoritative.

## 11. Accessibility and desktop behavior

- Minimum practical touch/click target sizes for fast POS operation.
- Keyboard navigation and visible focus indicators for all controls.
- Status communicated by text/icon **as well as** color.
- Confirm high-risk actions; keep common actions one or two interactions away.
- Support common Windows DPI scaling and smaller desktop windows without clipped checkout controls.
- Provide shortcut discoverability; avoid shortcuts conflicting with text entry.

## 12. Frontend acceptance checklist

- [ ] Every route in the inventory is reachable or explicitly permission-gated.
- [ ] Walk-in POS and table ordering remain separate entry points.
- [ ] Table cards distinguish available/occupied/reserved/unavailable.
- [ ] Every screen has empty, error, and loading states.
- [ ] Dialogs and drawers validate inputs and restore focus.
- [ ] Checkout never displays success before backend confirmation.
- [ ] Pending print jobs are visible and retryable.
- [ ] Navigation does not silently discard unsaved edits.
- [ ] Staff roles cannot access unauthorized data through deep links or commands.
- [ ] Desktop keyboard use and Windows scaling have been tested.

## 13. Decisions to confirm before implementation

1. Single restaurant location only, or multiple branches later?
2. Is split billing/merging tables in the first release or a later phase?
3. Should walk-in orders support a hold/resume queue?
4. Are kitchen display and kitchen printer both needed at launch?
5. Which staff roles may issue discounts, voids, and refunds?
6. Required invoice format, GST applicability, and local tax settings?
7. Supported thermal printer models and 58mm/80mm paper widths?
8. Whether reservation deposits are supported (default: no).

**Do not invent business policy to resolve these decisions.** Keep features configurable or mark them pending approval.

## 14. Related documentation

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
- `13-security-and-permissions.md`
- `16-ai-agent-instructions.md`

**Next document:** `18-error-handling-and-recovery.md`.
