# 18 — Error Handling & Recovery Specification

**Product:** Offline Restaurant Billing & Management Desktop Application  
**Platform:** Windows, Tauri 2, React, TypeScript, shadcn/ui, Rust, SQLite  
**Status:** Implementation specification (decisions marked *TBD* require approval)

## 1. Purpose and scope
Define predictable failure handling for dine-in tables, walk-in POS, reservations, kitchen tickets, invoices, payments, printing, staff shifts, database storage, backup/restore, and application updates. The software must remain fully operational without internet access. This document complements `09-database-schema.md`, `10-business-rules.md`, `11-offline-data-management.md`, `12-printing-and-billing.md`, and `13-security-and-permissions.md`.

## 2. Non-negotiable invariants
1. SQLite is the durable source of truth; UI state is not proof of a saved transaction.
2. Never report payment success until the corresponding transaction has committed.
3. A retry must not duplicate an order mutation, payment, invoice, or kitchen ticket.
4. Printing is separate from financial commits: a failed print cannot roll back a valid payment.
5. Historical invoices and payments are immutable; corrections use authorized adjustment/refund records.
6. A failed or partial backup must never replace a known-good backup.
7. A failed restore must leave the existing database recoverable.
8. An available table is green; table status must derive from durable sessions, reservations, and maintenance state, not stale local UI state.
9. Never silently discard an unsaved cart or overwrite another staff member's changes.
10. Any financial ambiguity must be visible as **Needs review**, not silently classified as success or failure.

## 3. Severity classification
| Severity | Meaning | Example | Expected response |
|---|---|---|---|
| S0 — Data integrity | Possible loss, corruption, or duplicate money records | SQLite integrity failure | Stop financial writes, preserve evidence, offer guided recovery |
| S1 — Critical workflow | Billing cannot complete safely | Commit failed | Block completion, show safe retry/status check |
| S2 — Degraded | Work can continue with limitations | Receipt printer offline | Preserve print job, continue billing, show retry |
| S3 — Recoverable input | User can fix immediately | Invalid discount | Inline validation, no destructive action |
| S4 — Informational | No loss of functionality | Backup completed | Brief notification/log |

## 4. Standard error contract
Rust commands should return a structured, safe error shape (never raw SQL, filesystem paths containing personal information, stack traces, or secrets to UI):

```ts
type AppError = {
  code: string;                  // e.g. PAYMENT_ALREADY_RECORDED
  category: 'validation' | 'conflict' | 'permission' | 'storage' | 'printing' | 'recovery' | 'unexpected';
  message: string;               // safe, human-readable
  retryable: boolean;
  correlationId: string;         // links UI event to local diagnostics
  details?: Record<string, string>; // non-sensitive field hints only
};
```

Every error has a stable code, user-facing message, severity, recovery action, and local diagnostic entry. Do not retry commands merely because they returned a generic exception.

## 5. Error catalog and recovery actions
| Code | Trigger | User-facing behavior | Recovery / safeguard |
|---|---|---|---|
| `VALIDATION_FAILED` | Missing/invalid item, guest count, amount | Field-level error | Correct input; no write |
| `PERMISSION_DENIED` | Cashier attempts manager-only action | Explain restricted action | Manager approval or switch account; audit |
| `STALE_ORDER_VERSION` | Order modified elsewhere/in another window | Show current order and differences | Reload and reapply changes; no overwrite |
| `TABLE_NOT_AVAILABLE` | Table occupied/reserved/maintenance | Show current state | Select another table or resolve conflict |
| `RESERVATION_CONFLICT` | Overlapping reservation | Explain conflict | Change time/table; atomic recheck |
| `ITEM_UNAVAILABLE` | Menu item disabled since selection | Highlight affected item | Remove or replace; reprice with confirmation |
| `PRICE_CHANGED` | Menu price changed before confirmation | Show old/new totals | Explicitly accept new price or cancel |
| `KOT_ALREADY_SENT` | Repeat send request | Show existing KOT | Return existing result using idempotency key |
| `PAYMENT_ALREADY_RECORDED` | Repeated payment request | Show existing payment receipt | Return existing transaction, do not charge again |
| `PAYMENT_STATUS_UNKNOWN` | UI lost response during commit | Disable blind retry | Query by operation ID; reconcile before retry |
| `INSUFFICIENT_PAYMENT` | Tender less than payable amount | Show remaining balance | Collect balance or cancel checkout |
| `SHIFT_CLOSED` | Payment posted to closed shift | Block action | Open valid shift or manager workflow |
| `DB_BUSY` | SQLite write contention | Show short progress state | Bounded retry with jitter; then safe error |
| `DB_WRITE_FAILED` | Disk full/read-only/IO failure | Critical alert; don't claim saved | Stop writes, free disk/resolve permissions, retry with same operation ID |
| `DB_INTEGRITY_FAILED` | Integrity check fails | Maintenance mode | Preserve files, restore verified backup under admin control |
| `PRINTER_OFFLINE` | Printer unavailable | Payment remains completed | Queue print and allow manual retry |
| `PRINT_STATUS_UNKNOWN` | Job sent but acknowledgment unavailable | Warn of possible physical print | Ask operator to inspect paper before retry; mark duplicate on reprint |
| `BACKUP_FAILED` | USB removed/no space/IO failure | Explain incomplete backup | Keep prior valid backup; retry elsewhere |
| `BACKUP_INVALID` | Verification failed | Reject backup | Do not publish backup as complete |
| `RESTORE_FAILED` | Invalid backup/migration/IO error | Block reopening corrupted state | Restore pre-restore snapshot; show diagnostics |
| `MIGRATION_FAILED` | App upgrade incompatible | Stop launch into write mode | Roll back app version or recover from pre-migration backup |

## 6. Operation IDs, idempotency and reconciliation
Generate a UUID **before** a financial or externally visible operation. Persist it with a unique database constraint. The same UUID must be reused after timeout, crash, or UI retry; a fresh UUID indicates a genuinely new action. Within a single SQLite transaction, validate current state, apply mutation, record the operation result, and commit. Return the already committed result when the UUID exists.

For `PAYMENT_STATUS_UNKNOWN`, the UI must query `get_operation_status(operationId)` first. Possible states: `committed`, `not_found`, `in_progress`, `needs_review`. Only `not_found` after an authoritative database check may be retried using the **same** ID. External UPI/card settlement cannot be assumed confirmed by the offline application: record only the operator-verified status and distinguish recorded tender from verified external settlement.

## 7. Checkout and cash billing failure sequence
1. User reviews items, tax, discount, and total; frontend validates tender.
2. Backend revalidates staff permissions, active shift, order version, and amounts.
3. Backend transaction records payment, invoice/receipt linkage, shift movement, and relevant order/table transition atomically.
4. UI displays success **only after commit** and then queues receipt printing.
5. If the response is lost, look up the operation ID; do not accept a second payment blindly.
6. If printing fails, show **Paid — receipt pending** and preserve a persistent print job.
7. If change is owed for cash, show cash received and change due clearly; never conflate change with revenue.

## 8. Orders, tables and reservations
- **Walk-in:** unsaved cart changes may be kept in memory but must be clearly marked until persisted. Prompt before destructive navigation. Confirmed order mutations are durable.
- **Dine-in:** table becomes occupied when an active dining session is durably opened; checkout frees it only after all applicable bills/sessions are settled or explicitly transferred.
- **Concurrent actions:** use optimistic version numbers or equivalent conditional updates, even on one PC with multiple windows.
- **Reservations:** check overlap within the same transaction that saves a booking. A reservation does not automatically mean the table is occupied.
- **Table transfer/merge/split:** apply all related changes transactionally; show rollback-safe errors and do not partially move items.

## 9. Kitchen tickets and printing
- Persist each KOT and its print job before sending bytes to the printer.
- Track states such as `queued`, `sending`, `printed` (only with reliable acknowledgment), `failed`, `unknown`, and `cancelled`.
- An OS spooler acknowledgment is **not** proof paper printed; use `unknown` when physical delivery cannot be established.
- Retry uses the same ticket ID; print a visible **REPRINT** marker when reprinting a possibly printed ticket.
- Amendments and cancellations create distinct kitchen messages referencing the original KOT; never silently edit previously dispatched paper tickets.
- Configure separate kitchen and billing printers; allow staff to retry individual jobs.

## 10. SQLite reliability and startup recovery
- Enable foreign keys, configure a bounded busy timeout, and use WAL mode when suitable for the local filesystem.
- Use transactions for all multi-record business mutations and explicit unique/check constraints.
- Store live database in a writable per-user/per-machine application data directory, **not** inside installed program files or a USB drive.
- On startup, check schema version, unfinished migrations, outstanding operation IDs, print jobs, and prior unclean shutdown marker.
- Run `PRAGMA quick_check` as a lightweight diagnostic when appropriate; run a full `integrity_check` during maintenance/recovery. Do not treat a successful quick check as a guarantee of no data loss.
- For `SQLITE_FULL`, `SQLITE_IOERR`, or corruption: block further financial writes, preserve logs, and guide recovery. Do not auto-delete WAL or SHM files.
- Power-loss durability depends on hardware/filesystem behavior; document the remaining risk and recommend a UPS.

## 11. Backup, restore and migration failures
**Backup:** use SQLite's online backup API or `VACUUM INTO` where appropriate, not a naive copy of a live WAL database. Write to a temporary destination, verify integrity and metadata, then atomically publish a completed backup where supported. Keep prior verified backups; detect USB removal and disk-full conditions.

**Restore:** require admin authentication and explicit confirmation, verify backup checksum/integrity and compatible schema, close database connections, create a verified pre-restore snapshot, restore to a temporary location, validate it, then switch safely. If validation fails, revert to the original state. Reopen only after success; record restore event in a separate durable recovery log where feasible.

**Migrations:** version each migration, test on copies of real-world sample databases, make a pre-migration backup, and fail closed on incompatible schema. SQLite DDL migrations should be transactional where possible. Never assume downgrading the binary can safely open a newer schema.

## 12. UI/UX error presentation
Use shadcn/ui field errors for validation, toasts for low-risk transient notifications, persistent inline banners for degraded printer/backup status, and blocking dialogs only for critical financial ambiguity or recovery. Use plain-language action labels such as **Check payment status**, **Retry receipt**, **Choose backup location**, and **Open recovery details**. Preserve typed values after validation failures. Avoid infinite spinners and repeated toast storms. Include keyboard focus management and screen-reader announcements.

## 13. Local diagnostics and privacy
Store structured logs locally with timestamp, severity, error code, correlation ID, operation ID, app/schema versions, and sanitized context. Never log passwords, PINs, full payment identifiers, or customer contact details unnecessarily. Rotate logs with configurable retention and support an admin-only diagnostics export. Financial audit logs must be separate from disposable technical logs.

## 14. Permissions and sensitive recovery
Refunds, voids, manual invoice adjustments, backup restore, database maintenance, and security-setting changes require explicit role checks in Rust. Record actor, timestamp, reason, original record reference, and resulting action. A PIN prompt in React is not sufficient authorization on its own.

## 15. Test matrix — required scenarios
| ID | Scenario | Expected outcome |
|---|---|---|
| ER-01 | Double-click Pay | Exactly one payment and invoice |
| ER-02 | Kill app after payment commit but before UI response | Status lookup returns committed payment |
| ER-03 | Kill app before transaction commit | No partial payment/invoice |
| ER-04 | Disconnect receipt printer | Payment saved, print job pending |
| ER-05 | Spooler accepts job but paper jams | Unknown print status; cautious reprint |
| ER-06 | Send same KOT twice | One logical KOT, no duplicate database record |
| ER-07 | Disk fills during write | Clear error, no false success |
| ER-08 | Two windows modify one order | Version conflict; no lost update |
| ER-09 | Two bookings overlap | Second booking rejected atomically |
| ER-10 | Remove USB during backup | Incomplete file rejected; prior backup remains |
| ER-11 | Restore invalid archive | Existing database unchanged |
| ER-12 | Fail schema migration | Application does not write to incompatible schema |
| ER-13 | Crash while table is occupied | Table/order recovered correctly |
| ER-14 | Cashier attempts refund | Denied and audited |
| ER-15 | Restart with queued print jobs | Jobs visible for controlled retry |
| ER-16 | Run with network adapter disabled | Core operations remain functional |
| ER-17 | Power-loss simulation on test device | Recovery path verified, no false guarantees |
| ER-18 | Change menu price during active order | Historical line price preserved; explicit policy applied |

## 16. Acceptance criteria
- No duplicate financial writes under repeated input, timeouts, or restart.
- No paid invoice is lost merely because a printer failed.
- A failed restore/migration does not silently replace a working database.
- Every recoverable error provides a concrete next action.
- Every critical error has a stable code and diagnostic correlation ID.
- The app can recover a live dine-in session and pending print jobs after restart.
- All test cases above pass on the **packaged Windows build**, including actual supported printer hardware where available.

## 17. Decisions to confirm before production
1. **TBD:** Exact auto-backup frequency, retention period, and backup destination.
2. **TBD:** Which printer models/Windows drivers and whether ESC/POS direct output is required.
3. **TBD:** Whether staff may accept partial payments and under what conditions.
4. **TBD:** Policy for menu price changes on open, unsent, and sent orders.
5. **TBD:** Reservation grace period and no-show handling.
6. **TBD:** Local log retention and customer-data retention policies.
7. **TBD:** Whether the system supports multiple simultaneous Windows user sessions or only one operator at a time.
8. **TBD:** Operational policy for confirming offline-recorded UPI/card payments.

## 18. AI coding agent implementation rules
Implement the error contract and operation-status lookup before the payment flow. Add database constraints and transaction tests before UI success notifications. Keep recovery logic in Rust services, with React presenting state and actions. Never hide a backend error behind a generic success toast. Do not invent business policies for TBD decisions; expose them as configuration or request approval. Each feature must include failure-path tests, not just happy-path tests.

## 19. Definition of done
A feature is done only when its successful operation, failed operation, retry, restart recovery, authorization, audit, and user-facing feedback are implemented and verified. For financial features, prove idempotency and transaction atomicity in automated tests.
