# Universal Request Analyzer — Architecture & Roadmap

## What is URA

A Chrome MV3 extension that captures every network request made by the browser,
enriches it through a three-layer SQLite pipeline, and surfaces performance analytics
in a popup, options dashboard, and DevTools panel.

Target evolution: a team SaaS QA platform with cloud auth, bidirectional sync, and a
first-party JS tracking SDK.

---

## Current Stack

| Layer | Technology |
|-------|-----------|
| Extension runtime | Chrome MV3 Service Worker |
| Storage | OPFS (Origin Private File System) — `universal_request_analyzer.sqlite` |
| Database | sql.js (WASM SQLite in SW heap) |
| Data pipeline | Medallion Architecture (Bronze → Silver → Gold) |
| Scheduling | `chrome.alarms` (survives SW restarts) |
| Build | Webpack 5, Babel, Jest |

---

## Execution Contexts

```
Browser
├── Service Worker (background.js)         ← can be killed after ~30s idle
│   ├── OPFS SQLite (medallion DB)         ← persists across SW restarts
│   ├── chrome.alarms                      ← persists across SW restarts
│   └── message-router.js                  ← handles all chrome.runtime.onMessage
│
├── Content Script (content.js)            ← injected into every page
│   ├── XHR/fetch intercept (size only, no body read)
│   ├── PerformanceObserver (resource timing, 500ms debounce)
│   ├── Core Web Vitals (LCP, FID, CLS, FCP, TTFB, DCL, Load, TTI)
│   └── Event tracking (clicks/scrolls — off by default, feature-flagged)
│
├── Popup (popup.js)                        ← quick stats + capture toggle
├── Options (options.js)                    ← full settings + dashboard
└── DevTools Panel (panel.js)              ← request inspector
```

SW kill resilience:
- `scheduleSave()` — 5s debounce coalesces Bronze inserts into one OPFS write
- `onSuspend` handler — synchronous flush before Chrome kills the SW
- All periodic work uses `chrome.alarms` not `setInterval`

---

## Medallion Data Pipeline

```
webRequest.onCompleted
        │
        ▼
   Bronze Layer              ← raw insert, real-time
   (bronze_requests)         ← URL, method, status, timing, domain, tab
        │
        │  chrome.alarm: bronzeToSilver (every 2 min)
        ▼
   Silver Layer              ← enriched per-request metrics
   (silver_requests)         ← latency percentiles, error class, vitals join
        │
        │  chrome.alarm: dailyGoldProcessing (midnight)
        ▼
   Gold Layer                ← daily domain-level aggregates
   (gold_domain_daily)       ← p50/p95/p99, error rate, volume, size totals
        │
        │  chrome.alarm: dataCleanup (midnight)
        ▼
   Retention purge           ← deletes records older than configured period (default 30 days)
```

---

## Key Files

### Background (Service Worker)

| File | Role |
|------|------|
| `background/background.js` | Entry point. 10-step init: DB → auth → config → medallion → analytics → capture → feature-flags → message-handlers → periodic-tasks → ready |
| `background/database/db-manager-medallion.js` | OPFS init, sql.js loader, debounced save, onSuspend flush |
| `background/database/medallion-manager.js` | Bronze insert, Silver/Gold processing logic |
| `background/database/medallion-schema.js` | DDL for all Bronze/Silver/Gold tables and indexes |
| `background/database/analytics-processor.js` | Query engine for charts (time-series, percentiles, domain breakdown) |
| `background/capture/request-capture-integration.js` | webRequest listeners → Bronze; domain/type filtering |
| `background/capture/request-runner.js` | Execute request collections; assertion engine for QA |
| `background/capture/runner-collections.js` | CRUD for test suites and scheduled runs |
| `background/messaging/message-router.js` | Central dispatcher; also initializes requestRunner/runnerCollections with DB |
| `background/messaging/handlers/*.js` | 15 handlers: analytics, alerts, auth, collections, database, domain, export, medallion, query, requests, runners, settings, stats, ui, vitals |
| `config/feature-flags.js` | Flag singleton; broadcasts changes to content scripts via `chrome.storage.local` |
| `auth/acl-manager.js` | Local ACL gating (basic/pro) |

### Content Script

| File | Role |
|------|------|
| `content/content.js` | Page script. One `batchResourceTiming` IPC per page load. Vitals via PerformanceObserver. Event tracking gated by `eventTracking` flag (off by default). No response body reads. |

---

## Alarms

| Alarm name | Period | Purpose |
|------------|--------|---------|
| `bronzeToSilver` | every 2 min | Enrich raw captures into Silver |
| `dailyGoldProcessing` | midnight daily | Aggregate Silver into Gold |
| `dataCleanup` | midnight daily | Purge records older than retention period |
| `autoExport` | user-configured | Export data to file on schedule |

---

## Deleted Legacy (do not restore)

These were removed because they were either stubs, broken, or superseded:

- `background/database/db-manager.js` — legacy flat SQLite. Replaced by medallion DB.
- `background/database/schema.js`, `migrations.js` — legacy DDL/migrations. Replaced by `medallion-schema.js`.
- `background/config/config-manager.js` — replaced by `settings-manager-core.js` + `chrome.storage`.
- `background/api/` — Phase 2 cloud API stubs (never wired). Rewrite in Phase 2 branch.
- `background/auth/auth-manager.js`, `remote-auth-service.js` — cloud auth stubs. Local auth is `auth/local-auth-manager.js`.
- `background/sync/` — cloud sync stubs. Phase 2.
- `background/session/session-manager.js` — session tracking stub (never imported anywhere).
- `background/security/auth-security.js` — imported Node.js `crypto`, broken in browser context.
- `background/security/encryption-manager.js` — at-rest encryption, never wired in background init.
- `background/errors/error-manager.js` — had broken import (missing `.js`), never wired.
- `background/monitoring/error-monitor.js` — EventBus error tracking, never wired.
- `background/notifications/notification-manager.js` — background uses `chrome.notifications` directly.
- `background/messaging/message-handler.js`, `popup-message-handler.js` — replaced by `message-router.js` + handlers.
- `background/export/export-manager.js` — replaced by `messaging/handlers/export-handlers.js`.
- `background/messaging/handlers/insights-handlers.js` — merged into `analytics-handlers.js`.
- `background/capture/request-capture.js` — `PerformanceMetricsCollector` stub, never wired; `request-capture-integration.js` is the active capture module.
- `background/cleanup/cleanup-manager.js` — SW shutdown handled by `background.cleanup()`.
- `background/database/purge-manager.js` — auto-purge is now the `dataCleanup` alarm in `background.js`.
- `lib/core/DataManager.js`, `lib/managers/ExportManager.js`, `lib/ui/{BaseComponent,ChartManager,NotificationManager}.js`, `lib/index.js` — class wrappers, none imported by live code.
- `lib/utils/helpers.js` — `formatBytes/Duration/Timestamp`; each component has its own inline implementation.
- `lib/shared-components/pagination.js` — `PaginationManager`, not imported anywhere.
- `lib/sql-wasm.js`, `lib/sql-wasm.wasm` — duplicates; real WASM is at `assets/wasm/`.

---

## Build

```sh
npm run dev       # webpack watch + inline source maps
npm run build     # production bundle → dist/ + release/ura.zip
npm test          # jest
npm run lint      # eslint
```

Webpack entries: `popup`, `options`, `background`, `content`, `devtools`, `panel`.  
WASM, icons, fonts, and CSS copied via `CopyWebpackPlugin` (not bundled through module graph).  
CSS extracted into `styles.css` via `MiniCssExtractPlugin`.  
Production build also produces `release/ura.zip` via `ZipPlugin` for Chrome Web Store upload.

---

## Phase 2: Team Foundation (next)

Multi-tenant SaaS layer. Implement in a feature branch, not in `main` until ready to ship.

- JWT auth (Google OAuth / email magic-link)
- Workspace create/invite/join
- Cloud → extension config sync (capture presets, alert rules, runner collections)
- Extension → cloud Gold aggregate upload
- RBAC: admin / analyst / viewer
- Backend: Node/Bun + PostgreSQL with row-level security

## Phase 3: Full SaaS

- SSO (SAML/OIDC) for enterprise
- Bidirectional Silver sync (opt-in per workspace)
- Cross-member aggregate dashboards
- Webhook/Slack/email alerting
- CI mode: API-triggered runner execution

## Phase 4: SDK Platform

Browser snippet + server-side SDK feeding the same Bronze→Silver→Gold pipeline.

```js
// Browser
URA.identify('usr_42', { plan: 'pro' })
URA.track('checkout_started', { cart_total: 129 })
URA.page()

// Node.js
await ura.track({ userId: 'usr_42', event: 'subscription_created', props: { mrr: 49 } })
```

Multi-tenant data model:
```
tenant → workspace → member
                   → bronze_events (raw SDK events alongside bronze_requests)
                   → silver_events (session, funnel enrichment)
                   → gold_aggregates (DAU/WAU/MAU, funnels)
```
