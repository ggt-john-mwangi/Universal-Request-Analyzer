# Universal Request Analyzer - Implementation Plan

**Date:** December 27, 2025  
**Status:** Planning Phase  
**Estimated Timeline:** 8-12 weeks

---

## Overview

This document outlines a phased approach to resolve outstanding issues and architectural violations in the Universal Request Analyzer extension. The plan addresses both immediate bugs and long-term architectural improvements.

---

## Priority Matrix

| Priority  | Category                                 | Impact | Effort      |
| --------- | ---------------------------------------- | ------ | ----------- |
| 🔴 **P0** | Critical bugs & architectural violations | High   | Medium-High |
| 🟠 **P1** | Feature completeness & UX issues         | High   | Medium      |
| 🟡 **P2** | Performance & optimization               | Medium | Low-Medium  |
| 🟢 **P3** | Nice-to-have enhancements                | Low    | Variable    |

---

## Phase 1: Architecture & Foundation (Weeks 1-3)

### 🔴 P0: Fix Separation of Concerns Violations

**Objective:** Eliminate service worker crashes caused by UI dependencies in background code.

#### Task 1.1: Split settings-manager

**Complexity:** High  
**Dependencies:** None  
**Estimated Time:** 3-4 days

**Action Items:**

- [ ] Create `settings-manager-core.js` (background-safe)
  - Database operations only
  - No UI dependencies
  - Theme preference storage (string value only)
  - Feature flag coordination
- [ ] Create `settings-ui-coordinator.js` (UI wrapper)
  - Imports core + theme-manager
  - Handles UI-specific settings
  - Coordinates between core and UI managers
- [ ] Update all background imports to use `settings-manager-core.js`
  - `background-medallion.js`
  - `popup-message-handler.js`
  - All message handlers
- [ ] Update all UI imports to use `settings-ui-coordinator.js`
  - Options page
  - Popup
  - DevTools panel
- [ ] Add integration tests for both contexts

**Files to Modify:**

```
src/lib/shared-components/
  ├── settings-manager-core.js (new)
  └── settings-ui-coordinator.js (new, replaces settings-manager.js)
src/background/messaging/popup-message-handler.js
src/background/background-medallion.js
src/options/js/options-main.js
src/popup/popup.js
src/devtools/js/panel.js
```

#### Task 1.2: Create Context Detection Utility

**Complexity:** Low  
**Dependencies:** None  
**Estimated Time:** 1 day

**Action Items:**

- [ ] Create `src/lib/utils/context-detector.js`
- [ ] Export functions:
  ```javascript
  isServiceWorker();
  isBrowserContext();
  hasDOM();
  hasLocalStorage();
  hasChromeStorage();
  ```
- [ ] Use in all conditional imports/initializations
- [ ] Add unit tests

#### Task 1.3: Refactor theme-manager (UI-only)

**Complexity:** Medium  
**Dependencies:** Task 1.1  
**Estimated Time:** 2 days

**Action Items:**

- [ ] Remove all localStorage fallbacks
- [ ] Assume DOM is always available (throw if not)
- [ ] Read theme preference from `chrome.storage.local` (set by settings-core)
- [ ] Move to `src/lib/ui/theme-manager.js`
- [ ] Remove import from settings-manager-core
- [ ] Update UI coordinator to import it
- [ ] Add "theme changed" listener to sync from storage

#### Task 1.4: Refactor feature-flags (Remove localStorage)

**Complexity:** Low  
**Dependencies:** Task 1.2  
**Estimated Time:** 1 day

**Action Items:**

- [ ] Remove all localStorage fallback code
- [ ] Use chrome.storage.local exclusively
- [ ] Add context detection for error handling
- [ ] Update tests

#### Task 1.5: Refactor acl-manager (Remove localStorage)

**Complexity:** Low  
**Dependencies:** Task 1.2  
**Estimated Time:** 1 day

**Action Items:**

- [ ] Remove localStorage mock mode
- [ ] Use chrome.storage.local for mock data
- [ ] Add context detection
- [ ] Update tests

#### Task 1.6: Reorganize Library Structure

**Complexity:** Medium  
**Dependencies:** Tasks 1.1-1.5  
**Estimated Time:** 2 days

**Action Items:**

- [ ] Create new directory structure:
  ```
  src/lib/
    ├── shared/          # True context-independent code
    │   ├── constants.js
    │   ├── types.js
    │   └── pure-utils.js
    ├── ui/              # Browser DOM required
    │   ├── theme-manager.js
    │   ├── ui-utils.js
    │   └── dom-helpers.js
    ├── background/      # Service worker utilities
    │   ├── db-utils.js
    │   └── worker-utils.js
    └── utils/           # Context-aware utilities
        └── context-detector.js
  ```
- [ ] Move files to appropriate directories
- [ ] Update all import paths
- [ ] Update webpack config if needed
- [ ] Run full test suite

**Deliverables:**

- ✅ No service worker crashes
- ✅ Clean separation between UI and background code
- ✅ All tests passing
- ✅ Clear architectural boundaries

---

## Phase 2: Core Features & UX (Weeks 4-6)

### 🟠 P1: Runners - Fix Duplicate Creation & Enhance UI

**Objective:** Fix runner creation bug and improve runner management UX.

#### Task 2.1: Fix Duplicate Runner Creation

**Complexity:** Medium  
**Dependencies:** Phase 1 complete  
**Estimated Time:** 1-2 days

**Action Items:**

- [ ] Add creation guard flag to prevent double-clicks
- [ ] Add transaction isolation for runner creation
- [ ] Verify no duplicate entries in `getRunners` query
- [ ] Add loading state during creation
- [ ] Add console logging for debugging
- [ ] Test rapid clicking scenarios

**Current Issue:** Two cards appear when creating a runner, one with 0 requests.

**Root Cause Investigation:**

- [ ] Check if wizard "Create" button handler is called twice
- [ ] Check if `loadRunners()` is called multiple times in quick succession
- [ ] Verify database INSERT doesn't create duplicates
- [ ] Check if auto-refresh interval conflicts with manual reload

#### Task 2.2: Implement Runner Pagination

**Complexity:** Medium  
**Dependencies:** Task 2.1  
**Estimated Time:** 2-3 days

**Action Items:**

- [ ] Extract pagination component from Dashboard → Requests Table
- [ ] Create `src/lib/shared-components/pagination.js`
- [ ] Add to runners.js:
  ```javascript
  - Page size selector (10, 25, 50, 100)
  - Page navigation (prev/next, page numbers)
  - Total count display
  - Jump to page input
  ```
- [ ] Update backend `getRunners` to support:
  - `offset` parameter
  - `limit` parameter
  - Return `total` count
- [ ] Update UI to show "Showing X-Y of Z runners"

#### Task 2.3: Implement Runner Search (DB-backed)

**Complexity:** Medium  
**Dependencies:** Task 2.2  
**Estimated Time:** 2 days

**Action Items:**

- [ ] Add search input to runners page
- [ ] Update backend `getRunners` to support:
  - `searchQuery` parameter
  - Search across: name, description, domain
- [ ] Use SQL `LIKE` with proper escaping
- [ ] Debounce search input (300ms)
- [ ] Show "No results" state
- [ ] Clear search button

#### Task 2.4: Show Runner Variables

**Complexity:** Low  
**Dependencies:** None  
**Estimated Time:** 1 day

**Action Items:**

- [ ] Add variables section to runner card
- [ ] Show variable count badge
- [ ] Expand to show variable list on click
- [ ] Format: `{{variableName}}` with value preview
- [ ] Add edit variables quick action

#### Task 2.5: Fix Runner Card Theming

**Complexity:** Low  
**Dependencies:** Phase 1 complete  
**Estimated Time:** 1 day

**Action Items:**

- [ ] Remove hardcoded backgrounds
- [ ] Use CSS variables consistently
- [ ] Fix transparency issues
- [ ] Test in all themes (light, dark, high contrast)
- [ ] Ensure proper contrast ratios

### 🟠 P1: Dashboard - Fix Visualizations

**Objective:** Fix dashboard display issues and enforce proper page/domain context.

#### Task 2.6: Fix Page vs Domain Context

**Complexity:** Medium  
**Dependencies:** None  
**Estimated Time:** 2-3 days

**Action Items:**

- [ ] Enforce rule: **No aggregation without page selection**
- [ ] Update visualizations to show:
  - Page-only metrics when page selected
  - Domain summary when only domain selected
  - "Select a page to view detailed metrics" message
- [ ] Page-only visualizations:
  - [ ] Core Web Vitals
  - [ ] Request Volume Over Time
  - [ ] Performance Trends
  - [ ] Response Time Percentiles
- [ ] Domain-only visualizations:
  - [ ] Domain summary stats
  - [ ] Request type distribution
  - [ ] Status code distribution
- [ ] Add clear UI indicator of current context

#### Task 2.7: Link Visualizations to "Enable Plots" Setting

**Complexity:** Low  
**Dependencies:** Phase 1 complete  
**Estimated Time:** 1 day

**Action Items:**

- [ ] Verify all charts check `settings.visualizations.enablePlots`
- [ ] Show message when disabled: "Visualizations disabled in settings"
- [ ] Add quick link to enable in General → Visualizations
- [ ] Document which setting controls which visualization

#### Task 2.8: Core Web Vitals Per-Page Trends

**Complexity:** High  
**Dependencies:** Task 2.6  
**Estimated Time:** 3-4 days

**Action Items:**

- [ ] Design database schema for CWV storage
  - Table: `cwv_metrics` (page_url, metric_name, value, timestamp)
- [ ] Capture CWV from content scripts
  - LCP (Largest Contentful Paint)
  - FID (First Input Delay) / INP (Interaction to Next Paint)
  - CLS (Cumulative Layout Shift)
- [ ] Store in Silver layer
- [ ] Create aggregation for trends over time
- [ ] Build UI component:
  - [ ] Metric value cards
  - [ ] Embedded mini time-series chart
  - [ ] Icon to open detailed modal
  - [ ] Historical comparison (vs previous period)
- [ ] Add threshold indicators (good/needs improvement/poor)

#### Task 2.9: Fix XHR vs Fetch Handling

**Complexity:** Medium  
**Dependencies:** None  
**Estimated Time:** 2 days

**Action Items:**

- [ ] Document differences in capture:
  - XHR: captured via content script hook
  - Fetch: captured via webRequest API in background
- [ ] Ensure both are tagged correctly in database (`request_type`)
- [ ] Verify both show in visualizations
- [ ] Add filter to toggle XHR/Fetch display
- [ ] Document in architecture guide

---

## Phase 3: Export & Data Management (Weeks 7-8)

### 🟠 P1: Export Functionality

**Objective:** Complete export feature with all formats and auto-export.

#### Task 3.1: Implement SQLite Export

**Complexity:** Medium  
**Dependencies:** None  
**Estimated Time:** 2-3 days

**Action Items:**

- [ ] Use SQL.js to export database to binary .sqlite file
- [ ] Add to export manager:
  ```javascript
  exportToSQLite(options: {
    tables: string[],  // which tables to include
    filters: object    // date range, domain filter, etc.
  })
  ```
- [ ] Show progress indicator for large databases
- [ ] Trigger browser download with proper filename
  - Format: `URA_Export_YYYY-MM-DD_HHmmss.sqlite`

#### Task 3.2: Implement JSON Export

**Complexity:** Low  
**Dependencies:** None  
**Estimated Time:** 1-2 days

**Action Items:**

- [ ] Structure: `{ database: { tableName: [rows...] } }`
- [ ] Each table → JSON object with array of row objects
- [ ] Handle large datasets (streaming if needed)
- [ ] Add to export manager
- [ ] Format filename: `URA_Export_YYYY-MM-DD_HHmmss.json`

#### Task 3.3: Implement CSV Export

**Complexity:** Low  
**Dependencies:** None  
**Estimated Time:** 1-2 days

**Action Items:**

- [ ] One CSV file per table
- [ ] Naming convention: `tableName_YYYY-MM-DD_HHmmss.csv`
- [ ] Package multiple CSVs into ZIP file
- [ ] Add to export manager
- [ ] Handle special characters (commas, quotes, newlines)

#### Task 3.4: Export Configuration Schema

**Complexity:** Medium  
**Dependencies:** Tasks 3.1-3.3  
**Estimated Time:** 2 days

**Action Items:**

- [ ] Define config schema:
  ```javascript
  exportConfig: {
    format: "sqlite" | "json" | "csv",
    scope: {
      tables: string[],
      profiles: string[],
      dateRange: { start, end },
      domains: string[]
    },
    location: string,  // default or custom
    compression: boolean
  }
  ```
- [ ] Store in `config_app_settings`
- [ ] Add UI for configuration in Options → Export
- [ ] Validate configuration before export

#### Task 3.5: Auto Export Implementation

**Complexity:** High  
**Dependencies:** Tasks 3.1-3.4  
**Estimated Time:** 3-4 days

**Action Items:**

- [ ] Add auto-export settings:
  ```javascript
  autoExport: {
    enabled: boolean,
    frequency: "daily" | "weekly" | "monthly",
    format: string,
    scope: object,
    location: string,
    maxBackups: number
  }
  ```
- [ ] Implement scheduler in background worker
  - Use `chrome.alarms` API for scheduling
- [ ] Handle export location:
  - Default: browser download folder
  - Custom: request persistent storage permission
  - Validate permissions before enabling
- [ ] Rotation: keep only last N backups
- [ ] Notification on successful export
- [ ] Error handling and retry logic

---

## Phase 4: Settings & Configuration (Week 9)

### 🟠 P1: Theme Persistence & UX

**Objective:** Fix theme reset bug and improve theme management UX.

#### Task 4.1: Fix Theme Persistence

**Complexity:** Medium  
**Dependencies:** Phase 1 complete  
**Estimated Time:** 2 days

**Action Items:**

- [ ] Verify theme save flow:
  1. User selects theme in UI
  2. Theme-manager applies to current page
  3. Preference saved to `chrome.storage.local`
  4. Settings-core syncs to database
- [ ] Fix reload issue:
  - [ ] All surfaces (options, popup, panel) read from storage on init
  - [ ] Apply theme before rendering content
  - [ ] Listen for storage changes to sync across tabs
- [ ] Add loading state to prevent FOUC (Flash of Unstyled Content)
- [ ] Test:
  - [ ] Theme persists across extension reload
  - [ ] Theme persists across browser restart
  - [ ] Theme syncs across all extension pages

#### Task 4.2: Theme Management UX Decision

**Complexity:** Low  
**Dependencies:** Task 4.1  
**Estimated Time:** 1 day

**Decision Required:** Global "Save" button vs per-theme "Apply" button

**Option A: Per-Theme Apply Button**

- Pros: Immediate feedback, no accidental changes
- Cons: Extra click, less discoverable

**Option B: Global Save Button**

- Pros: Standard UX pattern, clear save action
- Cons: User might preview and forget to save

**Recommendation:** Option A - Per-theme "Apply" button with auto-save

**Action Items:**

- [ ] Implement chosen UX pattern
- [ ] Add "Currently Applied: Theme Name" indicator
- [ ] Add preview mode (optional)
- [ ] Add reset to default option

### 🟠 P1: General Settings - Tracking Logic

**Objective:** Fix tracking configuration and enforce consistent behavior.

#### Task 4.3: "Track ONLY Configured Sites" Logic

**Complexity:** Medium  
**Dependencies:** Phase 1 complete  
**Estimated Time:** 2-3 days

**Action Items:**

- [ ] Enforce rules:

  ```
  If "Track ONLY configured" is ENABLED:
    - If NO sites configured → track NOTHING
    - If sites configured → track ONLY those sites

  If "Track ONLY configured" is DISABLED:
    - If NO sites configured → track ALL sites (except excluded)
    - If sites configured → track ALL except excluded
  ```

- [ ] Update capture logic in background/capture/
- [ ] Update content script injection rules
- [ ] Add clear UI explanation of current behavior
- [ ] Add warning when enabled with no sites configured
- [ ] Test all combinations

#### Task 4.4: Fix Quick Site Presets - Prevent Duplicates

**Complexity:** Low  
**Dependencies:** None  
**Estimated Time:** 1 day

**Action Items:**

- [ ] Add duplicate check before adding site
- [ ] Disable "Add Current Tab" button if already added
- [ ] Show message: "This site is already in your list"
- [ ] Enforce exclusion rules:
  - [ ] Extension URLs (chrome-extension://, moz-extension://)
  - [ ] Browser default pages (chrome://, about:, edge://)
  - [ ] Invalid URLs
- [ ] Apply exclusion in:
  - [ ] Settings UI input validation
  - [ ] Capture logic
  - [ ] Quick add button

#### Task 4.5: Harmonize General Settings

**Complexity:** High  
**Dependencies:** Tasks 4.3-4.4, Phase 1  
**Estimated Time:** 3 days

**Action Items:**

- [ ] Audit all General settings
- [ ] Document which settings control:
  - Content script behavior
  - Capture logic (background)
  - Visualization display (options/popup/panel)
- [ ] Ensure settings flow correctly:
  ```
  User changes setting in UI
    ↓
  Settings-UI-Coordinator saves
    ↓
  Settings-Core syncs to DB + storage
    ↓
  Background worker reads from storage
    ↓
  Content scripts read from storage
    ↓
  Behavior changes immediately (or on next page load)
  ```
- [ ] Add setting change listeners where needed
- [ ] Test all setting combinations

---

## Phase 5: Data Management & Cleanup (Week 10)

### 🟡 P2: Cleanup & Database Maintenance

**Objective:** Fix data management panel inconsistencies and improve cleanup preview.

#### Task 5.1: Fix Database Size & Count Mismatches

**Complexity:** Medium  
**Dependencies:** None  
**Estimated Time:** 2-3 days

**Action Items:**

- [ ] Audit size calculation methods
- [ ] Verify Bronze/Silver/Gold counts:
  ```sql
  SELECT COUNT(*) FROM bronze_requests;
  SELECT COUNT(*) FROM silver_requests;
  SELECT COUNT(*) FROM gold_domain_stats;
  ```
- [ ] Fix discrepancies between displayed and actual counts
- [ ] Add cache invalidation when data changes
- [ ] Show timestamp of last calculation
- [ ] Add manual refresh button

#### Task 5.2: Improve Cleanup Preview

**Complexity:** Medium  
**Dependencies:** Task 5.1  
**Estimated Time:** 2 days

**Action Items:**

- [ ] Show accurate table counts:
  - Before cleanup count
  - After cleanup estimate
  - Size reduction estimate
- [ ] List which tables will be affected
- [ ] Show what will be kept vs deleted
- [ ] Add dry-run mode for preview
- [ ] Track backup creation:
  - List all backups with dates
  - Show backup sizes
  - Add restore option
  - Add backup deletion option

#### Task 5.3: Table Usage Tracking

**Complexity:** Low  
**Dependencies:** None  
**Estimated Time:** 1 day

**Action Items:**

- [ ] Add metadata table: `table_usage_tracking`
  ```sql
  CREATE TABLE table_usage_tracking (
    table_name TEXT PRIMARY KEY,
    last_read_at INTEGER,
    last_write_at INTEGER,
    read_count INTEGER,
    write_count INTEGER,
    purpose TEXT
  );
  ```
- [ ] Update on every read/write
- [ ] Show in Data Management panel:
  - Table name
  - Purpose/description
  - Last accessed
  - Row count
  - Size
  - Status (active/deprecated)

---

## Phase 6: Security & Profiles (Week 11)

### 🟢 P3: Security Menu

**Objective:** Finalize security settings scope.

#### Task 6.1: Define Security Menu Scope

**Complexity:** Low  
**Dependencies:** Phase 1 complete  
**Estimated Time:** 1 day

**Action Items:**

- [ ] Review current security settings
- [ ] Determine which settings belong in Security vs General
- [ ] Document security-related features:
  - ACL (Access Control List)
  - Encryption settings
  - Cloud sync security
  - API authentication
- [ ] Align with profiles architecture
- [ ] Remove redundant settings

### 🟢 P3: Settings Profiles (Future-Facing)

**Objective:** Prepare architecture for cloud-driven profiles.

#### Task 6.2: Profiles Architecture Design

**Complexity:** High  
**Dependencies:** Phase 1 complete  
**Estimated Time:** 3-4 days (design only, no implementation)

**Action Items:**

- [ ] Document profile system design:
  ```
  Company Tenant
    ├── Team 1
    │   ├── Profile: Project A
    │   └── Profile: Project B
    └── Team 2
        └── Profile: Project C
  ```
- [ ] Define profile schema:
  ```javascript
  profile: {
    id: string,
    name: string,
    teamId: string,
    tenantId: string,
    trackingRules: {
      domains: string[],
      thresholds: object,
      metrics: string[]
    },
    authTokens: object,
    featureFlags: object
  }
  ```
- [ ] Document priority: Profiles > General Settings
- [ ] Design SDK-style integration (Sentry-like)
- [ ] Document regional/location-based tracking
- [ ] Plan threshold-based capture

**Note:** Implementation deferred to future release.

---

## Phase 7: Testing & Documentation (Week 12)

### 🟡 P2: Comprehensive Testing

**Objective:** Ensure all fixes are stable and well-tested.

#### Task 7.1: Unit Tests

**Complexity:** High  
**Dependencies:** All phases  
**Estimated Time:** 3-4 days

**Action Items:**

- [ ] Test coverage for all new modules
- [ ] Context-specific tests (service worker vs browser)
- [ ] Test settings-manager-core in isolation
- [ ] Test theme-manager with DOM mocks
- [ ] Test export functionality
- [ ] Test cleanup operations
- [ ] Achieve 80%+ code coverage

#### Task 7.2: Integration Tests

**Complexity:** High  
**Dependencies:** Task 7.1  
**Estimated Time:** 2-3 days

**Action Items:**

- [ ] Test message passing between contexts
- [ ] Test settings sync across surfaces
- [ ] Test runner creation/execution flow
- [ ] Test export formats
- [ ] Test cleanup with backups
- [ ] Test theme persistence across reloads

#### Task 7.3: End-to-End Tests

**Complexity:** Medium  
**Dependencies:** Task 7.2  
**Estimated Time:** 2 days

**Action Items:**

- [ ] Test complete user flows:
  - Install extension → configure → capture → view → export
  - Create runner → execute → view results
  - Change settings → verify behavior changes
  - Switch themes → verify persistence
  - Cleanup data → verify backup → restore

#### Task 7.4: Browser Compatibility Testing

**Complexity:** Medium  
**Dependencies:** All testing complete  
**Estimated Time:** 2 days

**Action Items:**

- [ ] Test in Chrome (latest + 2 previous versions)
- [ ] Test in Firefox (latest + 2 previous versions)
- [ ] Test in Edge (latest)
- [ ] Document any browser-specific issues
- [ ] Fix compatibility issues if found

### 🟡 P2: Documentation Updates

**Objective:** Keep documentation in sync with code changes.

#### Task 7.5: Update Architecture Documentation

**Complexity:** Low  
**Dependencies:** Phase 1 complete  
**Estimated Time:** 2 days

**Action Items:**

- [ ] Update ARCHITECTURE.md with new structure
- [ ] Update COPILOT_ARCHITECTURE_GUIDE.md
- [ ] Document settings-manager split
- [ ] Document context detection patterns
- [ ] Update file organization docs
- [ ] Add architecture diagrams

#### Task 7.6: Update User-Facing Documentation

**Complexity:** Low  
**Dependencies:** Phases 2-6 complete  
**Estimated Time:** 2 days

**Action Items:**

- [ ] Update USER_GUIDE.md
- [ ] Document new export features
- [ ] Document runner improvements
- [ ] Document dashboard features
- [ ] Document cleanup process
- [ ] Add screenshots/videos

#### Task 7.7: Update Development Documentation

**Complexity:** Low  
**Dependencies:** All phases  
**Estimated Time:** 1 day

**Action Items:**

- [ ] Update DEVELOPMENT.md
- [ ] Document new testing procedures
- [ ] Update contribution guidelines
- [ ] Document context-aware development patterns
- [ ] Add troubleshooting guide

---

## Risk Assessment & Mitigation

### High-Risk Items

| Risk                                                 | Impact | Likelihood | Mitigation                                                |
| ---------------------------------------------------- | ------ | ---------- | --------------------------------------------------------- |
| Settings-manager split breaks existing functionality | High   | Medium     | Comprehensive testing, gradual rollout, feature flags     |
| Export on large databases times out                  | Medium | High       | Implement streaming, show progress, add size limits       |
| Theme persistence breaks across browsers             | Medium | Medium     | Browser-specific testing, fallback mechanisms             |
| Database migration causes data loss                  | High   | Low        | Backup before migration, rollback plan, extensive testing |
| Runner duplicate creation persists                   | Low    | Medium     | Add transaction isolation, thorough debugging             |

### Dependencies

```
Phase 1 (Architecture) → BLOCKS → Phase 2, 4, 5, 6
Phase 2 (Features) → BLOCKS → Phase 7 (Testing)
Phase 3 (Export) → Independent (can run in parallel)
Phase 4 (Settings) → REQUIRES → Phase 1
Phase 5 (Cleanup) → Independent (can run in parallel)
Phase 6 (Profiles) → Design only, no blocking
Phase 7 (Testing) → REQUIRES → All phases
```

### Critical Path

```
Phase 1 (Architecture fixes)
  → Phase 4 (Settings harmonization)
    → Phase 2 (Runner & dashboard fixes)
      → Phase 7 (Testing & docs)
```

---

## Success Criteria

### Phase 1

- ✅ Zero service worker crashes
- ✅ All tests passing in both contexts
- ✅ Clean import paths (no UI in background)

### Phase 2

- ✅ No duplicate runner creation
- ✅ Pagination working with 1000+ runners
- ✅ Dashboard visualizations respect context
- ✅ Core Web Vitals tracking active

### Phase 3

- ✅ All export formats working
- ✅ Auto-export running on schedule
- ✅ No data loss during export

### Phase 4

- ✅ Theme persists across restarts
- ✅ Tracking logic behaves correctly in all modes
- ✅ No duplicate sites in quick presets

### Phase 5

- ✅ Accurate database size reporting
- ✅ Cleanup preview shows correct counts
- ✅ Backups created and restorable

### Phase 6

- ✅ Security menu scope documented
- ✅ Profile architecture designed (no implementation)

### Phase 7

- ✅ 80%+ test coverage
- ✅ All documentation updated
- ✅ Extension works in all supported browsers

---

## Post-Implementation

### Monitoring

- [ ] Set up error tracking (Sentry or similar)
- [ ] Monitor extension performance metrics
- [ ] Track user adoption of new features
- [ ] Collect feedback on UX improvements

### Future Enhancements (Not in this plan)

- Profile system implementation
- SDK-style integration
- Real-time collaboration features
- Advanced analytics
- Machine learning for anomaly detection

---

## Timeline Summary

| Phase                 | Duration | Dependencies | Can Start         |
| --------------------- | -------- | ------------ | ----------------- |
| Phase 1: Architecture | 3 weeks  | None         | Immediately       |
| Phase 2: Features     | 3 weeks  | Phase 1      | Week 4            |
| Phase 3: Export       | 2 weeks  | None         | Week 4 (parallel) |
| Phase 4: Settings     | 1 week   | Phase 1      | Week 7            |
| Phase 5: Cleanup      | 1 week   | None         | Week 8 (parallel) |
| Phase 6: Profiles     | 1 week   | Phase 1      | Week 9 (parallel) |
| Phase 7: Testing      | 1 week   | All phases   | Week 11           |

**Total Duration:** 12 weeks (3 months)  
**With parallel execution:** 8-10 weeks realistic

---

## Next Steps

1. **Review & approve** this plan
2. **Prioritize** any phases that need to move up/down
3. **Assign resources** (developers, testers, reviewers)
4. **Set up tracking** (GitHub Projects, Jira, etc.)
5. **Begin Phase 1** - Architecture fixes
6. **Schedule weekly check-ins** to track progress

---

**Document Version:** 1.0  
**Last Updated:** December 27, 2025  
**Next Review:** Start of each phase
