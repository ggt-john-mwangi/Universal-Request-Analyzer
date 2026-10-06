# Universal Request Analyzer — Claude Instructions

## What this project is

A Chrome MV3 extension that captures and analyzes network traffic using an in-browser SQLite
database (sql.js over OPFS). It is evolving into a team SaaS QA platform with cloud auth,
bidirectional sync, and a JS tracking SDK. See `docs/architecture.md` for the full roadmap.

## Documentation rules

- **Architecture and design docs go in `docs/` as `.md` files only.**
- **Do not create `.html` files anywhere in this repo** (the `ura-architecture.html` at the root
  is a leftover — delete it if seen).
- Do not create `README.md` files in subdirectories unless explicitly asked.

## Database rules — non-negotiable

- **Only `db-manager-medallion.js` and its medallion schema.** The legacy `db-manager.js` was
  deleted. Do not recreate it, do not add a fallback to it, do not reference it.
- OPFS filename is `universal_request_analyzer.sqlite`. Do not change it.
- All DB writes go through `DatabaseManagerMedallion`. Never bypass it with a raw sql.js call
  that skips `scheduleSave()`.
- Bronze→Silver runs every 2 min via `chrome.alarms` (`bronzeToSilver`).
  Silver→Gold and data cleanup run daily (`dailyGoldProcessing`, `dataCleanup`).
  **Never replace these with `setInterval` — the SW dies after ~30s idle.**

## Architecture constraints

- **No legacy fallbacks.** If a feature does not work with the medallion stack, fix the
  medallion stack. Do not add an `if (legacyDb)` branch.
- **No stubs for Phase 2/3/4 features.** Cloud API, remote auth, sync managers, and SDK code
  belong in Phase 2+ branches — do not add placeholder files in `src/background/`.
- `chrome.alarms` for all recurring work (not `setInterval`). `onSuspend` for flush-on-kill.
- Content script IPC: batch resource timing entries into one `batchResourceTiming` message per
  page load. Do not send one message per resource.
- Event tracking (clicks, scrolls, form submits) is gated behind the `eventTracking` feature
  flag. It is **off by default**. Do not enable it globally.

## File hygiene

- Before deleting a file, grep for imports. Pattern:
  `grep -rn "from.*<filename>\|require.*<filename>" src --include="*.js"`
- Before adding a new file, check if an existing handler in
  `src/background/messaging/handlers/` covers the message action.
- Tests belong in `src/tests/<area>/`. Test files for deleted modules must also be deleted.
- No `.html` docs, no `README.OLD.md`, no duplicate WASM files.

## Build process

```
npm run dev       # webpack watch (development, inline source maps)
npm run build     # webpack production (minified, outputs dist/ + release/ura.zip)
npm test          # jest
npm run lint      # eslint
```

Webpack entries: `popup`, `options`, `background`, `content`, `devtools`, `panel`.
All assets (WASM, icons, fonts, CSS) are copied via `CopyWebpackPlugin` — they are not bundled
through webpack's module graph. The sql.js WASM lives at `src/assets/wasm/`.

The `src/lib/**/*` glob in `CopyWebpackPlugin` copies shared components as-is (not bundled).
CSS is extracted via `MiniCssExtractPlugin` into `styles.css`.

## Key modules at a glance

| File | Role |
|------|------|
| `background/background.js` | SW entry point — 10-step init |
| `background/database/db-manager-medallion.js` | OPFS init, debounced save, onSuspend |
| `background/database/medallion-manager.js` | Bronze insert, Silver/Gold processing |
| `background/capture/request-capture-integration.js` | webRequest → Bronze |
| `background/messaging/message-router.js` | Dispatches all chrome.runtime.onMessage |
| `background/messaging/handlers/*.js` | 15 granular action handlers |
| `content/content.js` | Page script: vitals, timing, XHR/fetch intercept |
| `config/feature-flags.js` | Flag singleton; broadcasts to content via storage |
| `auth/acl-manager.js` | Local ACL (basic/pro tier gating) |

## Phase 2+ (do not implement until branched)

- Cloud auth: JWT + OAuth2 via `background/auth/remote-auth-service.js` (deleted stub, rewrite
  from scratch in a feature branch)
- Bidirectional sync: Gold aggregates → cloud, config ← cloud
- Multi-tenant: every DB table gets `tenant_id` + `workspace_id`
- SDK: standalone `URA.track()` / `URA.identify()` browser snippet + Node.js package

## WASM loading

`src/lib/sql-wasm.js` and `src/lib/sql-wasm.wasm` were stale copies — never imported by
any live file. **Do not recreate them.** The real files are at `src/assets/wasm/` and are
loaded by `sql-js-loader.js`:

```js
import initSqlJsModule from "../../assets/wasm/sql-wasm.js";  // assets/wasm — not lib/
```

CopyPlugin copies `assets/wasm/**/*` to `dist/assets/wasm/` at build time.

## Known vulnerabilities (dev toolchain only)

After Oct 2026 cleanup: 0 critical, 58 total (4 low / 15 moderate / 39 high).
All remaining are in dev toolchain (webpack-dev-server, jest) — they do not affect the
extension bundle shipped to users. Do not run `npm audit fix --force`; it breaks jest.

Remaining unfixable: `crypto-browserify` → `pbkdf2` / `sha.js` — these are polyfills
webpack injects for the Node.js code path inside `sql-wasm.js`. That code path is never
reached in the browser (it branches on `typeof process`). Low real-world risk.

Fixed in Oct 2026: upgraded `msw` 1.x → 2.x (removed `form-data` criticals);
`npm audit fix` patched `ws` and `websocket-driver`.
Babel: replaced deprecated `@babel/plugin-proposal-*` with `@babel/plugin-transform-*`.

## TS diagnostics (pre-existing, do not regress)

Lines 235, 422, 436 of `background.js` have `await` on sync sql.js calls (upstream library
issue). Line 581 has an unused `url` variable in the export handler. These are known, not
introduced by recent changes.
