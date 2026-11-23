# Decisions and requirement reconciliation

## Approved by user on 2026-11-22

- UI amendment: use Animate UI ready-made animated primitives/components with shadcn/ui, and Hugeicons for all application icons instead of Lucide. Motion remains Animate UI's underlying dependency and reduced-motion provider. Do not build bespoke dialog/confirmation animations where Animate UI provides them. Bundle all assets locally for offline operation.

- One local admin account only. Multi-staff administration and permission tiers are removed from this release's scope; all protected commands still require a valid backend session.
- Password login, 10-minute idle lock, password re-entry for restore and refunds.
- No application-level database or backup encryption for this release. Salted Argon2id credential hashing remains required.
- GST/taxes, discounts, service charges, and rounding are disabled. No tax invoice compliance claim.
- Partial/pay-later payments disabled. Split tender is allowed only for full settlement in one transaction, as requested in project scope.
- Invoice prefix supplied during setup; continuous sequence with no annual reset. Never reuse issued numbers.
- Printer model/width undecided; actual hardware acceptance remains blocked.

## Technical decisions

- Keep requested feature-first architecture and thin typed Tauri adapters. No HTTP backend, cloud, runtime CDN, or localStorage business persistence.
- Use system UI font fallback initially; no remote font loading.
- SQLite via rusqlite (bundled SQLite), foreign_keys ON, WAL, synchronous FULL, bounded busy timeout. Rust owns reads/writes. Test core without the desktop feature.
- Migrations start with infrastructure only. Add domain tables in their milestone after their policies are reconciled; do not deploy the draft schema wholesale.
- Single-instance plugin prevents two native processes opening independent application sessions.
- User-requested root DECISIONS.md is canonical; docs/decisions.md points here.
- Foundation exposes diagnostics only; no mock restaurant sales, payments, tables, or successful actions.
- Use Vite 6 / React 19 compatible with installed Node 22.14; exact resolved dependencies must be captured in lockfiles once dependency access is available. No lockfile is fabricated.

## Contradictions and proposed resolutions

| Conflict | Resolution / gate |
|---|---|
| docs/03, 09, 10 mix kitchen and order lifecycle states | Before M4, normalize order financial state separately from KOT preparation state; document migration mapping |
| docs/04 tests partial payments, docs/10 excludes them by default | User confirmed partial/pay-later disabled; no partial invoice/table release workflow |
| docs/09 permits multiple orders/session and invoices/order | For baseline use one accumulating order/session and one settlement invoice; advanced split bills remain excluded pending explicit request |
| docs/03 rejects empty saved orders but seating flows create an empty order | Create seating independently; first committed item creates order. Empty seating cancellation must be explicit |
| docs/09 schema lacks tax snapshots, numbering ledger, cash movements, operation ledger and honest print states | Add purpose-specific migrations; preserve paused tax behavior and durable operation/print ledgers |
| docs/09 says refunds reduce outstanding payment balance | Refunds must not reopen a settled bill or occupied table; final refund accounting policy remains pending |
| docs/03 and 12 differ on tax/charge order | Disabled by owner; enabling these later needs approved policy and tests |
| docs/09 has booked reservations, docs/10 pending/confirmed | Reconcile internal state contract before reservation migration |
| docs/05 vs 06 table colors and F4 shortcut | Use design-system colors: green/orange/blue/gray; Ctrl+K search, F2 POS, F3 Tables; defer F4 mapping |
| docs/07 queues print after commit vs 12 durable outbox | Persist pending job in same transaction; do printer I/O only after commit |
| docs/13 suggests encrypted backups, docs/11 leaves encryption open | User approved no app-level encryption |

## Still unresolved

- Refund method, partial refund support, limits, and cancellation conditions for sent KOTs. Do not enable refund posting until settled.
- Reservation duration/buffer/hold window, capacity overrides; 15-minute grace is a documented configurable proposal, not final policy.
- Business-day cutoff (midnight proposed), cash shift scope/variance acknowledgement and open-order carryover.
- Backup cadence/retention and external destination; do not auto-delete backups.
- Actual printer model/width/driver, signing certificate, clean Windows test machine, deployment OS baseline.
- Single admin password-loss recovery procedure; no master password or automatic data reset.

## Environment evidence

- Workspace initially contained only docs/; AGENTS.md is located at docs/AGENTS.md, read completely.
- No existing git repository, application source, dependencies, or lockfiles.
- node v22.14.0; npm 11.2.0.
- cargo/rustc unavailable on PATH; standard .cargo/.rustup and Visual Studio installer locations absent.
- npm ping fails ENOTFOUND registry.npmjs.org; no React/Tauri npm cache found.
