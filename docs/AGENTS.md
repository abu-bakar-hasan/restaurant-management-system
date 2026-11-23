# AGENTS.md — Offline Restaurant Billing & Management

> Repository-level operating instructions for AI coding agents. Read this file before editing code. This file is an index and enforcement layer, **not** a replacement for the detailed specifications in `docs/`.

## 1. Product mission

Build a **Windows-only, fully offline restaurant POS, billing, and management desktop application**. Restaurant staff must be able to take dine-in orders against tables, handle **walk-in / counter orders without tables**, reserve tables, send kitchen order tickets (KOT), accept and record payments, print receipts, reconcile cash shifts, and access reports. Data must persist locally and survive application restarts. Never remove table-wise management in favor of walk-in POS, or vice versa.

## 2. Fixed technology and deployment constraints

**Owner amendment (2026-11-22):** Animate UI is the animation component library and Hugeicons replaces Lucide throughout the application. Keep shadcn/ui and Motion as supporting foundations. This overrides older icon/animation references below and in the numbered documents.

- Desktop shell: **Tauri 2**, packaged for Windows; no browser-hosted product as the final deliverable.
- Frontend: **React, TypeScript, Vite, Tailwind CSS v4, shadcn/ui**; Lucide icons; Motion for restrained transitions.
- Client state: **Zustand** for ephemeral UI state, not authoritative financial data.
- Backend: **Rust** with Tauri command interfaces; authoritative domain rules and permission checks live here.
- Persistence: **SQLite**, stored in the application's writable per-user/per-install data location; schema migrations are versioned.
- **No cloud, external API, hosted authentication, remote database, internet requirement, or mandatory online licensing** in core workflows.
- Do not replace the stack, introduce a server, or add a major dependency without explaining the trade-off and obtaining approval.

## 3. Documentation map

The project documentation is expected in `docs/` with the following filenames. The original business brief is `docs/01-business-requirements.md` (source filename: `restaurant_management_business_requirements.md`). If the files have not yet been moved into `docs/`, locate them at the repository root rather than pretending they are missing.

| Document | Read when working on… |
| --- | --- |
| `01-business-requirements.md` | Overall business purpose and scope |
| `02-product-requirements.md` | Features, scope, priorities, acceptance criteria |
| `03-functional-specifications.md` | Exact feature behavior and validations |
| `04-user-flows.md` | Operational journeys and status transitions |
| `05-ui-ux-guidelines.md` | Screen layout, interaction, accessibility |
| `06-design-system.md` | Tokens, themes, typography, shadcn/ui styling |
| `07-application-architecture.md` | System boundaries, Rust/React/SQLite integration |
| `08-folder-structure.md` | Feature modules, naming, dependency direction |
| `09-database-schema.md` | Entities, constraints, indexes, migrations |
| `10-business-rules.md` | Financial and operational invariants |
| `11-offline-data-management.md` | SQLite lifecycle, backup, restore, recovery |
| `12-printing-and-billing.md` | Receipts, KOT, printer queues, invoice formats |
| `13-security-and-permissions.md` | Staff roles, authentication, authorization, audits |
| `14-testing-strategy.md` | Test coverage, release gates, hardware validation |
| `15-development-roadmap.md` | Phases, dependencies, milestone gates |
| `16-ai-agent-instructions.md` | Detailed coding-agent procedures |
| `17-screen-inventory-navigation-map.md` | Routes, dialogs, drawers, navigation |
| `18-error-handling-and-recovery.md` | Failure classification, retries, recovery UX |
| `19-deployment-and-installation-guide.md` | Windows builds, installation, updates, handover |

**Before implementing a task:** read this file, then the relevant sections of `02`, `03`, `07`, `10`, `16`, and any feature-specific documents above. Do not load all documents blindly when a focused subset suffices.

## 4. Conflict resolution and unanswered decisions

1. User's latest explicit decisions take precedence over older documentation.
2. Preserve agreed constraints: Windows desktop only; fully offline; both dine-in tables and walk-in orders; Tauri/React/Rust/SQLite/shadcn/ui.
3. For other conflicts, **flag the discrepancy and propose a resolution** before implementing irreversible schema, accounting, security, or billing behavior. Do not silently choose whichever document you read last.
4. Specifications contain *open decisions*, not permissions to invent policy. Confirm applicable GST treatment, invoice numbering, service charge, rounding, split-bill behavior, refund approvals, and printer hardware before production implementation. Make policy configurable only where documents authorize it.
5. Record approved decisions in the relevant specification and, when useful, an architecture decision record (ADR). Never imply unconfirmed tax or compliance behavior is legally correct.

## 5. Architectural rules

- **React** renders UI, handles user input, and invokes typed commands; it does not own authoritative order, invoice, payment, or table status.
- **Rust** validates inputs, checks role permissions, applies business rules, and coordinates database transactions, printing jobs, and backup operations.
- **SQLite** is the source of truth. Use foreign keys, constraints, indexes, migrations, and transactions; never store canonical financial data in localStorage.
- Separate feature modules (`tables`, `reservations`, `menu`, `orders`, `pos`, `kitchen`, `billing`, `payments`, `shifts`, `reports`, `settings`) while sharing domain services where appropriate.
- Keep Tauri IPC contracts typed, narrow, and version-conscious. Return structured errors; never expose arbitrary SQL execution or unrestricted filesystem access to the frontend.
- Avoid monolithic components, duplicated calculations, and cross-feature imports that violate documented boundaries.

## 6. Non-negotiable business invariants

- **Two order entry paths:** dine-in orders tied to table sessions, and walk-in orders with no table requirement. Both use the **same backend billing and payment logic**.
- Available tables appear **green**; occupied, reserved, and unavailable states must be visually distinguishable and have accessible text labels.
- Persist menu price/tax snapshots on historical order/invoice records; later menu edits must not rewrite completed invoices.
- Store monetary values as **integer paise**; do not use floating-point money arithmetic. Apply documented rounding and tax rules consistently.
- Invoice issuance, payment recording, refunds, table release, and cash reconciliation must preserve referential and transactional integrity.
- Make payment and invoice actions safe against duplicate clicks, retries, and process restarts (e.g., idempotency keys and uniqueness constraints).
- Do not mark a bill paid based only on a frontend success animation or a successful print call.
- KOTs represent kitchen work; distinguish newly sent items, amendments, and cancellations to avoid silent or duplicate kitchen instructions.
- **Printer failure must never roll back a legitimately committed payment.** Persist print jobs and allow safe retry/reprint with an audit trail.
- Enforce staff permissions in Rust, including overrides, voids, refunds, and sensitive settings changes.

## 7. UI/UX execution rules

- Use shadcn/ui primitives and the project's design tokens rather than inventing a second component system.
- Optimize the POS for fast desktop use: prominent search, clear menu categories, rapid quantity controls, readable totals, keyboard support, and unambiguous checkout confirmation.
- Preserve separate, clearly accessible entry points for **Tables / Dine-in** and **Quick Order / Walk-in**.
- Every screen needs realistic loading, empty, error, and success states; every destructive action needs an appropriate confirmation/authorization flow.
- Prefer restrained, purposeful Motion transitions; animations must not delay rapid billing or hide important status changes.
- Do not add unnecessary decorative cards, badges, icons, or dashboard clutter. Follow `05` and `06` for spacing, visual hierarchy, accessibility, and table-state semantics.
- Prototype screens may use clearly labeled dummy data, but do not present mocked transactions as working persistent billing.

## 8. Reliability, data safety, and printing

- Configure SQLite according to the storage specification, including transaction safety and foreign key enforcement. Do not copy an active WAL database file as an ad hoc backup; use an approved consistent SQLite backup mechanism.
- Backup and restore must be verified and must not silently overwrite the only good copy. Test interruption, low disk space, invalid backup, and app restart scenarios.
- Never delete user data as a side effect of reinstall, upgrade, reset, or failed migration without explicit authorization and a recovery plan.
- Keep operational audit events for financial adjustments and privileged actions. Avoid logging passwords, PINs, or unnecessary customer information.
- Treat thermal printer availability as fallible. Verify supported Windows printer paths and receipt widths on actual hardware; do not claim 58mm/80mm compatibility from a browser preview alone.
- Recover pending orders and persisted print jobs after crashes without duplicating invoices, payments, or KOTs.

## 9. Task execution protocol

For each requested implementation task:

1. **Inspect** the existing repository, relevant docs, dependencies, and current implementation before changing files.
2. **State scope**: affected modules, assumptions, acceptance criteria, and any unresolved business decisions.
3. **Implement incrementally** in the existing architecture; avoid unrelated refactors.
4. **Validate** TypeScript, Rust compilation, formatting/linting, tests, and relevant database migrations; use actual project scripts where available rather than inventing commands.
5. **Test realistic scenarios** including invalid inputs, repeat submissions, permission failures, and restart/recovery for financial changes.
6. **Report** files changed, behavior implemented, checks run and results, untested hardware-dependent behavior, and outstanding decisions.

Do not claim tests passed unless they actually ran. If tooling, hardware, or project files are unavailable, say exactly what could not be verified.

## 10. Testing and completion gates

A feature is complete only when its documented acceptance criteria are met, it respects permission checks and financial invariants, and it has appropriate automated or manual verification. In particular, test:

- Table available → occupied → billed → available; reservations and conflicts.
- Walk-in checkout with no table assignment.
- Order edits and KOT amendments without duplicate kitchen tickets.
- Exact cash received, change due, split tenders, tax/discount calculations, and refunds.
- Duplicate payment attempts, printer offline/retry, process termination, and app restart.
- SQLite migration, consistent backup, restore verification, and offline Windows installer behavior.

Follow `14-testing-strategy.md` for full coverage and `15-development-roadmap.md` for release gates. Real printer tests and packaged Windows desktop tests are required before production claims.

## 11. Implementation order

Follow the roadmap's dependencies: (0) reconcile requirements → (1) Tauri/repository foundation → (2) design system and interactive frontend → (3) Rust/SQLite persistence → (4) menu, tables, reservations → (5) orders and KOT → (6) billing, payments, shifts → (7) printing and reports → (8) security, backup, recovery → (9) QA/pilot → (10) Windows release. Do not defer fundamental transactional integrity until after payment features are built.

## 12. Agent handoff checklist

Before ending a task, communicate:

- What changed and which requirements it satisfies.
- What was tested, with actual outcomes.
- What is still mocked, blocked, unverified, or awaiting a business decision.
- The next smallest logical implementation step.

**Core principle:** Restaurant staff must be able to operate quickly and confidently while the software protects money, orders, and local records even when printers fail, power is interrupted, or the application restarts.
