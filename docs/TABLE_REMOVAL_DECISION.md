# Database Table Removal Decision

**Date:** December 29, 2025  
**Purpose:** Understand WHY each table was created before deciding what to remove

---

## Summary

| Status                                | Count | Action                      |
| ------------------------------------- | ----- | --------------------------- |
| ✅ **KEEP** - Actively Used           | 18    | No changes                  |
| ⚠️ **REVIEW** - Partial/Future Use    | 6     | Keep for now, may implement |
| ❌ **REMOVE** - Schema Only, No Usage | 10    | Safe to remove              |

---

## ✅ KEEP - Actively Used (18 tables)

### Config Schema (6 tables)

#### 1. config_app_settings

**Why Created:** Store ALL application settings in one place  
**Usage:** Settings Manager reads/writes constantly  
**Files:** settings-manager.js, config-schema-manager.js  
**Decision:** ✅ **KEEP** - Core infrastructure

#### 2. config_feature_flags

**Why Created:** Enable/disable features without code deployment  
**Usage:** Feature flag checks throughout codebase  
**Files:** feature-flags.js  
**Decision:** ✅ **KEEP** - Essential for gradual rollout

#### 3. config_extension

**Why Created:** Track extension version, installation ID  
**Usage:** Version checks, analytics tracking  
**Files:** background.js initialization  
**Decision:** ✅ **KEEP** - Extension metadata

#### 4. config_storage

**Why Created:** Configure max requests, auto-cleanup settings  
**Usage:** Cleanup manager uses these limits  
**Files:** cleanup-manager.js  
**Decision:** ✅ **KEEP** - Data retention logic

#### 5. config_runner_definitions

**Why Created:** Store saved request runners  
**Usage:** Full CRUD in Options → Runners tab  
**Files:** db-manager-medallion.js, runners.js  
**Decision:** ✅ **KEEP** - Fully implemented feature

#### 6. config_runner_requests

**Why Created:** Store individual requests within a runner  
**Usage:** Each runner has 1+ requests  
**Files:** db-manager-medallion.js, request-runner.js  
**Decision:** ✅ **KEEP** - Required for runners feature

### Bronze Schema (6 tables)

#### 7. bronze_requests

**Why Created:** Raw HTTP request capture (core feature)  
**Usage:** Captured every second via webRequest API  
**Files:** request-capture.js, medallion-manager.js  
**Decision:** ✅ **KEEP** - CORE FEATURE

#### 8. bronze_request_headers

**Why Created:** Store headers separately (JSON column in requests)  
**Usage:** Headers stored as JSON in bronze_requests  
**Files:** request-capture.js  
**Note:** Headers in JSON, not separate table  
**Decision:** ✅ **KEEP** - Used via JSON column

#### 9. bronze_request_bodies

**Why Created:** Store request/response bodies  
**Usage:** Bodies captured if enabled in settings  
**Files:** request-capture.js  
**Decision:** ✅ **KEEP** - Optional capture feature

#### 10. bronze_request_timings

**Why Created:** Navigation/Resource Timing API data  
**Usage:** Performance metrics captured  
**Files:** request-capture.js  
**Decision:** ✅ **KEEP** - Performance tracking

#### 11. bronze_errors

**Why Created:** Log errors to database  
**Usage:** Logger writes errors when persistErrors: true  
**Files:** logger.js, popup-message-handler.js  
**Decision:** ✅ **KEEP** - Just implemented logging feature

#### 12. bronze_runner_executions

**Why Created:** Track each runner execution  
**Usage:** Every runner run creates record  
**Files:** request-runner.js  
**Decision:** ✅ **KEEP** - Runner history

#### 13. bronze_runner_execution_results

**Why Created:** Store per-request results within execution  
**Usage:** Each request in runner stores result  
**Files:** request-runner.js  
**Decision:** ✅ **KEEP** - Detailed runner results

### Silver Schema (5 tables)

#### 14. silver_requests

**Why Created:** Cleaned, validated requests (medallion pipeline)  
**Usage:** Bronze → Silver transformation  
**Files:** medallion-manager.js, analytics-processor.js  
**Decision:** ✅ **KEEP** - Medallion architecture

#### 15. silver_request_metrics

**Why Created:** Calculated metrics (duration, size, etc)  
**Usage:** Derived from silver_requests  
**Files:** analytics-processor.js  
**Decision:** ✅ **KEEP** - Performance analytics

#### 16. silver_domain_stats

**Why Created:** Per-domain aggregations  
**Usage:** Dashboard domain breakdown  
**Files:** analytics-processor.js, dashboard.js  
**Decision:** ✅ **KEEP** - Dashboard feature

#### 17. silver_resource_stats

**Why Created:** Per-resource-type aggregations  
**Usage:** Dashboard resource breakdown  
**Files:** analytics-processor.js, dashboard.js  
**Decision:** ✅ **KEEP** - Dashboard feature

#### 18. silver_hourly_stats

**Why Created:** Time-series hourly aggregations  
**Usage:** Dashboard charts  
**Files:** analytics-processor.js, dashboard.js  
**Decision:** ✅ **KEEP** - Dashboard charts

### Gold Schema (1 table)

#### 19. gold_daily_analytics

**Why Created:** Daily rollup for long-term trends  
**Usage:** Historical analytics  
**Files:** analytics-processor.js  
**Decision:** ✅ **KEEP** - Long-term trends

---

## ⚠️ REVIEW - Partial/Future Use (6 tables)

### 20. config_user_preferences

**Why Created:** User-specific preferences (theme, language, etc)  
**Current Status:** Schema exists, but preferences stored in config_app_settings  
**Usage:** Duplicate functionality - settings-manager handles this  
**Files:** settings-manager.js uses config_app_settings instead  
**Issue:** Redundant with config_app_settings  
**Decision:** ⚠️ **REMOVE OR MIGRATE** - Duplicate functionality

### 21. config_performance

**Why Created:** Performance capture settings  
**Current Status:** Schema only, no UI  
**Usage:** Would control bronze_performance_entries capture  
**Files:** None yet  
**Issue:** Feature not implemented  
**Decision:** ⚠️ **KEEP** - May implement performance monitoring UI later

### 22. config_export

**Why Created:** Export format preferences  
**Current Status:** Schema only  
**Usage:** Export handled by settings-manager instead  
**Files:** None - export uses settings-manager  
**Issue:** Duplicate functionality  
**Decision:** ⚠️ **REMOVE** - Duplicate functionality

### 23. config_runner_collections

**Why Created:** Group runners into collections  
**Current Status:** ✅ **JUST IMPLEMENTED** in this session  
**Usage:** Collections UI in Options page  
**Files:** runner-collections.js, db-manager-medallion.js  
**Issue:** Still needs scheduled runs migration  
**Decision:** ✅ **KEEP** - Just implemented!

### 24. bronze_web_vitals

**Why Created:** Capture Core Web Vitals (LCP, FID, CLS)  
**Current Status:** Schema only, content script not implemented  
**Usage:** Would track performance metrics  
**Files:** Schema exists, but no content script injecting data  
**Issue:** Feature not implemented  
**Decision:** ⚠️ **KEEP** - Valuable future feature

### 25. bronze_sessions

**Why Created:** Track user browsing sessions  
**Current Status:** Schema only  
**Usage:** Would track tabs, navigation, time on site  
**Files:** None yet  
**Issue:** Single-user extension, sessions less useful  
**Decision:** ⚠️ **REMOVE** - Not useful for single-user extension

---

## ❌ REMOVE - Schema Only, No Usage (10 tables)

### Bronze Schema (2 tables)

#### 26. bronze_performance_entries

**Why Created:** Capture PerformanceObserver entries  
**Current Status:** Schema only, never written to  
**Usage:** None - performance data in bronze_request_timings  
**Files:** None  
**Reason:** Duplicate of bronze_request_timings  
**Decision:** ❌ **REMOVE** - Unused

#### 27. bronze_events

**Why Created:** Generic event logging  
**Current Status:** Schema only  
**Usage:** None - errors use bronze_errors instead  
**Files:** None  
**Reason:** Too generic, covered by bronze_errors  
**Decision:** ❌ **REMOVE** - Unused

### Silver Schema (2 tables)

#### 28. silver_tags

**Why Created:** User-defined request tags  
**Current Status:** Schema only, no UI  
**Usage:** Would allow tagging requests for organization  
**Files:** None yet  
**Reason:** Feature not prioritized  
**Decision:** ❌ **REMOVE** - Can add later if needed

#### 29. silver_request_tags

**Why Created:** Junction table for request-tag relationships  
**Current Status:** Schema only, depends on silver_tags  
**Usage:** Would link requests to tags  
**Files:** None yet  
**Reason:** Depends on silver_tags (also unused)  
**Decision:** ❌ **REMOVE** - Depends on unused feature

### Gold Schema (4 tables)

#### 30. gold_performance_insights

**Why Created:** AI/ML performance insights  
**Current Status:** Schema only, very ambitious  
**Usage:** Would analyze patterns and suggest optimizations  
**Files:** None yet  
**Reason:** Advanced feature, not prioritized  
**Decision:** ❌ **REMOVE** - Too ambitious for v1

#### 31. gold_optimization_opportunities

**Why Created:** Suggest performance optimizations  
**Current Status:** Schema only  
**Usage:** Would find slow endpoints, large payloads  
**Files:** None yet  
**Reason:** Advanced feature, not prioritized  
**Decision:** ❌ **REMOVE** - Too ambitious for v1

#### 32. gold_trends

**Why Created:** Detect trends over time  
**Current Status:** Schema only  
**Usage:** Would find increasing/decreasing metrics  
**Files:** None yet  
**Reason:** gold_daily_analytics sufficient for trends  
**Decision:** ❌ **REMOVE** - Covered by gold_daily_analytics

#### 33. gold_anomalies

**Why Created:** Anomaly detection  
**Current Status:** Schema only  
**Usage:** Would find unusual spikes/drops  
**Files:** None yet  
**Reason:** Advanced ML feature  
**Decision:** ❌ **REMOVE** - Too ambitious for v1

### Queues (2 tables)

#### 34. analytics_queue

**Why Created:** Queue for async analytics processing  
**Current Status:** Schema only  
**Usage:** Would batch-process analytics  
**Files:** None - analytics-processor.js processes synchronously  
**Reason:** Synchronous processing works fine  
**Decision:** ❌ **REMOVE** - Not needed

#### 35. sync_queue

**Why Created:** Cloud sync queue  
**Current Status:** Schema only  
**Usage:** Would queue changes for sync to cloud  
**Files:** None - cloud sync not implemented  
**Reason:** Cloud sync feature not implemented  
**Decision:** ❌ **REMOVE** - Feature not implemented

---

## Action Plan

### Phase 1: Fix runner-collections.js (PRIORITY)

**Issue:** scheduledRuns still uses chrome.storage  
**Fix:** Create config_runner_scheduled_runs table  
**File:** src/background/capture/runner-collections.js

```javascript
// Current (WRONG):
const data = await storage.get(["scheduledRuns"]);
this.scheduledRuns = data.scheduledRuns || [];

// Change to (RIGHT):
this.scheduledRuns = await this.dbManager.scheduledRun.getScheduledRuns();
```

### Phase 2: Remove Unused Tables

**Remove from medallion-schema.js:**

❌ **Definitely Remove (10 tables):**

- bronze_performance_entries
- bronze_events
- silver_tags
- silver_request_tags
- gold_performance_insights
- gold_optimization_opportunities
- gold_trends
- gold_anomalies
- analytics_queue
- sync_queue

⚠️ **Review Before Removing (3 tables):**

- config_user_preferences - Migrate to config_app_settings first
- config_export - Verify not used anywhere
- bronze_sessions - Confirm not needed

✅ **Keep for Future (3 tables):**

- config_performance - Performance UI may be added
- bronze_web_vitals - Valuable performance metrics
- config_runner_collections - Just implemented!

---

## Final Count

**Current:** 35 tables  
**Remove:** 10 tables (schema only, no usage)  
**Review:** 3 tables (may remove after verification)  
**Keep:** 22 tables (18 active + 4 future features)

**After cleanup:** 22-25 tables (depending on review)

---

## Notes

1. **Don't drop tables in production** - Just remove from schema creation
2. **Tables exist but empty** - Safe to not create them anymore
3. **Future tables** - config_performance, bronze_web_vitals can be added later when features implemented
4. **Scheduled runs** - Need to implement table for this feature
