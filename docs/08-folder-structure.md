# 08 — Project Folder Structure

**Product:** Offline Restaurant Billing & Management Desktop Application  
**Platform:** Windows desktop only  
**Stack:** Tauri 2, React, TypeScript, Vite, Tailwind CSS v4, shadcn/ui, Zustand, Motion, Rust, SQLite  
**Status:** Proposed implementation standard

## 1. Purpose

Define a scalable, feature-first project layout for a single-machine offline restaurant POS. Separate reusable presentation primitives, business features, Rust domain services, database persistence, and native printing. Keep table-wise dine-in orders and walk-in orders distinct at the UI level while sharing the same order, tax, payment, and invoice rules.

## 2. Recommended repository tree

```text
restaurant-management/
├── AGENTS.md
├── README.md
├── package.json
├── package-lock.json
├── tsconfig.json
├── vite.config.ts
├── components.json                  # shadcn/ui configuration
├── index.html
├── .env.example                     # non-secret build configuration only
├── docs/
│   ├── 01-business-requirements.md
│   ├── 02-product-requirements.md
│   ├── 03-functional-specifications.md
│   ├── 04-user-flows.md
│   ├── 05-ui-ux-guidelines.md
│   ├── 06-design-system.md
│   ├── 07-application-architecture.md
│   └── 08-folder-structure.md
├── public/
│   └── app-icon.png
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── app/
│   │   ├── providers/               # app-wide providers, error boundaries
│   │   ├── router/                  # route definitions and guards
│   │   ├── layouts/                 # desktop shell, sidebar, topbar
│   │   └── bootstrap/               # app startup, initialization checks
│   ├── components/
│   │   ├── ui/                      # shadcn/ui generated primitives
│   │   ├── common/                  # shared composed controls
│   │   ├── feedback/                # empty, loading, error states
│   │   └── printing/                # receipt/KOT preview only
│   ├── features/
│   │   ├── auth/
│   │   ├── dashboard/
│   │   ├── tables/
│   │   ├── reservations/
│   │   ├── menu/
│   │   ├── orders/
│   │   ├── pos/
│   │   ├── kitchen/
│   │   ├── billing/
│   │   ├── payments/
│   │   ├── shifts/
│   │   ├── reports/
│   │   ├── staff/
│   │   ├── settings/
│   │   └── backup/
│   ├── lib/
│   │   ├── tauri/                   # typed invoke adapter and error mapping
│   │   ├── format/                  # INR, dates, quantities
│   │   ├── validation/              # shared frontend schemas
│   │   └── utils.ts
│   ├── hooks/                       # generic reusable React hooks
│   ├── stores/                      # UI-only global state (Zustand)
│   ├── types/                       # cross-feature DTOs and shared enums
│   ├── styles/
│   │   ├── globals.css
│   │   └── tokens.css
│   ├── assets/
│   └── test/
│       ├── setup.ts
│       ├── fixtures/
│       └── helpers/
├── src-tauri/
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   ├── capabilities/                # least-privilege Tauri capabilities
│   ├── icons/
│   ├── migrations/                  # numbered SQL migrations
│   ├── src/
│   │   ├── main.rs
│   │   ├── lib.rs
│   │   ├── state.rs                 # application state and DB pool
│   │   ├── commands/               # validated Tauri IPC entry points
│   │   ├── domain/                 # entities, enums, pure rules
│   │   ├── services/               # use cases and transactions
│   │   ├── repositories/           # SQL queries and persistence
│   │   ├── db/                     # initialization, migrations, backup
│   │   ├── printing/               # printer adapters, receipt/KOT layouts
│   │   ├── security/               # authentication, permissions, audit
│   │   ├── errors/                 # typed error model
│   │   └── tests/                  # integration test support
│   └── tests/                       # Rust integration tests
├── tests/
│   └── e2e/                         # desktop E2E flows, if configured
└── scripts/                          # dev and packaging helpers
```

## 3. Standard feature module

Use this pattern for a feature when its complexity warrants it; do not create empty folders merely for symmetry.

```text
src/features/tables/
├── pages/
│   └── TablesPage.tsx
├── components/
│   ├── TableGrid.tsx
│   ├── TableCard.tsx
│   └── TableDetailsDialog.tsx
├── hooks/
│   └── useTables.ts
├── api/
│   └── tables.api.ts              # calls typed Tauri adapter
├── schemas/
│   └── table.schema.ts
├── types.ts
└── index.ts                      # explicit public exports
```

For `pos/`, separate `DineInPOSPage` and `WalkInPOSPage` (or shared POS shell with explicit mode). Shared order calculations and payment posting belong in Rust services, **not duplicated React components**.

## 4. Frontend responsibilities

- `app/`: bootstrapping, routing, layouts, global error boundaries; no restaurant business rules.
- `components/ui/`: vendor-generated shadcn primitives; avoid feature-specific logic and invasive edits.
- `components/common/`: reusable components used by multiple features, e.g., `CurrencyAmount`, `ConfirmActionDialog`.
- `features/*`: own screens, presentation state, feature validation, and IPC calls.
- `lib/tauri/`: one typed IPC gateway, consistent error mapping, no scattered raw `invoke()` calls.
- `stores/`: ephemeral view state (selected table, draft cart, panel state). Do not treat Zustand or localStorage as durable financial storage.
- `types/`: shared API contracts. Do not manually fork conflicting versions of Rust/TS enums.

## 5. Rust backend responsibilities

Example modules:

```text
commands/
  tables.rs, reservations.rs, orders.rs, billing.rs,
  payments.rs, kitchen.rs, reports.rs, backup.rs, printing.rs
services/
  table_service.rs, reservation_service.rs, order_service.rs,
  billing_service.rs, payment_service.rs, shift_service.rs
repositories/
  table_repository.rs, order_repository.rs, payment_repository.rs
```

- **Commands** authenticate/authorize, validate input, invoke services, return typed responses.
- **Services** enforce status transitions, permissions, monetary calculations, and atomic transactions.
- **Repositories** contain SQLite statements; do not embed SQL in React or Tauri commands.
- **Printing adapters** interact with Windows printers; printing status is tracked separately from payment success.
- **Database module** initializes SQLite, applies migrations, checks integrity, and performs safe backups.

## 6. Database and local file placement

Do not write runtime databases under the project repository or installed executable directory. Resolve the Tauri application data directory and create an application-specific data location there. Example logical layout:

```text
<AppData>/RestaurantManagement/
├── restaurant.sqlite3
├── backups/
├── exports/
└── logs/
```

Exact OS-resolved paths depend on application identifier and Tauri path APIs. Store sensitive information only as necessary; never hardcode credentials. Apply schema migrations on startup with rollback/error reporting. For live SQLite backups use the SQLite backup API or an equivalent consistent snapshot mechanism, not a naive copy of an active WAL database.

## 7. Dependency direction

```text
React feature UI → feature API → typed Tauri invoke adapter
                                  ↓
                            Rust command
                                  ↓
                            domain service
                                  ↓
                         repository / printer
                                  ↓
                              SQLite / OS
```

Do not allow UI components to access SQLite directly. Do not allow repositories to depend on React or view state. Keep pure financial calculations testable independently.

## 8. Naming conventions

| Item | Convention | Example |
|---|---|---|
| React component | PascalCase | `PaymentDialog.tsx` |
| React hook | `use` + PascalCase | `useActiveOrder.ts` |
| TypeScript utility | camelCase | `formatCurrency.ts` |
| Feature folder | kebab-case or lowercase, consistently | `reservations/` |
| Rust module/file | snake_case | `payment_service.rs` |
| SQL table/column | snake_case | `order_items`, `created_at` |
| Migration | ordered descriptive filename | `0001_initial_schema.sql` |
| Tests | colocated unit tests; dedicated integration tests | `billing_service_tests.rs` |

Prefer explicit imports through feature public exports; avoid circular feature dependencies. Shared domain DTOs belong in `types/` or a dedicated contracts module, not in unrelated components.

## 9. Important feature boundaries

- **Tables**: floor/table metadata and occupancy state.
- **Reservations**: booking times, guest counts, conflict handling.
- **Orders**: order lifecycle, items, notes, cancellations, dine-in/walk-in context.
- **POS**: fast operator-facing ordering UI; consumes orders/menu/tables.
- **Kitchen**: KOT snapshots and preparation lifecycle.
- **Billing**: invoice snapshots, totals, taxes, discounts.
- **Payments**: payment entries, tender, change, refunds, idempotency.
- **Shifts**: cash drawer opening, closing, expected vs actual cash.
- **Reports**: read-only queries and export workflows.
- **Backup**: integrity check, consistent backup, restore safeguards.

A paid invoice is immutable; corrections use authorized void/refund/adjustment records with audit history. Store money as integer minor units (paise), never floating-point values. Do not mark a table available until the applicable order settlement/release rules are satisfied.

## 10. Example typed IPC boundary

```ts
// src/lib/tauri/client.ts
import { invoke } from '@tauri-apps/api/core';

export async function callDesktop<T>(command: string, payload?: object): Promise<T> {
  return invoke<T>(command, payload);
}
```

```ts
// src/features/tables/api/tables.api.ts
import { callDesktop } from '@/lib/tauri/client';
import type { RestaurantTable } from '../types';

export const listTables = () => callDesktop<RestaurantTable[]>('list_tables');
```

For production, replace unrestricted string command names with a typed command registry and runtime validation where appropriate. Rust is authoritative for authorization and business invariants even when frontend forms validate input.

## 11. Test organization

- React component tests: rendering, keyboard interactions, state handling.
- Rust unit tests: tax rounding, discounts, status transitions, permissions.
- Rust + SQLite integration tests: order persistence, atomic checkout, payment retries, backup restore.
- Desktop end-to-end tests: table order → KOT → checkout → receipt → release; walk-in cash sale; restart recovery.
- Hardware acceptance tests: configured Windows thermal printer and cash drawer (if used).

Use seeded dummy fixtures only in development/test modes. Never silently populate production with fake transactions.

## 12. Implementation sequence

1. Scaffold Tauri + Vite + React + TypeScript; install Tailwind v4 and shadcn/ui.
2. Add application shell, route structure, design tokens, and shared UI components.
3. Implement table grid, menu, POS screens with isolated mock repositories.
4. Define database schema and migrations; establish Rust commands/services/repositories.
5. Replace mock adapters with persistent SQLite-backed commands.
6. Implement atomic checkout, payment records, KOT, receipt printing, and shifts.
7. Add backup/restore, permissions, reports, crash recovery, and installer testing.

Avoid simultaneously maintaining mock and production business logic: use adapters behind stable interfaces and remove obsolete mocks before release.

## 13. AI coding agent rules

1. Read the BRD, PRD, functional specs, user flows, design system, and architecture before implementing major features.
2. Use the feature-first layout; one component per meaningful responsibility.
3. Keep table ordering and walk-in ordering both supported.
4. Never bypass Rust services for financial writes.
5. Never use floating-point money or trust frontend totals for payment capture.
6. Add tests for business invariants and migrations alongside implementation.
7. Do not introduce cloud dependencies, external authentication, or internet-required services.
8. Keep Tauri permissions minimal and avoid unrestricted filesystem/shell access.
9. Use consistent errors and operator-facing recovery actions.
10. Update relevant docs when changing module boundaries or decisions.

## 14. Acceptance checklist

- [ ] Each major module has a clear owner and boundary.
- [ ] UI primitives are separate from feature-specific components.
- [ ] All persistent operations pass through Rust and SQLite.
- [ ] Dine-in, reservations, and walk-in workflows remain distinct but interoperable.
- [ ] Printing, backup, and reporting are isolated behind service interfaces.
- [ ] App builds and starts fully offline on Windows.
- [ ] Money, payments, invoices, and table release have automated tests.
- [ ] No live database is stored in the installation directory.
- [ ] Runtime errors are handled without losing completed transactions.

## 15. Next document

**09-database-schema.md** will specify SQLite entities, foreign keys, indexes, constraints, migrations, financial precision, and audit fields.
