# 06 — Design System

**Product:** Offline Restaurant Billing & Management Desktop Application  
**Platform:** Windows desktop (Tauri 2)  
**Frontend:** React, TypeScript, Tailwind CSS v4, shadcn/ui  
**Status:** Proposed design specification — validate against the UI/UX guidelines before implementation.

## 1. Purpose

Provide a consistent, accessible, keyboard-friendly visual language for POS, dine-in tables, reservations, kitchen tickets, billing, reporting, and settings. Optimize for speed and legibility during busy restaurant shifts rather than decorative dashboards.

## 2. Design principles

- **Operational clarity:** Show the next action and current status without guesswork.
- **Fast interaction:** Common actions are prominent; avoid unnecessary dialogs.
- **Financial confidence:** Totals, payment status, and change due must be unambiguous.
- **Consistent feedback:** Every save, print, and payment operation has visible pending/success/failure states.
- **Offline-first:** Never imply an internet connection is required for local operations.
- **Accessible:** Keyboard, focus rings, text labels, contrast, and non-color status indicators.

## 3. Visual direction

Clean, calm, contemporary desktop software. Default **light theme**, optional dark theme. Neutral surfaces with one strong brand accent. Avoid excessive gradients, pill-shaped labels, oversized cards, dense shadows, or gratuitous motion. Food photography is optional in the POS grid and must not slow down billing.

## 4. Color tokens

Use semantic tokens instead of hard-coded component colors. Values below are a proposed baseline and may be adjusted after visual review.

| Token | Light | Dark | Use |
|---|---|---|---|
| Background | `#F8FAFC` | `#0B1220` | App canvas |
| Surface | `#FFFFFF` | `#111C2E` | Panels, cards |
| Surface subtle | `#F1F5F9` | `#1A2940` | Hover/subsections |
| Foreground | `#0F172A` | `#F8FAFC` | Primary text |
| Muted text | `#64748B` | `#94A3B8` | Secondary text |
| Border | `#E2E8F0` | `#29384D` | Dividers |
| Primary | `#2563EB` | `#60A5FA` | Main actions |
| Primary contrast | `#FFFFFF` | `#0B1220` | Text on primary |
| Destructive | `#DC2626` | `#F87171` | Irreversible actions |
| Success | `#15803D` | `#4ADE80` | Successful operations |
| Warning | `#B45309` | `#FBBF24` | Attention |
| Focus ring | `#2563EB` | `#93C5FD` | Keyboard focus |

### Table status tokens

| Status | Color | Visible label | Meaning |
|---|---|---|---|
| Available | Green | Available | No active seating/order or reservation conflict |
| Occupied | Orange | Occupied | Seated party or active dine-in order |
| Reserved | Blue | Reserved | Future or imminent reservation |
| Unavailable | Gray | Unavailable | Disabled/maintenance |
| Needs attention | Red accent | Attention | Exceptional state, e.g. overdue or failed action |

**Rule:** Color alone must never communicate status. Every table tile includes text and an accessible label. Reservation conflicts take precedence over an otherwise available state; precise status precedence belongs in `10-business-rules.md`.

## 5. Typography

- Font: `Inter`, with system UI fallbacks; bundle locally so the app works offline.
- Base body: 14px / 20px; primary desktop controls: 14–16px.
- Page title: 24px / 32px, weight 650–700.
- Section title: 18px / 26px, weight 600.
- Card title: 16px / 24px, weight 600.
- Secondary metadata: 12–13px, never for critical totals.
- Currency totals: 24–32px, tabular numerals (`font-variant-numeric: tabular-nums`).
- Use `₹` and locale-aware `en-IN` number formatting. Do not round monetary calculations using floating-point arithmetic.

## 6. Layout and spacing

- Spacing scale: 4, 8, 12, 16, 20, 24, 32, 40px.
- Sidebar: approximately 232–256px expanded; compact mode optional.
- Header: 56–64px; keep active shift and current staff visible where relevant.
- Main content padding: 20–24px on typical desktops; 12–16px on narrow windows.
- Border radius: 8px controls, 10–12px panels, 12px dialogs.
- Use subtle 1px borders; shadows only where elevation matters.
- Target minimum comfortable interactive area: 40×40px; high-frequency POS controls ideally 44–48px.
- Support 1366×768 as a practical baseline; avoid horizontal scrolling in checkout.

## 7. Navigation patterns

Primary sidebar items: Dashboard, POS, Tables, Reservations, Kitchen, Menu, Reports, Staff (permission dependent), Settings. Keep **POS** and **Tables** independently accessible. The POS offers two explicit order modes: **Dine-in (table-linked)** and **Walk-in (no table)**. Preserve active drafts on navigation; show unsaved-change warnings only when needed.

## 8. Component inventory

Use shadcn/ui primitives where suitable, composed into domain-specific components.

| Domain component | Requirements |
|---|---|
| `StatCard` | Label, value, comparison, optional trend; never rely on chart alone |
| `TableTile` | Table number, capacity, status text, current bill/elapsed time when relevant |
| `ReservationRow` | Guest, time, party size, assigned table, state, actions |
| `MenuItemCard` | Name, price, availability, optional image, add action |
| `OrderLine` | Item, variant, quantity, modifiers, unit price, line total, remove/edit |
| `OrderSummary` | Subtotal, discount, charges, taxes, rounding, grand total |
| `PaymentPanel` | Method, tendered amount, change, remaining balance, confirmation |
| `KOTTicket` | Ticket number, table/walk-in reference, items, timestamps, preparation state |
| `ReceiptPreview` | Print-width-safe invoice preview and reprint indication |
| `ShiftSummary` | Opening cash, cash sales, refunds, expenses/adjustments, expected vs counted |

Use `Button`, `Input`, `Select`, `Dialog`, `AlertDialog`, `Sheet`, `Tabs`, `Table`, `DropdownMenu`, `Tooltip`, `Toast/Sonner`, `Skeleton`, and `Form` consistently. Avoid creating multiple competing styles for the same action.

## 9. Screen-specific patterns

### Dashboard

Display shift context, revenue, order counts, occupied tables, pending kitchen tickets, and actionable exceptions. Charts are secondary to operational actions.

### Tables

Responsive grid of table tiles. **Available tables are green** and visibly labeled. Clicking an available table starts seating/order creation; clicking an occupied table opens its current order. Reservations are accessible without hiding the table grid. Never silently overwrite an existing table order.

### POS

Desktop layout: category/search and item grid on the left, persistent order summary and checkout on the right. Search field receives focus via shortcut. Add-to-cart must be immediate, and quantity controls must be large. Display table number for dine-in and “Walk-in” for counter orders. Prevent accidental checkout of an empty cart.

### Kitchen

High-contrast, easy-to-scan tickets with elapsed time, item modifiers, and clear state transitions. Do not use animation that makes tickets jump while staff are reading.

### Checkout

Make **grand total**, **amount received**, **change due**, and **remaining balance** distinct. Confirm before finalizing payment. Disable repeated submission while processing, and use idempotent persistence at the backend layer. Printing failure must not reverse an already committed payment.

### Reports

Show selected date/shift, totals, filters, and export actions. Differentiate gross sales, discounts, taxes, refunds, and net collection. Use tables with aligned currency columns and clear empty states.

## 10. Forms and validation

- Labels above fields; helper text only where needed.
- Required fields marked in text and programmatically.
- Validate on submit and after interaction, not aggressively on every keystroke.
- Error messages specify what to fix (e.g., “Received amount cannot be less than amount due”).
- Use a currency input with fixed decimal precision in storage; never trust formatted UI strings for arithmetic.
- Confirm destructive actions such as voiding a bill, deleting menu items, or restoring a backup.

## 11. Interaction and motion

- Hover/focus feedback: 100–150ms.
- Dialog/sheet entry: 160–220ms, subtle opacity and small translation/scale.
- Page transitions: 120–180ms; avoid large directional movement.
- Respect `prefers-reduced-motion` and disable nonessential motion.
- No animation delays on item addition, tender entry, or order submission.
- Use Motion only where it improves state comprehension; default to CSS transitions for simple states.

## 12. Keyboard and accessibility

Suggested shortcuts (finalize in settings/help and avoid OS conflicts):

| Shortcut | Action |
|---|---|
| `Ctrl+K` | Focus POS item search |
| `F2` | Open POS |
| `F3` | Open Tables |
| `F4` | Open Reservations |
| `F8` | Open checkout for active order |
| `Esc` | Close current dialog/drawer |

Visible focus ring, logical tab order, Escape handling, accessible dialog titles, and descriptive button labels are mandatory. Do not override text zoom. Verify contrast against WCAG AA where feasible.

## 13. Loading, empty, success, and failure states

- **Loading:** Small skeletons for reports; never conceal already loaded order lines.
- **Empty:** Clear explanation plus primary next action (e.g., “No active orders — Start walk-in order”).
- **Success:** Non-blocking confirmation with invoice/order reference.
- **Failure:** Explain whether the operation was saved and provide retry/recovery action.
- **Printer unavailable:** Show “Payment saved; receipt not printed” with Retry Print.
- **Database error:** Block unsafe actions; preserve context and provide recovery instructions.
- **Offline:** No recurring “connection lost” warnings because local operation is normal.

## 14. Design tokens — implementation example

For Tailwind v4, map semantic CSS custom properties to Tailwind theme variables using `@theme inline`. The following is a conceptual starting point, not a drop-in replacement for shadcn's generated theme:

```css
:root {
  --app-bg: #f8fafc;
  --app-surface: #ffffff;
  --app-text: #0f172a;
  --app-border: #e2e8f0;
  --app-primary: #2563eb;
  --table-available: #15803d;
  --table-occupied: #b45309;
  --table-reserved: #2563eb;
  --table-unavailable: #64748b;
}

.dark {
  --app-bg: #0b1220;
  --app-surface: #111c2e;
  --app-text: #f8fafc;
  --app-border: #29384d;
  --app-primary: #60a5fa;
  --table-available: #4ade80;
  --table-occupied: #fbbf24;
  --table-reserved: #60a5fa;
  --table-unavailable: #94a3b8;
}

@theme inline {
  --color-app-bg: var(--app-bg);
  --color-app-surface: var(--app-surface);
  --color-app-text: var(--app-text);
  --color-app-border: var(--app-border);
  --color-app-primary: var(--app-primary);
}
```

Maintain compatibility with the shadcn/ui theme variables generated in the actual project; do not create parallel conflicting sources of truth.

## 15. Acceptance checklist

- [ ] All primary screens use the same typography, spacing, controls, and tokens.
- [ ] Available table tiles are green and include the word “Available”.
- [ ] Dine-in and walk-in orders are both discoverable within two actions.
- [ ] Order summary and grand total remain visible during POS operations.
- [ ] Payment screen clearly shows tendered amount, change, and balance.
- [ ] Focus states and keyboard navigation work without a mouse.
- [ ] Critical status is never indicated by color alone.
- [ ] Printer failure messaging distinguishes saved payment from print failure.
- [ ] UI remains usable at 1366×768 and with increased text size.
- [ ] Reduced-motion settings are respected.
- [ ] Fonts, icons, and other essential assets load without internet.

## 16. Decisions to confirm

1. Restaurant brand name/logo and whether a branded accent color is desired.
2. Light-only versus user-selectable dark mode.
3. Touchscreen support versus keyboard-and-mouse as the primary input.
4. Primary receipt widths (58mm, 80mm, or both).
5. Whether menu images are used or a text-first POS grid is preferred.
6. Final shortcut mapping and whether staff may customize it.

## 17. Related documents

- `01-business-requirements.md` — Business goals and modules.
- `02-product-requirements.md` — Product scope and acceptance criteria.
- `03-functional-specifications.md` — Exact behaviors and validation.
- `04-user-flows.md` — End-to-end restaurant workflows.
- `05-ui-ux-guidelines.md` — Interaction and screen layout principles.
- `10-business-rules.md` — Authoritative status and financial rules (forthcoming).

**Implementation rule:** This design system controls presentation, not financial calculations, data integrity, permissions, or order state transitions. Those must be enforced in the backend/domain layer.
