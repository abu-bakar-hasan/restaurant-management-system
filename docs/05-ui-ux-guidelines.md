# 05 — UI/UX Guidelines

**Product:** Offline Restaurant Billing & Management Desktop Application  
**Platform:** Windows desktop only  
**Stack:** Tauri 2, React, TypeScript, Tailwind CSS v4, shadcn/ui, SQLite  
**Status:** Design specification v1.0 — proposed defaults to validate with restaurant operators

## 1. Purpose and principles

This document defines how the app should look, feel, and behave. It complements the business requirements, PRD, functional specifications, and user flows. Those documents govern business logic; this document governs presentation and interaction.

Prioritize **speed, clarity, accuracy, and resilience** over decorative effects. A cashier should be able to complete common tasks with minimal navigation, without internet, and without losing an order if the window is closed or the printer fails.

Principles:
- Make the primary action obvious on each screen.
- Show monetary amounts, order status, and table status without requiring extra clicks.
- Prevent irreversible actions and explain consequences.
- Support mouse, keyboard, and touch-capable Windows hardware, without assuming touch input.
- Keep walk-in billing and table-wise billing equally accessible.
- Use consistent labels, icons, colors, and spacing.
- Never use color alone to communicate state.

## 2. Information architecture

### Primary navigation

1. Dashboard
2. POS / New Order
3. Tables
4. Reservations
5. Kitchen / KOT
6. Menu
7. Orders & Bills
8. Reports
9. Staff & Shifts (role-restricted)
10. Settings (role-restricted)

A persistent sidebar is recommended on standard desktop widths. Keep the current restaurant/shift indicator, signed-in staff member, and local date/time visible in a compact header. Avoid unnecessary secondary navigation.

### Navigation behavior

- POS must be reachable in one click from anywhere.
- POS opens with a clear choice or switch between **Walk-in** and **Table** modes.
- Clicking an occupied table opens its existing active order; clicking an available table starts a new dine-in order after confirmation.
- Back navigation must never silently discard an order or unsaved form changes.
- Restore the last safe view after reopening the app; require authentication according to session policy.

## 3. Window sizes and adaptive desktop layout

Target Windows displays at **1366×768 and 1920×1080**, with usability at **1280×720** where practical. Test at Windows display scaling of 100%, 125%, and 150%.

- Standard desktop: sidebar (approximately 220–256 px), main content, optional contextual panel.
- Narrow windows: collapsible icon sidebar, stacked or tabbed panels, scrollable content areas.
- POS at 1366×768: categories and item selection in main area; order/cart summary remains visible on the right, ideally 320–400 px wide.
- At smaller widths, cart becomes a prominent toggleable panel; totals and checkout action must remain accessible.
- Avoid horizontal page scrolling for core workflows.

## 4. Visual hierarchy and typography

Use a neutral, restrained interface with one accent color for primary actions. Use the shadcn/ui semantic token system rather than hardcoded component colors. A dedicated design-system document will specify exact tokens.

- Screen title: 22–28 px, semibold.
- Section title: 16–20 px, semibold.
- Body: 14–16 px.
- Secondary information: 12–14 px, but never for critical totals or controls.
- Currency figures: tabular numerals, right aligned in tables.
- Primary bill total: 24–32 px, strong contrast.
- Maintain consistent spacing increments (4, 8, 12, 16, 24, 32 px).
- Prefer whitespace and dividers over excessive cards, borders, shadows, gradients, and badges.

## 5. Components and interaction standards

Use shadcn/ui primitives consistently: Button, Input, Select, Dialog, AlertDialog, Sheet, Tabs, Table, DropdownMenu, Popover, Command, Toast/Sonner, Skeleton, Tooltip, Checkbox, Switch, and Form. Use Lucide icons with text labels where meaning is not obvious.

- Primary button: one dominant action per context (e.g., **Charge ₹620**).
- Destructive action: explicit label, confirmation when appropriate, reason capture where required.
- Dialog: short, focused decisions such as void confirmation or discount approval.
- Sheet/panel: contextual order details, table transfer, item customization.
- Full page: complex workflows such as menu management, reports, and settings.
- Use inline validation near the affected field; avoid generic error toasts as the only feedback.
- Disable duplicate submission while a transaction is processing, and show the result clearly.

## 6. Dashboard

The dashboard should answer: **How is the restaurant doing right now?**

Recommended sections:
- Today's gross/net sales (clearly labeled)
- Paid orders, open orders, occupied tables
- Cash collected and payment-method breakdown
- Pending kitchen tickets
- Recent orders and actionable exceptions

Charts are secondary to operational KPIs. Distinguish paid revenue from unpaid/open-order value. Display the shift date/business day, not just the system calendar date, if the restaurant closes after midnight.

## 7. POS — walk-in and table ordering

### Shared screen structure

1. Header: mode, table/customer context, current order number, staff member.
2. Search field and category navigation.
3. Menu item grid/list with name, price, availability, optional photo.
4. Cart with item, quantity, modifiers, notes, line price, and remove action.
5. Summary with subtotal, discounts, taxes, charges, grand total.
6. Primary action area: Save / Send to Kitchen / Checkout as applicable.

### Walk-in mode

- Begin without choosing a table.
- Add items rapidly; support keyboard search and category filtering.
- Allow optional customer name or phone only when necessary.
- Support immediate payment and receipt printing, or kitchen workflow if configured.

### Table mode

- Clearly show table number and guest count.
- Save and revisit open orders without re-entering items.
- Show which items are new, sent to kitchen, prepared, served, or cancelled.
- Never silently resend previously issued KOT items.
- Make table transfer and split bill discoverable, subject to permissions.

### Cart details

- Plus/minus controls must be large enough for fast use.
- A removed or reduced quantity that has already been sent to the kitchen may require a cancellation flow rather than ordinary deletion.
- Clearly distinguish an **unsaved draft** from a **saved order**.
- Show a persistent order summary even when the menu list scrolls.

## 8. Table management

Use a grid of readable table tiles, not a decorative floorplan by default. Each tile displays table name/number, capacity, state, and where applicable elapsed occupancy or active bill amount.

**Suggested states:**
- Available — green with “Available” label
- Occupied — amber or another contrasting color with “Occupied” label
- Reserved — blue/purple with “Reserved” label
- Out of service — neutral gray with “Unavailable” label

These are provisional colors; verify contrast and semantic tokens in the design system. Do not rely on green/red alone.

Filtering: All, Available, Occupied, Reserved, Out of service. Search by table number. A reservation does not automatically mean the table is occupied. Show upcoming booking conflicts before seating walk-in guests.

## 9. Reservations

Present a date-oriented list/calendar with reservation time, customer name, party size, assigned table, and status. Reservation creation should include required customer/party/time fields and clearly identify conflicts.

Recommended actions: Create, Confirm, Seat, Cancel, Mark No-show. Never imply a booking is guaranteed until it has been saved successfully in SQLite. The interface must make current reservations visible even without network access.

## 10. Kitchen / KOT

Kitchen tickets should prioritize readability and time sensitivity:
- Ticket number, order/table, created time, item quantities, modifiers, notes.
- Clear status: New → Preparing → Ready → Served, where applicable.
- Highlight delayed tickets by elapsed time and configured thresholds.
- Provide large, unambiguous status buttons.
- Printing errors must not remove a ticket from the application.

If kitchen printing and screen-based KOT are both supported, their statuses must stay consistent.

## 11. Checkout, payments, and receipts

Checkout is a high-attention screen. Use a prominent final total and itemized calculation. Present payment methods: **Cash, UPI, Card, Split**. For offline UPI/card, the application records an externally confirmed payment; it must not claim to verify a bank transaction without integration.

For cash:
- Amount due
- Cash received
- Change due, never negative

For split payments, show remaining balance after each payment. Require explicit confirmation before finalizing. After successful database commit, display payment success and offer **Print Receipt**, **Reprint**, and **New Order**. A printer failure must not undo a committed payment or generate a second bill.

## 12. Orders, refunds, and reports

- Orders list: search by bill/order number, table, date, payment status; filters must be visible and resettable.
- Order details: chronological events, items, KOT history, adjustments, payments, receipt actions.
- Refund/void: reason, permission check, confirmation, and visible audit trail.
- Reports: distinguish sales, payments, refunds, and outstanding balances; show the date range and business-day cutoff.
- Exports: show destination and success/failure feedback; do not silently overwrite existing files.

## 13. Forms and validation

- Label all inputs; show required fields and useful examples.
- Validate at the right time: immediately for formatting, on submit for cross-field rules.
- Preserve user input when validation fails.
- Monetary fields should show currency and accept valid decimal precision as defined by business rules.
- Time and date inputs must use local restaurant time and clearly display the selected date.
- For dangerous changes (tax settings, price edits, backup restore), require confirmation and permission checks.

## 14. Keyboard shortcuts and accessibility

Suggested shortcuts (finalize after testing):

| Shortcut | Action |
|---|---|
| Ctrl+K | Focus global command/search |
| F2 | New walk-in order |
| F3 | Open tables |
| F4 | Focus POS item search |
| F8 | Open checkout for current order |
| Esc | Close active dialog/panel where safe |

Never hijack shortcuts while a text input or modal requires them. Provide visible focus rings, logical tab order, descriptive labels, sufficient contrast, and keyboard-operable controls. Avoid automatic focus shifts that interrupt rapid item entry.

## 15. Motion and feedback

Use Motion sparingly for short, purposeful transitions (roughly 120–220 ms for small UI changes). Respect reduced-motion settings.

- Sidebar/panel: smooth open/close without delaying input.
- Dialog: subtle fade/scale; no exaggerated bounce for payment confirmation.
- Item added: brief cart feedback without moving the whole layout.
- Success: clear confirmation tied to persisted state.
- Loading: skeletons for read operations, explicit progress for backups/exports.

No animation should block a cashier from continuing work.

## 16. Empty, loading, error, and offline states

- Empty menu: “No items found” with search reset or add-item action (if permitted).
- Empty orders: contextual explanation, not an error.
- Database busy/unavailable: specific error and retry action; never show a fake success.
- Print failure: “Payment saved; receipt not printed” with retry option.
- Backup failure: show failure and preserve the previous valid backup.
- Restore: warn that existing local data may be replaced; require verification and confirmation.
- Offline is the normal operating mode; do not display persistent “No internet” warnings.

## 17. Staff permissions in the UI

Hide or disable actions the signed-in role cannot perform, but **enforce permissions in the backend as well**. Explain why a disabled action is unavailable where useful. Manager overrides should request authorization without exposing sensitive PIN values. Record consequential actions in the audit log.

## 18. Data safety and persistence cues

For saved orders, show a subtle “Saved” state only after the database confirms success. Avoid optimistic “Paid” or “Printed” states before the operation completes. Use transaction-safe handling for payment and invoice creation. If the app restarts unexpectedly, reconstruct the latest committed order state from SQLite.

## 19. Localization and formatting

Default currency: INR (₹). Format dates, times, decimals, and receipts consistently. Support restaurant-configurable tax labels/rates and receipt details. English UI can be the initial language; do not hardcode UI strings so tightly that later Hindi localization becomes difficult.

## 20. Screen-by-screen acceptance checklist

- [ ] POS allows a cashier to create a walk-in order without table selection.
- [ ] POS allows opening, saving, and resuming a table order.
- [ ] Available tables are visibly green **and** labeled “Available”.
- [ ] Reserved, occupied, and unavailable states are distinguishable without color.
- [ ] Existing KOT items cannot be accidentally reissued as new items.
- [ ] Checkout shows an itemized, consistent total before payment.
- [ ] Cash received and change due are clear and validated.
- [ ] Failed receipt printing does not duplicate payment or invoice.
- [ ] Every primary workflow works with mouse and keyboard.
- [ ] App remains usable at 1366×768 with 125% Windows scaling.
- [ ] Critical operations show real persisted success/failure states.
- [ ] App does not require internet access or external browser pages.

## 21. Decisions to confirm before high-fidelity design

1. Restaurant service type: quick-service, casual dine-in, or mixed.
2. Typical number of tables and menu items.
3. Expected Windows monitor size and whether touchscreens are used.
4. Thermal printer width (58 mm or 80 mm), and kitchen printer availability.
5. Whether table reservations are essential for initial release.
6. Required languages and receipt content.
7. Whether one PC is used initially or multiple terminals will eventually share data.

**Do not silently assume these decisions are final.** Design flexible components and document any interim defaults.

## 22. Related documents

- `01-business-requirements.md` — business scope
- `02-product-requirements.md` — product capabilities and priorities
- `03-functional-specifications.md` — behavioral rules
- `04-user-flows.md` — operational sequences
- `06-design-system.md` — exact tokens and component standards (next)

**Implementation instruction:** Treat this file as a UI/UX contract. If a design choice conflicts with financial accuracy, permission rules, or persisted order state, those safety requirements take precedence.
