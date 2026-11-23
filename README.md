# Restaurant Admin

Fully offline Windows restaurant billing application under development. **Not usable for restaurant operations yet.** Read `PROGRESS.md` for actual completion and verification state.

## Current source

UI choice updated by owner: Animate UI for ready-made animation components and Hugeicons for icons. Motion remains a supporting dependency. New package versions must be resolved and pinned after registry access is restored. The existing page uses Animate UI Fade and the shared provider; future dialogs/sheets should use its shadcn-compatible primitives. Official setup: https://animate-ui.com/docs/installation and https://hugeicons.com/docs/integrations/react/quick-start .

- React/TypeScript desktop foundation with Tailwind 4 tokens, shadcn-style Button primitive, Lucide, reduced-motion support, UI-only Zustand navigation and error boundary.
- Typed Tauri diagnostics command; browser preview explicitly refuses to simulate database access.
- Rust SQLite infrastructure migration, app-data storage, startup checks, WAL/FULL durability settings, newer/unknown schema rejection, single-instance integration.
- SQL migration tests and Rust/React test sources. Native and React tests need dependencies before they can run.

This foundation has no admin login, restaurant CRUD, ordering, financial posting, printing, reporting, backup or restore implementation yet. Recharts is declared for the reporting milestone but no fabricated chart data is displayed.

## Build prerequisites

- Node.js 22.14+ (current Vite 6 selection supports this workstation).
- Rust stable MSVC toolchain, Cargo, Microsoft C++ Build Tools (Desktop development with C++), Windows SDK and WebView2.
- Development-time access to npm/crates and Tauri packaging prerequisites. Installed application operation will be offline.
- Official prerequisite guide: https://v2.tauri.app/start/prerequisites/

## First dependency resolution

No lockfiles exist yet because dependency download failed on this workstation. Do not run `npm ci` until `npm install` has successfully generated the lockfile. Review and retain both lockfiles for reproducible builds.

```powershell
npm install
cargo generate-lockfile --manifest-path src-tauri/Cargo.toml
npm run check:environment
npm run typecheck
npm run lint
npm test
npm run test:source
npm run test:rust
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
npm run check:rust
npm run tauri -- dev
```

## Windows build

```powershell
npm run build
npm run tauri -- build
```

NSIS output is expected under `src-tauri/target/release/bundle/nsis/` after a successful build. **No installer exists yet.** The configuration requests bundling the offline WebView2 installer; build-time availability and clean offline installation still need verification. Release icon/signing, prerequisite pinning, native testing and operational modules remain pending.

## Data safety

The native bootstrap resolves Tauri's application data directory and uses `data/restaurant.sqlite`. It never uses the project directory for operational storage. Existing unrecognized databases fail closed; initialization errors are returned to the UI without resetting the file. A failed initial creation can leave a version-zero file requiring explicit recovery review; it is not automatically deleted.

The single admin, password session and reauthentication policies are approved but not implemented. No authenticated operational commands are exposed in this milestone.

## Documents

`IMPLEMENTATION_PLAN.md`: milestone gates and acceptance mapping.
`DECISIONS.md`: approved policies, contradictions and unresolved rules.
`PROGRESS.md`: implementation and actual test results.
`docs/`: complete original specifications, preserved.
